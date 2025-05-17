/*
  Classe responsável pela gestão do histórico de análises de notas musicais.
 */
class HistoryManager {
    /*
      Inicializa o gestor de histórico.
      Define um array de listeners para o padrão Observer, carrega o histórico do localStorage (se existir)
      e inicializa o objeto de estado da aplicação.
     */
    constructor() {
      this.listeners = [];
      this.loadHistory();
    }
  
    /*
      Estado interno da aplicação que guarda o histórico de pesquisas
      e a visibilidade do painel de histórico.
     */
    state = {
      searchHistory: [],
      showHistory: false
    };
  
    /*
      Carrega o histórico a partir do localStorage, se disponível e, em caso de erro, remove
      os dados do localStorage e reinicializa o histórico como um array vazio.
     */
    loadHistory() {
      try {
        const savedHistory = localStorage.getItem("notesAnalysisHistory");
        if (savedHistory) {
          this.state.searchHistory = JSON.parse(savedHistory);
        }
      } catch (e) {
        console.error("Erro ao carregar histórico:", e);
        localStorage.removeItem("notesAnalysisHistory");
        this.state.searchHistory = [];
      }
      this.notifyListeners();
    }
  
    /* 
        Converte notas MIDI em notas "legíveis".
        Usa um Set para eliminar notas duplicadas e retorna uma string formatada.
    */
    formatNotes(notes) {
      const noteNames = ["Dó", "Dó#", "Ré", "Ré#", "Mi", "Fá", "Fá#", "Sol", "Sol#", "Lá", "Lá#", "Si"];
      const uniqueNoteNames = new Set(notes.map(midiNote => noteNames[midiNote % 12]));
      return Array.from(uniqueNoteNames).join(", ");
    }
  
    /*
      Adiciona uma nova análise ao histórico.
      Verifica se as notas são válidas e se já existe uma entrada idêntica para evitar duplicações.
      Limita o histórico a 20 entradas para evitar sobrecarga de memória.
      Persiste o histórico atualizado no localStorage.
     */
    saveToHistory(notes, analysisResponse) {
      if (!notes || notes.length === 0) return;
      const formattedNotes = this.formatNotes(notes);
      
      // Verifica se já existe uma entrada idêntica no histórico
      const isDuplicate = this.state.searchHistory.some(item => 
        item.formattedNotes === formattedNotes
      );
  
      if (!isDuplicate) {
        const historyItem = {
          id: Date.now(),
          notes: [...notes],
          formattedNotes,
          response: analysisResponse,
          timestamp: new Date().toISOString()
        };
  
        // Adiciona a nova entrada no início do array limitando a 20 registos.
        this.state.searchHistory = [historyItem, ...this.state.searchHistory].slice(0, 20);
        localStorage.setItem("notesAnalysisHistory", JSON.stringify(this.state.searchHistory));
        this.notifyListeners();
      }
    }
  
    /*
      Limpa todo o histórico de análises e remove os dados do localStorage.
     */
    clearHistory() {
      this.state.searchHistory = [];
      localStorage.removeItem("notesAnalysisHistory");
      this.notifyListeners();
    }
  
    /*
      Alterna a visibilidade do painel de histórico.
      Esta função é chamada quando o utilizador clica no botão de histórico.
     */
    toggleHistory() {
      this.state.showHistory = !this.state.showHistory;
      this.notifyListeners();
    }
  
    /*
      Permite que componentes se registem para receber notificações quando o estado do histórico mudar.
      Retorna uma função para cancelar o registo quando o componente for desmontado.
     */
    subscribe(listener) {
      this.listeners.push(listener);
      return () => {
        this.listeners = this.listeners.filter(l => l !== listener);
      };
    }
  
    /*
      Notifica todos os componentes registados sobre alterações no estado.
      É chamada internamente sempre que o estado do histórico é modificado.
     */
    notifyListeners() {
      this.listeners.forEach(listener => listener(this.state));
    }
  }
  
  // Exporta uma instância do gestor de histórico
  const historyManager = new HistoryManager();
  export default historyManager;
  