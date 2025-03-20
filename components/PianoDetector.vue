<template>
  <div class="piano-detector">
    <div class="controls">
      <button @click="startListening" :disabled="isListening">
        Start Listening
      </button>
      <button @click="stopListening" :disabled="!isListening">
        Stop Listening
      </button>
    </div>

    <div class="status">
      <p>Status: {{ status }}</p>
      <p v-if="progress > 0 && progress < 1">
        Processing: {{ Math.round(progress * 100) }}%
      </p>
      <p v-if="detectedNotes.length > 0">
        Detected Notes: {{ formatNotes(detectedNotes) }}
      </p>
    </div>

    <div class="piano-keyboard">
      <div
        v-for="note in allNotes"
        :key="note.id"
        class="piano-key"
        :class="[
          isBlackKey(note.midiNote) ? 'black-key' : 'white-key',
          activeNotes.includes(note.midiNote) ? 'active' : '',
        ]"
      >
        <span class="note-name">{{ midiToNoteName(note.midiNote) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import { BasicPitch } from "@spotify/basic-pitch";
import * as tf from "@tensorflow/tfjs";

// State
const isListening = ref(false);
const status = ref("Ready");
const activeNotes = ref<number[]>([]);
const detectedNotes = ref<number[]>([]);
const progress = ref(0);

// Setup audio context and objects
let audioContext: AudioContext | null = null;
let mediaStream: MediaStream | null = null;
let recorder: MediaRecorder | null = null;
let basicPitch: BasicPitch | null = null;
let audioChunks: Blob[] = [];
let recordingInterval: number | null = null;

// Constants from the code
const TARGET_SAMPLE_RATE = 22050;

// Convert MIDI note number to note name (C4, C#4, etc.)
const midiToNoteName = (midiNote: number): string => {
  const noteNames = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ];
  const octave = Math.floor(midiNote / 12) - 1;
  const noteName = noteNames[midiNote % 12];
  return `${noteName}${octave}`;
};

// Determine if a MIDI note is a black key
const isBlackKey = (midiNote: number): boolean => {
  const note = midiNote % 12;
  return [1, 3, 6, 8, 10].includes(note);
};

// Format a list of MIDI notes to note names
const formatNotes = (notes: number[]): string => {
  return notes.map(midiToNoteName).join(", ");
};

// Generate all piano notes (MIDI range 21-108)
const allNotes = Array.from({ length: 88 }, (_, i) => {
  const midiNote = i + 21;
  return {
    id: i,
    midiNote,
  };
});

// Initialize basic-pitch
const initBasicPitch = async () => {
  try {
    status.value = "Loading model...";

    // Load BasicPitch with the model URL
    basicPitch = new BasicPitch(
      "https://cdn.jsdelivr.net/npm/@spotify/basic-pitch/model/"
    );

    status.value = "Model loaded";
  } catch (error) {
    console.error("Failed to initialize BasicPitch:", error);
    status.value = "Error initializing model";
  }
};

// Function to resample audio to 22050 Hz
const resampleAudio = async (
  audioBuffer: AudioBuffer
): Promise<Float32Array> => {
  // Create an offline audio context at the target sample rate
  const offlineCtx = new OfflineAudioContext(
    1,
    audioBuffer.duration * TARGET_SAMPLE_RATE,
    TARGET_SAMPLE_RATE
  );

  // Create a buffer source
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;

  // Connect to the offline context
  source.connect(offlineCtx.destination);

  // Start the source
  source.start(0);

  // Render the audio
  const renderedBuffer = await offlineCtx.startRendering();

  // Return the resampled audio data
  return renderedBuffer.getChannelData(0);
};

// Process audio blob
const processAudioBlob = async (blob: Blob) => {
  try {
    // Convert blob to array buffer
    const arrayBuffer = await blob.arrayBuffer();

    // Create audio context if it doesn't exist
    if (!audioContext) {
      audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    }

    // Decode audio data
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Resample audio to 22050 Hz if needed
    const sampleRate = audioBuffer.sampleRate;
    let audioData: Float32Array;

    if (sampleRate !== TARGET_SAMPLE_RATE) {
      audioData = await resampleAudio(audioBuffer);
    } else {
      audioData = audioBuffer.getChannelData(0);
    }

    // Process with BasicPitch if available
    if (basicPitch) {
      progress.value = 0;
      status.value = "Processing audio...";

      // Arrays to collect the processed data
      const framesCollection: number[][] = [];
      const onsetsCollection: number[][] = [];
      const contoursCollection: number[][] = [];

      // Evaluate the model
      await basicPitch.evaluateModel(
        audioData,
        (frames, onsets, contours) => {
          // Collect the data from each callback
          framesCollection.push(...frames);
          onsetsCollection.push(...onsets);
          contoursCollection.push(...contours);
        },
        (percent) => {
          progress.value = percent;
        }
      );

      // Once processing is complete, extract active notes
      // This is a simplified approach - in practice, you might need more complex logic
      // to extract notes from frames/onsets/contours
      const activeIndices = findActiveIndices(framesCollection);
      const midiNotes = activeIndices.map((index) => index + 21); // MIDI notes start at 21 (A0)

      if (midiNotes.length > 0) {
        activeNotes.value = midiNotes;
        detectedNotes.value = midiNotes;
        status.value = "Notes detected";
      } else {
        status.value = "No notes detected";
      }
    }
  } catch (error) {
    console.error("Error processing audio:", error);
    status.value = "Error processing audio";
  }
};

// Find active note indices from frame data (simplified approach)
const findActiveIndices = (frames: number[][]): number[] => {
  // If no frames, return empty array
  if (frames.length === 0 || frames[0].length === 0) {
    return [];
  }

  // Get the last frame (most recent)
  const lastFrame = frames[frames.length - 1];

  // Find indices where activation is above threshold
  const threshold = 0.5; // This is a simplification - you might need to adjust this
  return lastFrame
    .map((value, index) => ({ value, index }))
    .filter((item) => item.value > threshold)
    .map((item) => item.index);
};

// Start listening to the microphone
const startListening = async () => {
  try {
    // Initialize BasicPitch if needed
    if (!basicPitch) {
      await initBasicPitch();
    }

    // Get access to the microphone
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Create a media recorder
    recorder = new MediaRecorder(mediaStream);
    audioChunks = [];

    // Listen for data available events
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    });

    // Start recording
    recorder.start();

    // Set up an interval to process chunks
    recordingInterval = window.setInterval(() => {
      if (audioChunks.length > 0) {
        // Stop the recorder temporarily
        recorder?.stop();

        // Process the chunks
        const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
        processAudioBlob(audioBlob);

        // Clear the chunks
        audioChunks = [];

        // Restart the recorder
        if (isListening.value && recorder) {
          recorder.start();
        }
      }
    }, 2000); // Process every 2 seconds

    isListening.value = true;
    status.value = "Listening...";
  } catch (error) {
    console.error("Error starting microphone:", error);
    status.value = "Error accessing microphone";
  }
};

// Stop listening
const stopListening = () => {
  // Stop the recording interval
  if (recordingInterval !== null) {
    clearInterval(recordingInterval);
    recordingInterval = null;
  }

  // Stop the recorder
  if (recorder && recorder.state !== "inactive") {
    recorder.stop();
  }

  // Stop the media stream
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }

  isListening.value = false;
  status.value = "Stopped";
  activeNotes.value = [];
};

// Initialize on component mount
onMounted(() => {
  // Prefetch TensorFlow.js - may help with loading speed
  tf.ready().then(() => {
    initBasicPitch();
  });
});

// Clean up on component unmount
onBeforeUnmount(() => {
  stopListening();
  if (audioContext) {
    audioContext.close();
  }
});
</script>

<style scoped>
.piano-detector {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
}

.controls {
  margin-bottom: 20px;
}

button {
  padding: 10px 15px;
  margin: 0 10px;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.status {
  margin-bottom: 20px;
}

.piano-keyboard {
  display: flex;
  position: relative;
  width: 100%;
  height: 200px;
  overflow-x: auto;
}

.piano-key {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 10px;
  box-sizing: border-box;
  transition: background-color 0.1s ease;
}

.white-key {
  width: 40px;
  height: 200px;
  background-color: white;
  border: 1px solid #ccc;
  z-index: 1;
}

.black-key {
  width: 30px;
  height: 120px;
  background-color: black;
  margin-left: -15px;
  margin-right: -15px;
  z-index: 2;
  color: white;
}

.active {
  background-color: #91d4ff;
}

.black-key.active {
  background-color: #2196f3;
}

.note-name {
  font-size: 12px;
}
</style>
