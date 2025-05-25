import React, { useState, useEffect, useRef } from "react";
import Icon from '@mdi/react';
import { mdiMicrophone, mdiStop, mdiChartLine, mdiPlay, mdiHistory, mdiMusicNote } from '@mdi/js';
import "./PianoDetector.css";
import GeminiComponent from "./GeminiComponent";
import AudioService from "./AudioService";
import AudioCacheService from "./AudioCacheService";
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

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [historyState, setHistoryState] = useState({
    searchHistory: [],
    showHistory: false
  });

  const [pendingAnalysis, setPendingAnalysis] = useState(false);
  const [pendingHistoryItem, setPendingHistoryItem] = useState(null);
  const [currentAudioId, setCurrentAudioId] = useState(null);

  const audioServiceRef = useRef(new AudioService());
  const audioCacheServiceRef = useRef(new AudioCacheService());
  const noteDetectorRef = useRef(new NoteDetector());
  const geminiComponentRef = useRef(null);
  const timerRef = useRef(null);
  const durationRef = useRef(null);

  const allNotes = noteDetectorRef.current.getAllNotes();

  // Subscreve às mudanças no store do history.
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

  // Inicializa o BasicPitch assim que a aplicação é iniciada (assim que o componente é montado).
  useEffect(() => {
    noteDetectorRef.current.initBasicPitch(setStatus);
  }, []);

  // Effect para lidar com análise pendente quando o componente Gemini está pronto.
  useEffect(() => {
    if (pendingAnalysis && geminiComponentRef.current && detectedNotes.length > 0) {
      geminiComponentRef.current.analyzeNotes();
      setPendingAnalysis(false);
    }

    if (pendingHistoryItem && geminiComponentRef.current) {
      geminiComponentRef.current.loadHistoryItem(pendingHistoryItem);
      setPendingHistoryItem(null);
    }
  }, [pendingAnalysis, pendingHistoryItem, detectedNotes, geminiComponentRef.current]);

  /* Permite fazer um cleanup dos recursos sempre que a aplicação é fechada (componente desmontado):
  - Termina o temporizador
  - Liberta o microfone
  - Fecha o contexto de audio */
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      audioServiceRef.current.cleanup();
    };
  }, []);

  /* 
  Hook que é chamado sempre que o estado detectedNotes muda, convertendo cada nota MIDI 
  para a sua pitch class, ou seja, converte para um valor de 0 a 11 que corresponde à sua 
  nota mas sem a oitava onde foi tocada. 
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
        setActiveNotes,
        setDetectedNotes,
        setRecordingComplete,
        setRecordedAudio,
        setWarningInfo
      );

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        const duration = (Date.now() - startTime) / 1000;
        if (durationRef.current) {
          durationRef.current.textContent = `${duration.toFixed(1)}s`;
        }
      }, 100);
    } catch (error) {
      console.error("Erro ao começar a gravação:", error);
      setStatus(`Erro ao acessar o microfone: ${error.message}`);
    }
  };

  // Função responsável por terminar o processo de gravação.
  const stopRecording = () => {
    if (isRecording) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      audioServiceRef.current.stopRecording(setIsRecording);
    }
  };

  /* 
  Função que inicia a análise de dados, chamando a função processAudioBlob() ou mostrando
  uma mensagem ao utilizador, caso não haja audio gravado.
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
          setDetectedNotes(notes);
          if (notes.length > 0) {
            setPendingAnalysis(true);
          }
        }
      );
    } else {
      setStatus("Nenhuma gravação disponível para analisar");
    }
  };

  // Função que permite ao utilizador ouvir o audio gravado.
  const playRecording = () => {
    audioServiceRef.current.playRecording(recordedAudio);
  };

  const playHistoryAudio = async () => {
    if (currentAudioId) {
      const cachedAudio = await audioCacheServiceRef.current.loadAudioFromCache(currentAudioId);
      if (cachedAudio) {
        audioServiceRef.current.playRecording(cachedAudio);
      }
    }
  };

  /* 
  Função que salva a análise no histórico e chama o componente Gemini para exibir a análise.
  */
  const saveAnalysisToHistory = (response) => {
    if (detectedNotes.length > 0) {
      historyManager.saveToHistory(detectedNotes, response, recordedAudio);
    }
  };

  // Carrega uma análise prévia do histórico
  const loadFromHistory = async (historyItem) => {
    setPendingHistoryItem(historyItem);
    setDetectedNotes(historyItem.notes);
    setRecordedAudio(null);
    
    /* 
    Se o item do histórico tiver um áudio associado,
    carrega-o do cache e define o ID atual do áudio.
    */
    if (historyItem.audioId) {
        setCurrentAudioId(historyItem.audioId);
        const cachedAudio = await audioCacheServiceRef.current.loadAudioFromCache(historyItem.audioId);
        if (cachedAudio) {
            setRecordedAudio(cachedAudio);
        }
    } else {
        setCurrentAudioId(null);
    }
    
    closeHistoryModal();
};


  // Funções para controlar o modal
  const openHistoryModal = () => {
    setIsModalOpen(true);
  };

  const closeHistoryModal = () => {
    setIsModalOpen(false);
  };

  /* 
  Função que retorna a classe CSS baseada no estado atual.
  */
  const getStatusClass = (status) => {
    if (status.includes('erro') || status.includes('Erro')) return 'status-error';
    if (status.includes('completo') || status.includes('carregado')) return 'status-success';
    if (status.includes('processando') || status.includes('gravando')) return 'status-processing';
    return 'status-info';
  };

  /*
  Lógica associada aos botões.
  */
  const Button = ({ onClick, disabled, icon, children, variant = 'primary', size = 'medium' }) => {
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
          background: disabled ? '#e2e8f0' : variants[variant].background,
          color: disabled ? '#a0aec0' : variants[variant].color,
          border: 'none',
          borderRadius: '12px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: '600',
          transition: 'all 0.3s ease',
          boxShadow: disabled ? 'none' : '0 4px 12px rgba(0, 0, 0, 0.15)',
          transform: disabled ? 'none' : 'translateY(0)',
          ...sizes[size]
        }}
        onMouseOver={(e) => {
          if (!disabled) {
            e.target.style.background = variants[variant].hoverBackground;
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
          }
        }}
        onMouseOut={(e) => {
          if (!disabled) {
            e.target.style.background = variants[variant].background;
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
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
      <div className="status-card">
        <div className="status-header">
          <Icon path={mdiMusicNote} size={1.2} />
          <h2>Detetor de Notas de Piano</h2>
        </div>

        <div className="status-content">
          <div className="status-item">
            <span className="status-label">Estado:</span>
            <span className={`status-value ${getStatusClass(status)}`}>
              {status}
            </span>
          </div>

          {isRecording && (
            <div className="status-item">
              <div className="recording-indicator">
                <div className="pulse-dot"></div>
                <span>A gravar</span>
                <span ref={durationRef}>0.0s</span>
              </div>
            </div>
          )}

          {isAnalyzing && (
            <div className="progress-container">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${progress * 100}%` }}
                ></div>
              </div>
              <div className="progress-text">
                Processando: {Math.round(progress * 100)}%
              </div>
            </div>
          )}

          {warningInfo && (
            <div className="warning-card">
              {warningInfo}
            </div>
          )}

          {detectedNotes.length > 0 && (
            <div className="notes-accordion">
              <div className="detected-notes">
                <span className="notes-label">Notas detectadas:</span>
                <span className="notes-display">
                  {noteDetectorRef.current.formatNotes(detectedNotes)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="controls-modern">
        {!isRecording ? (
          <Button 
            onClick={startRecording} 
            disabled={isAnalyzing}
            icon={mdiMicrophone}
            variant="primary"
          >
            Iniciar Gravação
          </Button>
        ) : (
          <Button 
            onClick={stopRecording}
            icon={mdiStop}
            variant="secondary"
          >
            Parar Gravação
          </Button>
        )}

        {recordedAudio && !pendingHistoryItem && (
          <Button 
            onClick={playRecording}
            icon={mdiPlay}
            variant="success"
          >
            Ouvir Gravação Atual
          </Button>
        )}

        {currentAudioId && pendingHistoryItem && (
          <Button 
            onClick={playHistoryAudio}
            icon={mdiPlay}
            variant="secondary"
          >
            Ouvir Gravação do Histórico
          </Button>
        )}

        {recordingComplete && !isAnalyzing && (
          <Button 
            onClick={analyzeRecording}
            icon={mdiChartLine}
            variant="primary"
          >
            Analisar Gravação
          </Button>
        )}

        <Button 
          onClick={openHistoryModal}
          icon={mdiHistory}
          variant="secondary"
        >
          Histórico ({historyState.searchHistory.length})
        </Button>
      </div>

      <div className="piano-container">
        <div className="piano-keyboard">
          {allNotes.map((note) => {
            const isActive = chordPitchClasses.has(note.id);
            const isBlack = noteDetectorRef.current.isBlackKey(note.midiNote);
            
            return (
              <div
                key={note.id}
                className={`piano-key ${isBlack ? 'black-key' : 'white-key'} ${isActive ? 'active' : ''}`}
              >
                <span className="note-name">
                  {noteDetectorRef.current.midiToPitchClassName(note.midiNote)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <GeminiComponent
        ref={geminiComponentRef}
        detectedNotes={detectedNotes}
        searchHistory={historyState.searchHistory}
        onSaveToHistory={saveAnalysisToHistory}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={closeHistoryModal}
        title="Histórico de Análises"
      >
        <HistoryView
          searchHistory={historyState.searchHistory}
          onSelectItem={loadFromHistory}
          onClearHistory={() => {
            historyManager.clearHistory();
            closeHistoryModal();
          }}
        />
      </Modal>
    </div>
  );
};

export default PianoDetector;