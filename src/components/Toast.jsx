// src/components/Toast.jsx
import { useEffect } from 'react';
import { useI18n } from '../i18n';
import './Toast.css';

export default function Toast({
  open = false,
  message = '',
  variant = 'info',
  duration = 3000,
  onClose,
  className = '',
}) {
  const { t } = useI18n();

  useEffect(() => {
    if (!open || !duration) return undefined;
    const timer = setTimeout(() => { onClose && onClose(); }, duration);
    return () => clearTimeout(timer);
  }, [open, duration, onClose]);

  if (!open) return null;

  const isUrgent = variant === 'warning' || variant === 'error';
  const role = isUrgent ? 'alert' : 'status';
  const live = isUrgent ? 'assertive' : 'polite';

  return (
    <div
      className={`toast toast--${variant} ${className}`.trim()}
      role={role}
      aria-live={live}
    >
      <span className="toast__message">{message}</span>
      {onClose && (
        <button
          type="button"
          className="toast__close"
          onClick={onClose}
          aria-label={t('common.close')}
        >
          ×
        </button>
      )}
    </div>
  );
}