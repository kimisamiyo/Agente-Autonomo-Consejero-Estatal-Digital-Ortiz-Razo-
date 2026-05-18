import React, { useState, useRef, useEffect } from 'react';

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

const ToolsDropdown = ({ onSelectTool, disabled }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={`p-2 rounded-lg flex items-center gap-2 text-xs font-medium transition-all duration-200 ${
          open ? 'bg-amber-100 text-amber-900' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
        }`}
        onClick={() => setOpen(!open)}
        disabled={disabled}
        title="Herramientas premium (no consumen auditorías freemium)"
      >
        <span className="material-symbols-outlined text-sm">construction</span>
        <span className="hidden sm:inline">Herramientas</span>
        <span className="material-symbols-outlined text-[14px]">{open ? 'expand_less' : 'expand_more'}</span>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-72 sm:w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden cedit-dropdown-enter">
          <div className="px-4 py-3 bg-gradient-to-r from-slate-800 to-slate-700 text-white">
            <p className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">diamond</span>
              Herramientas Pro
            </p>
            <p className="text-[10px] text-slate-300 mt-0.5">No consumen cupo de auditoría freemium</p>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {PREMIUM_TOOLS.map((tool) => (
              <button
                key={tool.id}
                type="button"
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
        </div>
      )}
    </div>
  );
};

export default ToolsDropdown;
