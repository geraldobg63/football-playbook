import { useRef, useState } from 'react';
import type Konva from 'konva';
import { useFieldStore, type Folder, type GameMode, type Play } from '../../store/useFieldStore';
import { supabase } from '../../supabase';
import { BatchExportStage } from './BatchExportStage';
import { exportPlaysToPdf } from './exportPlaysToPdf';

const CATEGORY_LABELS: Record<Play['category'], string> = {
  offense: 'Ataque',
  defense: 'Defesa',
  special: 'Times Especiais',
};

// Mesmo rótulo usado no toggle do header (App.tsx) — duplicado aqui de
// propósito (mesmo padrão de CATEGORY_LABELS acima): só exibe qual
// modalidade está ativa, ainda não muda nenhum comportamento.
const GAME_MODE_LABELS: Record<GameMode, string> = {
  tackle: 'Tackle 11x11',
  flag5x5: 'Flag 5x5',
};

// Mesmo tratamento de foco/clique aplicado em todo botão do app (ver
// FieldControls.tsx) — mantido aqui como constante local pra não criar um
// import cruzado entre features só por causa de uma string de classes.
const INTERACTIVE_BUTTON_CLASSES =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lobos-gold-400 active:scale-[0.97] transition-all';

interface PlaybookSidebarProps {
  /** Modo Foco (App.tsx): false retrai a barra pra w-0 em telas md+, sem
   * desmontar nada — o formulário/lista continuam com seu estado intacto,
   * só ficam invisíveis até reabrir. Não afeta o layout empilhado mobile. */
  isOpen: boolean;
}

/**
 * Painel lateral de persistência: salva o estado atual do campo como uma
 * `Play` (nome + categoria + pasta) e lista as jogadas já salvas, agrupadas
 * por pasta (mais uma seção "Raiz" pras jogadas sem pasta), com CRUD de
 * pastas e ações de carregar/excluir jogada. Não desenha nada no Konva — só
 * lê/escreve `savedPlays`/`folders` via Zustand.
 */
export function PlaybookSidebar({ isOpen }: PlaybookSidebarProps) {
  const gameMode = useFieldStore((state) => state.gameMode);
  const savedPlays = useFieldStore((state) => state.savedPlays);
  const saveCurrentPlay = useFieldStore((state) => state.saveCurrentPlay);
  const loadPlay = useFieldStore((state) => state.loadPlay);
  const deletePlay = useFieldStore((state) => state.deletePlay);
  const folders = useFieldStore((state) => state.folders);
  const createFolder = useFieldStore((state) => state.createFolder);
  const renameFolder = useFieldStore((state) => state.renameFolder);
  const deleteFolder = useFieldStore((state) => state.deleteFolder);
  const isLoadingPlaybook = useFieldStore((state) => state.isLoadingPlaybook);
  const syncError = useFieldStore((state) => state.syncError);
  const clearSyncError = useFieldStore((state) => state.clearSyncError);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<Play['category']>('offense');
  // '' representa "Raiz" no <select> — HTML select não tem conceito nativo
  // de valor undefined, então a conversão pra undefined acontece só na
  // hora de chamar saveCurrentPlay.
  const [destinationFolderId, setDestinationFolderId] = useState('');

  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');

  // Exportação em lote pra PDF: quais jogadas estão marcadas, e o estado do
  // <BatchExportStage> off-screen (ver esse arquivo) que captura cada uma
  // sequencialmente sem tocar no campo que o usuário está editando.
  const [selectedPlayIds, setSelectedPlayIds] = useState<Set<string>>(new Set());
  const [isBatchExporting, setIsBatchExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ completed: number; total: number } | null>(
    null,
  );
  const [currentExportPlay, setCurrentExportPlay] = useState<Play | null>(null);
  const batchExportStageRef = useRef<Konva.Stage>(null);

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

  const toggleSelectPlay = (id: string) => {
    setSelectedPlayIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExportSelected = async () => {
    const selectedPlays = savedPlays.filter((play) => selectedPlayIds.has(play.id));
    if (selectedPlays.length === 0 || isBatchExporting) return;

    setIsBatchExporting(true);
    setExportProgress({ completed: 0, total: selectedPlays.length });
    try {
      await exportPlaysToPdf(selectedPlays, setCurrentExportPlay, batchExportStageRef, (completed, total) =>
        setExportProgress({ completed, total }),
      );
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      window.alert(`Não foi possível gerar o PDF: ${detail}`);
    } finally {
      setIsBatchExporting(false);
      setExportProgress(null);
    }
  };

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
    <aside
      className={`flex h-auto max-h-[45vh] w-full shrink-0 flex-col border-b border-white/5 bg-lobos-navy-900 text-slate-100 transition-all duration-300 md:h-screen md:max-h-none md:border-b-0 ${
        isOpen ? 'md:w-80 md:border-r' : 'md:w-0 md:overflow-hidden md:border-r-0'
      }`}
    >
      <div className="flex flex-col gap-3 border-b border-white/5 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Playbook</h2>
          <span className="rounded-full bg-lobos-navy-800 px-2.5 py-0.5 text-xs font-semibold text-lobos-gold-400 ring-1 ring-white/10">
            {GAME_MODE_LABELS[gameMode]}
          </span>
        </div>

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
        {syncError && (
          // Banner não-bloqueante — ao contrário de um window.alert(), não
          // interrompe o fluxo do usuário nem trava a UI; some sozinho na
          // próxima operação bem-sucedida ou quando o usuário clica em ✕.
          <div
            role="alert"
            className="mb-4 flex items-start justify-between gap-2 rounded border border-red-600/50 bg-red-950/50 px-3 py-2 text-sm text-red-300"
          >
            <span>{syncError}</span>
            <button
              type="button"
              onClick={clearSyncError}
              aria-label="Dispensar aviso de erro"
              className={`shrink-0 rounded text-red-300 hover:text-white ${INTERACTIVE_BUTTON_CLASSES}`}
            >
              ✕
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={handleCreateFolder}
          className={`mb-2 flex w-full items-center justify-center gap-1.5 rounded border-2 border-lobos-gold-500 px-3 py-1.5 text-sm font-semibold text-lobos-gold-500 hover:bg-lobos-gold-500/10 ${INTERACTIVE_BUTTON_CLASSES}`}
        >
          <FolderPlusIcon />
          Nova Pasta
        </button>

        <button
          type="button"
          onClick={handleExportSelected}
          disabled={selectedPlayIds.size === 0 || isBatchExporting}
          className={`mb-4 flex w-full items-center justify-center gap-1.5 rounded bg-lobos-gold-500 px-3 py-1.5 text-sm font-semibold text-lobos-navy-950 hover:bg-lobos-gold-400 disabled:cursor-not-allowed disabled:bg-lobos-navy-800 disabled:text-slate-500 ${INTERACTIVE_BUTTON_CLASSES}`}
        >
          <PdfIcon />
          {isBatchExporting
            ? `Exportando ${exportProgress?.completed ?? 0}/${exportProgress?.total ?? 0}…`
            : `Exportar Selecionados (PDF)${selectedPlayIds.size > 0 ? ` · ${selectedPlayIds.size}` : ''}`}
        </button>

        {/* Off-screen: nunca visível, só existe pra <BatchExportStage>
            conseguir renderizar cada jogada selecionada num Konva Stage
            independente do que está na tela (ver exportPlaysToPdf.ts). */}
        <BatchExportStage play={currentExportPlay} stageRef={batchExportStageRef} />

        {isLoadingPlaybook ? (
          <p className="text-sm text-slate-500">Carregando jogadas…</p>
        ) : (
          savedPlays.length === 0 &&
          folders.length === 0 && <p className="text-sm text-slate-500">Nenhuma jogada salva ainda.</p>
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
                  <PlayListItem
                    key={play.id}
                    play={play}
                    onLoad={loadPlay}
                    onDelete={handleDelete}
                    isSelected={selectedPlayIds.has(play.id)}
                    onToggleSelect={toggleSelectPlay}
                  />
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
                <PlayListItem
                  key={play.id}
                  play={play}
                  onLoad={loadPlay}
                  onDelete={handleDelete}
                  isSelected={selectedPlayIds.has(play.id)}
                  onToggleSelect={toggleSelectPlay}
                />
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
  isSelected,
  onToggleSelect,
}: {
  play: Play;
  onLoad: (id: string) => void;
  onDelete: (play: Play) => void;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-2 rounded bg-lobos-navy-800 px-2.5 py-1.5">
      <label className="flex min-w-0 items-center gap-2">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(play.id)}
          aria-label={`Selecionar "${play.name}" para exportação em lote`}
          className="shrink-0 accent-lobos-gold-500"
        />
        <span className="truncate text-sm" title={play.name}>
          {play.name}
        </span>
      </label>
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

function PdfIcon() {
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
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
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
