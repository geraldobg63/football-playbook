import { useEffect, useState } from 'react';
import { useFieldStore, type DrawingMode, type GameMode } from '../../store/useFieldStore';
import type { FieldRule } from '../../utils/constants';
import { OFFENSIVE_FORMATIONS, DEFENSIVE_FORMATIONS } from '../../utils/formations';
import { exportFieldToPng } from './exportToPng';

const FIELD_RULES: FieldRule[] = ['NFL', 'NCAA', 'HIGHSCHOOL'];

const FIELD_RULE_LABELS: Record<FieldRule, string> = {
  NFL: 'NFL',
  NCAA: 'NCAA',
  HIGHSCHOOL: 'High School',
};

// Servidos direto de /public pelo Vite — sem import, o caminho é resolvido
// a partir da raiz do site em runtime (funciona igual em dev e no build).
const FIELD_RULE_LOGOS: Record<FieldRule, string> = {
  NFL: '/NFL.webp',
  NCAA: '/NCAA.webp',
  HIGHSCHOOL: '/NFHS.png',
};

const DRAWING_MODES: DrawingMode[] = ['move', 'route', 'block', 'motion', 'zone', 'erase'];

const DRAWING_MODE_LABELS: Record<DrawingMode, string> = {
  move: 'Arrastar Jogadores',
  route: 'Desenhar Rota (Passe)',
  block: 'Desenhar Bloqueio',
  motion: 'Desenhar Motion',
  zone: 'Desenhar Zona (Cobertura)',
  erase: 'Borracha',
};

// Todo modo de desenho ganha tooltip agora — mesmo os que pareciam
// autoexplicativos pelo rótulo do botão, já que "clicar e arrastar" vs.
// "clicar/quebrar/duplo-clique" não é óbvio só pelo nome.
const DRAWING_MODE_TOOLTIPS: Partial<Record<DrawingMode, string>> = {
  move: 'Clique e arraste o jogador até a posição desejada',
  route: 'Clique para quebrar, Duplo clique para finalizar',
  block: 'Clique para quebrar, Duplo clique para finalizar',
  motion: 'Movimento pré-snap (Tracejado)',
  zone: 'Criar Cobertura (Clique no campo)',
  erase: 'Apagar Vetor (Clique na linha)',
};

// Mesmo rótulo do toggle no header (App.tsx) — duplicado de propósito, mesmo
// padrão de FIELD_RULE_LABELS acima. Só exibe a modalidade ativa por
// enquanto, sem mudar nenhum comportamento das ferramentas ainda.
const GAME_MODE_LABELS: Record<GameMode, string> = {
  tackle: 'Tackle 11x11',
  flag5x5: 'Flag 5x5',
};

const OFFENSIVE_FORMATION_NAMES = Object.keys(OFFENSIVE_FORMATIONS);
const DEFENSIVE_FORMATION_NAMES = Object.keys(DEFENSIVE_FORMATIONS);

// Flag 5x5 ainda não tem dados reais de formação (posições de jogador) em
// OFFENSIVE_FORMATIONS/DEFENSIVE_FORMATIONS — só os NOMES aparecem no menu
// nesta etapa. setOffensiveFormation/setDefensiveFormation (useFieldStore)
// fazem lookup por nome nesses dicionários Tackle-only e não fazem nada se
// não encontrarem (`formation ? applyFormation(...) : state`), então
// selecionar um desses nomes é seguro: não move nenhum jogador, não toca no
// Konva. Preparação estrutural, igual ao próprio gameMode (ver comentário
// em useFieldStore.ts).
const FLAG_OFFENSIVE_FORMATION_NAMES = ['Spread', 'Trips', 'Twins'];
const FLAG_DEFENSIVE_FORMATION_NAMES = ['Man Free', 'Zone 2-3', 'Zone 3-2'];

// Estilo compartilhado por todo botão clicável do app: anel de foco e
// "afundar" no clique. `transition-all` (em vez de só transition-colors)
// porque agora também anima a escala do active:scale.
const INTERACTIVE_BUTTON_CLASSES =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lobos-gold-400 active:scale-[0.97] transition-all';

interface FieldControlsProps {
  /** Modo Foco (App.tsx): false retrai a barra pra w-0 em telas md+. Junto
   * com a largura, `overflow-x-visible` (necessário pro tooltip escapar os
   * limites da barra — ver comentário no botão abaixo) também vira
   * condicional: com a barra fechada não há tooltip visível pra escapar
   * mesmo, então cai pra overflow-hidden igual às outras zonas colapsadas. */
  isOpen: boolean;
}

/**
 * Barra lateral (direita em telas médias+, empilhada abaixo do campo em
 * telas pequenas): regra de campo ativa, formação de ataque/defesa
 * (personnel groupings), ferramenta de desenho e exportação PNG. Puramente
 * controlado pelo Zustand — o único estado local é qual formação está
 * selecionada em cada dropdown, só para exibição.
 */
export function FieldControls({ isOpen }: FieldControlsProps) {
  const gameMode = useFieldStore((state) => state.gameMode);
  const fieldRule = useFieldStore((state) => state.fieldRule);
  const setFieldRule = useFieldStore((state) => state.setFieldRule);
  const drawingMode = useFieldStore((state) => state.drawingMode);
  const setDrawingMode = useFieldStore((state) => state.setDrawingMode);
  const setOffensiveFormation = useFieldStore((state) => state.setOffensiveFormation);
  const setDefensiveFormation = useFieldStore((state) => state.setDefensiveFormation);
  const clearAllAssignments = useFieldStore((state) => state.clearAllAssignments);
  const isExporting = useFieldStore((state) => state.isExporting);

  const offensiveFormationNames =
    gameMode === 'flag5x5' ? FLAG_OFFENSIVE_FORMATION_NAMES : OFFENSIVE_FORMATION_NAMES;
  const defensiveFormationNames =
    gameMode === 'flag5x5' ? FLAG_DEFENSIVE_FORMATION_NAMES : DEFENSIVE_FORMATION_NAMES;

  const [offenseFormation, setOffenseFormation] = useState(offensiveFormationNames[0]);
  const [defenseFormation, setDefenseFormation] = useState(defensiveFormationNames[0]);

  // Ao trocar de modalidade, a lista de opções muda inteira — sem isso, o
  // <select> ficaria mostrando um valor selecionado (ex.: "Shotgun") que não
  // existe mais nas options de Flag 5x5. Só realinha o VALOR EXIBIDO nos
  // dropdowns: não chama setOffensiveFormation/setDefensiveFormation, então
  // não move nenhum jogador nem toca no Konva ao alternar o toggle.
  useEffect(() => {
    setOffenseFormation(offensiveFormationNames[0]);
    setDefenseFormation(defensiveFormationNames[0]);
  }, [offensiveFormationNames, defensiveFormationNames]);

  const handleOffenseChange = (name: string) => {
    setOffenseFormation(name);
    setOffensiveFormation(name);
  };

  const handleDefenseChange = (name: string) => {
    setDefenseFormation(name);
    setDefensiveFormation(name);
  };

  return (
    <div
      className={`flex w-full shrink-0 flex-col items-start gap-3 overflow-y-auto border-t border-white/5 bg-lobos-navy-900 p-3 shadow-lg transition-all duration-300 md:h-screen md:border-t-0 ${
        isOpen
          ? 'overflow-x-visible md:w-72 md:border-l'
          : 'overflow-x-hidden md:w-0 md:overflow-hidden md:border-l-0 md:p-0'
      }`}
    >
      {/* Badge de modalidade ativa — só informativo nesta etapa (ver
          GameMode em useFieldStore.ts). `justify-end` porque esta barra não
          tem um título/h2 próprio pra alinhar ao lado (ao contrário da
          PlaybookSidebar), então o badge fica sozinho no topo. */}
      <div className="flex w-full justify-end">
        <span className="rounded-full bg-lobos-navy-800 px-2.5 py-0.5 text-xs font-semibold text-lobos-gold-400 ring-1 ring-white/10">
          {GAME_MODE_LABELS[gameMode]}
        </span>
      </div>

      {/* Seletor de liga por logo — vive fora do padrão ToolbarSection de
          propósito: os logos já são autoexplicativos (liga reconhecível
          visualmente), então o card não carrega um micro-label. */}
      <div className="mb-4 flex flex-row justify-center gap-2 rounded-xl bg-lobos-navy-900 p-2">
        {FIELD_RULES.map((rule) => (
          <button
            key={rule}
            type="button"
            onClick={() => setFieldRule(rule)}
            aria-pressed={fieldRule === rule}
            aria-label={FIELD_RULE_LABELS[rule]}
            className={INTERACTIVE_BUTTON_CLASSES}
          >
            <img
              src={FIELD_RULE_LOGOS[rule]}
              alt={FIELD_RULE_LABELS[rule]}
              className={`h-12 w-12 cursor-pointer rounded-lg object-contain p-1.5 transition-all ${
                fieldRule === rule
                  ? 'border-2 border-lobos-gold-500 bg-lobos-navy-800'
                  : 'opacity-60 hover:bg-lobos-navy-800/50 hover:opacity-100'
              }`}
            />
          </button>
        ))}
      </div>

      <ToolbarSection label="Ações">
        <button
          type="button"
          onClick={() => exportFieldToPng()}
          disabled={isExporting}
          className={`flex items-center gap-1.5 rounded bg-lobos-gold-500 px-3 py-1.5 text-sm font-semibold text-lobos-navy-950 hover:bg-lobos-gold-400 disabled:cursor-not-allowed disabled:bg-lobos-navy-800 disabled:text-slate-500 ${INTERACTIVE_BUTTON_CLASSES}`}
        >
          <DownloadIcon />
          {isExporting ? 'Exportando…' : 'Exportar PNG'}
        </button>

        <button
          type="button"
          onClick={() => clearAllAssignments()}
          className={`rounded bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-500 ${INTERACTIVE_BUTTON_CLASSES}`}
        >
          Limpar Desenhos
        </button>
      </ToolbarSection>

      <ToolbarSection label="Formação">
        <label className="flex items-center gap-1.5 text-sm font-semibold text-blue-300">
          Ataque
          <select
            value={offenseFormation}
            onChange={(e) => handleOffenseChange(e.target.value)}
            className="rounded border border-white/10 bg-lobos-navy-800 px-2 py-1.5 text-sm font-semibold text-white focus:ring-2 focus:ring-lobos-gold-400 focus:outline-none"
          >
            {offensiveFormationNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-sm font-semibold text-red-300">
          Defesa
          <select
            value={defenseFormation}
            onChange={(e) => handleDefenseChange(e.target.value)}
            className="rounded border border-white/10 bg-lobos-navy-800 px-2 py-1.5 text-sm font-semibold text-white focus:ring-2 focus:ring-lobos-gold-400 focus:outline-none"
          >
            {defensiveFormationNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </ToolbarSection>

      <ToolbarSection label="Ferramentas">
        <div role="radiogroup" aria-label="Ferramenta de desenho" className="flex flex-wrap gap-2">
          {DRAWING_MODES.map((mode) => {
            const tooltip = DRAWING_MODE_TOOLTIPS[mode];
            return (
              <div key={mode} className="group relative">
                <button
                  type="button"
                  role="radio"
                  aria-checked={drawingMode === mode}
                  onClick={() => setDrawingMode(mode)}
                  className={`rounded px-3 py-1.5 text-sm font-semibold ${INTERACTIVE_BUTTON_CLASSES} ${
                    drawingMode === mode
                      ? 'bg-lobos-gold-500 text-lobos-navy-950'
                      : 'bg-lobos-navy-800 text-slate-300 hover:bg-lobos-navy-700'
                  }`}
                >
                  {DRAWING_MODE_LABELS[mode]}
                </button>
                {tooltip && (
                  // pointer-events-none é obrigatório aqui: o tooltip flutua
                  // para a ESQUERDA, sobre a área do Canvas. Sem isso, ele
                  // "rouba" os cliques que o usuário dá no campo para
                  // desenhar rota/bloqueio/motion assim que o cursor passa
                  // por cima dele a caminho do Stage — foi exatamente essa
                  // regressão que quebrou o desenho numa rodada anterior.
                  // opacity (em vez de hidden/block) dá uma transição suave
                  // de entrada/saída em vez do "flash" instantâneo de antes.
                  <div className="pointer-events-none absolute top-0 right-full z-50 mr-3 w-48 rounded bg-lobos-navy-950 p-3 text-sm text-white break-words whitespace-normal opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
                    {tooltip}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ToolbarSection>
    </div>
  );
}

/** Agrupa um bloco da toolbar sob um micro-label — quebra a antiga "parede
 * de botões" indiferenciada em seções escaneáveis. `first:` remove a borda/
 * padding superior da primeira seção, que não precisa de separador. */
function ToolbarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-2 border-t border-white/5 pt-3 first:border-t-0 first:pt-0">
      <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function DownloadIcon() {
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
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}
