// NoteHistoryStore.js
class HistoryManager {
    constructor() {
      this.listeners = [];
      this.loadHistory();
    }
  
    state = {
      searchHistory: [],
      showHistory: false
    };
  
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
  
    formatNotes(notes) {
      const noteNames = ["Dó", "Dó#", "Ré", "Ré#", "Mi", "Fá", "Fá#", "Sol", "Sol#", "Lá", "Lá#", "Si"];
      const uniqueNoteNames = new Set(notes.map(midiNote => noteNames[midiNote % 12]));
      return Array.from(uniqueNoteNames).join(", ");
    }
  
    saveToHistory(notes, analysisResponse) {
      if (!notes || notes.length === 0) return;
      
      const formattedNotes = this.formatNotes(notes);
      
      // Check for duplicates
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
        
        this.state.searchHistory = [historyItem, ...this.state.searchHistory].slice(0, 20);
        localStorage.setItem("notesAnalysisHistory", JSON.stringify(this.state.searchHistory));
        this.notifyListeners();
      }
    }
  
    clearHistory() {
      this.state.searchHistory = [];
      localStorage.removeItem("notesAnalysisHistory");
      this.notifyListeners();
    }
  
    toggleHistory() {
      this.state.showHistory = !this.state.showHistory;
      this.notifyListeners();
    }
  
    // Subscribe to changes
    subscribe(listener) {
      this.listeners.push(listener);
      return () => {
        this.listeners = this.listeners.filter(l => l !== listener);
      };
    }
  
    // Notify all listeners of state changes
    notifyListeners() {
      this.listeners.forEach(listener => listener(this.state));
    }
  }
  
  // Export a singleton instance
  const historyManager = new HistoryManager();
  export default historyManager;  