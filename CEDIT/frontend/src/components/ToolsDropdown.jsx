import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

const PREMIUM_TOOLS = [
  {
    id: 'compare-norm',
    icon: 'balance',
    label: 'Comparar normativas',
    description: 'Contrasta directivas MEF/OSCE en una tabla',
    prompt: 'Compara en una tabla las diferencias clave entre la Directiva de Inversión Pública vigente y la normativa OSCE aplicable a mi caso.',
  },
  {
    id: 'timeline',
    icon: 'timeline',
    label: 'Cronograma Invierte.pe',
    description: 'Fases del ciclo de inversión con hitos',
    prompt: 'Genera un cronograma por fases (formulación, expediente, ejecución, liquidación) según Invierte.pe para mi proyecto.',
  },
  {
    id: 'risk-matrix',
    icon: 'warning',
    label: 'Matriz de riesgos',
    description: 'Riesgos y mitigación según MEF',
    prompt: 'Elabora una matriz de riesgos (probabilidad × impacto) con mitigación según directivas del MEF.',
  },
  {
    id: 'citizen-letter',
    icon: 'mail',
    label: 'Carta al Estado',
    description: 'Solicitud o reclamo administrativo',
    prompt: 'Ayúdame a redactar una carta formal al Estado peruano invocando mis derechos (silencio administrativo, acceso a información).',
  },
  {
    id: 'glossary',
    icon: 'menu_book',
    label: 'Glosario express',
    description: 'Términos técnicos en lenguaje claro',
    prompt: 'Explica en lenguaje sencillo: perfil, expediente técnico, SNIP, viabilidad y componente.',
  },
  {
    id: 'checklist-mef',
    icon: 'checklist',
    label: 'Checklist pre-MEF',
    description: 'Verificación antes de presentar',
    prompt: 'Dame un checklist de lo que debe incluir mi expediente antes de presentarlo al MEF por Invierte.pe.',
  },
];

const MENU_WIDTH = 320;
const MENU_GAP = 8;

const ToolsDropdown = ({ onSelectTool, disabled }) => {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const updatePosition = () => {
    const btn = btnRef.current;
    if (!btn) return null;
    const rect = btn.getBoundingClientRect();
    const width = Math.min(MENU_WIDTH, window.innerWidth - 16);
    let left = rect.left;
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8);
    }
    const spaceAbove = rect.top - MENU_GAP - 8;
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP - 8;
    const openUp = spaceAbove >= 180 || spaceAbove >= spaceBelow;
    const maxHeight = Math.min(360, Math.max(160, openUp ? spaceAbove : spaceBelow));
    const next = {
      top: openUp ? rect.top - MENU_GAP : rect.bottom + MENU_GAP,
      left,
      maxHeight,
      openUp,
      width,
    };
    setCoords(next);
    return next;
  };

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return undefined;
    }
    updatePosition();
    const onWin = () => updatePosition();
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    return () => {
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (
        btnRef.current?.contains(e.target) ||
        menuRef.current?.contains(e.target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`p-2 rounded-lg flex items-center gap-2 text-xs font-medium transition-all duration-200 ${
          open ? 'bg-amber-100 text-amber-900' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
        }`}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title="Herramientas premium (no consumen auditorías freemium)"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="material-symbols-outlined text-sm">construction</span>
        <span className="hidden sm:inline">Herramientas</span>
        <span className="material-symbols-outlined text-[14px]">{open ? 'expand_less' : 'expand_more'}</span>
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[80] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden cedit-dropdown-enter"
            style={{
              width: coords.width,
              left: coords.left,
              maxHeight: coords.maxHeight,
              ...(coords.openUp
                ? { bottom: window.innerHeight - coords.top, top: 'auto' }
                : { top: coords.top }),
            }}
          >
            <div className="px-4 py-3 bg-gradient-to-r from-slate-800 to-slate-700 text-white shrink-0">
              <p className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">diamond</span>
                Herramientas Pro
              </p>
              <p className="text-[10px] text-slate-300 mt-0.5">No consumen auditoría freemium</p>
            </div>
            <div className="overflow-y-auto py-1" style={{ maxHeight: Math.max(120, coords.maxHeight - 64) }}>
              {PREMIUM_TOOLS.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  role="menuitem"
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 group"
                  onClick={() => {
                    onSelectTool(tool.prompt);
                    setOpen(false);
                  }}
                >
                  <div className="flex gap-3">
                    <span className="material-symbols-outlined text-red-800 text-lg shrink-0 group-hover:scale-110 transition-transform duration-200">
                      {tool.icon}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{tool.label}</p>
                      <p className="text-[11px] text-slate-500 leading-snug">{tool.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default ToolsDropdown;
