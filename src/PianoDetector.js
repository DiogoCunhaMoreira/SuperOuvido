import React, { useState, useEffect, useRef } from "react";
import { BasicPitch } from "@spotify/basic-pitch";
import "./PianoDetector.css";
import GeminiComponent from "./GeminiComponent";

const PianoDetector = () => {
  // Estados
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recordingComplete, setRecordingComplete] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [status, setStatus] = useState("Ready");
  const [activeNotes, setActiveNotes] = useState([]);
  const [detectedNotes, setDetectedNotes] = useState([]);
  const [progress, setProgress] = useState(0);
  const [warningInfo, setWarningInfo] = useState("");

  const basicPitchRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const recorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingStartTimeRef = useRef(null);
  const recordingTimerRef = useRef(null);

  const TARGET_SAMPLE_RATE = 22050;

  /*
    Como existem 12 semitons em cada oitava e a numeração MIDI incrementa ou decrementa um valor a cada semitom,
    basta dividir o número MIDI por 12 para determinar a nota correspondente. Como não é necessário saber a oitava onde foi tocada a nota,
    apenas o modulo é utilizado. 
   */
  const midiToPitchClassName = (midiNote) => {
    const noteNames = [
      "Dó",
      "Dó#",
      "Ré",
      "Ré#",
      "Mi",
      "Fá",
      "Fá#",
      "Sol",
      "Sol#",
      "Lá",
      "Lá#",
      "Si",
    ];
    return noteNames[midiNote % 12];
  };

  /* 
  Função para determinar se a nota tocada corresponde a uma nota preta no teclado, usada depois para 
  representar visualmente. As teclas pretas, numa oitava, são representadas pela segunda, quarta, sétima, nona ou décima primeira nota.
  Como a númeração MIDI começa no 0, então verifica-se se a nota detada é uma dos seguintes números: 1, 3, 6, 8, ou 10.
  */
  const isBlackKey = (midiNote) => {
    const note = midiNote % 12;
    return [1, 3, 6, 8, 10].includes(note);
  };

  /*
  Função que recebe um array de notas MIDI e converte o array num outro array com o nome das notas, usando
  a estrutura de dados Set() para remover duplicados, ou seja, se dois Dós forem tocados, apenas é assumido um.
  */
  const formatNotes = (notes) => {
    const uniqueNoteNames = new Set(
      notes.map((midiNote) => midiToPitchClassName(midiNote))
    );
    return Array.from(uniqueNoteNames).join(", ");
  };

  /* 
  Array com as notas em MIDI (do 60 ao 71) representando a quarta oitava, a que contém o dó central no piano.
  É usada depois para destacar as teclas corretas do acorde tocado.
  */
  const allNotes = Array.from({ length: 12 }, (_, i) => {
    const midiNote = i + 60;
    return {
      id: i,
      midiNote,
    };
  });

  /*
  Função responsável por carregar e inicializar o modelo de deteção de pitch (BasicPitch da Spotify).
  É um usado um CDN para criar uma nova instancia do modelo.
  Para validar se o modelo está a funcionar é criado um array de dados, que simboliza um segundo de silêncio, 
  e é executado o modelo. Se o modelo executar com sucesso, a função anónima data como argumento, executa e coloca a variável 
  modelWorks a true.
  */
  const initBasicPitch = async () => {
    try {
      setStatus("A carregar o modelo de deteção...");

      basicPitchRef.current = null;

      basicPitchRef.current = new BasicPitch(
        "https://unpkg.com/@spotify/basic-pitch@1.0.1/model/model.json"
      );

      setStatus("Modelo carregado - a testar...");

      const testData = new Float32Array(TARGET_SAMPLE_RATE);
      let modelWorks = false;

      try {
        await basicPitchRef.current.evaluateModel(
          testData,
          () => {
            modelWorks = true;
          },
          () => {}
        );

        setStatus("Modelo de deteção carregado e validado!");
        return true;
      } catch (validationError) {
        console.error("Validação do modelo falhou:", validationError);
        setStatus("Erro ao validar o modelo de deteção");
        return false;
      }
    } catch (error) {
      console.error("Inicialização do BasicPitch falhou:", error);
      setStatus(`Erro ao inicializar o modelo de deteção: ${error.message}`);
      return false;
    }
  };

  /*  
  O BasicPitch dava o seguinte erro:
  "Input audio buffer is not at correct sample rate! Is 44100. Should be 22050"
  Foi necessário criar uma função para fazer o resample do audio para 22050Hz.
  */
  const resampleAudio = async (audioBuffer) => {
    /* 
    Cria um contexto de áudio offline mono (1 canal), com um comprimento obtido pela multiplicação da duração
    do buffer original pela sample rate de 22050 Hz, utilizando a mesma também para definir a sample rate deste contexto de audio.
    */
    const offlineCtx = new OfflineAudioContext(
      1,
      audioBuffer.duration * TARGET_SAMPLE_RATE,
      TARGET_SAMPLE_RATE
    );

    // Cria uma buffer source para o contexto de audio offline e assigna-o ao  audioBuffer.
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;

    // Conecta o buffer source ao destino, para renderização
    source.connect(offlineCtx.destination);

    source.start(0);

    // Começa a renderização do audio
    const renderedBuffer = await offlineCtx.startRendering();

    // Retorna um array os dados renderizados
    return renderedBuffer.getChannelData(0);
  };

  /*
   Função que recebe um blob de audio (binary large object), converte-o para dados possíveis de processar,
   e usa o, verifica o nível de audio, faz o resample se necessário e, por fim,  chama a função evaluateModel() do BasicPitch
   para obtem a framesCollection que será depois usada na função detectNotes para obtenção das notas tocadas.
  */
  const processAudioBlob = async (blob) => {
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
      if (!audioContextRef.current) {
        audioContextRef.current = new window.AudioContext({
          sampleRate: TARGET_SAMPLE_RATE,
        });
      }

      // Utiliza o decodeAudioData do contexto de audio para fazer a descoficiação dos dados no arrayBuffer
      const audioBuffer = await audioContextRef.current.decodeAudioData(
        arrayBuffer
      );

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
      if (sampleRate !== TARGET_SAMPLE_RATE) {
        setStatus("Resampling audio...");
        audioData = await resampleAudio(audioBuffer);
      } else {
        audioData = audioBuffer.getChannelData(0);
      }

      if (basicPitchRef.current) {
        setProgress(0);
        setStatus("A processar áudio...");

        const framesCollection = [];
        const onsetsCollection = [];
        const contoursCollection = [];

        // Chamada do evaluateModel do BasicPitch para obtem a framesCollecion
        await basicPitchRef.current.evaluateModel(
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
        const { detectedMidiNotes } = detectNotes(framesCollection);
        if (detectedMidiNotes.length > 0) {
          setActiveNotes(detectedMidiNotes);
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
  };

  const detectNotes = (frames) => {
    /*
    Verifica primeiro se existem dados para serem analisados
    */
    if (frames.length === 0 || !frames[0] || frames[0].length === 0) {
      return { detectedMidiNotes: [], pitchClasses: new Set() };
    }

    const noteData = {};

    //Iniciado o processamento dos frames
    frames.forEach((frame) => {
      frame.forEach((confidence, noteIndex) => {
        /*
        O 21 representa em MIDI a nota mais grave do piano, Lá0.
        Como o algoritmo do BasicPitch funciona com um offset=21 (ou seja, deteta apenas as 88 notas de um piano),
        o valor 21 deve ser adicionado ao index do frame para representar a nota MIDI real que está a ser representada.
        */
        const midiNote = noteIndex + 21;

        // Notas com confiança abaixo de 0.1 são ignoradas
        if (confidence < 0.1) return;

        /* 
        Verifica se a nota já foi detetada noutros frames, se não tiver sido detetada,
        cria um elemento no noteData com valores iniciais.
        */
        if (!noteData[midiNote]) {
          noteData[midiNote] = {
            totalConfidence: 0,
            maxConfidence: 0,
            frameCount: 0,
            frames: [],
          };
        }

        /*
        Atualizado o index no noteData com os seguintes dados:
        totalConfidence = Somatório dos valores da confiança encontrada em diferentes frames
        maxConfidence = O maior valor de confiança encontrado nos frames
        frameCount = Em quantos frames foi detetada a nota
        frames = Array que vai conter todos os valores de confiança encontrados nos frames
        */
        const data = noteData[midiNote];
        data.totalConfidence += confidence;
        data.maxConfidence = Math.max(data.maxConfidence, confidence);
        data.frameCount++;
        data.frames.push(confidence);
      });
    });

    /* 
    Converte-se o objeto noteData num array de objetos e itera-se pelo mesmo para se calcular
    a pontuação de cada nota detetada
    */
    const notes = [];
    Object.entries(noteData).forEach(([midiNote, data]) => {
      midiNote = parseInt(midiNote);

      // Se a nota só for detetada em menos de 15% dos frames, é ignorada
      if (data.frameCount < frames.length * 0.15) return;

      const avgConfidence = data.totalConfidence / data.frameCount;

      /*
      Como as notas graves são mais dificeis de detetar, decidiu-se implementar
      um boost para aumentar a pontuação (score) destas notas, para aumentar
      a precisão.
      */
      let boost = 1.0;
      if (midiNote >= 36 && midiNote < 48) {
        // Dó2 ao Si2
        boost = 1.15;
      } else if (midiNote >= 28 && midiNote < 36) {
        // Mi1 ao Si1
        boost = 1.25;
      } else if (midiNote >= 21 && midiNote < 28) {
        // Lá0 ao Ré1
        boost = 1.35;
      }

      /* 
      A pontuação (score) é calculada pela soma de 70% do valor da confiança máxima
      por 30% do valor da confiança média, multiplicado pelo boost 
      */
      const score = (data.maxConfidence * 0.7 + avgConfidence * 0.3) * boost;

      // Adiciona ao array a nota detetada com o score calculado e os dados já obtidos anteriormente
      notes.push({
        midiNote,
        score,
        maxConfidence: data.maxConfidence,
        avgConfidence,
        frameCount: data.frameCount,
        frameRatio: data.frameCount / frames.length,
      });
    });

    // Ordena o array notes por pontuação (decrescente)
    notes.sort((a, b) => b.score - a.score);

    // Verifica se o array notes está vazio
    if (notes.length === 0) {
      return { detectedMidiNotes: [], pitchClasses: new Set() };
    }

    // Se o score da nota com melhor pontuação for menor que 0.15, retorna.
    if (notes[0].score < 0.15) {
      return { detectedMidiNotes: [], pitchClasses: new Set() };
    }

    /* 
    Verificar se há notasabaixo de Dó2 = MIDI 36 com uma pontuação maior que 0.25. Se houver, a mensagem
    é mostrada ao utilizador.
    */
    const C2_MIDI = 36;
    const hasVeryLowNotes = notes.some(
      (note) => note.midiNote < C2_MIDI && note.score > 0.25
    );

    if (hasVeryLowNotes) {
      setWarningInfo(
        "⚠️ Detectadas notas abaixo de C2, a precisão pode ser limitada."
      );
    }

    const finalNotes = [];

    // Adiciona a nota com maior pontuação ao array que vai conter as notas finais detetadas
    finalNotes.push(notes[0]);

    /*
    Nestes dois objetos tem-se os intervalos que simbolizam os possíveis harmónicos (overtones) e sub-harmónicos 
    (undertones) que uma nota pode reproduzir quando tocada e os seus respetivos limiares
    (usados depois para calcular se a nota poderá ser ou não um harmónico) 
    */
    const harmonicThresholds = {
      12: 0.65, // Oitava
      19: 0.65, // Oitava + A quinta
      24: 0.7, // Duas oitavas
      28: 0.5, // Duas oitavas + a terceira maior
      31: 0.5, // Duas oitavas + a quinta
      36: 0.4, // Três oitavas
    };

    const subharmonicThresholds = {
      "-12": 0.6, // Uma oitava abaixo
      "-24": 0.5, // Duas oitavas abaixo
    };

    /*
    Estabelecido um valor minimo de confiança que as notas devem atingir para serem considerada
    notas reais, ou seja, realmente tocadas.
    É calculado um máximo entre o valor de 40% da nota com maior score e 0.25.
    O cálculo do máximo serve para adaptar o limiar à qualidade da deteção,ou seja, se os scores
    detetados forem altos, o limiar também será maior, ou seja, pode-se aumentar a exigencia na eliminação
    ou não de falsos positivos.
    */
    const baseThreshold = Math.max(0.25, notes[0].score * 0.4);

    /*
    Este loop itera por todas as notas detetadas e, em primeiro lugar, descarta as que têm
    um score abaixo do valor minimo de confiança, e de seguida elimina as notas que são
    consideradas harmónicos ou sub-harmónicos
    */
    for (let i = 1; i < notes.length; i++) {
      const note = notes[i];

      if (note.score < baseThreshold) continue;

      let isLikelyHarmonic = false;

      /*
      Como os sub-harmónicos não são componentes naturais do som, ou seja, a maioria dos instrumentos
      músicais não produzem sub-harmónicos quando são tocados, a análise é feita a todas as notas que 
      foram detetadas, isto porque os sub-harmónicos são erros de deteção do próprio algoritmo, ou seja,
      deve ser feito sempre para todas as notas já analisadas e não só para as notas que já foram dadas
      como reais.
      */
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

      /*
      Como os harmónicos são componentes naturais do som, faz sentido apenas verificar em notas
      que foram já dadas como reais, porque poderia-se descartar notas como sendo harmónicos de
      notas que seriam mais tarde descartadas como sub-harmónicos.
      */
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

    // Transformação do array finalNotes num array apenas com as notas MIDI
    const midiNotes = finalNotes.map((note) => note.midiNote);
    /* 
    Simplifica as notas MIDI para obter apenas a sua classe de pitch, ou seja,
    não interessa a oitava em que foi tocada mas sim a nota em si. Servirá
    depois para o processamento visual das notas no teclado.
    O uso da estrutura de dados Set() também elimina notas dúplicadas.
    */
    const pitchClasses = new Set(midiNotes.map((note) => note % 12));
    return {
      detectedMidiNotes: midiNotes,
      pitchClasses,
    };
  };

  // Função responsável pela gravação de audio
  const startRecording = async () => {
    try {
      /*
      Verifica se o modulo de deteção de pitch está disponível antes de começar a gravação.
      Se não estiver disponível, inicia-o.
      */
      if (!basicPitchRef.current) {
        const initialized = await initBasicPitch();
        if (!initialized) return;
      }

      // Reset a todos os estados
      setActiveNotes([]);
      setDetectedNotes([]);
      setRecordingComplete(false);
      setRecordedAudio(null);
      setWarningInfo("");
      audioChunksRef.current = [];

      /*
      Solicitado o acesso ao microfone através da Web Audio API.
      Todas as opções de processamento estão a falso para não comprometer a deteção de pitch.
      */
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      /*
      Criação de uma instancia do MediaRecorder para gravação do audio
      */
      recorderRef.current = new MediaRecorder(mediaStreamRef.current, {
        mimeType: "audio/webm;codecs=opus",
      });

      /*
      Listener que captura fragmentos de audio e guarda-os num array
      */
      recorderRef.current.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      });

      /*
      Listener que quando a gravação para, combina todos os fragmentos de aúdio
      num objeto blob (binary large object).
      */
      recorderRef.current.addEventListener("stop", () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        setRecordedAudio(audioBlob);
        setRecordingComplete(true);
        setStatus(`Gravação completa (${recordingDuration.toFixed(1)}s)`);
      });

      /* 
      Inicio da gravação e do temporizador que é depois autualizado a cada 100ms
      para oferecer feedback ao utilizador durante o processo de gravação. 
      */
      recorderRef.current.start();
      recordingStartTimeRef.current = Date.now();

      recordingTimerRef.current = setInterval(() => {
        const duration = (Date.now() - recordingStartTimeRef.current) / 1000;
        setRecordingDuration(duration);
      }, 100);

      // Atualização de estados e tratamento de possíveis erros.
      setIsRecording(true);
      setStatus("A gravar audio...");
    } catch (error) {
      console.error("Erro ao começar a gravação:", error);
      setStatus(`Erro ao aceder ao microfone: ${error.message}`);
    }
  };

  // Função responsável por terminar o processo de gravação.
  const stopRecording = () => {
    // Termina o temporizador
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    // Despoleta o evento "stop" ao MediaRecorder para poder começar a processar os dados
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }

    // Para o fluxo de mídia do microfone e liberta o acesso ao mesmo.
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    // Atualiza o estado de gravação para false.
    setIsRecording(false);
  };

  /* 
  Função que inicia a análise de dados, chamando a função processAudioBlob() ou 
  mostrando uma mensagem ao utilizador, caso não haja audio gravado. 
  */
  const analyzeRecording = () => {
    if (recordedAudio) {
      processAudioBlob(recordedAudio);
    } else {
      setStatus("Nenhuma gravação disponível para analisar");
    }
  };

  // Função que permite ao utilizador ouvir o audio gravado
  const playRecording = () => {
    if (recordedAudio) {
      const audioUrl = URL.createObjectURL(recordedAudio);
      const audio = new Audio(audioUrl);
      audio.play();
    }
  };

  /*
  Permite fazer um cleanup dos recursos sempre que a aplicação é fechada (componente desmontado):
   - Termina o temporizador
   - Liberta o microfone
   - Fecha o contexto de audio
  */
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Inicializa o BasicPitch assim que a aplicação é iniciada (assim que o componente é montado)
  useEffect(() => {
    initBasicPitch();
  }, []);

  // Estado que guarda as notas (independentemente da oitava) que serão usadas na componente visual.
  const [chordPitchClasses, setChordPitchClasses] = useState(new Set());

  /*
  Hook que é chamado sempre que o estado detectedNotes muda, convertendo cada
  nota MIDI para a sua pitch class, ou seja, converte para um valor de 0 a 11 
  que corresponde à sua nota mas sem a oitava onde foi tocada.
  */
  useEffect(() => {
    if (detectedNotes.length > 0) {
      const pitchClasses = new Set(detectedNotes.map((note) => note % 12));
      setChordPitchClasses(pitchClasses);
    } else {
      setChordPitchClasses(new Set());
    }
  }, [detectedNotes]);

  return (
    /* Componente visual da aplicação que utiliza classes definidas no ficheiro PianoDetector.css */
    <div
      className="piano-detector"
      style={{
        textAlign: "center",
        maxWidth: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/*Permite ao utilizador controlar o ciclo de gravação de audio */}
      <div
        className="controls"
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "10px",
          margin: "20px 0",
        }}
      >
        <button
          onClick={startRecording}
          disabled={isRecording || isAnalyzing}
          style={{ padding: "8px 15px", cursor: "pointer" }}
        >
          Gravar
        </button>
        <button
          onClick={stopRecording}
          disabled={!isRecording || isAnalyzing}
          style={{ padding: "8px 15px", cursor: "pointer" }}
        >
          Parar Gravação
        </button>
        <button
          onClick={analyzeRecording}
          disabled={isRecording || !recordingComplete || isAnalyzing}
          style={{ padding: "8px 15px", cursor: "pointer" }}
        >
          Analisar
        </button>
        <button
          onClick={playRecording}
          disabled={isRecording || !recordingComplete || isAnalyzing}
          style={{ padding: "8px 15px", cursor: "pointer" }}
        >
          Ouvir Gravação
        </button>
      </div>

      {/*
      Secção que mostra o estado atual da aplicação e algumas mensagens ao utilizador, como 
      o aviso de notas graves tocadas e as notas finais detetadas.
      */}
      <div className="status" style={{ width: "100%", textAlign: "center" }}>
        <p>Status: {status}</p>
        {isRecording && <p>A gravar: {recordingDuration.toFixed(1)}s</p>}
        {progress > 0 && progress < 1 && (
          <p>A processar: {Math.round(progress * 100)}%</p>
        )}
        {warningInfo && <p className="warning-info">{warningInfo}</p>}
        {detectedNotes.length > 0 && (
          <div>
            <p>Notas: {formatNotes(detectedNotes)}</p>
          </div>
        )}
      </div>
      {/* Mostra o teclado virtual que vai mostrar as notas tocadas pelo utilizador */}
      <div
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          marginTop: "20px",
        }}
      >
        <div
          className="piano-keyboard"
          style={{
            display: "flex",
            justifyContent: "center",
            position: "relative",
            margin: "0 auto",
          }}
        >
          {allNotes.map((note) => (
            <div
              key={note.id}
              className={`piano-key ${
                isBlackKey(note.midiNote) ? "black-key" : "white-key"
              } ${chordPitchClasses.has(note.midiNote % 12) ? "active" : ""}`}
            >
              <span className="note-name">
                {midiToPitchClassName(note.midiNote)}
              </span>
            </div>
          ))}
        </div>
      </div>
      {detectedNotes.length > 0 && (
        <GeminiComponent detectedNotes={detectedNotes} />
      )}
    </div>
  );
};

export default PianoDetector;
