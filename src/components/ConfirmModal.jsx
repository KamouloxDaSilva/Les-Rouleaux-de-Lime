// src/components/ConfirmModal.jsx
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n';
import './ConfirmModal.css';

export default function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText,
  cancelText,
  isDestructive = false,
}) {
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
      if (e.key === 'Escape' && isOpen) onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  return createPortal(
    <div
      className="confirm-modal-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="confirm-modal">
        {title && (
          <h3 id="confirm-modal-title" className="confirm-modal__title">
            {title}
          </h3>
        )}
        {message && <p className="confirm-modal__message">{message}</p>}

        <div className="confirm-modal__actions">
          <button
            type="button"
            className="confirm-modal__btn confirm-modal__btn--cancel"
            onClick={onCancel}
          >
            {cancelText || t('common.cancel')}
          </button>
          <button
            type="button"
            className={`confirm-modal__btn confirm-modal__btn--confirm ${
              isDestructive ? 'confirm-modal__btn--danger' : ''
            }`}
            onClick={onConfirm}
          >
            {confirmText || t('common.save')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}