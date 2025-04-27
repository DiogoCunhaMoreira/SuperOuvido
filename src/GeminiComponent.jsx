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
  
  // Formatar as notas em um formato legível
  const formatNotes = (notes) => {
    const noteNames = ["Dó", "Dó#", "Ré", "Ré#", "Mi", "Fá", "Fá#", "Sol", "Sol#", "Lá", "Lá#", "Si"];
    const uniqueNoteNames = new Set(notes.map(midiNote => noteNames[midiNote % 12]));
    return Array.from(uniqueNoteNames).join(", ");
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
    } catch (error) {
      console.error("Erro ao chamar a API Gemini:", error);
      setError("Ocorreu um erro ao analisar as notas com o Gemini.");
    } finally {
      setLoading(false);
    }
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
    </div>
  );
}

export default GeminiComponent;
