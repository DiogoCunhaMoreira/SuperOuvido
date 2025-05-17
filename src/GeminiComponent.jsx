import React, { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import ReactMarkdown from 'react-markdown';

/*
  Inicializa a API usando a API key e, se a chave não estiver definida,
  apresenta uma mensagem de erro.
 */
const apiKeyFromEnv = process.env.REACT_APP_GEMINI_API_KEY;
let genAI;
let model;
if (!apiKeyFromEnv) {
  console.error("Erro: Private key não encontrada");
} else {
  genAI = new GoogleGenerativeAI(apiKeyFromEnv);
  model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
}

/*
  Componente responsável pela comunicação com a Gemini API. Recebe as notas detectadas,
  analisa-as e retorna a resposta do LLM.
 */
function GeminiComponent({ detectedNotes = [], searchHistory = [], showHistory = false, onSaveToHistory, onToggleHistory, onClearHistory }) {
  // Estados para controlar a interface e o fluxo de dados
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');

  /* 
    Converte notas MIDI em notas "legíveis".
    Usa um Set para eliminar notas duplicadas e retorna uma string formatada.
    Usada na exibição e no prompt.
   */
  const formatNotes = (notes) => {
    const noteNames = ["Dó", "Dó#", "Ré", "Ré#", "Mi", "Fá", "Fá#", "Sol", "Sol#", "Lá", "Lá#", "Si"];
    const uniqueNoteNames = new Set(notes.map(midiNote => noteNames[midiNote % 12]));
    return Array.from(uniqueNoteNames).join(", ");
  };

  /*
    Construção do prompt baseado nas notas detectadas.
   */
  const createPrompt = (notes) => {
    const formattedNotes = formatNotes(notes);
    return `Analisei estas notas musicais: ${formattedNotes}. Diz-me qual acorde isso poderia formar, quais as escalas a que estas notas pertencem, e sugere algumas progressões harmónicas possíveis baseadas neste conjunto de notas. Formata a tua resposta com Markdown, usando títulos, listas e secções para melhor legibilidade. A resposta deve ser dada em pt pt. Atenção aos acentos e diferenças entre Português de Portugal e Português do Brasil.`;
  };

  /*
    Effect Hook que chama a API sempre que as notas detectadas mudam, garantindo que a análise
    só é executada quando há notas para analisar.
   */
  useEffect(() => {
    if (detectedNotes.length > 0) {
      handleGeminiRequest();
    }
  }, [detectedNotes]);

  /*
    Effect Hook que guarda a resposta no histórico
   */
  useEffect(() => {
    if (response && !loading && detectedNotes.length > 0) {
      onSaveToHistory(response);
    }
  }, [response, loading]);

  /*
    Função principal que faz a chamada à Gemini API.
    Controla os estados de carregamento, erro e resposta durante todo o processo.
   */
  const handleGeminiRequest = async () => {
    if (!model) {
      setError("O modelo Gemini não foi inicializado.");
      return;
    }
    if (detectedNotes.length === 0) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const prompt = createPrompt(detectedNotes);
      const result = await model.generateContent(prompt);
      const textResponse = result.response.text();
      setResponse(textResponse);
    } catch (error) {
      console.error("Erro ao chamar a Gemini API:", error);
      setError("Ocorreu um erro ao analisar as notas com a Gemini API.");
    } finally {
      setLoading(false);
    }
  };

  /*
    Carrega uma análise prévia do histórico e permite que o utilizador
    recupere análises anteriores
   */
  const loadFromHistory = (historyItem) => {
    setResponse(historyItem.response);
  };

  return (
    <div className="gemini-response" style={{ 
      margin: '20px 0', 
      width: '100%', 
      maxWidth: '800px',
      padding: '15px',
      border: '1px solid #ddd',
      borderRadius: '8px',
      backgroundColor: '#f9f9f9' 
    }}>
      <h3>Análise Musical</h3>
      
      {detectedNotes.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <p><strong>Notas detectadas:</strong> {formatNotes(detectedNotes)}</p>
        </div>
      )}
      
      {loading && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <p>Analisando as notas...</p>
        </div>
      )}
      
      {error && (
        <div style={{ color: 'red', margin: '10px 0' }}>
          {error}
        </div>
      )}
      
      {!apiKeyFromEnv && (
        <p style={{ color: 'red', marginTop: '10px' }}>
          Erro: REACT_APP_GEMINI_API_KEY não definida. Crie um ficheiro `.env` na raiz do projeto e adicione a chave. Depois, reinicie o servidor.
        </p>
      )}
      
      {response && !loading && (
        <div className="markdown-response">
          <ReactMarkdown>{response}</ReactMarkdown>
        </div>
      )}
      
      <button 
        onClick={onToggleHistory}
        style={{ 
          marginTop: '20px', 
          padding: '8px 15px', 
          cursor: 'pointer',
          display: 'block'
        }}
      >
        {showHistory ? "Ocultar Histórico" : "Mostrar Histórico"}
      </button>
      
      {/* Histórico de análises - Mostrado quando showHistory é true */}
      {showHistory && (
        <div className="search-history" style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: '0' }}>Histórico de Análises</h4>
            <button 
              onClick={onClearHistory} 
              style={{ fontSize: '0.8rem', padding: '4px 8px' }}
            >
              Limpar histórico
            </button>
          </div>
          
          {searchHistory.length > 0 ? (
            <div style={{ maxHeight: '300px', overflowY: 'auto', marginTop: '10px' }}>
              {searchHistory.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => loadFromHistory(item)}
                  style={{ 
                    padding: '10px', 
                    margin: '8px 0', 
                    border: '1px solid #eee',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#e9e9e9"}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  <p><strong>Notas:</strong> {item.formattedNotes}</p>
                  <p style={{ fontSize: '0.8rem', color: '#777' }}>
                    {new Date(item.timestamp).toLocaleDateString()} às {new Date(item.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ marginTop: '10px', fontStyle: 'italic' }}>Nenhuma análise no histórico.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default GeminiComponent;