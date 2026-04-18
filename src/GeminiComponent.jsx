import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import { GoogleGenerativeAI } from '@google/generative-ai';
import ReactMarkdown from 'react-markdown';
import Icon from '@mdi/react';
import { mdiChartLine, mdiChevronDown, mdiChevronUp, mdiLoading } from '@mdi/js';
import { buildAnalysisPrompt } from './i18n/prompts';
import { getNoteNamesForLang } from './hooks/useNoteNames';

const apiKeyFromEnv = process.env.REACT_APP_GEMINI_API_KEY;
let genAI;
let model;
if (!apiKeyFromEnv) {
  console.error("Erro: Private key não encontrada");
} else {
  genAI = new GoogleGenerativeAI(apiKeyFromEnv);
  model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}

const formatNotesForLang = (notes, lang) => {
  const noteNames = getNoteNamesForLang(lang);
  const uniqueNoteNames = new Set(notes.map((midiNote) => noteNames[midiNote % 12]));
  return Array.from(uniqueNoteNames).join(", ");
};

const GeminiComponent = forwardRef(({ detectedNotes = [], searchHistory = [], onSaveToHistory }, ref) => {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);

  useImperativeHandle(ref, () => ({
    analyzeNotes: async () => {
      await handleGeminiRequest(detectedNotes);
    },
    loadHistoryItem: (historyItem) => {
      setResponse(historyItem.response);
      setLoading(false);
      setError('');
      setIsAccordionOpen(true);
    }
  }));

  const handleGeminiRequest = async (notes) => {
    if (!model) {
      setError(t('analysis.modelNotInit'));
      return;
    }
    if (notes.length === 0) {
      setError(t('analysis.noNotes'));
      return;
    }

    setLoading(true);
    setError('');
    setIsAccordionOpen(true);

    try {
      const lang = i18n.language;
      const formattedNotes = formatNotesForLang(notes, lang);
      const prompt = buildAnalysisPrompt(formattedNotes, lang);
      const result = await model.generateContent(prompt);
      const textResponse = result.response.text();
      setResponse(textResponse);

      onSaveToHistory(textResponse);
    } catch (err) {
      console.error("Erro ao chamar a Gemini API:", err);
      setError(t('analysis.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gemini-response-modern">
      <div className="analysis-accordion">
        <button
          className="analysis-accordion-header"
          onClick={() => setIsAccordionOpen(!isAccordionOpen)}
          disabled={!response && !loading}
        >
          <div className="analysis-accordion-title">
            <Icon path={mdiChartLine} size={1} />
            <span>{t('analysis.title')}</span>
            {detectedNotes.length > 0 && (
              <span className="notes-preview">({formatNotesForLang(detectedNotes, i18n.language)})</span>
            )}
          </div>
          <Icon
            path={isAccordionOpen ? mdiChevronUp : mdiChevronDown}
            size={1}
            className="analysis-accordion-icon"
          />
        </button>

        {isAccordionOpen && (
          <div className="analysis-accordion-content">
            {loading && (
              <div className="loading-state">
                <Icon path={mdiLoading} size={1.5} className="loading-icon" />
                <p>{t('analysis.loading')}</p>
              </div>
            )}

            {error && (
              <div className="error-state">
                {error}
              </div>
            )}

            {!apiKeyFromEnv && (
              <p className="api-key-error">
                {t('analysis.noApiKey')}
              </p>
            )}

            {response && !loading && (
              <div className="markdown-response">
                <ReactMarkdown>{response}</ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default GeminiComponent;
