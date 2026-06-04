import React, { useState, useEffect } from 'react';
import { DEFAULT_SETTINGS, saveSettings } from '../utils/userSettings';
import { useI18n } from '../i18n/I18nContext';
import { ceditCardClass, ceditIconBoxClass, ceditBtnSecondaryClass } from '../theme/ceditPalette';

const CARD_KEYS = [
  { key: 'textSize', labelKey: 'a11y.textSize', icon: 'format_size', theme: 'gray' },
  { key: 'contrast', labelKey: 'a11y.contrast', icon: 'contrast', theme: 'blue' },
  { key: 'cursor', labelKey: 'a11y.cursor', icon: 'mouse', theme: 'gray' },
  { key: 'readingMask', labelKey: 'a11y.readingMask', icon: 'horizontal_rule', theme: 'blue' },
  { key: 'dyslexia', labelKey: 'a11y.dyslexia', icon: 'text_fields', theme: 'gray' },
  { key: 'lineSpacing', labelKey: 'a11y.lineSpacing', icon: 'format_line_spacing', theme: 'blue' },
];

const LOCALE_IDS = ['es', 'qu', 'ay'];

const LevelBar = ({ level, theme = 'gray', max = 4 }) => {
  const fill = theme === 'blue' ? 'bg-blue-700' : 'bg-slate-700';
  return (
    <div className="flex gap-1 mt-3">
      {Array.from({ length: max }, (_, i) => (
        <div key={i} className={`h-1.5 flex-1 rounded-full ${i < level ? fill : 'bg-slate-200'}`} />
      ))}
    </div>
  );
};

const SettingsView = ({ settings, onSettingsChange }) => {
  const { t } = useI18n();
  const [local, setLocal] = useState(settings || DEFAULT_SETTINGS);

  useEffect(() => {
    setLocal(settings || DEFAULT_SETTINGS);
  }, [settings]);

  const update = (patch) => {
    const next = { ...local, ...patch };
    setLocal(next);
    saveSettings(next);
    onSettingsChange?.(next);
  };

  const cycle = (key) => {
    const cur = local[key] ?? 0;
    update({ [key]: (cur + 1) % 4 });
  };

  const reset = () => {
    const next = { ...DEFAULT_SETTINGS, locale: local.locale };
    setLocal(next);
    saveSettings(next);
    onSettingsChange?.(next);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-2xl mx-auto w-full">
      <header className="flex items-center gap-3 mb-6">
        <div className={ceditIconBoxClass('blue', 'w-12 h-12')}>
          <span className="material-symbols-outlined text-white text-2xl">settings</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-800">{t('settings.title')}</h1>
      </header>

      <div className={`mb-8 p-4 ${ceditCardClass('gray')}`}>
        <label className="block text-sm font-semibold text-slate-700 mb-2">{t('settings.language')}</label>
        <select
          value={local.locale}
          onChange={(e) => update({ locale: e.target.value })}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-medium focus:ring-1 focus:ring-blue-500 focus:border-blue-400"
        >
          {LOCALE_IDS.map((id) => (
            <option key={id} value={id}>
              {t(`locale.${id}`)}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500 mt-3">{t('settings.languageHint')}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        {CARD_KEYS.map(({ key, labelKey, icon, theme }) => (
          <button
            key={key}
            type="button"
            onClick={() => cycle(key)}
            className={`text-left p-4 ${ceditCardClass(theme)} hover:shadow-md transition-shadow`}
          >
            <div className={ceditIconBoxClass(theme, 'w-9 h-9 mb-2')}>
              <span className="material-symbols-outlined text-white text-lg">{icon}</span>
            </div>
            <span className="text-sm font-semibold text-slate-800">{t(labelKey)}</span>
            <LevelBar level={(local[key] ?? 0) + 1} theme={theme} />
          </button>
        ))}
      </div>

      <hr className="border-slate-200 mb-4" />
      <button type="button" onClick={reset} className={ceditBtnSecondaryClass()}>
        <span className="material-symbols-outlined text-lg">restart_alt</span>
        {t('settings.reset')}
      </button>
    </div>
  );
};

export default SettingsView;
