<template>
  <div>
    <h1>Super Ouvido!</h1>
    <button @click="toggleListening">
      {{ listening ? 'Parar de Ouvir!' : 'Começar a Ouvir!' }}
    </button>
    <p>Nota Detectada: {{ note || '--' }}</p>
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount } from 'vue';

// Variáveis para o processamento de áudio
const audioContext = ref(null); // Contexto de áudio para o processamento
const analyser = ref(null); // Analisador de frequência
const mediaStreamSource = ref(null); // Fonte do stream de áudio
const rafID = ref(null); // ID do requestAnimationFrame

// Tamanho do buffer para análise do sinal
const buflen = 4096;
const buf = new Float32Array(buflen);

// Stream do microfone
let stream = null;

// Estado de escuta ativo/inativo
const listening = ref(false);

// Nota musical detectada
const note = ref(null);

// Variáveis responsáveis pela deteção de notas consecutivas e eliminação de falsos positivos
const noteDetectionCounter = ref(0);
const requiredDetections = 3;
let lastDetectedNote = null;

// Limites de frequência para detecção (Dó2 até Dó6) - Os números a seguir ao número da nota representam a oitava onde se localizam
const MIN_FREQ = 65; // Dó2
const MAX_FREQ = 1046.5; // Dó6

// Toggle que permite alternar entre o estado de escuta ou "não-escuta"
function toggleListening() {
  if (listening.value) {
    stopListening();
  } else {
    startListening();
  }
  listening.value = !listening.value;
}

// Inicia a captura e processamento de áudio
function startListening() {

  note.value = null;
  noteDetectionCounter.value = 0;
  lastDetectedNote = null;
  
  if (!audioContext.value) {
    audioContext.value = new (window.AudioContext || window.webkitAudioContext)();
  }

  navigator.mediaDevices.getUserMedia({ audio: true })
    .then((micStream) => {
      stream = micStream;
      mediaStreamSource.value = audioContext.value.createMediaStreamSource(micStream);
      analyser.value = audioContext.value.createAnalyser();
      analyser.value.fftSize = 4096;
      
      // Filtro bandpass para que haja mais foco nas frequências relevantes
      const bandpassFilter = audioContext.value.createBiquadFilter();
      bandpassFilter.type = "bandpass";
      // Frequência central (Hz), baseada num valor central entre a frequencia do Dó2 (MIN_FREQ) ao Dó6 (MAX_FREQ)
      bandpassFilter.frequency.value = 550;
      // Largura de banda (Q baixo = banda larga, ou seja, permite um range maior de frequências)
      bandpassFilter.Q.value = 0.5;
      
      // Conexão entre o microfone, o filtro bandpass e o analizador
      mediaStreamSource.value.connect(bandpassFilter);
      bandpassFilter.connect(analyser.value);

      updatePitch();
    })
    .catch((err) => {
      console.error('Erro ao acessar ao microfone:', err);
      listening.value = false;
    });
}

// Função responsável por terminar a captura de audio do microfone, cancelar o animation frame (e limpeza da variável rafID)
// e, por fim, encerrar o contexto de audio, limpando também a variável audioContext.
function stopListening() {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  if (rafID.value) {
    cancelAnimationFrame(rafID.value);
    rafID.value = null;
  }

  if (audioContext.value) {
    audioContext.value.close().catch((e) => console.warn(e));
    audioContext.value = null;
  }
}

// Função responsável por analisar o pitch. Utiliza o animationFrame para se chamar recursivamente, a uma rate
// aproximadada de 60 vezes por segundo (refresh rate tipica dos browsers atuais).
// Utiliza o analisador, chamando a função getFloatTimeDomainData() que recebe o buffer como argumento e permite 
// obter a forma de onda atual do sinal de audio.
// É chamada a função calculateAMDF que vai analisar os dados usando o algoritmo AMDF e determinar a frequência.
// Converte a frequência para uma nota músical especifica e, para que o número de falsos pisitivos seja reduzido, a função
// só termina quando a mesma nota for detetada 3 vezes (valor que pode ser alterado na variável requiredDetections)

function updatePitch() {
  rafID.value = requestAnimationFrame(updatePitch);
  if (!analyser.value) return;

  analyser.value.getFloatTimeDomainData(buf);
  const acResult = calculateAMDF(buf, audioContext.value.sampleRate);
  
  if (acResult !== -1) {
    const pitch = acResult;
    const noteNumber = noteFromPitch(pitch);
    const noteName = noteStrings[noteNumber % 12];
    const octave = Math.floor(noteNumber / 12) - 1;
    const fullNoteName = `${noteName}${octave}`;
    
    if (fullNoteName === lastDetectedNote) {
      noteDetectionCounter.value++;
      if (noteDetectionCounter.value >= requiredDetections) {
        note.value = fullNoteName;
        stopListening();
        listening.value = false;
      }
    } else {
      noteDetectionCounter.value = 1;
      lastDetectedNote = fullNoteName;
    }
  }
}

// Função de detecção de pitch que implementa o algoritmo AMDF (Average Magnitude Difference Function)
// Este algoritmo vai calcular as diferenças absolutas entre um delay (deslocamento temporal ou time shift) na onda original e a própria 
// onda, repetindo o processo várias vezes.
// Ao algoritmo foi adicionado calcula-se o RMS (Root Mean Square) que serve para verificar se existe nível de energia suficiente do sinal de
// audio para que consiga ser analisado. Não havendo, retorna -1.
// É aplicado também um filtro pré-emphasis para melhorar a deteção de frequências mais altas.
// Por fim, para melhorar a precisão do algoritmo AMDF, é usada a parabolic interpolation pegando no mínimo detetado no algoritmo
// AMDF e dois elementos "vizinhos" dele para calcular um mínimo mais próximo do exato.
function calculateAMDF(buf, sampleRate) {
  const SIZE = buf.length;
  
  // Calculo do RMS (Root Mean Square)
  let rms = 0;
  for (let i = 0; i < SIZE; i++) {
    rms += buf[i] * buf[i];
  }
  rms = Math.sqrt(rms / SIZE);
  
  if (rms < 0.01) return -1;
  
  // Pre-emphasis filter
  const filtered = new Float32Array(SIZE);
  filtered[0] = buf[0];
  for (let i = 1; i < SIZE; i++) {
    filtered[i] = buf[i] - 0.9 * buf[i-1];
  }
  
  // Limites para o período baseado-se nos limites de frequência
  const minPeriod = Math.floor(sampleRate / (MAX_FREQ * 1.05));
  const maxPeriod = Math.ceil(sampleRate / (MIN_FREQ * 0.95));
  
  // Algoritmo AMDF
  const amdf = new Float32Array(maxPeriod);
  for (let delay = minPeriod; delay < maxPeriod; delay++) {
    let sum = 0;
    for (let i = 0; i < SIZE - delay; i++) {
      sum += Math.abs(filtered[i] - filtered[i + delay]);
    }
    amdf[delay] = sum / (SIZE - delay);
  }
  
  let minValue = Infinity;
  let minIndex = -1;
  
  for (let i = minPeriod; i < maxPeriod; i++) {
    if (amdf[i] < minValue) {
      minValue = amdf[i];
      minIndex = i;
    }
  }
  
  if (minIndex === -1) return -1;
  
  // Parabolic Interpolation
  let period = minIndex;
  if (period > 1 && period < maxPeriod - 1) {
    const x1 = amdf[period - 1];
    const x2 = amdf[period];
    const x3 = amdf[period + 1];
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    if (a !== 0) {
      period = period - b / (2 * a);
    }
  }
  
  // Conversão do periodo para frequência
  return sampleRate / period;
}

// Converte frequência para número de nota MIDI (padrão numérico usado para representar as notas em formato digital)
function noteFromPitch(frequency) {
  const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
  return Math.round(noteNum) + 69;
}

// Array com nomes das notas musicais
const noteStrings = ["Dó", "Dó#", "Ré", "Ré#", "Mi", "Fá", "Fá#", "Sol", "Sol#", "Lá", "Lá#", "Si"];

// Permite a limpeza de recursos sempre que o utilizador desliga o modo de escuta
onBeforeUnmount(() => {
  if (listening.value) {
    stopListening();
  }
});
</script>

<style scoped>
h1 {
  font-family: sans-serif;
}
button {
  margin-bottom: 10px;
  padding: 8px 16px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}
button:hover {
  background-color: #45a049;
}
p {
  font-family: sans-serif;
  font-size: 18px;
}
</style>