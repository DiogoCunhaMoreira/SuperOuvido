import { BasicPitch } from "@spotify/basic-pitch";

class NoteDetector {
  constructor() {
    this.basicPitch = null;
    this.TARGET_SAMPLE_RATE = 22050;
  }

  /*
    Função responsável por carregar e inicializar o modelo de deteção de pitch (BasicPitch da Spotify).
    É um usado um CDN para criar uma nova instancia do modelo.
    Para validar se o modelo está a funcionar é criado um array de dados, que simboliza um segundo de silêncio, 
    e é executado o modelo. Se o modelo executar com sucesso, a função anónima data como argumento, executa e coloca a variável 
    modelWorks a true.
    */
  async initBasicPitch(setStatus) {
    try {
      setStatus("A carregar o modelo de deteção...");

      this.basicPitch = null;

      this.basicPitch = new BasicPitch(
        "https://unpkg.com/@spotify/basic-pitch@1.0.1/model/model.json"
      );

      setStatus("Modelo carregado - a testar...");

      const testData = new Float32Array(this.TARGET_SAMPLE_RATE);
      let modelWorks = false;

      try {
        await this.basicPitch.evaluateModel(
          testData,
          () => {
            modelWorks = true;
          },
          () => {}
        );

        setStatus("Modelo de deteção carregado e validado!");
        return true;
      } catch (validationError) {
        console.error("Validação do modelo falhou:", validationError);
        setStatus("Erro ao validar o modelo de deteção");
        return false;
      }
    } catch (error) {
      console.error("Inicialização do BasicPitch falhou:", error);
      setStatus(`Erro ao inicializar o modelo de deteção: ${error.message}`);
      return false;
    }
  }

  /*
    Como existem 12 semitons em cada oitava e a numeração MIDI incrementa ou decrementa um valor a cada semitom,
    basta dividir o número MIDI por 12 para determinar a nota correspondente. Como não é necessário saber a oitava onde foi tocada a nota,
    apenas o modulo é utilizado. 
   */
  midiToPitchClassName(midiNote) {
    const noteNames = [
      "Dó",
      "Dó#",
      "Ré",
      "Ré#",
      "Mi",
      "Fá",
      "Fá#",
      "Sol",
      "Sol#",
      "Lá",
      "Lá#",
      "Si",
    ];
    return noteNames[midiNote % 12];
  }

  /* 
  Função para determinar se a nota tocada corresponde a uma nota preta no teclado, usada depois para 
  representar visualmente. As teclas pretas, numa oitava, são representadas pela segunda, quarta, sétima, nona ou décima primeira nota.
  Como a númeração MIDI começa no 0, então verifica-se se a nota detada é uma dos seguintes números: 1, 3, 6, 8, ou 10.
  */
  isBlackKey(midiNote) {
    const note = midiNote % 12;
    return [1, 3, 6, 8, 10].includes(note);
  }

  /*
  Função que recebe um array de notas MIDI e converte o array num outro array com o nome das notas, usando
  a estrutura de dados Set() para remover duplicados, ou seja, se dois Dós forem tocados, apenas é assumido um.
  */
  formatNotes(notes) {
    const uniqueNoteNames = new Set(
      notes.map((midiNote) => this.midiToPitchClassName(midiNote))
    );
    return Array.from(uniqueNoteNames).join(", ");
  }

  detectNotes(frames, setWarningInfo) {
    /*
    Verifica primeiro se existem dados para serem analisados
    */
    if (frames.length === 0 || !frames[0] || frames[0].length === 0) {
      return { detectedMidiNotes: [], pitchClasses: new Set() };
    }

    const noteData = {};

    //Iniciado o processamento dos frames
    frames.forEach((frame) => {
      frame.forEach((confidence, noteIndex) => {
        /*
        O 21 representa em MIDI a nota mais grave do piano, Lá0.
        Como o algoritmo do BasicPitch funciona com um offset=21 (ou seja, deteta apenas as 88 notas de um piano),
        o valor 21 deve ser adicionado ao index do frame para representar a nota MIDI real que está a ser representada.
        */
        const midiNote = noteIndex + 21;

        // Notas com confiança abaixo de 0.1 são ignoradas
        if (confidence < 0.1) return;

        /* 
        Verifica se a nota já foi detetada noutros frames, se não tiver sido detetada,
        cria um elemento no noteData com valores iniciais.
        */
        if (!noteData[midiNote]) {
          noteData[midiNote] = {
            totalConfidence: 0,
            maxConfidence: 0,
            frameCount: 0,
            frames: [],
          };
        }

        /*
        Atualizado o index no noteData com os seguintes dados:
        totalConfidence = Somatório dos valores da confiança encontrada em diferentes frames
        maxConfidence = O maior valor de confiança encontrado nos frames
        frameCount = Em quantos frames foi detetada a nota
        frames = Array que vai conter todos os valores de confiança encontrados nos frames
        */
        const data = noteData[midiNote];
        data.totalConfidence += confidence;
        data.maxConfidence = Math.max(data.maxConfidence, confidence);
        data.frameCount++;
        data.frames.push(confidence);
      });
    });

    /* 
    Converte-se o objeto noteData num array de objetos e itera-se pelo mesmo para se calcular
    a pontuação de cada nota detetada
    */
    const notes = [];
    Object.entries(noteData).forEach(([midiNote, data]) => {
      midiNote = parseInt(midiNote);

      // Se a nota só for detetada em menos de 15% dos frames, é ignorada
      if (data.frameCount < frames.length * 0.15) return;

      const avgConfidence = data.totalConfidence / data.frameCount;

      /*
      Como as notas graves são mais dificeis de detetar, decidiu-se implementar
      um boost para aumentar a pontuação (score) destas notas, para aumentar
      a precisão.
      */
      let boost = 1.0;
      if (midiNote >= 36 && midiNote < 48) {
        // Dó2 ao Si2
        boost = 1.15;
      } else if (midiNote >= 28 && midiNote < 36) {
        // Mi1 ao Si1
        boost = 1.25;
      } else if (midiNote >= 21 && midiNote < 28) {
        // Lá0 ao Ré1
        boost = 1.35;
      }

      /* 
      A pontuação (score) é calculada pela soma de 70% do valor da confiança máxima
      por 30% do valor da confiança média, multiplicado pelo boost 
      */
      const score = (data.maxConfidence * 0.7 + avgConfidence * 0.3) * boost;

      // Adiciona ao array a nota detetada com o score calculado e os dados já obtidos anteriormente
      notes.push({
        midiNote,
        score,
        maxConfidence: data.maxConfidence,
        avgConfidence,
        frameCount: data.frameCount,
        frameRatio: data.frameCount / frames.length,
      });
    });

    // Ordena o array notes por pontuação (decrescente)
    notes.sort((a, b) => b.score - a.score);

    // Verifica se o array notes está vazio
    if (notes.length === 0) {
      return { detectedMidiNotes: [], pitchClasses: new Set() };
    }

    // Se o score da nota com melhor pontuação for menor que 0.15, retorna.
    if (notes[0].score < 0.15) {
      return { detectedMidiNotes: [], pitchClasses: new Set() };
    }

    /* 
    Verificar se há notasabaixo de Dó2 = MIDI 36 com uma pontuação maior que 0.25. Se houver, a mensagem
    é mostrada ao utilizador.
    */
    const C2_MIDI = 36;
    const hasVeryLowNotes = notes.some(
      (note) => note.midiNote < C2_MIDI && note.score > 0.25
    );

    if (hasVeryLowNotes) {
      setWarningInfo(
        "⚠️ Detectadas notas abaixo de C2, a precisão pode ser limitada."
      );
    }

    const finalNotes = [];

    // Adiciona a nota com maior pontuação ao array que vai conter as notas finais detetadas
    finalNotes.push(notes[0]);

    /*
    Nestes dois objetos tem-se os intervalos que simbolizam os possíveis harmónicos (overtones) e sub-harmónicos 
    (undertones) que uma nota pode reproduzir quando tocada e os seus respetivos limiares
    (usados depois para calcular se a nota poderá ser ou não um harmónico) 
    */
    const harmonicThresholds = {
      12: 0.65, // Oitava
      19: 0.65, // Oitava + A quinta
      24: 0.7, // Duas oitavas
      28: 0.5, // Duas oitavas + a terceira maior
      31: 0.5, // Duas oitavas + a quinta
      36: 0.4, // Três oitavas
    };

    const subharmonicThresholds = {
      "-12": 0.6, // Uma oitava abaixo
      "-24": 0.5, // Duas oitavas abaixo
    };

    /*
    Estabelecido um valor minimo de confiança que as notas devem atingir para serem considerada
    notas reais, ou seja, realmente tocadas.
    É calculado um máximo entre o valor de 40% da nota com maior score e 0.25.
    O cálculo do máximo serve para adaptar o limiar à qualidade da deteção,ou seja, se os scores
    detetados forem altos, o limiar também será maior, ou seja, pode-se aumentar a exigencia na eliminação
    ou não de falsos positivos.
    */
    const baseThreshold = Math.max(0.25, notes[0].score * 0.4);

    /*
    Este loop itera por todas as notas detetadas e, em primeiro lugar, descarta as que têm
    um score abaixo do valor minimo de confiança, e de seguida elimina as notas que são
    consideradas harmónicos ou sub-harmónicos
    */
    for (let i = 1; i < notes.length; i++) {
      const note = notes[i];

      if (note.score < baseThreshold) continue;

      let isLikelyHarmonic = false;

      /*
      Como os sub-harmónicos não são componentes naturais do som, ou seja, a maioria dos instrumentos
      músicais não produzem sub-harmónicos quando são tocados, a análise é feita a todas as notas que 
      foram detetadas, isto porque os sub-harmónicos são erros de deteção do próprio algoritmo, ou seja,
      deve ser feito sempre para todas as notas já analisadas e não só para as notas que já foram dadas
      como reais.
      */
      for (let j = 0; j < i; j++) {
        const higherNote = notes[j];
        const interval = higherNote.midiNote - note.midiNote;

        if (subharmonicThresholds.hasOwnProperty(String(interval))) {
          if (
            note.score <
            higherNote.score * subharmonicThresholds[String(interval)]
          ) {
            isLikelyHarmonic = true;
            break;
          }
        }
      }

      /*
      Como os harmónicos são componentes naturais do som, faz sentido apenas verificar em notas
      que foram já dadas como reais, porque poderia-se descartar notas como sendo harmónicos de
      notas que seriam mais tarde descartadas como sub-harmónicos.
      */
      if (!isLikelyHarmonic) {
        for (const strongerNote of finalNotes) {
          const interval = note.midiNote - strongerNote.midiNote;

          if (harmonicThresholds.hasOwnProperty(interval)) {
            const threshold = strongerNote.score * harmonicThresholds[interval];

            if (note.score < threshold) {
              isLikelyHarmonic = true;
              break;
            }
          }
        }
      }
      if (!isLikelyHarmonic) {
        finalNotes.push(note);
      }
    }

    // Transformação do array finalNotes num array apenas com as notas MIDI
    const midiNotes = finalNotes.map((note) => note.midiNote);
    /* 
    Simplifica as notas MIDI para obter apenas a sua classe de pitch, ou seja,
    não interessa a oitava em que foi tocada mas sim a nota em si. Servirá
    depois para o processamento visual das notas no teclado.
    O uso da estrutura de dados Set() também elimina notas dúplicadas.
    */
    const pitchClasses = new Set(midiNotes.map((note) => note % 12));

    return {
      detectedMidiNotes: midiNotes,
      pitchClasses,
    };
  }

  /* 
  Array com as notas em MIDI (do 60 ao 71) representando a quarta oitava, a que contém o dó central no piano.
  É usada depois para destacar as teclas corretas do acorde tocado.
  */
  getAllNotes() {
    return Array.from({ length: 12 }, (_, i) => {
      const midiNote = i + 60;
      return {
        id: i,
        midiNote,
      };
    });
  }
}

export default NoteDetector;