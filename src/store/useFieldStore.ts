import { create } from 'zustand';
import type { FieldRule } from '../utils/constants';
import { createDefaultFormation } from './defaultFormation';
import {
  fetchFolders,
  fetchPlays,
  insertFolder,
  updateFolderName,
  deleteFolderRow,
  unassignPlaysFromFolder,
  insertPlay,
  updatePlay,
  deletePlayRow,
} from './playbookApi';
import { OFFENSIVE_FORMATIONS, DEFENSIVE_FORMATIONS, type FormationPosition } from '../utils/formations';

/** Modalidade esportiva — preparação estrutural pra suportar "Tackle 11x11"
 * (padrão atual) e "Flag 5x5" no futuro. Nesta iteração é só estado + UI de
 * alternância: NADA na renderização do Konva (proporções do campo, limite
 * de jogadores, vetores) reage a essa variável ainda, de propósito. */
export type GameMode = 'tackle' | 'flag5x5';

export type Team = 'offense' | 'defense';

export interface Player {
  id: string;
  label: string;
  team: Team;
  /** Posição no campo em JARDAS reais: 0-120 no eixo X, 0-53,33 no eixo Y. */
  x: number;
  y: number;
}

export type DrawingMode = 'move' | 'route' | 'block' | 'motion' | 'zone' | 'erase';

export type AssignmentType = 'route' | 'block' | 'motion' | 'zone';

export interface Assignment {
  id: string;
  /** Jogador de onde a linha parte. Zonas não têm dono — não são ancoradas
   * a nenhum jogador, então esta propriedade fica de fora. */
  playerId?: string;
  type: AssignmentType;
  /** Polilinha em JARDAS reais: [x1,y1, x2,y2, x3,y3, ...] — nunca pixels.
   * Zonas usam um único par (o centro da elipse). */
  points: number[];
}

/** Organização hierárquica das jogadas salvas, por enquanto só um nível
 * (sem sub-pastas). Persistida no Supabase (tabelas `folders`/`plays`,
 * escopadas por `user_id` — ver playbookApi.ts) em vez de localStorage. */
export interface Folder {
  id: string;
  name: string;
}

export interface Play {
  id: string;
  name: string;
  category: 'offense' | 'defense' | 'special';
  /** Pasta onde a jogada está guardada — `undefined` = "Raiz" (sem pasta).
   * Nunca aponta pra uma pasta inexistente: deleteFolder realoca as jogadas
   * da pasta excluída pra Raiz antes de remover a pasta em si. */
  folderId?: string;
  fieldRule: FieldRule;
  players: Player[];
  assignments: Assignment[];
  createdAt: number;
}

interface FieldState {
  /** Ver comentário do tipo GameMode acima — só estado por enquanto. */
  gameMode: GameMode;
  setGameMode: (mode: GameMode) => void;
  fieldRule: FieldRule;
  setFieldRule: (rule: FieldRule) => void;
  players: Player[];
  updatePlayerPosition: (id: string, x: number, y: number) => void;
  updatePlayerLabel: (id: string, newLabel: string) => void;
  setOffensiveFormation: (formationName: string) => void;
  setDefensiveFormation: (formationName: string) => void;
  drawingMode: DrawingMode;
  setDrawingMode: (mode: DrawingMode) => void;
  assignments: Assignment[];
  /** Id do Assignment sendo desenhado por múltiplos cliques agora, ou null
   * se nenhum desenho estiver em andamento (ver Field.tsx). */
  activeDrawingId: string | null;
  /** 1º clique num jogador (route/block/motion): cria o Assignment com o
   * ponto de ancoragem no próprio jogador + o ponto onde o mouse clicou. */
  startDrawing: (
    type: 'route' | 'block' | 'motion',
    playerId: string,
    anchorX: number,
    anchorY: number,
    pointerX: number,
    pointerY: number,
  ) => void;
  /** mousemove durante o desenho: só atualiza o ÚLTIMO par em vigor. */
  updateDrawingPoint: (x: number, y: number) => void;
  /** clique subsequente durante o desenho: fixa o último par e abre um
   * novo par (quebra da rota), que passa a seguir o mouse. */
  addDrawingPoint: (x: number, y: number) => void;
  /** duplo-clique: encerra o desenho em andamento. */
  finishDrawing: () => void;
  /** modo 'zone': cria a zona inteira num único clique, sem jogador. */
  addZoneAssignment: (x: number, y: number) => void;
  /** Remove o assignment vinculado a `playerId` — ou, no caso de zonas (que
   * não têm dono), o assignment cujo próprio `id` bate com o valor passado.
   * Ver AssignmentsLayer.tsx: cada forma carrega `playerId ?? id` como seu
   * id Konva, então o mesmo identificador serve para os dois casos. */
  removeAssignment: (playerId: string) => void;
  /** Modo 'erase': esvazia todas as rotas/bloqueios/motions/zonas de uma
   * vez, sem tocar nos jogadores nem nas formações. */
  clearAllAssignments: () => void;
  savedPlays: Play[];
  /** Cria uma jogada nova (INSERT) ou, se `existingPlayId` for passado,
   * sobrescreve uma já existente (UPDATE) — hoje a UI só usa o caminho de
   * criação; o parâmetro existe pra permitir "salvar por cima" no futuro
   * sem precisar mexer na store de novo. */
  saveCurrentPlay: (
    name: string,
    category: Play['category'],
    folderId?: string,
    existingPlayId?: string,
  ) => Promise<void>;
  loadPlay: (id: string) => void;
  deletePlay: (id: string) => Promise<void>;
  folders: Folder[];
  createFolder: (name: string) => Promise<void>;
  renameFolder: (id: string, newName: string) => Promise<void>;
  /** Remove a pasta e realoca suas jogadas pra Raiz (folderId: undefined) —
   * excluir uma pasta nunca destrói as jogadas guardadas nela. */
  deleteFolder: (id: string) => Promise<void>;
  /** Id do usuário autenticado cujas pastas/jogadas estão carregadas — null
   * antes do login ou depois do logout. Toda operação de pasta/jogada lê
   * daqui em vez de receber o id por parâmetro em cada chamada. */
  currentUserId: string | null;
  /** True enquanto o SELECT inicial de pastas/jogadas está em andamento —
   * evita mostrar "Nenhuma jogada salva ainda" por um instante antes dos
   * dados reais chegarem do Supabase. */
  isLoadingPlaybook: boolean;
  /** Busca pastas/jogadas do usuário no Supabase e popula o estado local —
   * chamado por App.tsx assim que a sessão é confirmada. */
  loadUserPlaybook: (userId: string) => Promise<void>;
  /** Limpa pastas/jogadas/currentUserId — chamado no logout, pra não deixar
   * o playbook de um usuário visível depois que a sessão dele encerrou. */
  clearUserPlaybook: () => void;
  /** Mensagem da última operação de pasta/jogada que falhou contra o
   * Supabase, ou null se não há erro pendente — ver PlaybookSidebar.tsx
   * pro banner que exibe isso sem travar o resto da UI. */
  syncError: string | null;
  clearSyncError: () => void;
  /** Nome da jogada atualmente carregada/salva — null se o campo foi
   * resetado ou editado sem corresponder a nenhuma jogada salva. Usado
   * para nomear o arquivo na exportação PNG. */
  activePlayName: string | null;
  /** True enquanto o PNG está sendo capturado — usado para esconder UI de
   * edição do Stage antes do toDataURL. */
  isExporting: boolean;
  setIsExporting: (value: boolean) => void;
}

/**
 * Aplica um "personnel grouping" (ver utils/formations.ts) por cima do
 * estado atual: só as coordenadas dos jogadores cujo id aparece no mapa de
 * posições são tocadas — qualquer outro jogador (o time adversário) passa
 * intacto. Reaproveita o mesmo padrão de ancoragem de updatePlayerPosition
 * para que rotas/bloqueios já desenhados acompanhem o P0 reposicionado em
 * vez de ficarem "presos" na coordenada antiga.
 */
function applyFormation(
  state: FieldState,
  formationPositions: FormationPosition[],
): Pick<FieldState, 'players' | 'assignments'> {
  const positionByPlayerId = new Map(
    formationPositions.map((position) => [position.playerId, position] as const),
  );

  return {
    players: state.players.map((player) => {
      const position = positionByPlayerId.get(player.id);
      return position ? { ...player, x: position.x, y: position.y } : player;
    }),
    assignments: state.assignments.map((assignment) => {
      const position = assignment.playerId ? positionByPlayerId.get(assignment.playerId) : undefined;
      return position
        ? { ...assignment, points: [position.x, position.y, ...assignment.points.slice(2)] }
        : assignment;
    }),
  };
}

/** Remove pares finais duplicados de uma polilinha — artefato inevitável de
 * um duplo-clique: cada clique do gesto roda `addDrawingPoint`, e como as
 * duas metades do duplo-clique caem no mesmo ponto (sem mousemove entre
 * elas), sobram 1-2 pares redundantes na mesma posição ao final. */
function dedupeTrailingPairs(points: number[]): number[] {
  const result = points.slice();
  while (
    result.length >= 4 &&
    result[result.length - 2] === result[result.length - 4] &&
    result[result.length - 1] === result[result.length - 3]
  ) {
    result.splice(result.length - 2, 2);
  }
  return result;
}

/** Extrai uma mensagem legível de um erro do Supabase (ou qualquer outro
 * lançado), com um prefixo dizendo qual operação falhou — o banner de erro
 * em PlaybookSidebar.tsx mostra isso direto, então precisa ser algo que
 * faça sentido pro usuário final, não um stack trace. */
function describeSyncError(operationLabel: string, err: unknown): string {
  const detail = err instanceof Error ? err.message : String(err);
  return `${operationLabel}: ${detail}`;
}

export const useFieldStore = create<FieldState>((set, get) => ({
  gameMode: 'tackle',
  setGameMode: (mode) => set({ gameMode: mode }),
  fieldRule: 'NCAA',
  setFieldRule: (rule) => set({ fieldRule: rule }),
  // A formação padrão já nasce populada aqui, então a primeira renderização
  // do app já mostra os 22 jogadores — nenhum efeito de inicialização extra
  // é necessário em nenhum componente.
  players: createDefaultFormation(),
  updatePlayerPosition: (id, x, y) =>
    set((state) => ({
      players: state.players.map((player) =>
        player.id === id ? { ...player, x, y } : player,
      ),
      // Ancoragem reativa: se o jogador arrastado tiver uma rota/bloqueio,
      // o ponto INICIAL da linha (points[0], points[1]) acompanha o nó para
      // que ela nunca se descole do jogador. O resto da polilinha não é
      // tocado aqui.
      assignments: state.assignments.map((assignment) =>
        assignment.playerId === id
          ? { ...assignment, points: [x, y, ...assignment.points.slice(2)] }
          : assignment,
      ),
    })),
  updatePlayerLabel: (id, newLabel) =>
    set((state) => ({
      players: state.players.map((player) =>
        player.id === id ? { ...player, label: newLabel } : player,
      ),
    })),
  setOffensiveFormation: (formationName) =>
    set((state) => {
      const formation = OFFENSIVE_FORMATIONS[formationName];
      return formation ? applyFormation(state, formation) : state;
    }),
  setDefensiveFormation: (formationName) =>
    set((state) => {
      const formation = DEFENSIVE_FORMATIONS[formationName];
      return formation ? applyFormation(state, formation) : state;
    }),
  drawingMode: 'move',
  setDrawingMode: (mode) => set({ drawingMode: mode }),
  assignments: [],
  activeDrawingId: null,
  startDrawing: (type, playerId, anchorX, anchorY, pointerX, pointerY) =>
    set((state) => {
      // Id único POR SESSÃO de desenho (não só por jogador): um id fixo
      // como `assign-${playerId}` faz `activeDrawingId` colidir com o
      // assignment de uma sessão de desenho ANTERIOR do mesmo jogador — se
      // startDrawing rodasse de novo por engano enquanto activeDrawingId
      // ainda apontasse pro desenho velho (ex.: uma race entre gestos),
      // updateDrawingPoint/addDrawingPoint passariam a não achar mais o
      // assignment (`a.id !== state.activeDrawingId` sempre verdadeiro) e
      // virariam no-op silencioso pro resto da sessão, sem erro nenhum.
      const id = `assign-${playerId}-${Date.now()}`;
      const newAssignment: Assignment = {
        id,
        playerId,
        type,
        points: [anchorX, anchorY, pointerX, pointerY],
      };
      return {
        // Mesmo limite de "um assignment por jogador" das etapas anteriores:
        // começar um novo desenho substitui o que esse jogador já tinha.
        assignments: [
          ...state.assignments.filter((a) => a.playerId !== playerId),
          newAssignment,
        ],
        activeDrawingId: id,
      };
    }),
  updateDrawingPoint: (x, y) =>
    set((state) => {
      if (!state.activeDrawingId) return state;
      // Guarda contra desincronização: se activeDrawingId não bate com
      // NENHUM assignment (ex.: foi substituído por um startDrawing
      // concorrente pro mesmo jogador), mapear não faz nada e o desenho
      // fica "travado" pro resto da sessão sem nenhum sinal disso. Resetar
      // aqui transforma um estado fantasma silencioso num "desenho
      // cancelado" visível — pior caso é o usuário precisar clicar nem
      // jogador de novo, não uma trava permanente sem explicação.
      if (!state.assignments.some((a) => a.id === state.activeDrawingId)) {
        return { activeDrawingId: null };
      }
      return {
        assignments: state.assignments.map((a) => {
          if (a.id !== state.activeDrawingId) return a;
          const points = a.points.slice();
          points[points.length - 2] = x;
          points[points.length - 1] = y;
          return { ...a, points };
        }),
      };
    }),
  addDrawingPoint: (x, y) =>
    set((state) => {
      if (!state.activeDrawingId) return state;
      if (!state.assignments.some((a) => a.id === state.activeDrawingId)) {
        return { activeDrawingId: null };
      }
      return {
        assignments: state.assignments.map((a) => {
          if (a.id !== state.activeDrawingId) return a;
          const points = a.points.slice();
          points[points.length - 2] = x;
          points[points.length - 1] = y;
          points.push(x, y); // novo par "seguindo o mouse" até o próximo evento
          return { ...a, points };
        }),
      };
    }),
  finishDrawing: () =>
    set((state) => {
      const id = state.activeDrawingId;
      if (!id) return state;

      const target = state.assignments.find((a) => a.id === id);
      if (!target) return { activeDrawingId: null };

      const dedupedPoints = dedupeTrailingPairs(target.points);
      // Menos de 2 pontos distintos = clique/duplo-clique sem desenhar nada
      // de fato — descarta em vez de deixar um Assignment invisível.
      const isDegenerate = dedupedPoints.length < 4;

      return {
        activeDrawingId: null,
        assignments: isDegenerate
          ? state.assignments.filter((a) => a.id !== id)
          : state.assignments.map((a) => (a.id === id ? { ...a, points: dedupedPoints } : a)),
      };
    }),
  addZoneAssignment: (x, y) =>
    set((state) => ({
      assignments: [
        ...state.assignments,
        {
          id: `assign-zone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: 'zone',
          points: [x, y],
        },
      ],
    })),
  removeAssignment: (playerId) =>
    set((state) => ({
      // a.id !== playerId cobre zonas: como não têm playerId, são
      // identificadas pelo próprio id do assignment (ver comentário acima).
      assignments: state.assignments.filter((a) => a.playerId !== playerId && a.id !== playerId),
    })),
  clearAllAssignments: () => set({ assignments: [], activeDrawingId: null }),
  // Populado por loadUserPlaybook() assim que a sessão é confirmada — antes
  // disso (ou sem usuário logado) começa vazio, nunca lido de localStorage.
  savedPlays: [],
  saveCurrentPlay: async (name, category, folderId, existingPlayId) => {
    const { currentUserId, fieldRule, players, assignments } = get();
    if (!currentUserId) return; // não deveria disparar sem sessão (UI só aparece autenticada)
    try {
      const play = existingPlayId
        ? await updatePlay(existingPlayId, { name, category, folderId, fieldRule, players, assignments })
        : await insertPlay(currentUserId, { name, category, folderId, fieldRule, players, assignments });
      set((state) => ({
        savedPlays: existingPlayId
          ? state.savedPlays.map((p) => (p.id === play.id ? play : p))
          : [...state.savedPlays, play],
        activePlayName: play.name,
      }));
    } catch (err) {
      set({ syncError: describeSyncError('Não foi possível salvar a jogada', err) });
    }
  },
  loadPlay: (id) =>
    set((state) => {
      const play = state.savedPlays.find((p) => p.id === id);
      if (!play) return state;
      // players/assignments são os mesmos arrays já carregados do Supabase
      // por loadUserPlaybook, então assignment.playerId já referencia os
      // ids corretos dos jogadores — a ancoragem das linhas do motor de
      // desenho continua funcionando sem nenhum remapeamento. Carregar uma
      // jogada é 100% local (não bate no Supabase de novo): os dados já
      // estão todos em savedPlays desde o carregamento inicial.
      return {
        fieldRule: play.fieldRule,
        players: play.players,
        assignments: play.assignments,
        activePlayName: play.name,
      };
    }),
  deletePlay: async (id) => {
    try {
      await deletePlayRow(id);
      set((state) => ({ savedPlays: state.savedPlays.filter((p) => p.id !== id) }));
    } catch (err) {
      set({ syncError: describeSyncError('Não foi possível excluir a jogada', err) });
    }
  },
  activePlayName: null,
  folders: [],
  createFolder: async (name) => {
    const { currentUserId } = get();
    if (!currentUserId) return;
    try {
      const newFolder = await insertFolder(currentUserId, name);
      set((state) => ({ folders: [...state.folders, newFolder] }));
    } catch (err) {
      set({ syncError: describeSyncError('Não foi possível criar a pasta', err) });
    }
  },
  renameFolder: async (id, newName) => {
    try {
      await updateFolderName(id, newName);
      set((state) => ({
        folders: state.folders.map((folder) => (folder.id === id ? { ...folder, name: newName } : folder)),
      }));
    } catch (err) {
      set({ syncError: describeSyncError('Não foi possível renomear a pasta', err) });
    }
  },
  deleteFolder: async (id) => {
    try {
      // Realoca pra Raiz ANTES de apagar a pasta em si — excluir uma pasta é
      // uma ação de organização, não deveria também destruir as jogadas
      // guardadas nela nem deixar folder_id apontando pra uma pasta morta.
      await unassignPlaysFromFolder(id);
      await deleteFolderRow(id);
      set((state) => ({
        folders: state.folders.filter((folder) => folder.id !== id),
        savedPlays: state.savedPlays.map((play) =>
          play.folderId === id ? { ...play, folderId: undefined } : play,
        ),
      }));
    } catch (err) {
      set({ syncError: describeSyncError('Não foi possível excluir a pasta', err) });
    }
  },
  currentUserId: null,
  isLoadingPlaybook: false,
  loadUserPlaybook: async (userId) => {
    set({ currentUserId: userId, isLoadingPlaybook: true, syncError: null });
    try {
      const [folders, savedPlays] = await Promise.all([fetchFolders(userId), fetchPlays(userId)]);
      set({ folders, savedPlays, isLoadingPlaybook: false });
    } catch (err) {
      set({
        syncError: describeSyncError('Não foi possível carregar o playbook', err),
        isLoadingPlaybook: false,
      });
    }
  },
  clearUserPlaybook: () =>
    set({ currentUserId: null, folders: [], savedPlays: [], activePlayName: null, syncError: null }),
  syncError: null,
  clearSyncError: () => set({ syncError: null }),
  isExporting: false,
  setIsExporting: (value) => set({ isExporting: value }),
}));
