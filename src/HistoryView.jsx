import React, { useState } from 'react';
import Icon from '@mdi/react';
import { mdiMagnify, mdiDelete, mdiMusicNote, mdiClockOutline } from '@mdi/js';
import './HistoryView.css';

function HistoryView({ 
  searchHistory, 
  onSelectItem, 
  onClearHistory 
}) {
  const [searchTerm, setSearchTerm] = useState('');

  // Agrupar itens por data para exibição organizada
  const groupByDate = (items) => {
    const grouped = {};
    items.forEach(item => {
      const date = new Date(item.timestamp).toDateString();
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(item);
    });
    return grouped;
  };

  // Formatar data para exibição
  const formatDate = (dateString) => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('pt-PT', options);
  };

  // Filtrar itens do histórico com base no termo de pesquisa
  const filteredHistory = searchHistory.filter(item => 
    item.formattedNotes.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="search-history-modern">
      <div className="search-controls">
        <div className="search-input-container">
          <Icon path={mdiMagnify} size={0.9} className="search-icon" />
          <input 
            type="text" 
            placeholder="Pesquisar no histórico..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <button 
          onClick={onClearHistory} 
          className="clear-button"
        >
          <Icon path={mdiDelete} size={0.8} />
          Limpar histórico
        </button>
      </div>

      {filteredHistory.length > 0 ? (
        <div className="history-content">
          {Object.entries(groupByDate(filteredHistory)).map(([date, items]) => (
            <div key={date} className="date-group">
              <h5 className="date-header">
                <Icon path={mdiClockOutline} size={0.8} />
                {formatDate(date)}
              </h5>
              {items.map((item) => (
                <div 
                  key={item.id}
                  onClick={() => onSelectItem(item)}
                  className="history-item"
                >
                  <div className="item-accent"></div>
                  
                  <div className="item-content">
                    <div className="item-header">
                      <div className="item-title">
                        <Icon path={mdiMusicNote} size={0.9} />
                        <span className="notes-text">{item.formattedNotes}</span>
                      </div>
                      <span className="item-time">
                        {new Date(item.timestamp).toLocaleTimeString('pt-PT', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })} 
                      </span>
                    </div>
                    
                    <div className="notes-badges">
                      {item.formattedNotes.split(', ').map((note, idx) => (
                        <span key={idx} className="note-badge">
                          {note}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Icon path={mdiMusicNote} size={2} className="empty-icon" />
          <p className="empty-message">
            {searchTerm ? "Nenhum resultado encontrado." : "Nenhuma análise no histórico."}
          </p>
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="clear-search-button"
            >
              Limpar pesquisa
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default HistoryView;