import React from 'react';
import { useI18n } from '../i18n/I18nContext';

const TOOLS = [
  {
    id: 'compare-norm',
    icon: 'balance',
    labelKey: 'jewel.tools.compare',
    descKey: 'jewel.tools.compareDesc',
    prompt:
      'Compara en una tabla las diferencias clave entre la Directiva de Inversión Pública vigente y la normativa OSCE aplicable a mi caso.',
  },
  {
    id: 'timeline',
    icon: 'timeline',
    labelKey: 'jewel.tools.timeline',
    descKey: 'jewel.tools.timelineDesc',
    prompt:
      'Genera un cronograma por fases (formulación, expediente, ejecución, liquidación) según Invierte.pe para mi proyecto.',
  },
  {
    id: 'risk-matrix',
    icon: 'health_and_safety',
    labelKey: 'jewel.tools.risk',
    descKey: 'jewel.tools.riskDesc',
    prompt:
      'Elabora una matriz de riesgos (probabilidad × impacto) con mitigación según directivas del MEF.',
  },
  {
    id: 'citizen-letter',
    icon: 'mail',
    labelKey: 'jewel.tools.letter',
    descKey: 'jewel.tools.letterDesc',
    prompt:
      'Ayúdame a redactar una carta formal al Estado peruano invocando mis derechos (silencio administrativo, acceso a información).',
  },
  {
    id: 'glossary',
    icon: 'menu_book',
    labelKey: 'jewel.tools.glossary',
    descKey: 'jewel.tools.glossaryDesc',
    prompt: 'Explica en lenguaje sencillo: perfil, expediente técnico, SNIP, viabilidad y componente.',
  },
  {
    id: 'checklist-mef',
    icon: 'checklist',
    labelKey: 'jewel.tools.checklist',
    descKey: 'jewel.tools.checklistDesc',
    prompt:
      'Dame un checklist de lo que debe incluir mi expediente antes de presentarlo al MEF por Invierte.pe.',
  },
];

/**
 * Joya 7 — Cajón lateral de herramientas (desplegable)
 */
const ToolsDrawer = ({ open, onClose, onSelectTool, disabled }) => {
  const { t } = useI18n();
  if (!open) return null;

  return (
    <>
      <div className="cedit-overlay z-[85]" onClick={onClose} aria-hidden />
      <aside className="cedit-drawer" role="dialog" aria-modal="true" aria-label={t('jewel.tools.title')}>
        <div className="px-5 pt-5 pb-4 border-b border-[var(--cedit-border)] flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl cedit-accent-steel text-white flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">diamond</span>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-[var(--cedit-text)]">{t('jewel.tools.title')}</h2>
            <p className="text-xs text-[var(--cedit-text-muted)] mt-1 leading-relaxed">{t('jewel.tools.subtitle')}</p>
          </div>
          <button type="button" onClick={onClose} className="text-[var(--cedit-text-faint)] p-1" aria-label="Cerrar">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {TOOLS.map((tool, i) => (
            <button
              key={tool.id}
              type="button"
              disabled={disabled}
              onClick={() => {
                onSelectTool?.(tool.prompt);
                onClose();
              }}
              className="cedit-intent-card w-full disabled:opacity-50 cedit-fade-in"
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <div className="flex items-start gap-3 relative">
                <span className="w-10 h-10 rounded-xl bg-[var(--cedit-primary-soft)] text-[var(--cedit-primary)] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined">{tool.icon}</span>
                </span>
                <div className="text-left min-w-0">
                  <p className="text-sm font-bold text-[var(--cedit-text)]">{t(tool.labelKey)}</p>
                  <p className="text-xs text-[var(--cedit-text-muted)] mt-0.5 leading-snug">{t(tool.descKey)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-[var(--cedit-border)] text-[11px] text-[var(--cedit-text-faint)] leading-relaxed">
          {t('jewel.tools.footer')}
        </div>
      </aside>
    </>
  );
};

export default ToolsDrawer;
export { TOOLS };
