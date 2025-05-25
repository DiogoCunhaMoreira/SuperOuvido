import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import Icon from '@mdi/react';
import { mdiClose } from '@mdi/js';

const Modal = ({ isOpen, onClose, title, children }) => {
  const modalRef = useRef(null);

  // Fechar modal com a tecla Escape
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevenir scroll do body enquanto modal está aberto
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose]);

  // Se o modal não estiver aberto, não renderiza nada
  if (!isOpen) return null;

  // Renderiza o modal no fim do body usando portal
  return ReactDOM.createPortal(
    <div 
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        animation: 'fadeIn 0.3s ease-out',
        overflow: 'auto',
        padding: '20px'
      }}
    >
      <div 
        className="modal-content"
        ref={modalRef}
        onClick={e => e.stopPropagation()}  // Previne que cliques dentro do modal fechem-no
        style={{
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.9))',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          width: '90%',
          maxWidth: '900px',
          maxHeight: '85vh',
          overflow: 'hidden',
          animation: 'slideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div 
          className="modal-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 24px',
            borderBottom: '1px solid rgba(102, 126, 234, 0.1)',
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05), rgba(118, 75, 162, 0.05))',
          }}
        >
          <h2 style={{ 
            margin: 0, 
            fontSize: '1.5rem', 
            fontWeight: '700',
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: 'linear-gradient(135deg, #f093fb, #f5576c)',
              border: 'none',
              borderRadius: '12px',
              width: '40px',
              height: '40px',
              cursor: 'pointer',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 12px rgba(240, 147, 251, 0.3)'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #ed7de8, #f04558)';
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(240, 147, 251, 0.4)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #f093fb, #f5576c)';
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(240, 147, 251, 0.3)';
            }}
          >
            <Icon path={mdiClose} size={1} />
          </button>
        </div>
        <div 
          className="modal-body"
          style={{
            padding: '24px',
            overflow: 'auto',
            flex: 1
          }}
        >
          {children}
        </div>
      </div>
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { transform: translateY(-30px) scale(0.95); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>,
    document.body
  );
};

export default Modal;
