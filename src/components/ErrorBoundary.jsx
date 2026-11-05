// src/components/ErrorBoundary.jsx
// Chantier 33 — Barrière d'erreur (évite les écrans blancs en cas de crash JS)
import { Component } from 'react';
import { useI18n } from '../i18n';
import './ErrorBoundary.css';

class ErrorBoundaryInner extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info);
  }

  handleReload = () => {
    try {
      window.location.reload();
    } catch (e) {
      /* ignore */
    }
  };

  render() {
    if (this.state.hasError) {
      const { t } = this.props;
      return (
        <div className="error-boundary" role="alert">
          <div className="error-boundary__icon" aria-hidden="true">💥</div>
          <h1 className="error-boundary__title">{t('common.error')}</h1>
          <p className="error-boundary__desc">
            {t('common.errorBoundary.desc')}
          </p>
          <button
            type="button"
            className="error-boundary__btn"
            onClick={this.handleReload}
          >
            🔄 {t('common.errorBoundary.reload')}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ErrorBoundary({ children }) {
  const { t } = useI18n();
  return <ErrorBoundaryInner t={t}>{children}</ErrorBoundaryInner>;
}