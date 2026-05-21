import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { translate } from './translations';

const I18nContext = createContext({ locale: 'es', t: (k) => k });

export function I18nProvider({ locale = 'es', children }) {
  const value = useMemo(() => {
    const loc = ['es', 'qu', 'ay'].includes(locale) ? locale : 'es';
    return {
      locale: loc,
      t: (key, vars) => translate(loc, key, vars),
    };
  }, [locale]);

  useEffect(() => {
    const lang = value.locale === 'qu' ? 'qu' : value.locale === 'ay' ? 'ay' : 'es';
    document.documentElement.lang = lang;
  }, [value.locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
