import React from 'react';
import { ceditBtnPrimaryClass, ceditBtnSecondaryClass, ceditCardClass, ceditIconBoxClass } from '../theme/ceditPalette';

const ResetMemoryModal = ({ isOpen, onClose, onConfirm, auditCount = 0, limit = 10 }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm cedit-fade-in">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200/90 overflow-hidden"
        role="dialog"
        aria-labelledby="reset-memory-title"
      >
        <div className="bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/80 px-6 py-4 flex items-center gap-3 border-b border-slate-200/80">
          <div className={ceditIconBoxClass('blue', 'w-11 h-11')}>
            <span className="material-symbols-outlined text-white text-xl">psychology_alt</span>
          </div>
          <div>
            <h2 id="reset-memory-title" className="text-slate-800 font-bold text-lg">
              Reiniciar memoria
            </h2>
            <p className="text-slate-500 text-xs">Consejero Estatal Digital</p>
          </div>
        </div>
        <div className="px-6 py-5 text-slate-700 text-sm leading-relaxed space-y-3 bg-gradient-to-b from-slate-50/90 to-white">
          <p>
            ¿Desea reiniciar la memoria de esta sesión? Su progreso actual{' '}
            <strong className="text-slate-800">
              ({auditCount}/{limit} auditorías)
            </strong>{' '}
            y el historial del chat <strong className="text-slate-800">se perderán</strong> en este navegador.
          </p>
          <p className="text-slate-600">
            Podrá seguir usando el agente con un cupo renovado de auditorías gratuitas y una conversación nueva.
          </p>
          <p className={`text-xs text-slate-600 ${ceditCardClass('gray')}`}>
            Tip: si solo necesita ajustar el plan, use <strong>Corregir plan</strong> sin reiniciar.
          </p>
        </div>
        <div className="px-6 pb-6 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end bg-slate-50/50 border-t border-slate-100">
          <button type="button" onClick={onClose} className={ceditBtnSecondaryClass()}>
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} className={ceditBtnPrimaryClass('blue')}>
            Sí, reiniciar memoria
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResetMemoryModal;
