import { BasicPitch } from "@spotify/basic-pitch";
import { NOTE_NAMES_PT } from "./hooks/useNoteNames";

class NoteDetector {
  constructor() {
    this.basicPitch = null;
    this.TARGET_SAMPLE_RATE = 22050;
  }

  async initBasicPitch(setStatus) {
    try {
      setStatus('status.modelLoading', 'processing');

      this.basicPitch = null;

      this.basicPitch = new BasicPitch(
        "https://unpkg.com/@spotify/basic-pitch@1.0.1/model/model.json"
      );

      setStatus('status.modelTesting', 'processing');

      const testData = new Float32Array(this.TARGET_SAMPLE_RATE);

      try {
        await this.basicPitch.evaluateModel(
          testData,
          () => {},
          () => {}
        );

        setStatus('status.modelReady', 'success');
        return true;
      } catch (validationError) {
        console.error("Validação do modelo falhou:", validationError);
        setStatus('status.modelValidationError', 'error');
        return false;
      }
    } catch (error) {
      console.error("Inicialização do BasicPitch falhou:", error);
      setStatus('status.modelInitError', 'error', { message: error.message });
      return false;
    }
  }

  /*
    Converte uma nota MIDI no respetivo nome. Aceita um array opcional de
    nomes de notas (12 entradas) para suportar múltiplos idiomas; caso não
    seja fornecido, usa o solfejo português.
   */
  midiToPitchClassName(midiNote, noteNames = NOTE_NAMES_PT) {
    return noteNames[midiNote % 12];
  }

  isBlackKey(midiNote) {
    const note = midiNote % 12;
    return [1, 3, 6, 8, 10].includes(note);
  }

  formatNotes(notes, noteNames = NOTE_NAMES_PT) {
    const uniqueNoteNames = new Set(
      notes.map((midiNote) => this.midiToPitchClassName(midiNote, noteNames))
    );
    return Array.from(uniqueNoteNames).join(", ");
  }

  detectNotes(frames, setWarningInfo) {
    if (frames.length === 0 || !frames[0] || frames[0].length === 0) {
      return { detectedMidiNotes: [], pitchClasses: new Set() };
    }

    const noteData = {};

    frames.forEach((frame) => {
      frame.forEach((confidence, noteIndex) => {
        const midiNote = noteIndex + 21;

        if (confidence < 0.1) return;

        if (!noteData[midiNote]) {
          noteData[midiNote] = {
            totalConfidence: 0,
            maxConfidence: 0,
            frameCount: 0,
            frames: [],
          };
        }

        const data = noteData[midiNote];
        data.totalConfidence += confidence;
        data.maxConfidence = Math.max(data.maxConfidence, confidence);
        data.frameCount++;
        data.frames.push(confidence);
      });
    });

    const notes = [];
    Object.entries(noteData).forEach(([midiNote, data]) => {
      midiNote = parseInt(midiNote);

      if (data.frameCount < frames.length * 0.15) return;

      const avgConfidence = data.totalConfidence / data.frameCount;

      let boost = 1.0;
      if (midiNote >= 36 && midiNote < 48) {
        boost = 1.15;
      } else if (midiNote >= 28 && midiNote < 36) {
        boost = 1.25;
      } else if (midiNote >= 21 && midiNote < 28) {
        boost = 1.35;
      }

      const score = (data.maxConfidence * 0.7 + avgConfidence * 0.3) * boost;

      notes.push({
        midiNote,
        score,
        maxConfidence: data.maxConfidence,
        avgConfidence,
        frameCount: data.frameCount,
        frameRatio: data.frameCount / frames.length,
      });
    });

    notes.sort((a, b) => b.score - a.score);

    if (notes.length === 0) {
      return { detectedMidiNotes: [], pitchClasses: new Set() };
    }

    if (notes[0].score < 0.15) {
      return { detectedMidiNotes: [], pitchClasses: new Set() };
    }

    const C2_MIDI = 36;
    const hasVeryLowNotes = notes.some(
      (note) => note.midiNote < C2_MIDI && note.score > 0.25
    );

    if (hasVeryLowNotes) {
      setWarningInfo('status.lowNotesWarning');
    }

    const finalNotes = [];

    finalNotes.push(notes[0]);

    const harmonicThresholds = {
      12: 0.65,
      19: 0.65,
      24: 0.7,
      28: 0.5,
      31: 0.5,
      36: 0.4,
    };

    const subharmonicThresholds = {
      "-12": 0.6,
      "-24": 0.5,
    };

    const baseThreshold = Math.max(0.25, notes[0].score * 0.4);

    for (let i = 1; i < notes.length; i++) {
      const note = notes[i];

      if (note.score < baseThreshold) continue;

      let isLikelyHarmonic = false;

      for (let j = 0; j < i; j++) {
        const higherNote = notes[j];
        const interval = higherNote.midiNote - note.midiNote;

        if (subharmonicThresholds.hasOwnProperty(String(interval))) {
          if (
            note.score <
            higherNote.score * subharmonicThresholds[String(interval)]
          ) {
            isLikelyHarmonic = true;
            break;
          }
        }
      }

      if (!isLikelyHarmonic) {
        for (const strongerNote of finalNotes) {
          const interval = note.midiNote - strongerNote.midiNote;

          if (harmonicThresholds.hasOwnProperty(interval)) {
            const threshold = strongerNote.score * harmonicThresholds[interval];

            if (note.score < threshold) {
              isLikelyHarmonic = true;
              break;
            }
          }
        }
      }
      if (!isLikelyHarmonic) {
        finalNotes.push(note);
      }
    }

    const midiNotes = finalNotes.map((note) => note.midiNote);
    const pitchClasses = new Set(midiNotes.map((note) => note % 12));

    return {
      detectedMidiNotes: midiNotes,
      pitchClasses,
    };
  }

  getAllNotes() {
    return Array.from({ length: 12 }, (_, i) => {
      const midiNote = i + 60;
      return {
        id: i,
        midiNote,
      };
    });
  }
}

export default NoteDetector;
