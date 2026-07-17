import { useState } from 'react';

const HELP_TIPS = [
  '💡 Renomear: Duplo clique sobre o atleta.',
  '💡 Quebras: Clique no campo durante o desenho para criar quinas.',
  '💡 Finalizar: Duplo clique para concluir a rota/bloqueio.',
  '💡 Zonas: Selecione a ferramenta e clique no campo.',
];

// Mesmo tratamento de foco/clique aplicado em todo botão do app (ver
// FieldControls.tsx).
const INTERACTIVE_BUTTON_CLASSES =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lobos-gold-400 active:scale-[0.97] transition-all';

/**
 * Botão de ajuda flutuante (fora do Canvas, canto inferior direito) que
 * abre um guia rápido com as interações menos óbvias do editor.
 */
export function HelpGuide() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Abrir guia de ajuda"
        className={`fixed right-4 bottom-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-lobos-gold-500 text-xl font-bold text-lobos-navy-950 shadow-lg hover:bg-lobos-gold-400 ${INTERACTIVE_BUTTON_CLASSES}`}
      >
        ?
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            role="dialog"
            aria-label="Guia rápido"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-lg bg-lobos-navy-900 p-5 shadow-xl ring-1 ring-white/5"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Guia Rápido</h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Fechar"
                className={`rounded px-2 py-1 text-slate-400 hover:bg-lobos-navy-800 hover:text-white ${INTERACTIVE_BUTTON_CLASSES}`}
              >
                ✕
              </button>
            </div>

            <ul className="flex flex-col gap-2 text-sm text-slate-200">
              {HELP_TIPS.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className={`mt-4 w-full rounded bg-lobos-gold-500 px-3 py-2 text-sm font-semibold text-lobos-navy-950 hover:bg-lobos-gold-400 ${INTERACTIVE_BUTTON_CLASSES}`}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
