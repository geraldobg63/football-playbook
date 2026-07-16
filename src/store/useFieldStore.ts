import { create } from 'zustand';
import type { FieldRule } from '../utils/constants';
import { createDefaultFormation } from './defaultFormation';
import { loadSavedPlays, persistSavedPlays } from './playbookStorage';

export type Team = 'offense' | 'defense';

export interface Player {
  id: string;
  label: string;
  team: Team;
  /** Posição no campo em JARDAS reais: 0-120 no eixo X, 0-53,33 no eixo Y. */
  x: number;
  y: number;
}

export type DrawingMode = 'move' | 'route' | 'block' | 'edit-curve';

export interface Assignment {
  id: string;
  playerId: string;
  type: 'route' | 'block';
  /** [x0, y0, x1, y1] em JARDAS reais (início e fim da linha) — nunca pixels. */
  points: number[];
  /** Ponto de controle da curva de Bezier quadrática, em JARDAS reais.
   * Opcional: assignments salvos antes deste recurso não têm essa
   * propriedade, e o renderizador cai de volta no ponto médio geométrico
   * (matematicamente idêntico a uma linha reta). */
  controlPoint?: [number, number];
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
  resetFormations: () => void;
  drawingMode: DrawingMode;
  setDrawingMode: (mode: DrawingMode) => void;
  assignments: Assignment[];
  addAssignment: (assignment: Assignment) => void;
  updateAssignmentPoints: (id: string, points: number[]) => void;
  updateControlPoint: (id: string, cx: number, cy: number) => void;
  removeAssignment: (playerId: string) => void;
  savedPlays: Play[];
  saveCurrentPlay: (name: string, category: Play['category']) => void;
  loadPlay: (id: string) => void;
  deletePlay: (id: string) => void;
  /** Nome da jogada atualmente carregada/salva — null se o campo foi
   * resetado ou editado sem corresponder a nenhuma jogada salva. Usado
   * para nomear o arquivo na exportação PNG. */
  activePlayName: string | null;
  /** True enquanto o PNG está sendo capturado — usado para esconder UI de
   * edição (ex.: handles de curva) do Stage antes do toDataURL. */
  isExporting: boolean;
  setIsExporting: (value: boolean) => void;
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
      // que ela nunca se descole do jogador. O ponto final (resto do array)
      // não é tocado aqui.
      assignments: state.assignments.map((assignment) =>
        assignment.playerId === id
          ? { ...assignment, points: [x, y, ...assignment.points.slice(2)] }
          : assignment,
      ),
    })),
  resetFormations: () =>
    set({ players: createDefaultFormation(), assignments: [], activePlayName: null }),
  drawingMode: 'move',
  setDrawingMode: (mode) => set({ drawingMode: mode }),
  assignments: [],
  // No máximo um assignment por jogador: qualquer assignment pré-existente
  // do mesmo playerId é descartado antes de inserir o novo.
  addAssignment: (assignment) =>
    set((state) => ({
      assignments: [
        ...state.assignments.filter((a) => a.playerId !== assignment.playerId),
        assignment,
      ],
    })),
  updateAssignmentPoints: (id, points) =>
    set((state) => ({
      assignments: state.assignments.map((a) => (a.id === id ? { ...a, points } : a)),
    })),
  updateControlPoint: (id, cx, cy) =>
    set((state) => ({
      assignments: state.assignments.map((a) =>
        a.id === id ? { ...a, controlPoint: [cx, cy] } : a,
      ),
    })),
  removeAssignment: (playerId) =>
    set((state) => ({
      assignments: state.assignments.filter((a) => a.playerId !== playerId),
    })),
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
