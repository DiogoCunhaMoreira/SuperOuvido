import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import Icon from '@mdi/react';
import { mdiClose } from '@mdi/js';

const Modal = ({ isOpen, onClose, title, children }) => {
  const { t } = useTranslation();
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
        background: 'rgba(87, 86, 79, 0.55)',
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
          background: '#F8F3CE',
          borderRadius: '20px',
          boxShadow: '0 10px 30px rgba(87, 86, 79, 0.2)',
          border: '1px solid #DDDAD0',
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
            borderBottom: '1px solid #DDDAD0',
            background: '#DDDAD0',
          }}
        >
          <h2 style={{
            margin: 0,
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#57564F'
          }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label={t('modal.close')}
            style={{
              background: '#7A7A73',
              border: 'none',
              borderRadius: '12px',
              width: '40px',
              height: '40px',
              cursor: 'pointer',
              color: '#F8F3CE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 6px rgba(87, 86, 79, 0.2)'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#57564F';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#7A7A73';
              e.currentTarget.style.transform = 'scale(1)';
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
