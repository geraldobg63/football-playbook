import { useState } from 'react';
import { useFieldStore, type DrawingMode } from '../../store/useFieldStore';
import type { FieldRule } from '../../utils/constants';
import { OFFENSIVE_FORMATIONS, DEFENSIVE_FORMATIONS } from '../../utils/formations';
import { exportFieldToPng } from './exportToPng';

const FIELD_RULES: FieldRule[] = ['NFL', 'NCAA', 'HIGHSCHOOL'];

const FIELD_RULE_LABELS: Record<FieldRule, string> = {
  NFL: 'NFL',
  NCAA: 'NCAA',
  HIGHSCHOOL: 'High School',
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

// Só os modos com interações não-óbvias (multi-clique, atalhos) ganham
// tooltip — "Arrastar Jogadores" e "Desenhar Bloqueio" já se explicam pelo
// próprio rótulo do botão.
const DRAWING_MODE_TOOLTIPS: Partial<Record<DrawingMode, string>> = {
  route: 'Clique para quebrar, Duplo clique para finalizar',
  motion: 'Movimento pré-snap (Tracejado)',
  zone: 'Criar Cobertura (Clique no campo)',
  erase: 'Apagar Vetor (Clique na linha)',
};

const OFFENSIVE_FORMATION_NAMES = Object.keys(OFFENSIVE_FORMATIONS);
const DEFENSIVE_FORMATION_NAMES = Object.keys(DEFENSIVE_FORMATIONS);

/**
 * Barra lateral (direita em telas médias+, empilhada abaixo do campo em
 * telas pequenas): regra de campo ativa, formação de ataque/defesa
 * (personnel groupings), ferramenta de desenho e exportação PNG. Puramente
 * controlado pelo Zustand — o único estado local é qual formação está
 * selecionada em cada dropdown, só para exibição.
 */
export function FieldControls() {
  const fieldRule = useFieldStore((state) => state.fieldRule);
  const setFieldRule = useFieldStore((state) => state.setFieldRule);
  const drawingMode = useFieldStore((state) => state.drawingMode);
  const setDrawingMode = useFieldStore((state) => state.setDrawingMode);
  const setOffensiveFormation = useFieldStore((state) => state.setOffensiveFormation);
  const setDefensiveFormation = useFieldStore((state) => state.setDefensiveFormation);
  const clearAllAssignments = useFieldStore((state) => state.clearAllAssignments);
  const isExporting = useFieldStore((state) => state.isExporting);

  const [offenseFormation, setOffenseFormation] = useState(OFFENSIVE_FORMATION_NAMES[0]);
  const [defenseFormation, setDefenseFormation] = useState(DEFENSIVE_FORMATION_NAMES[0]);

  const handleOffenseChange = (name: string) => {
    setOffenseFormation(name);
    setOffensiveFormation(name);
  };

  const handleDefenseChange = (name: string) => {
    setDefenseFormation(name);
    setDefensiveFormation(name);
  };

  return (
    <div className="flex w-full shrink-0 flex-col items-start gap-3 overflow-x-visible overflow-y-auto border-t border-slate-800 bg-slate-900 p-3 shadow-lg md:h-screen md:w-72 md:border-t-0 md:border-l">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {FIELD_RULES.map((rule) => (
            <button
              key={rule}
              type="button"
              onClick={() => setFieldRule(rule)}
              aria-pressed={fieldRule === rule}
              className={`rounded px-3 py-1.5 text-sm font-semibold transition-colors ${
                fieldRule === rule
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
              }`}
            >
              {FIELD_RULE_LABELS[rule]}
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-slate-600" />

        <button
          type="button"
          onClick={() => exportFieldToPng()}
          disabled={isExporting}
          className="flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          <DownloadIcon />
          {isExporting ? 'Exportando…' : 'Exportar PNG'}
        </button>

        <button
          type="button"
          onClick={() => clearAllAssignments()}
          className="rounded bg-red-700 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-red-600"
        >
          Limpar Desenhos
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-sm font-semibold text-blue-300">
          Ataque
          <select
            value={offenseFormation}
            onChange={(e) => handleOffenseChange(e.target.value)}
            className="rounded border border-blue-800 bg-slate-800 px-2 py-1.5 text-sm font-semibold text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            {OFFENSIVE_FORMATION_NAMES.map((name) => (
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
            className="rounded border border-red-800 bg-slate-800 px-2 py-1.5 text-sm font-semibold text-white focus:ring-2 focus:ring-red-500 focus:outline-none"
          >
            {DEFENSIVE_FORMATION_NAMES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>

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
                className={`rounded px-3 py-1.5 text-sm font-semibold transition-colors ${
                  drawingMode === mode
                    ? 'bg-sky-500 text-white'
                    : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
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
                // regressão que quebrou o desenho. O pequeno efeito
                // colateral (o tooltip pode sumir se o cursor parar
                // *exatamente* sobre o próprio texto dele, já que o hover
                // "vaza" para o que está atrás) é um trade-off aceitável
                // frente a bloquear o desenho por completo. `top-0` segue
                // valendo para alinhar verticalmente com o botão.
                <div className="pointer-events-none absolute top-0 right-full z-50 mr-3 hidden w-48 rounded bg-slate-950 p-3 text-sm text-white break-words whitespace-normal shadow-lg group-hover:block">
                  {tooltip}
                </div>
              )}
            </div>
          );
        })}
      </div>
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
