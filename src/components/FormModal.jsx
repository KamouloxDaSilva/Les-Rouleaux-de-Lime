// src/components/FormModal.jsx
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n';
import './FormModal.css';

export default function FormModal({ isOpen, onClose, title, children }) {
  const { t } = useI18n();

  // Empêche le scroll du body quand la modale est ouverte
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Ferme la modale avec la touche Echap
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div
      className="form-modal-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      <div className="form-modal">
        <div className="form-modal__header">
          <h2 className="form-modal__title">{title}</h2>
          <button
            type="button"
            className="form-modal__close-btn"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            ×
          </button>
        </div>
        
        <div className="form-modal__content">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}