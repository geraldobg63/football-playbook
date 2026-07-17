import { create } from 'zustand';
import type { FieldRule } from '../utils/constants';
import { createDefaultFormation } from './defaultFormation';
import { loadSavedPlays, persistSavedPlays } from './playbookStorage';
import { OFFENSIVE_FORMATIONS, DEFENSIVE_FORMATIONS, type FormationPosition } from '../utils/formations';

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

export interface Play {
  id: string;
  name: string;
  category: 'offense' | 'defense' | 'special';
  fieldRule: FieldRule;
  players: Player[];
  assignments: Assignment[];
  createdAt: number;
}

interface FieldState {
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
  saveCurrentPlay: (name: string, category: Play['category']) => void;
  loadPlay: (id: string) => void;
  deletePlay: (id: string) => void;
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

export const useFieldStore = create<FieldState>((set) => ({
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
  // Hidratação: lida do localStorage já na criação da store, então a
  // primeira renderização do app já mostra as jogadas salvas anteriormente
  // — mesmo padrão usado para a formação padrão de jogadores acima.
  savedPlays: loadSavedPlays(),
  saveCurrentPlay: (name, category) =>
    set((state) => {
      const newPlay: Play = {
        id: `play-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        category,
        // Captura o estado EXATO no momento do clique — não uma referência
        // que continuaria mudando se o usuário seguisse editando o campo.
        fieldRule: state.fieldRule,
        players: state.players,
        assignments: state.assignments,
        createdAt: Date.now(),
      };
      const savedPlays = [...state.savedPlays, newPlay];
      persistSavedPlays(savedPlays);
      return { savedPlays, activePlayName: newPlay.name };
    }),
  loadPlay: (id) =>
    set((state) => {
      const play = state.savedPlays.find((p) => p.id === id);
      if (!play) return state;
      // players/assignments são os mesmos arrays salvos juntos em
      // saveCurrentPlay, então assignment.playerId já referencia os ids
      // corretos dos jogadores carregados — a ancoragem das linhas do
      // motor de desenho continua funcionando sem nenhum remapeamento.
      return {
        fieldRule: play.fieldRule,
        players: play.players,
        assignments: play.assignments,
        activePlayName: play.name,
      };
    }),
  deletePlay: (id) =>
    set((state) => {
      const savedPlays = state.savedPlays.filter((p) => p.id !== id);
      persistSavedPlays(savedPlays);
      return { savedPlays };
    }),
  activePlayName: null,
  isExporting: false,
  setIsExporting: (value) => set({ isExporting: value }),
}));
