import { useState } from 'react';
import { useFieldStore, type Folder, type Play } from '../../store/useFieldStore';
import { supabase } from '../../supabase';

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
 * `Play` (nome + categoria + pasta) e lista as jogadas já salvas, agrupadas
 * por pasta (mais uma seção "Raiz" pras jogadas sem pasta), com CRUD de
 * pastas e ações de carregar/excluir jogada. Não desenha nada no Konva — só
 * lê/escreve `savedPlays`/`folders` via Zustand.
 */
export function PlaybookSidebar() {
  const savedPlays = useFieldStore((state) => state.savedPlays);
  const saveCurrentPlay = useFieldStore((state) => state.saveCurrentPlay);
  const loadPlay = useFieldStore((state) => state.loadPlay);
  const deletePlay = useFieldStore((state) => state.deletePlay);
  const folders = useFieldStore((state) => state.folders);
  const createFolder = useFieldStore((state) => state.createFolder);
  const renameFolder = useFieldStore((state) => state.renameFolder);
  const deleteFolder = useFieldStore((state) => state.deleteFolder);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<Play['category']>('offense');
  // '' representa "Raiz" no <select> — HTML select não tem conceito nativo
  // de valor undefined, então a conversão pra undefined acontece só na
  // hora de chamar saveCurrentPlay.
  const [destinationFolderId, setDestinationFolderId] = useState('');

  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    saveCurrentPlay(trimmedName, category, destinationFolderId || undefined);
    setName('');
  };

  const handleDelete = (play: Play) => {
    if (!window.confirm(`Tem certeza que deseja excluir a jogada "${play.name}"?`)) return;
    deletePlay(play.id);
  };

  const handleCreateFolder = () => {
    const rawName = window.prompt('Nome da nova pasta:');
    if (rawName === null) return; // usuário cancelou o prompt
    const trimmedName = rawName.trim();
    if (!trimmedName) return;
    createFolder(trimmedName);
  };

  const startRenameFolder = (folder: Folder) => {
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
  };

  const commitRenameFolder = () => {
    if (!editingFolderId) return;
    const trimmedName = editingFolderName.trim();
    if (trimmedName) renameFolder(editingFolderId, trimmedName);
    setEditingFolderId(null);
  };

  const cancelRenameFolder = () => setEditingFolderId(null);

  const handleDeleteFolder = (folder: Folder) => {
    if (
      !window.confirm(
        `Tem certeza que deseja excluir a pasta "${folder.name}"? As jogadas dentro dela serão movidas para a Raiz.`,
      )
    ) {
      return;
    }
    deleteFolder(folder.id);
  };

  const rootPlays = savedPlays.filter((play) => !play.folderId);
  const playsByFolder = folders.map((folder) => ({
    folder,
    plays: savedPlays.filter((play) => play.folderId === folder.id),
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
            {(Object.keys(CATEGORY_LABELS) as Play['category'][]).map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Pasta
          <select
            value={destinationFolderId}
            onChange={(e) => setDestinationFolderId(e.target.value)}
            className="rounded border border-white/10 bg-lobos-navy-800 px-2 py-1.5 text-sm text-white focus:ring-2 focus:ring-lobos-gold-400 focus:outline-none"
          >
            <option value="">Raiz</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
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
        <button
          type="button"
          onClick={handleCreateFolder}
          className={`mb-4 flex w-full items-center justify-center gap-1.5 rounded border-2 border-lobos-gold-500 px-3 py-1.5 text-sm font-semibold text-lobos-gold-500 hover:bg-lobos-gold-500/10 ${INTERACTIVE_BUTTON_CLASSES}`}
        >
          <FolderPlusIcon />
          Nova Pasta
        </button>

        {savedPlays.length === 0 && folders.length === 0 && (
          <p className="text-sm text-slate-500">Nenhuma jogada salva ainda.</p>
        )}

        {playsByFolder.map(({ folder, plays }) => (
          <div key={folder.id} className="mb-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <FolderIcon />
                {editingFolderId === folder.id ? (
                  <input
                    autoFocus
                    value={editingFolderName}
                    onChange={(e) => setEditingFolderName(e.target.value)}
                    onBlur={commitRenameFolder}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRenameFolder();
                      if (e.key === 'Escape') cancelRenameFolder();
                    }}
                    className="min-w-0 flex-1 rounded border border-lobos-gold-400 bg-lobos-navy-800 px-1.5 py-0.5 text-xs font-semibold text-white focus:outline-none"
                  />
                ) : (
                  <h3
                    onDoubleClick={() => startRenameFolder(folder)}
                    className="truncate text-xs font-semibold tracking-wide text-slate-400 uppercase"
                    title={folder.name}
                  >
                    {folder.name}
                  </h3>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => startRenameFolder(folder)}
                  aria-label={`Renomear pasta ${folder.name}`}
                  className={`rounded p-1 text-slate-400 hover:text-lobos-gold-400 ${INTERACTIVE_BUTTON_CLASSES}`}
                >
                  <PencilIcon />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteFolder(folder)}
                  aria-label={`Excluir pasta ${folder.name}`}
                  className={`rounded p-1 text-slate-400 hover:text-red-500 ${INTERACTIVE_BUTTON_CLASSES}`}
                >
                  <TrashIcon />
                </button>
              </div>
            </div>

            {plays.length === 0 ? (
              <p className="text-xs text-slate-600 italic">Pasta vazia</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {plays.map((play) => (
                  <PlayListItem key={play.id} play={play} onLoad={loadPlay} onDelete={handleDelete} />
                ))}
              </ul>
            )}
          </div>
        ))}

        {rootPlays.length > 0 && (
          <div className="mb-4">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">Raiz</h3>
            <ul className="flex flex-col gap-1.5">
              {rootPlays.map((play) => (
                <PlayListItem key={play.id} play={play} onLoad={loadPlay} onDelete={handleDelete} />
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-white/5 p-4">
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className={`flex w-full items-center justify-center gap-1.5 rounded border border-white/10 px-3 py-1.5 text-sm font-semibold text-slate-300 hover:bg-lobos-navy-800 hover:text-white ${INTERACTIVE_BUTTON_CLASSES}`}
        >
          <LogoutIcon />
          Sair
        </button>
      </div>
    </aside>
  );
}

function PlayListItem({
  play,
  onLoad,
  onDelete,
}: {
  play: Play;
  onLoad: (id: string) => void;
  onDelete: (play: Play) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-2 rounded bg-lobos-navy-800 px-2.5 py-1.5">
      <span className="truncate text-sm" title={play.name}>
        {play.name}
      </span>
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={() => onLoad(play.id)}
          className={`rounded bg-lobos-gold-500 px-2 py-1 text-xs font-semibold text-lobos-navy-950 hover:bg-lobos-gold-400 ${INTERACTIVE_BUTTON_CLASSES}`}
        >
          Carregar
        </button>
        <button
          type="button"
          onClick={() => onDelete(play)}
          className={`rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-500 ${INTERACTIVE_BUTTON_CLASSES}`}
        >
          Excluir
        </button>
      </div>
    </li>
  );
}

function FolderIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 text-slate-500"
    >
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  );
}

function FolderPlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
      <path d="M12 11v4M10 13h4" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}
