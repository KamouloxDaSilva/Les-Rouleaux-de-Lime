import { useI18n } from '../i18n';
import './LanguageSwitch.css';

const LANGUAGES = ['vi', 'fr', 'en'];

export default function LanguageSwitch() {
  const { lang, setLang } = useI18n();

  const cycleLanguage = () => {
    const currentIndex = LANGUAGES.indexOf(lang);
    const nextIndex = (currentIndex + 1) % LANGUAGES.length;
    setLang(LANGUAGES[nextIndex]);
  }

  return (
    <button type="button" className="lang-switch" onClick={cycleLanguage}>
      {lang.toUpperCase()}
    </button>
  );
}