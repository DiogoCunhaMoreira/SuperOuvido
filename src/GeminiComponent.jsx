import React, { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import ReactMarkdown from 'react-markdown';

const apiKeyFromEnv = process.env.REACT_APP_GEMINI_API_KEY;

let genAI;
let model;

if (!apiKeyFromEnv) {
  console.error("Erro: Não encontrou a variável no .env");
} else {
  genAI = new GoogleGenerativeAI(apiKeyFromEnv);
  model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
}

function GeminiComponent({ detectedNotes = [] }) {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const [searchHistory, setSearchHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  
  // Carregar o histórico ao iniciar o componente
  useEffect(() => {
    const savedHistory = localStorage.getItem("notesAnalysisHistory");
    if (savedHistory) {
      try {
        setSearchHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Erro ao carregar histórico:", e);
        localStorage.removeItem("notesAnalysisHistory");
        setSearchHistory([]);
      }
    }
  }, []);
  
  // Formatar as notas em um formato legível
  const formatNotes = (notes) => {
    const noteNames = ["Dó", "Dó#", "Ré", "Ré#", "Mi", "Fá", "Fá#", "Sol", "Sol#", "Lá", "Lá#", "Si"];
    const uniqueNoteNames = new Set(notes.map(midiNote => noteNames[midiNote % 12]));
    return Array.from(uniqueNoteNames).join(", ");
  };
  
  const saveToHistory = (notes, analysisResponse) => {
    // Recupere o histórico atual
    let currentHistory = [];
    const savedHistory = localStorage.getItem("notesAnalysisHistory");
    if (savedHistory) {
      try {
        currentHistory = JSON.parse(savedHistory);
      } catch (e) {
        console.error("Erro ao carregar histórico:", e);
      }
    }
    
    const formattedNotes = formatNotes(notes);
    
    // Verifique se já existe uma entrada com as mesmas notas
    const isDuplicate = currentHistory.some(item => 
      item.formattedNotes === formattedNotes
    );
    
    // Se não for duplicata, adicione ao histórico
    if (!isDuplicate) {
      const historyItem = {
        id: Date.now(),
        notes: [...notes],
        formattedNotes,
        response: analysisResponse,
        timestamp: new Date().toISOString()
      };
      
      // Adicionar ao início do histórico e limitar a 20 itens
      const updatedHistory = [historyItem, ...currentHistory].slice(0, 20);
      setSearchHistory(updatedHistory);
      localStorage.setItem("notesAnalysisHistory", JSON.stringify(updatedHistory));
    }
  };  
  
  // Criar o prompt automaticamente com as notas detectadas
  const createPrompt = (notes) => {
    const formattedNotes = formatNotes(notes);
    return `Analisei estas notas musicais: ${formattedNotes}. 
    Diz-me qual acorde isso poderia formar, quais as escalas a que estas notas pertencem, 
    e sugere algumas progressões harmónicas possíveis baseadas neste conjunto de notas.
    Formata a tua resposta com Markdown, usando títulos, listas e secções para melhor legibilidade.
    A resposta deve ser dada em pt pt.`;
  };

  // Chama a API Gemini automaticamente quando as notas mudam
  useEffect(() => {
    if (detectedNotes.length > 0) {
      handleGeminiRequest();
    }
  }, [detectedNotes]);

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
      
      // Salvar no histórico após obter resposta com sucesso
      saveToHistory(detectedNotes, textResponse);
    } catch (error) {
      console.error("Erro ao chamar a API Gemini:", error);
      setError("Ocorreu um erro ao analisar as notas com o Gemini.");
    } finally {
      setLoading(false);
    }
  };

  // Limpar histórico
  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem("notesAnalysisHistory");
  };
  
  // Carregar análise do histórico
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
      
      {/* Botão para mostrar/ocultar histórico - SEMPRE VISÍVEL */}
      <button 
        onClick={() => setShowHistory(!showHistory)}
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
              onClick={clearHistory} 
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
