import React, { useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKeyFromEnv = process.env.REACT_APP_GEMINI_API_KEY;

let genAI;
let model;

if (!apiKeyFromEnv) {
  console.error("Erro: Não encontrou a variável no .env");
} else {
  genAI = new GoogleGenerativeAI(apiKeyFromEnv);
  model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
}


function GeminiComponent() {
  const [prompt, setPrompt] = useState('');

  const handleInputChange = (event) => {
    setPrompt(event.target.value);
  };

  const chamarApi = async () => {
    if (!model) {
        console.error("O modelo Gemini não foi inicializado.");
        alert("Erro na configuração da API Key");
        return;
    }
     if (!prompt.trim()) {
      alert("Por favor, insira texto.");
      return;
    }


    try {
        const result = await model.generateContent(prompt);
        console.log(result.response.text());
         alert("Resposta recebida!");
    } catch (error) {
        console.error("Erro ao chamar a API Gemini:", error);
        alert("Ocorreu um erro ao chamar a API");
    }

  };

  return (
    <div>
      <input
        type="text"
        placeholder="Enter text"
        value={prompt}
        onChange={handleInputChange}
        disabled={!apiKeyFromEnv}
      />
      <button
        onClick={chamarApi}
        disabled={!apiKeyFromEnv}
      >
        Teste
      </button>
      {!apiKeyFromEnv && (
        <p style={{ color: 'red', marginTop: '10px' }}>
          Erro: REACT_APP_GEMINI_API_KEY não definida. Crie um ficheiro `.env` na raiz do projeto e adicione a chave. Depois, reinicie o servidor.
        </p>
      )}
    </div>
  );
}

export default GeminiComponent;
