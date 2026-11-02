// src/components/EmptyState.jsx
import './EmptyState.css';

export default function EmptyState({
  emoji = '📭',
  title,
  desc,
  cta,
  className = '',
}) {
  return (
    <div className={`empty-state ${className}`.trim()} role="status">
      <div className="empty-state__emoji" aria-hidden="true">{emoji}</div>
      {title && <h3 className="empty-state__title">{title}</h3>}
      {desc && <p className="empty-state__desc">{desc}</p>}
      {cta && <div className="empty-state__cta">{cta}</div>}
    </div>
  );
}