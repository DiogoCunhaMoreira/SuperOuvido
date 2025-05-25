import React, { useState, useEffect, useRef } from "react";
import Icon from '@mdi/react';
import { 
  mdiMicrophone, 
  mdiStop, 
  mdiChartLine, 
  mdiPlay, 
  mdiHistory,
  mdiMusicNote
} from '@mdi/js';
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

  // Função auxiliar para determinar a classe do status
  const getStatusClass = (status) => {
    if (status.includes('erro') || status.includes('Erro')) return 'status-error';
    if (status.includes('completo') || status.includes('carregado')) return 'status-success';
    if (status.includes('processando') || status.includes('gravando')) return 'status-processing';
    return 'status-info';
  };

  // Componente de botão moderno
  const ModernButton = ({ 
    onClick, 
    disabled, 
    icon, 
    children, 
    variant = 'primary',
    size = 'medium' 
  }) => {
    const variants = {
      primary: {
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        hoverBackground: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)'
      },
      secondary: {
        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        color: 'white',
        hoverBackground: 'linear-gradient(135deg, #ed7de8 0%, #f04558 100%)'
      },
      success: {
        background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        color: 'white',
        hoverBackground: 'linear-gradient(135deg, #3d9bfd 0%, #00e0ee 100%)'
      }
    };

    const sizes = {
      small: { padding: '8px 16px', fontSize: '12px' },
      medium: { padding: '12px 24px', fontSize: '14px' },
      large: { padding: '16px 32px', fontSize: '16px' }
    };

    return (
      <button
        onClick={onClick}
        disabled={disabled}
        style={{
          ...sizes[size],
          background: disabled ? '#cccccc' : variants[variant].background,
          color: disabled ? '#666' : variants[variant].color,
          border: 'none',
          borderRadius: '12px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: disabled 
            ? 'none' 
            : '0 4px 15px rgba(0, 0, 0, 0.2)',
          transform: disabled ? 'none' : 'translateY(0)',
          letterSpacing: '0.5px',
          margin: '0 6px',
          opacity: disabled ? 0.6 : 1,
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            e.target.style.background = variants[variant].hoverBackground;
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.3)';
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled) {
            e.target.style.background = variants[variant].background;
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
          }
        }}
      >
        {icon && <Icon path={icon} size={0.8} />}
        {children}
      </button>
    );
  };

  return (
    /* Componente visual da aplicação que utiliza classes definidas no ficheiro PianoDetector.css */
    <div className="piano-detector-modern">
      {/* Header com informações */}
      <div className="status-card">
        <div className="status-header">
          <Icon path={mdiMusicNote} size={1.2} />
          <h2>Detector de Notas Piano</h2>
        </div>
        
        <div className="status-content">
          <div className="status-item">
            <span className="status-label">Status:</span>
            <span className={`status-value ${getStatusClass(status)}`}>
              {status}
            </span>
          </div>
          
          {isRecording && (
            <div className="recording-indicator">
              <div className="pulse-dot"></div>
              <span>Gravando: {recordingDuration.toFixed(1)}s</span>
            </div>
          )}
          
          {progress > 0 && progress < 1 && (
            <div className="progress-container">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${Math.round(progress * 100)}%` }}
                ></div>
              </div>
              <span className="progress-text">
                Processando: {Math.round(progress * 100)}%
              </span>
            </div>
          )}
          
          {warningInfo && (
            <div className="warning-card">
              {warningInfo}
            </div>
          )}
          
          {detectedNotes.length > 0 && (
            <div className="detected-notes">
              <span className="notes-label">Notas:</span>
              <span className="notes-display">
                {noteDetectorRef.current.formatNotes(detectedNotes)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Controles modernos */}
      <div className="controls-modern">
        <ModernButton
          onClick={startRecording}
          disabled={isRecording || isAnalyzing}
          icon={mdiMicrophone}
          variant="primary"
        >
          Gravar
        </ModernButton>
        
        <ModernButton
          onClick={stopRecording}
          disabled={!isRecording || isAnalyzing}
          icon={mdiStop}
          variant="secondary"
        >
          Parar Gravação
        </ModernButton>
        
        <ModernButton
          onClick={analyzeRecording}
          disabled={isRecording || !recordingComplete || isAnalyzing}
          icon={mdiChartLine}
          variant="success"
        >
          Analisar
        </ModernButton>
        
        <ModernButton
          onClick={playRecording}
          disabled={isRecording || !recordingComplete || isAnalyzing}
          icon={mdiPlay}
          variant="primary"
        >
          Ouvir Gravação
        </ModernButton>
        
        <ModernButton
          onClick={openHistoryModal}
          disabled={false}
          icon={mdiHistory}
          variant="secondary"
        >
          Ver Histórico
        </ModernButton>
      </div>

      {/* Mostra o teclado virtual que vai mostrar as notas tocadas pelo utilizador */}
      <div className="piano-container">
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
