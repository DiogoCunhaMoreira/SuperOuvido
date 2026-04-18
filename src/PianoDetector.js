import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
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
import { useNoteNames } from "./hooks/useNoteNames";

const PianoDetector = () => {
  const { t } = useTranslation();
  const noteNames = useNoteNames();

  // Estados
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recordingComplete, setRecordingComplete] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState(null);
  const [statusInfo, setStatusInfo] = useState({ key: 'status.ready', type: 'info', params: {} });
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

  const setStatus = useCallback((key, type = 'info', params = {}) => {
    setStatusInfo({ key, type, params });
  }, []);

  // Subscreve às mudanças no store do history.
  useEffect(() => {
    const unsubscribe = historyManager.subscribe(newState => {
      setHistoryState(newState);
    });
    historyManager.loadHistory();
    return () => {
      unsubscribe();
    };
  }, []);

  // Inicializa o BasicPitch assim que a aplicação é iniciada.
  useEffect(() => {
    noteDetectorRef.current.initBasicPitch(setStatus);
  }, [setStatus]);

  useEffect(() => {
    if (pendingAnalysis && geminiComponentRef.current && detectedNotes.length > 0) {
      geminiComponentRef.current.analyzeNotes();
      setPendingAnalysis(false);
    }

    if (pendingHistoryItem && geminiComponentRef.current) {
      geminiComponentRef.current.loadHistoryItem(pendingHistoryItem);
      setPendingHistoryItem(null);
    }
  }, [pendingAnalysis, pendingHistoryItem, detectedNotes]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      audioServiceRef.current.cleanup();
    };
  }, []);

  useEffect(() => {
    if (detectedNotes.length > 0) {
      const pitchClasses = new Set(detectedNotes.map((note) => note % 12));
      setChordPitchClasses(pitchClasses);
    } else {
      setChordPitchClasses(new Set());
    }
  }, [detectedNotes]);

  const startRecording = async () => {
    try {
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
      setStatus('status.micError', 'error', { message: error.message });
    }
  };

  const stopRecording = () => {
    if (isRecording) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      audioServiceRef.current.stopRecording(setIsRecording);
    }
  };

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
      setStatus('status.noRecording', 'info');
    }
  };

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

  const saveAnalysisToHistory = (response) => {
    if (detectedNotes.length > 0) {
      historyManager.saveToHistory(detectedNotes, response, recordedAudio);
    }
  };

  const loadFromHistory = async (historyItem) => {
    setPendingHistoryItem(historyItem);
    setDetectedNotes(historyItem.notes);
    setRecordedAudio(null);

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


  const openHistoryModal = () => {
    setIsModalOpen(true);
  };

  const closeHistoryModal = () => {
    setIsModalOpen(false);
  };

  const getStatusClass = (type) => {
    switch (type) {
      case 'error': return 'status-error';
      case 'success': return 'status-success';
      case 'processing': return 'status-processing';
      default: return 'status-info';
    }
  };

  const statusText = t(statusInfo.key, statusInfo.params);

  const Button = ({ onClick, disabled, icon, children, variant = 'primary', size = 'medium' }) => {
    const variants = {
      primary: {
        background: '#86B0BD',
        color: '#FFF0DD',
        hoverBackground: '#E2A16F'
      },
      secondary: {
        background: '#E2A16F',
        color: '#FFF0DD',
        hoverBackground: '#86B0BD'
      },
      success: {
        background: '#86B0BD',
        color: '#FFF0DD',
        hoverBackground: '#E2A16F'
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
          background: disabled ? '#D1D3D4' : variants[variant].background,
          color: disabled ? '#E2A16F' : variants[variant].color,
          border: 'none',
          borderRadius: '12px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          fontWeight: '600',
          transition: 'all 0.2s ease',
          boxShadow: disabled ? 'none' : '0 2px 6px rgba(134, 176, 189, 0.15)',
          transform: disabled ? 'none' : 'translateY(0)',
          minHeight: '44px',
          touchAction: 'manipulation',
          ...sizes[size]
        }}
        onMouseOver={(e) => {
          if (!disabled) {
            e.target.style.background = variants[variant].hoverBackground;
            e.target.style.transform = 'translateY(-1px)';
            e.target.style.boxShadow = '0 4px 10px rgba(134, 176, 189, 0.2)';
          }
        }}
        onMouseOut={(e) => {
          if (!disabled) {
            e.target.style.background = variants[variant].background;
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 2px 6px rgba(134, 176, 189, 0.15)';
          }
        }}
      >
        {icon && <Icon path={icon} size={0.8} />}
        {children}
      </button>
    );
  };

  return (
    <div className="piano-detector-modern">
      <div className="status-card">
        <div className="status-header">
          <Icon path={mdiMusicNote} size={1.2} />
          <h2>{t('app.title')}</h2>
        </div>

        <div className="status-content">
          <div className="status-item">
            <span className="status-label">{t('status.label')}</span>
            <span className={`status-value ${getStatusClass(statusInfo.type)}`}>
              {statusText}
            </span>
          </div>

          {isRecording && (
            <div className="status-item">
              <div className="recording-indicator">
                <div className="pulse-dot"></div>
                <span>{t('status.recordingLive')}</span>
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
                {t('status.progressProcessing', { percent: Math.round(progress * 100) })}
              </div>
            </div>
          )}

          {warningInfo && (
            <div className="warning-card">
              {t(warningInfo)}
            </div>
          )}

          {detectedNotes.length > 0 && (
            <div className="notes-accordion">
              <div className="detected-notes">
                <span className="notes-label">{t('notes.detected')}</span>
                <span className="notes-display">
                  {noteDetectorRef.current.formatNotes(detectedNotes, noteNames)}
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
            {t('buttons.start')}
          </Button>
        ) : (
          <Button
            onClick={stopRecording}
            icon={mdiStop}
            variant="secondary"
          >
            {t('buttons.stop')}
          </Button>
        )}

        {recordedAudio && !pendingHistoryItem && (
          <Button
            onClick={playRecording}
            icon={mdiPlay}
            variant="success"
          >
            {t('buttons.playCurrent')}
          </Button>
        )}

        {currentAudioId && pendingHistoryItem && (
          <Button
            onClick={playHistoryAudio}
            icon={mdiPlay}
            variant="secondary"
          >
            {t('buttons.playHistory')}
          </Button>
        )}

        {recordingComplete && !isAnalyzing && (
          <Button
            onClick={analyzeRecording}
            icon={mdiChartLine}
            variant="primary"
          >
            {t('buttons.analyze')}
          </Button>
        )}

        <Button
          onClick={openHistoryModal}
          icon={mdiHistory}
          variant="secondary"
        >
          {t('buttons.history', { count: historyState.searchHistory.length })}
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
                  {noteDetectorRef.current.midiToPitchClassName(note.midiNote, noteNames)}
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
        title={t('history.title')}
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
