class AudioService {
  constructor() {
    this.TARGET_SAMPLE_RATE = 22050;
    this.audioContext = null;
    this.mediaStream = null;
    this.recorder = null;
    this.audioChunks = [];
    this.recordingStartTime = null;
    this.recordingTimer = null;
    this.MAX_RECORDING_TIME = 10000;
  }

  /*
  O BasicPitch dava o seguinte erro:
  "Input audio buffer is not at correct sample rate! Is 44100. Should be 22050"
  Foi necessário criar uma função para fazer o resample do audio para 22050Hz.
  */
  async resampleAudio(audioBuffer) {
    const offlineCtx = new OfflineAudioContext(
      1,
      audioBuffer.duration * this.TARGET_SAMPLE_RATE,
      this.TARGET_SAMPLE_RATE
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;

    source.connect(offlineCtx.destination);
    source.start(0);

    const renderedBuffer = await offlineCtx.startRendering();

    return renderedBuffer.getChannelData(0);
  }

  async processAudioBlob(
    blob,
    setIsAnalyzing,
    setWarningInfo,
    setStatus,
    setProgress,
    noteDetector,
    setActiveNotes,
    setDetectedNotes
  ) {
    try {
      setIsAnalyzing(true);
      setWarningInfo("");

      if (blob.size < 1000) {
        setStatus('status.shortSample', 'info');
        setIsAnalyzing(false);
        return;
      }

      const arrayBuffer = await blob.arrayBuffer();

      if (!this.audioContext) {
        this.audioContext = new window.AudioContext({
          sampleRate: this.TARGET_SAMPLE_RATE,
        });
      }

      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      const channel = audioBuffer.getChannelData(0);
      const sum = channel.reduce((acc, val) => acc + Math.abs(val), 0);
      const average = sum / channel.length;

      if (average < 0.005) {
        setStatus('status.lowVolume', 'info');
        setIsAnalyzing(false);
        return;
      }

      const sampleRate = audioBuffer.sampleRate;
      let audioData;

      if (sampleRate !== this.TARGET_SAMPLE_RATE) {
        setStatus('status.resampling', 'processing');
        audioData = await this.resampleAudio(audioBuffer);
      } else {
        audioData = audioBuffer.getChannelData(0);
      }

      if (noteDetector.basicPitch) {
        setProgress(0);
        setStatus('status.processing', 'processing');

        const framesCollection = [];
        const onsetsCollection = [];
        const contoursCollection = [];

        await noteDetector.basicPitch.evaluateModel(
          audioData,
          (frames, onsets, contours) => {
            framesCollection.push(...frames);
            onsetsCollection.push(...onsets);
            contoursCollection.push(...contours);
          },
          (percent) => {
            setProgress(percent);
          }
        );

        const { detectedMidiNotes } = noteDetector.detectNotes(
          framesCollection,
          setWarningInfo
        );

        if (detectedMidiNotes.length > 0) {
          setActiveNotes(detectedMidiNotes);
          setDetectedNotes(detectedMidiNotes);
          setStatus('status.analysisComplete', 'success');
        } else {
          setStatus('status.noNotes', 'info');
        }
      }

      setIsAnalyzing(false);
    } catch (error) {
      setStatus('status.processError', 'error', { message: error.message });
      setIsAnalyzing(false);
    }
  }

  async startRecording(
    setStatus,
    setIsRecording,
    setActiveNotes,
    setDetectedNotes,
    setRecordingComplete,
    setRecordedAudio,
    setWarningInfo
  ) {
    try {
      setActiveNotes([]);
      setDetectedNotes([]);
      setRecordingComplete(false);
      setRecordedAudio(null);
      setWarningInfo("");
      this.audioChunks = [];

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      this.recorder = new MediaRecorder(this.mediaStream, {
        mimeType: "audio/webm;codecs=opus",
      });

      this.recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      });

      this.recorder.addEventListener("stop", () => {
        const audioBlob = new Blob(this.audioChunks, {
          type: "audio/webm",
        });
        setRecordedAudio(audioBlob);
        setRecordingComplete(true);
        setStatus('status.complete', 'success');
      });

      this.recorder.start();
      this.recordingStartTime = Date.now();

      this.recordingTimer = setTimeout(() => {
        if (this.recorder && this.recorder.state === 'recording') {
          this.stopRecording(setIsRecording);
          setStatus('status.autoStopped', 'info');
        }
      }, this.MAX_RECORDING_TIME);

      setIsRecording(true);
      setStatus('status.recording', 'processing');
    } catch (error) {
      console.error("Erro ao começar a gravação:", error);
      setStatus('status.micError', 'error', { message: error.message });
    }
  }

  stopRecording(setIsRecording) {
    if (this.recordingTimer) {
      clearTimeout(this.recordingTimer);
      this.recordingTimer = null;
    }

    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.stop();
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    setIsRecording(false);
  }

  playRecording(recordedAudio) {
    if (recordedAudio) {
      const audioUrl = URL.createObjectURL(recordedAudio);
      const audio = new Audio(audioUrl);
      audio.play();
    }
  }

  cleanup() {
    if (this.recordingTimer) {
      clearTimeout(this.recordingTimer);
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
    }

    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}

export default AudioService;
