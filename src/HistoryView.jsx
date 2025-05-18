import React, { useState } from 'react';

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
    <div className="search-history" style={{ 
      marginTop: '20px',
      backgroundColor: '#fff',
      borderRadius: '12px',
      boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
      padding: '20px',
      transition: 'all 0.3s ease'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        borderBottom: '1px solid #eee',
        paddingBottom: '12px',
        marginBottom: '15px'
      }}>
        <h4 style={{ margin: '0', fontSize: '18px', fontWeight: '600' }}>Histórico de Análises</h4>
        <button 
          onClick={onClearHistory} 
          style={{ 
            fontSize: '0.8rem', 
            padding: '6px 12px',
            border: 'none',
            backgroundColor: '#f44336',
            color: 'white',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#d32f2f"}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#f44336"}
        >
          Limpar histórico
        </button>
      </div>
      
      <div style={{ margin: '10px 0 20px 0' }}>
        <input 
          type="text" 
          placeholder="Pesquisar no histórico..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 15px',
            borderRadius: '8px',
            border: '1px solid #ddd',
            fontSize: '14px',
            backgroundColor: '#f9f9f9'
          }}
        />
      </div>

      {filteredHistory.length > 0 ? (
        Object.entries(groupByDate(filteredHistory)).map(([date, items]) => (
          <div key={date}>
            <h5 style={{ 
              margin: '15px 0 10px 0',
              color: '#666',
              borderBottom: '1px dashed #eee',
              paddingBottom: '5px' 
            }}>
              {formatDate(date)}
            </h5>
            {items.map((item) => (
              <div 
                key={item.id}
                onClick={() => onSelectItem(item)}
                style={{ 
                  padding: '15px', 
                  margin: '12px 0', 
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: '#f5f9ff',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = "#e3f2fd";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 10px rgba(0,0,0,0.1)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = "#f5f9ff";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.05)";
                }}
              >
                <div style={{ 
                  position: 'absolute',
                  left: '0',
                  top: '0',
                  bottom: '0',
                  width: '5px',
                  background: 'linear-gradient(180deg, #4CAF50, #2196F3)'
                }}></div>
                
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginLeft: '8px' 
                }}>
                  <p style={{ 
                    fontSize: '18px', 
                    fontWeight: 'bold', 
                    margin: '0 0 6px 0',
                    color: '#333'
                  }}>{item.formattedNotes}</p>
                  <span style={{ 
                    fontSize: '0.8rem', 
                    color: '#777',
                    backgroundColor: '#e0e0e0',
                    padding: '3px 8px',
                    borderRadius: '12px'
                  }}>
                    {new Date(item.timestamp).toLocaleTimeString()} 
                  </span>
                </div>
                
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  marginTop: '8px',
                  marginLeft: '8px'
                }}>
                  {item.formattedNotes.split(', ').map((note, idx) => (
                    <span key={idx} style={{
                      display: 'inline-block',
                      padding: '4px 8px',
                      margin: '0 4px 4px 0',
                      backgroundColor: '#e3f2fd',
                      color: '#0d47a1',
                      borderRadius: '4px',
                      fontSize: '0.9rem'
                    }}>
                      {note}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))
      ) : (
        <p style={{ marginTop: '10px', fontStyle: 'italic', textAlign: 'center' }}>
          {searchTerm ? "Nenhum resultado encontrado." : "Nenhuma análise no histórico."}
        </p>
      )}
    </div>
  );
}

export default HistoryView;