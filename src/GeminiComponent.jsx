import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import ReactMarkdown from 'react-markdown';
import Icon from '@mdi/react';
import { mdiChartLine, mdiChevronDown, mdiChevronUp, mdiLoading } from '@mdi/js';

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
const GeminiComponent = forwardRef(({ detectedNotes = [], searchHistory = [], onSaveToHistory }, ref) => {
  // Estados para controlar a interface e o fluxo de dados
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);
  
  /* 
    Expõe funções para outros componentes acessarem via ref.
    IMPORTANTE: Não há mais dependência de useEffect para chamadas automáticas à API.
  */
  useImperativeHandle(ref, () => ({
    // Função para analisar notas usando a API
    analyzeNotes: async () => {
      await handleGeminiRequest(detectedNotes);
    },
    
    // Função para carregar de um item do histórico
    loadHistoryItem: (historyItem) => {
      setResponse(historyItem.response);
      setLoading(false);
      setError('');
      setIsAccordionOpen(true); // Abre o accordion quando carrega do histórico
    }
  }));

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
    Função principal que faz a chamada à Gemini API.
    Controla os estados de carregamento, erro e resposta durante todo o processo.
    Agora recebe as notas como parâmetro em vez de usar o estado.
   */
  const handleGeminiRequest = async (notes) => {
    if (!model) {
      setError("O modelo Gemini não foi inicializado.");
      return;
    }
    if (notes.length === 0) {
      setError("Nenhuma nota para analisar.");
      return;
    }
    
    setLoading(true);
    setError('');
    setIsAccordionOpen(true); // Abre o accordion quando inicia análise
    
    try {
      const prompt = createPrompt(notes);
      const result = await model.generateContent(prompt);
      const textResponse = result.response.text();
      setResponse(textResponse);
      
      // Salvar no histórico após resposta bem-sucedida
      onSaveToHistory(textResponse);
    } catch (error) {
      console.error("Erro ao chamar a Gemini API:", error);
      setError("Ocorreu um erro ao analisar as notas com a Gemini API.");
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
            <span>Análise Musical</span>
            {detectedNotes.length > 0 && (
              <span className="notes-preview">({formatNotes(detectedNotes)})</span>
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
                <p>Analisando as notas...</p>
              </div>
            )}
            
            {error && (
              <div className="error-state">
                {error}
              </div>
            )}
            
            {!apiKeyFromEnv && (
              <p className="api-key-error">
                Erro: REACT_APP_GEMINI_API_KEY não definida. Crie um ficheiro `.env` na raiz do projeto e adicione a chave. Depois, reinicie o servidor.
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