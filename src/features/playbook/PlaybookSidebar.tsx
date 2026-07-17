import { useState } from 'react';
import { useFieldStore, type Play } from '../../store/useFieldStore';

const CATEGORY_ORDER: Play['category'][] = ['offense', 'defense', 'special'];

const CATEGORY_LABELS: Record<Play['category'], string> = {
  offense: 'Ataque',
  defense: 'Defesa',
  special: 'Times Especiais',
};

// Mesmo tratamento de foco/clique aplicado em todo botão do app (ver
// FieldControls.tsx) — mantido aqui como constante local pra não criar um
// import cruzado entre features só por causa de uma string de classes.
const INTERACTIVE_BUTTON_CLASSES =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lobos-gold-400 active:scale-[0.97] transition-all';

/**
 * Painel lateral de persistência: salva o estado atual do campo como uma
 * `Play` (nome + categoria) e lista as jogadas já salvas, agrupadas por
 * categoria, com ações de carregar/excluir. Não desenha nada no Konva —
 * só lê/escreve `savedPlays` via Zustand.
 */
export function PlaybookSidebar() {
  const savedPlays = useFieldStore((state) => state.savedPlays);
  const saveCurrentPlay = useFieldStore((state) => state.saveCurrentPlay);
  const loadPlay = useFieldStore((state) => state.loadPlay);
  const deletePlay = useFieldStore((state) => state.deletePlay);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<Play['category']>('offense');

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    saveCurrentPlay(trimmedName, category);
    setName('');
  };

  const handleDelete = (play: Play) => {
    if (!window.confirm(`Tem certeza que deseja excluir a jogada "${play.name}"?`)) return;
    deletePlay(play.id);
  };

  const playsByCategory = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    plays: savedPlays.filter((play) => play.category === cat),
  }));

  return (
    <aside className="flex h-auto max-h-[45vh] w-full shrink-0 flex-col border-b border-white/5 bg-lobos-navy-900 text-slate-100 md:h-screen md:max-h-none md:w-80 md:border-r md:border-b-0">
      <div className="flex flex-col gap-3 border-b border-white/5 p-4">
        <h2 className="text-lg font-bold">Playbook</h2>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Nome da Jogada
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="Ex.: Slant Direita"
            className="rounded border border-white/10 bg-lobos-navy-800 px-2 py-1.5 text-sm text-white placeholder:text-slate-500 focus:ring-2 focus:ring-lobos-gold-400 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Categoria
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Play['category'])}
            className="rounded border border-white/10 bg-lobos-navy-800 px-2 py-1.5 text-sm text-white focus:ring-2 focus:ring-lobos-gold-400 focus:outline-none"
          >
            {CATEGORY_ORDER.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={handleSave}
          disabled={!name.trim()}
          className={`rounded bg-lobos-gold-500 px-3 py-1.5 text-sm font-semibold text-lobos-navy-950 hover:bg-lobos-gold-400 disabled:cursor-not-allowed disabled:bg-lobos-navy-800 disabled:text-slate-500 ${INTERACTIVE_BUTTON_CLASSES}`}
        >
          Salvar Jogada
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {savedPlays.length === 0 && (
          <p className="text-sm text-slate-500">Nenhuma jogada salva ainda.</p>
        )}

        {playsByCategory.map(
          ({ category: cat, plays }) =>
            plays.length > 0 && (
              <div key={cat} className="mb-4">
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                  {CATEGORY_LABELS[cat]}
                </h3>
                <ul className="flex flex-col gap-1.5">
                  {plays.map((play) => (
                    <li
                      key={play.id}
                      className="flex items-center justify-between gap-2 rounded bg-lobos-navy-800 px-2.5 py-1.5"
                    >
                      <span className="truncate text-sm" title={play.name}>
                        {play.name}
                      </span>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => loadPlay(play.id)}
                          className={`rounded bg-lobos-gold-500 px-2 py-1 text-xs font-semibold text-lobos-navy-950 hover:bg-lobos-gold-400 ${INTERACTIVE_BUTTON_CLASSES}`}
                        >
                          Carregar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(play)}
                          className={`rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-500 ${INTERACTIVE_BUTTON_CLASSES}`}
                        >
                          Excluir
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ),
        )}
      </div>
    </aside>
  );
}
