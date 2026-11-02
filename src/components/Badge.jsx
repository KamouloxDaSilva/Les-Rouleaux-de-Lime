// src/components/Badge.jsx
import './Badge.css';

const VARIANTS = ['default', 'info', 'warning', 'success', 'danger', 'promo'];

export default function Badge({
  variant = 'default',
  children,
  className = '',
}) {
  const safeVariant = VARIANTS.includes(variant) ? variant : 'default';
  return (
    <span className={`badge badge--${safeVariant} ${className}`.trim()}>
      {children}
    </span>
  );
}