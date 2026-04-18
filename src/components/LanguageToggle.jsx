import React from 'react';
import { useTranslation } from 'react-i18next';
import './LanguageToggle.css';

const LANGS = ['pt', 'en'];

const LanguageToggle = () => {
  const { i18n, t } = useTranslation();
  const current = (i18n.language || 'pt').toLowerCase().startsWith('en') ? 'en' : 'pt';

  const change = (lang) => {
    if (lang !== current) {
      i18n.changeLanguage(lang);
    }
  };

  return (
    <div className="language-toggle" role="group" aria-label={t('language.label')}>
      {LANGS.map((lang) => (
        <button
          key={lang}
          type="button"
          className={`language-toggle-btn ${current === lang ? 'active' : ''}`}
          onClick={() => change(lang)}
          aria-pressed={current === lang}
        >
          {t(`language.${lang}`)}
        </button>
      ))}
    </div>
  );
};

export default LanguageToggle;
