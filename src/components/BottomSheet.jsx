// src/components/BottomSheet.jsx
// Chantier 29 — F1 : correction du bug de focus (bouton × volait le focus)
// Le focus n'est plus relancé à chaque re-render du parent : on utilise
// un ref pour onClose et on ne dépend que de [open]. Le focus ne s'exécute
// qu'à la PREMIÈRE ouverture de chaque cycle open → close → open.
import { useEffect, useRef } from 'react';
import { useI18n } from '../i18n';
import './BottomSheet.css';

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export default function BottomSheet({
  open = false,
  onClose,
  title,
  children,
  className = '',
}) {
  const { t } = useI18n();
  const sheetRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const hasFocusedRef = useRef(false);
  const titleId = 'bottomsheet-title';

  // Garde onClose à jour sans relancer l'effet principal
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      hasFocusedRef.current = false;
      return undefined;
    }

    const previouslyFocused = document.activeElement;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (onCloseRef.current) onCloseRef.current();
        return;
      }
      if (e.key === 'Tab') {
        const focusables = sheetRef.current
          ? sheetRef.current.querySelectorAll(FOCUSABLE_SELECTOR)
          : [];
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Focus UNIQUEMENT à la première ouverture du cycle
    let focusTimer;
    if (!hasFocusedRef.current) {
      focusTimer = setTimeout(() => {
        const first = sheetRef.current?.querySelector(FOCUSABLE_SELECTOR);
        if (first) first.focus();
        hasFocusedRef.current = true;
      }, 60);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (focusTimer) clearTimeout(focusTimer);
      if (previouslyFocused && previouslyFocused.focus) {
        previouslyFocused.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="bottomsheet__backdrop"
      onClick={() => onClose && onClose()}
    >
      <div
        ref={sheetRef}
        className={`bottomsheet ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bottomsheet__handle" aria-hidden="true" />
        {title && (
          <h3 id={titleId} className="bottomsheet__title">{title}</h3>
        )}
        <button
          type="button"
          className="bottomsheet__close"
          onClick={() => onClose && onClose()}
          aria-label={t('common.close')}
        >
          ×
        </button>
        <div className="bottomsheet__content">{children}</div>
      </div>
    </div>
  );
}