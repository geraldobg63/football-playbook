import { useFieldStore, type DrawingMode } from '../../store/useFieldStore';
import type { FieldRule } from '../../utils/constants';
import { exportFieldToPng } from './exportToPng';

const FIELD_RULES: FieldRule[] = ['NFL', 'NCAA', 'HIGHSCHOOL'];

const FIELD_RULE_LABELS: Record<FieldRule, string> = {
  NFL: 'NFL',
  NCAA: 'NCAA',
  HIGHSCHOOL: 'High School',
};

const DRAWING_MODES: DrawingMode[] = ['move', 'route', 'block', 'edit-curve'];

const DRAWING_MODE_LABELS: Record<DrawingMode, string> = {
  move: 'Arrastar Jogadores',
  route: 'Desenhar Rota (Passe)',
  block: 'Desenhar Bloqueio',
  'edit-curve': 'Editar Curva',
};

/**
 * Painel flutuante sobre o Canvas: regra de campo ativa, ferramenta de
 * desenho (arrastar/rota/bloqueio) e reinício da formação. Puramente
 * controlado pelo Zustand — não guarda estado próprio.
 */
export function FieldControls() {
  const fieldRule = useFieldStore((state) => state.fieldRule);
  const setFieldRule = useFieldStore((state) => state.setFieldRule);
  const drawingMode = useFieldStore((state) => state.drawingMode);
  const setDrawingMode = useFieldStore((state) => state.setDrawingMode);
  const resetFormations = useFieldStore((state) => state.resetFormations);
  const isExporting = useFieldStore((state) => state.isExporting);

  return (
    <div className="absolute top-4 left-4 z-50 flex flex-col items-start gap-2 rounded-lg bg-slate-900/80 p-2 shadow-lg backdrop-blur">
      <div className="flex items-center gap-3">
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
          onClick={() => resetFormations()}
          className="rounded bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-amber-500"
        >
          Reiniciar Formação
        </button>

        <button
          type="button"
          onClick={() => exportFieldToPng()}
          disabled={isExporting}
          className="flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          <DownloadIcon />
          {isExporting ? 'Exportando…' : 'Exportar PNG'}
        </button>
      </div>

      <div role="radiogroup" aria-label="Ferramenta de desenho" className="flex gap-2">
        {DRAWING_MODES.map((mode) => (
          <button
            key={mode}
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
        ))}
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
