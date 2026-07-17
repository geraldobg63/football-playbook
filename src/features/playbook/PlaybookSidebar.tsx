import { useState } from 'react';
import { useFieldStore, type Play } from '../../store/useFieldStore';

const CATEGORY_ORDER: Play['category'][] = ['offense', 'defense', 'special'];

const CATEGORY_LABELS: Record<Play['category'], string> = {
  offense: 'Ataque',
  defense: 'Defesa',
  special: 'Times Especiais',
};

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

  const playsByCategory = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    plays: savedPlays.filter((play) => play.category === cat),
  }));

  return (
    <aside className="flex h-auto max-h-[45vh] w-full shrink-0 flex-col border-b border-slate-800 bg-slate-900 text-slate-100 md:h-screen md:max-h-none md:w-80 md:border-r md:border-b-0">
      <div className="flex flex-col gap-3 border-b border-slate-800 p-4">
        <h2 className="text-lg font-bold">Playbook</h2>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Nome da Jogada
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="Ex.: Slant Direita"
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Categoria
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Play['category'])}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
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
          className="rounded bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
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
                      className="flex items-center justify-between gap-2 rounded bg-slate-800 px-2.5 py-1.5"
                    >
                      <span className="truncate text-sm" title={play.name}>
                        {play.name}
                      </span>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => loadPlay(play.id)}
                          className="rounded bg-sky-600 px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-sky-500"
                        >
                          Carregar
                        </button>
                        <button
                          type="button"
                          onClick={() => deletePlay(play.id)}
                          className="rounded bg-red-700 px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-600"
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
