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
    /*
    Cria um contexto de áudio offline mono (1 canal), com um comprimento obtido pela multiplicação da duração
    do buffer original pela sample rate de 22050 Hz, utilizando a mesma também para definir a sample rate deste contexto de audio.
    */
    const offlineCtx = new OfflineAudioContext(
      1,
      audioBuffer.duration * this.TARGET_SAMPLE_RATE,
      this.TARGET_SAMPLE_RATE
    );

    // Cria uma buffer source para o contexto de audio offline e assigna-o ao audioBuffer.
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;

    // Conecta o buffer source ao destino, para renderização
    source.connect(offlineCtx.destination);
    source.start(0);

    // Começa a renderização do audio
    const renderedBuffer = await offlineCtx.startRendering();

    // Retorna um array os dados renderizados
    return renderedBuffer.getChannelData(0);
  }

  /*
  Função que recebe um blob de audio (binary large object), converte-o para dados possíveis de processar,
  e usa o, verifica o nível de audio, faz o resample se necessário e, por fim, chama a função evaluateModel() do BasicPitch
  para obtem a framesCollection que será depois usada na função detectNotes para obtenção das notas tocadas.
  */
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

      // Se o tamanho do blob for menor que 1000, ignora a análise.
      if (blob.size < 1000) {
        setStatus("Amostra de audio muito pequena");
        setIsAnalyzing(false);
        return;
      }

      // Converte o blob para um arrayBuffer
      const arrayBuffer = await blob.arrayBuffer();

      // Verifica se existe já um contexto de audio. Não existindo, cria um novo
      if (!this.audioContext) {
        this.audioContext = new window.AudioContext({
          sampleRate: this.TARGET_SAMPLE_RATE,
        });
      }

      // Utiliza o decodeAudioData do contexto de audio para fazer a descoficiação dos dados no arrayBuffer
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      /*
      Verifica o nível de audio nas amostras.
      Faz uma soma do valor absoluto das amplitudes do sinal de audio e divide pelo número de amostras para
      obter o volume médio do sinal de audio. Se o valor for menor que 0.005, a análise é ignorada.
      */
      const channel = audioBuffer.getChannelData(0);
      const sum = channel.reduce((acc, val) => acc + Math.abs(val), 0);
      const average = sum / channel.length;

      if (average < 0.005) {
        setStatus("Volume do áudio é demasiado baixo");
        setIsAnalyzing(false);
        return;
      }

      const sampleRate = audioBuffer.sampleRate;
      let audioData;

      // Verifica se é necessário fazer o resample do audio
      if (sampleRate !== this.TARGET_SAMPLE_RATE) {
        setStatus("Resampling audio...");
        audioData = await this.resampleAudio(audioBuffer);
      } else {
        audioData = audioBuffer.getChannelData(0);
      }

      if (noteDetector.basicPitch) {
        setProgress(0);
        setStatus("A processar áudio...");

        const framesCollection = [];
        const onsetsCollection = [];
        const contoursCollection = [];

        // Chamada do evaluateModel do BasicPitch para obtem a framesCollecion
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

        // Chamada a função detectNotes com a framesCollection como argumento para obter as notas MIDI tocadas
        const { detectedMidiNotes } = noteDetector.detectNotes(
          framesCollection,
          setWarningInfo
        );

        if (detectedMidiNotes.length > 0) {
          setActiveNotes(detectedMidiNotes);
          // Usamos o callback com as notas detectadas
          setDetectedNotes(detectedMidiNotes);
          setStatus(`Análise completa`);
        } else {
          setStatus("Nenhuma nota detetada");
        }
      }

      setIsAnalyzing(false);
    } catch (error) {
      setStatus(`Erro ao processar o áudio: ${error.message}`);
      setIsAnalyzing(false);
    }
  }

  // Função responsável pela gravação de audio
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
      // Reset a todos os estados
      setActiveNotes([]);
      setDetectedNotes([]);
      setRecordingComplete(false);
      setRecordedAudio(null);
      setWarningInfo("");
      this.audioChunks = [];

      /*
      Solicitado o acesso ao microfone através da Web Audio API.
      Todas as opções de processamento estão a falso para não comprometer a deteção de pitch.
      */
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      /*
      Criação de uma instancia do MediaRecorder para gravação do audio
      */
      this.recorder = new MediaRecorder(this.mediaStream, {
        mimeType: "audio/webm;codecs=opus",
      });

      /*
      Listener que captura fragmentos de audio e guarda-os num array
      */
      this.recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      });

      /*
      Listener que quando a gravação para, combina todos os fragmentos de aúdio
      num objeto blob (binary large object).
      */
      this.recorder.addEventListener("stop", () => {
        const audioBlob = new Blob(this.audioChunks, {
          type: "audio/webm",
        });
        setRecordedAudio(audioBlob);
        setRecordingComplete(true);
        setStatus("Gravação completa");
      });

      /*
      Inicio da gravação
      */
      this.recorder.start();
      this.recordingStartTime = Date.now();

      this.recordingTimer = setTimeout(() => {
        if (this.recorder && this.recorder.state === 'recording') {
          this.stopRecording(setIsRecording);
          setStatus("Gravação parada automaticamente (limite de 10s)");
        }
      }, this.MAX_RECORDING_TIME);

      // Atualização de estados e tratamento de possíveis erros.
      setIsRecording(true);
      setStatus("A gravar audio... (máx. 10s)");
    } catch (error) {
      console.error("Erro ao começar a gravação:", error);
      setStatus(`Erro ao aceder ao microfone: ${error.message}`);
    }
  }

  // Função responsável por terminar o processo de gravação.
  stopRecording(setIsRecording) {
    // Termina o temporizador
    if (this.recordingTimer) {
      clearTimeout(this.recordingTimer);
      this.recordingTimer = null;
    }

    // Despoleta o evento "stop" ao MediaRecorder para poder começar a processar os dados
    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.stop();
    }

    // Para o fluxo de mídia do microfone e liberta o acesso ao mesmo.
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    // Atualiza o estado de gravação para false.
    setIsRecording(false);
  }

  // Função que permite ao utilizador ouvir o audio gravado
  playRecording(recordedAudio) {
    if (recordedAudio) {
      const audioUrl = URL.createObjectURL(recordedAudio);
      const audio = new Audio(audioUrl);
      audio.play();
    }
  }

  // Limpa recursos de áudio
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