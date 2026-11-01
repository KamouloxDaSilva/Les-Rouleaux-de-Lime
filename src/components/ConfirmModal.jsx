// src/components/ConfirmModal.jsx
// Chantier 12 — Partie 1 : modale de confirmation (remplace window.confirm)
// Compatible avec les appels existants (props isOpen/open, onConfirm/onOk,
// onCancel/onClose, variant/danger/type). Fallbacks i18n sûrs.
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n';
import './ConfirmModal.css';

/**
 * Modale de confirmation générique.
 *
 * Props (toutes optionnelles sauf le déclencheur) :
 *   - isOpen / open         → booléen d'affichage
 *   - title                 → titre (string)
 *   - message / description → message (string)
 *   - confirmLabel / okLabel → label du bouton de confirmation
 *   - cancelLabel           → label du bouton d'annulation
 *   - onConfirm / onOk      → callback de confirmation
 *   - onCancel / onClose    → callback d'annulation
 *   - variant / type        → 'default' | 'danger'
 *   - danger                → booléen raccourci pour variant='danger'
 */
export default function ConfirmModal(props) {
  const {
    isOpen,
    open,
    title,
    message,
    description,
    confirmLabel,
    okLabel,
    cancelLabel,
    onConfirm,
    onOk,
    onCancel,
    onClose,
    variant,
    type,
    danger,
  } = props;

  const { t } = useI18n();

  // ---- Alias de props (accepte plusieurs conventions) ----
  const visible = typeof open === 'boolean' ? open : Boolean(isOpen);
  const body = description != null ? description : message;
  const confirmAction = typeof onOk === 'function' ? onOk : onConfirm;
  const cancelAction = typeof onClose === 'function' ? onClose : onCancel;
  const isDanger = Boolean(danger) || variant === 'danger' || type === 'danger';

  // ---- Libellés avec fallback si la clé i18n manque ----
  const cancelText = (() => {
    if (cancelLabel) return cancelLabel;
    const v = t('common.cancel');
    return v === 'common.cancel' ? '✕' : v;
  })();

  const confirmText = (() => {
    if (okLabel) return okLabel;
    if (confirmLabel) return confirmLabel;
    const v = t('common.confirm');
    return v === 'common.confirm' ? 'OK' : v;
  })();

  // ---- Effets globaux (ESC + lock body scroll) ----
  useEffect(() => {
    if (!visible) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Escape' && typeof cancelAction === 'function') {
        e.preventDefault();
        cancelAction();
      } else if (e.key === 'Enter' && typeof confirmAction === 'function') {
        e.preventDefault();
        confirmAction();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [visible, cancelAction, confirmAction]);

  if (!visible) return null;
  if (typeof document === 'undefined') return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && typeof cancelAction === 'function') {
      cancelAction();
    }
  };

  const content = (
    <div
      className="confirm-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'confirm-modal-title' : undefined}
      onClick={handleBackdropClick}
    >
      <div
        className="confirm-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <h2 id="confirm-modal-title" className="confirm-modal__title">
            {title}
          </h2>
        )}
        {body && (
          <p className="confirm-modal__message">{body}</p>
        )}
        <div className="confirm-modal__actions">
          <button
            type="button"
            className="confirm-modal__btn confirm-modal__btn--cancel"
            onClick={cancelAction}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`confirm-modal__btn confirm-modal__btn--${isDanger ? 'danger' : 'confirm'}`}
            onClick={confirmAction}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}