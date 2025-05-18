import React, { useState, useEffect, useRef } from "react";
import { BasicPitch } from "@spotify/basic-pitch";
import "./PianoDetector.css";
import GeminiComponent from "./GeminiComponent";
import AudioService from "./AudioService";
import NoteDetector from "./NoteDetector";
import historyManager from "./HistoryManager";
import Modal from "./Modal";
import HistoryView from "./HistoryView";

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
  const [chordPitchClasses, setChordPitchClasses] = useState(new Set());
  // Estado para o modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  // History state from store
  const [historyState, setHistoryState] = useState({
    searchHistory: [],
    showHistory: false
  });
  // Estado para pendentes
  const [pendingAnalysis, setPendingAnalysis] = useState(false);
  const [pendingHistoryItem, setPendingHistoryItem] = useState(null);

  const audioServiceRef = useRef(new AudioService());
  const noteDetectorRef = useRef(new NoteDetector());
  const geminiComponentRef = useRef(null);
  const allNotes = noteDetectorRef.current.getAllNotes();

  // Subscribe to history store changes
  useEffect(() => {
    const unsubscribe = historyManager.subscribe(newState => {
      setHistoryState(newState);
    });
    
    // Forçar carregamento do histórico na inicialização
    historyManager.loadHistory();
    
    return () => {
      unsubscribe();
    };
  }, []);

  // Inicializa o BasicPitch assim que a aplicação é iniciada (assim que o componente é montado)
  useEffect(() => {
    noteDetectorRef.current.initBasicPitch(setStatus);
  }, []);

  // Effect para lidar com análise pendente quando o componente Gemini está pronto
  useEffect(() => {
    // Se temos análise pendente e o componente Gemini está pronto
    if (pendingAnalysis && geminiComponentRef.current && detectedNotes.length > 0) {
      geminiComponentRef.current.analyzeNotes();
      setPendingAnalysis(false);
    }

    // Se temos um item de histórico pendente e o componente Gemini está pronto
    if (pendingHistoryItem && geminiComponentRef.current) {
      geminiComponentRef.current.loadHistoryItem(pendingHistoryItem);
      setPendingHistoryItem(null);
    }
  }, [pendingAnalysis, pendingHistoryItem, detectedNotes, geminiComponentRef.current]);

  /*
  Permite fazer um cleanup dos recursos sempre que a aplicação é fechada (componente desmontado):
   - Termina o temporizador
   - Liberta o microfone
   - Fecha o contexto de audio
  */
  useEffect(() => {
    return () => {
      audioServiceRef.current.cleanup();
    };
  }, []);

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

  // Função responsável pela gravação de audio
  const startRecording = async () => {
    try {
      /*
      Verifica se o modulo de deteção de pitch está disponível antes de começar a gravação.
      Se não estiver disponível, inicia-o.
      */
      if (!noteDetectorRef.current.basicPitch) {
        const initialized = await noteDetectorRef.current.initBasicPitch(setStatus);
        if (!initialized) return;
      }

      await audioServiceRef.current.startRecording(
        setStatus,
        setIsRecording,
        setRecordingDuration,
        setActiveNotes,
        setDetectedNotes,
        setRecordingComplete,
        setRecordedAudio,
        setWarningInfo
      );
    } catch (error) {
      console.error("Erro ao começar a gravação:", error);
      setStatus(`Erro ao acessar o microfone: ${error.message}`);
    }
  };

  // Função responsável por terminar o processo de gravação.
  const stopRecording = () => {
    audioServiceRef.current.stopRecording(setIsRecording);
  };

  /* 
  Função que inicia a análise de dados, chamando a função processAudioBlob() ou 
  mostrando uma mensagem ao utilizador, caso não haja audio gravado. 
  */
  const analyzeRecording = () => {
    if (recordedAudio) {
      audioServiceRef.current.processAudioBlob(
        recordedAudio,
        setIsAnalyzing,
        setWarningInfo,
        setStatus,
        setProgress,
        noteDetectorRef.current,
        setActiveNotes,
        (notes) => {
          // Primeiro definimos as notas detectadas
          setDetectedNotes(notes);
          
          // Marcamos que há uma análise pendente
          if (notes.length > 0) {
            setPendingAnalysis(true);
          }
        }
      );
    } else {
      setStatus("Nenhuma gravação disponível para analisar");
    }
  };

  // Função que permite ao utilizador ouvir o audio gravado
  const playRecording = () => {
    audioServiceRef.current.playRecording(recordedAudio);
  };

  // History control functions
  const saveAnalysisToHistory = (response) => {
    if (detectedNotes.length > 0) {
      historyManager.saveToHistory(detectedNotes, response);
    }
  };

  // Carrega uma análise prévia do histórico
  const loadFromHistory = (historyItem) => {
    // Definimos o item do histórico como pendente
    setPendingHistoryItem(historyItem);
    
    // Depois atualizamos as notas detectadas para atualizar o teclado
    setDetectedNotes(historyItem.notes);
    
    closeHistoryModal();
  };

  // Funções para controlar o modal
  const openHistoryModal = () => {
    setIsModalOpen(true);
  };

  const closeHistoryModal = () => {
    setIsModalOpen(false);
  };

  // Estilo comum para os botões
  const buttonStyle = {
    padding: '10px 20px',
    cursor: 'pointer',
    backgroundColor: '#3F51B5',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontWeight: '500',
    transition: 'all 0.3s ease',
    boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)',
    fontSize: '14px',
    letterSpacing: '0.5px',
    margin: '0 8px'
  };

  // Estilos para hover e disabled
  const getButtonProps = (isDisabled) => ({
    style: {
      ...buttonStyle,
      opacity: isDisabled ? 0.6 : 1,
      cursor: isDisabled ? 'not-allowed' : 'pointer'
    },
    onMouseOver: (e) => {
      if (!isDisabled) {
        e.currentTarget.style.backgroundColor = '#303F9F';
        e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }
    },
    onMouseOut: (e) => {
      e.currentTarget.style.backgroundColor = '#3F51B5';
      e.currentTarget.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.1)';
      e.currentTarget.style.transform = 'translateY(0)';
    },
    disabled: isDisabled
  });

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
          flexWrap: "wrap",
          gap: "10px",
          margin: "20px 0",
        }}
      >
        <button
          onClick={startRecording}
          {...getButtonProps(isRecording || isAnalyzing)}
        >
          Gravar
        </button>
        <button
          onClick={stopRecording}
          {...getButtonProps(!isRecording || isAnalyzing)}
        >
          Parar Gravação
        </button>
        <button
          onClick={analyzeRecording}
          {...getButtonProps(isRecording || !recordingComplete || isAnalyzing)}
        >
          Analisar
        </button>
        <button
          onClick={playRecording}
          {...getButtonProps(isRecording || !recordingComplete || isAnalyzing)}
        >
          Ouvir Gravação
        </button>
        <button
          onClick={openHistoryModal}
          {...getButtonProps(false)} // Sempre disponível
        >
          Ver Histórico
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
            <p>Notas: {noteDetectorRef.current.formatNotes(detectedNotes)}</p>
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
                noteDetectorRef.current.isBlackKey(note.midiNote) ? "black-key" : "white-key"
              } ${chordPitchClasses.has(note.midiNote % 12) ? "active" : ""}`}
            >
              <span className="note-name">
                {noteDetectorRef.current.midiToPitchClassName(note.midiNote)}
              </span>
            </div>
          ))}
        </div>
      </div>
      {detectedNotes.length > 0 && (
        <GeminiComponent 
          ref={geminiComponentRef}
          detectedNotes={detectedNotes}
          searchHistory={historyState.searchHistory}
          onSaveToHistory={saveAnalysisToHistory}
        />
      )}

      {/* Modal para exibir o histórico - Mova-o para fora do GeminiComponent */}
      <Modal 
        isOpen={isModalOpen}
        onClose={closeHistoryModal}
        title="Histórico de Análises"
      >
        <HistoryView 
          searchHistory={historyState.searchHistory}
          onSelectItem={loadFromHistory}
          onClearHistory={() => historyManager.clearHistory()}
        />
      </Modal>
    </div>
  );
}

export default PianoDetector;