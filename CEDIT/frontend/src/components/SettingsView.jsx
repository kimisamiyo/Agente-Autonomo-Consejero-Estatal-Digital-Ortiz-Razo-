import React, { useState, useEffect } from 'react';
import { DEFAULT_SETTINGS, saveSettings, COLOR_MODES, PALETTE_TONES } from '../utils/userSettings';
import { useI18n } from '../i18n/I18nContext';
import {
  ceditIconBoxClass,
  ceditBtnSecondaryClass,
  ceditSectionTitleClass,
  ceditCardClass,
} from '../theme/ceditPalette';

const LEVEL_KEYS = ['off', 'low', 'mid', 'high'];

const CARD_KEYS = [
  { key: 'textSize', labelKey: 'a11y.textSize', icon: 'format_size', theme: 'gray' },
  { key: 'contrast', labelKey: 'a11y.contrast', icon: 'contrast', theme: 'steel' },
  { key: 'cursor', labelKey: 'a11y.cursor', icon: 'mouse', theme: 'gray' },
  { key: 'readingMask', labelKey: 'a11y.readingMask', icon: 'horizontal_rule', theme: 'steel' },
  { key: 'dyslexia', labelKey: 'a11y.dyslexia', icon: 'text_fields', theme: 'gray' },
  { key: 'lineSpacing', labelKey: 'a11y.lineSpacing', icon: 'format_line_spacing', theme: 'steel' },
  { key: 'reduceMotion', labelKey: 'a11y.reduceMotion', icon: 'motion_photos_off', theme: 'gray' },
  { key: 'linkEmphasis', labelKey: 'a11y.linkEmphasis', icon: 'link', theme: 'steel' },
  { key: 'uiDensity', labelKey: 'a11y.uiDensity', icon: 'density_small', theme: 'gray' },
];

const LOCALE_IDS = ['es', 'qu', 'ay'];

const LevelBar = ({ level, max = 4 }) => (
  <div className="flex gap-1 mt-2" aria-hidden>
    {Array.from({ length: max }, (_, i) => (
      <div
        key={i}
        className="h-1.5 flex-1 rounded-full transition-colors duration-300"
        style={{
          background:
            i < level
              ? 'var(--cedit-primary)'
              : 'color-mix(in srgb, var(--cedit-border) 80%, transparent)',
        }}
      />
    ))}
  </div>
);

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
    const next = {
      ...DEFAULT_SETTINGS,
      locale: local.locale,
      colorMode: local.colorMode,
      paletteTone: local.paletteTone,
    };
    setLocal(next);
    saveSettings(next);
    onSettingsChange?.(next);
  };

  const mode = local.colorMode === 'dark' ? 'dark' : 'light';

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="relative p-5 sm:p-8 md:p-10 max-w-3xl mx-auto w-full">
        <header className="cedit-fade-in flex items-start gap-4 mb-8">
          <div className={ceditIconBoxClass('steel', 'w-14 h-14')}>
            <span className="material-symbols-outlined text-white text-3xl">tune</span>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] mb-1" style={{ color: 'var(--cedit-steel)' }}>
              CEDIT
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: 'var(--cedit-text)' }}>
              {t('settings.title')}
            </h1>
            <p className="text-sm mt-1.5 leading-relaxed" style={{ color: 'var(--cedit-text-muted)' }}>
              {t('settings.subtitle')}
            </p>
          </div>
        </header>

        {/* Apariencia */}
        <section className="cedit-scale-in mb-9">
          <h2 className={ceditSectionTitleClass()}>
            <span className="material-symbols-outlined text-base" style={{ color: 'var(--cedit-primary)' }}>
              palette
            </span>
            {t('settings.appearance')}
            <span className="flex-1 h-px" style={{ background: 'var(--cedit-border)' }} />
          </h2>

          <div className="grid grid-cols-2 gap-3.5">
            {COLOR_MODES.map((m) => {
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => update({ colorMode: m.id })}
                  className={`cedit-theme-card text-left ${active ? 'is-active' : ''}`}
                  aria-pressed={active}
                >
                  <div
                    className={`preview ${
                      m.id === 'light' ? 'cedit-theme-preview-light' : 'cedit-theme-preview-dark'
                    }`}
                  />
                  <div className="px-3.5 py-3 flex items-center gap-2.5">
                    <span
                      className="material-symbols-outlined text-xl"
                      style={{ color: active ? 'var(--cedit-primary)' : 'var(--cedit-text-faint)' }}
                    >
                      {m.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold" style={{ color: 'var(--cedit-text)' }}>
                        {t(`settings.theme.${m.id}`)}
                      </p>
                      <p className="text-[11px] truncate" style={{ color: 'var(--cedit-text-muted)' }}>
                        {t(`settings.theme.${m.id}Hint`)}
                      </p>
                    </div>
                    {active && (
                      <span className="material-symbols-outlined text-xl" style={{ color: 'var(--cedit-primary)' }}>
                        check_circle
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Paleta gris */}
        <section className="cedit-fade-in mb-9">
          <h2 className={ceditSectionTitleClass()}>
            <span className="material-symbols-outlined text-base" style={{ color: 'var(--cedit-steel)' }}>
              gradient
            </span>
            {t('settings.palette')}
            <span className="flex-1 h-px" style={{ background: 'var(--cedit-border)' }} />
          </h2>
          <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--cedit-text-muted)' }}>
            {t('settings.paletteHint')}
          </p>
          <div className="cedit-swatch-row mb-3.5 px-0.5" aria-hidden>
            <span className="cedit-swatch cedit-swatch-pearl" title="pearl" />
            <span className="cedit-swatch cedit-swatch-mist" title="mist" />
            <span className="cedit-swatch cedit-swatch-fog" title="fog" />
            <span className="cedit-swatch cedit-swatch-ash" title="ash" />
            <span className="cedit-swatch cedit-swatch-steel" title="steel" />
            <span className="cedit-swatch cedit-swatch-ink" title="ink" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PALETTE_TONES.map((p) => {
              const active = (local.paletteTone || 'mist') === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => update({ paletteTone: p.id })}
                  className={`cedit-palette-card text-left ${active ? 'is-active' : ''}`}
                  aria-pressed={active}
                >
                  <div className={`cedit-palette-preview cedit-palette-preview-${p.id}`} />
                  <div className="px-3 py-2.5 flex items-center gap-2">
                    <span
                      className="material-symbols-outlined text-lg"
                      style={{ color: active ? 'var(--cedit-primary)' : 'var(--cedit-text-faint)' }}
                    >
                      {p.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold" style={{ color: 'var(--cedit-text)' }}>
                        {t(`settings.palette.${p.id}`)}
                      </p>
                      <p className="text-[11px] truncate" style={{ color: 'var(--cedit-text-muted)' }}>
                        {t(`settings.palette.${p.id}Hint`)}
                      </p>
                    </div>
                    {active && (
                      <span className="material-symbols-outlined text-lg" style={{ color: 'var(--cedit-primary)' }}>
                        check_circle
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="cedit-chip-row mt-3.5">
            <span className="cedit-chip is-on">{t('settings.palette.chipScale')}</span>
            <span className="cedit-chip">{t('settings.palette.chipFields')}</span>
            <span className="cedit-chip">{t('settings.palette.chipSteel')}</span>
          </div>
        </section>

        {/* Idioma */}
        <section className="cedit-fade-in mb-9">
          <h2 className={ceditSectionTitleClass()}>
            <span className="material-symbols-outlined text-base" style={{ color: 'var(--cedit-primary)' }}>
              translate
            </span>
            {t('settings.language')}
            <span className="flex-1 h-px" style={{ background: 'var(--cedit-border)' }} />
          </h2>
          <div className={`p-5 ${ceditCardClass('steel')}`}>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {LOCALE_IDS.map((id) => {
                const active = local.locale === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => update({ locale: id })}
                    className="rounded-xl px-2 py-3 text-sm font-semibold border transition-all"
                    style={
                      active
                        ? {
                            background: 'var(--cedit-grad-cta)',
                            color: '#fff',
                            borderColor: 'var(--cedit-primary-deep)',
                            boxShadow: '0 0 0 2px var(--cedit-steel-soft)',
                          }
                        : {
                            background: 'var(--cedit-surface)',
                            color: 'var(--cedit-text)',
                            borderColor: 'var(--cedit-border)',
                          }
                    }
                    aria-pressed={active}
                  >
                    {t(`locale.${id}`)}
                  </button>
                );
              })}
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--cedit-text-muted)' }}>
              {t('settings.languageHint')}
            </p>
          </div>
        </section>

        {/* Accesibilidad */}
        <section className="mb-9">
          <h2 className={ceditSectionTitleClass()}>
            <span className="material-symbols-outlined text-base" style={{ color: 'var(--cedit-primary)' }}>
              accessibility_new
            </span>
            {t('a11y.section')}
            <span className="flex-1 h-px" style={{ background: 'var(--cedit-border)' }} />
          </h2>
          <p className="text-xs mb-4 px-1 leading-relaxed" style={{ color: 'var(--cedit-text-muted)' }}>
            {t('a11y.hint')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {CARD_KEYS.map(({ key, labelKey, icon, theme }, i) => {
              const level = local[key] ?? 0;
              const levelName = t(`a11y.level.${LEVEL_KEYS[level]}`);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => cycle(key)}
                  className="cedit-setting-card cedit-fade-in"
                  style={{ animationDelay: `${i * 0.03}s` }}
                  aria-label={`${t(labelKey)}: ${levelName}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={ceditIconBoxClass(theme, 'w-10 h-10')}>
                      <span className="material-symbols-outlined text-white text-xl">{icon}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--cedit-text)' }}>
                        {t(labelKey)}
                      </p>
                      <p className="level-label">
                        {t('a11y.levelWord')}: <strong>{levelName}</strong>
                      </p>
                      <LevelBar level={level + 1} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <div className="flex flex-wrap gap-3 items-center">
          <button type="button" onClick={reset} className={ceditBtnSecondaryClass()}>
            <span className="material-symbols-outlined text-lg">restart_alt</span>
            {t('settings.reset')}
          </button>
          <p className="text-xs" style={{ color: 'var(--cedit-text-faint)' }}>
            {t('settings.resetHint')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
