// src/components/SkeletonLoader.jsx
import './SkeletonLoader.css';

const VARIANTS = ['text', 'card', 'circle', 'bar'];

export default function SkeletonLoader({
  variant = 'text',
  className = '',
  width,
  height,
}) {
  const safeVariant = VARIANTS.includes(variant) ? variant : 'text';
  const style = {};
  if (width) style.width = width;
  if (height) style.height = height;

  return (
    <div
      className={`skeleton skeleton--${safeVariant} ${className}`.trim()}
      style={Object.keys(style).length ? style : undefined}
      aria-hidden="true"
      role="presentation"
    />
  );
}