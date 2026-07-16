import { Arrow, Ellipse, Layer, Line } from 'react-konva';
import { PIXELS_PER_YARD } from '../../utils/constants';
import type { Assignment, Player } from '../../store/useFieldStore';

// Cor por time de origem — quem desenhou a linha é dono do vetor.
const OFFENSE_COLOR = '#eab308'; // amarelo
const DEFENSE_COLOR = '#ef4444'; // vermelho
// Zona é sempre um conceito defensivo (área de cobertura), sem dono
// individual — por isso não segue a lógica de cor por time.
const ZONE_COLOR = '#ef4444';
const ZONE_FILL_OPACITY = 0.3;

const STROKE_WIDTH_PX = 3;
const ARROW_POINTER_LENGTH_PX = 10;
const ARROW_POINTER_WIDTH_PX = 10;
const MOTION_DASH_PX: [number, number] = [10, 5];

// Comprimento total da barra perpendicular ("T") na ponta de um bloqueio,
// em jardas — metade para cada lado do último ponto da polilinha.
const BLOCK_T_BAR_LENGTH_YARDS = 2;

// "8x8 jardas" = diâmetro da zona; o raio (usado pelo Konva Ellipse) é metade.
const ZONE_DIAMETER_YARDS = 8;

interface AssignmentsLayerProps {
  assignments: Assignment[];
  players: Player[];
  /** Id do assignment sendo desenhado agora (ver Field.tsx) — renderizado
   * com opacidade reduzida até o duplo-clique confirmar o desenho. */
  activeDrawingId: string | null;
  /** True no modo 'erase': habilita hit-testing nas formas (normalmente
   * `listening={false}`, puramente decorativas) para que clicar direto
   * numa linha/zona também funcione como colisão para a borracha. */
  isEraseMode: boolean;
}

/**
 * Camada vetorial para rotas, motions, bloqueios e zonas. Toda a interação
 * de desenho acontece no Stage (Field.tsx) e é gravada diretamente na
 * store — esta camada normalmente só renderiza o resultado
 * (`listening={false}`), exceto no modo 'erase', quando as formas passam a
 * aceitar clique para permitir apagar clicando direto na linha.
 */
export function AssignmentsLayer({
  assignments,
  players,
  activeDrawingId,
  isEraseMode,
}: AssignmentsLayerProps) {
  return (
    <Layer listening={isEraseMode}>
      {assignments.map((assignment) => (
        <AssignmentShape
          key={assignment.id}
          assignment={assignment}
          color={resolveAssignmentColor(assignment, players)}
          opacity={assignment.id === activeDrawingId ? 0.65 : 1}
        />
      ))}
    </Layer>
  );
}

/** Cor do vetor a partir do time do jogador dono (`assignment.playerId`).
 * Zonas não têm dono e são sempre vermelhas (ver ZONE_COLOR). */
function resolveAssignmentColor(assignment: Assignment, players: Player[]): string {
  const owner = players.find((player) => player.id === assignment.playerId);
  return owner?.team === 'defense' ? DEFENSE_COLOR : OFFENSE_COLOR;
}

function AssignmentShape({
  assignment,
  color,
  opacity,
}: {
  assignment: Assignment;
  color: string;
  opacity: number;
}) {
  // Polilinha em JARDAS -> pixels só aqui, na borda de renderização.
  const pointsPx = assignment.points.map((yards) => yards * PIXELS_PER_YARD);
  // Identificador Konva usado pela borracha (ver Field.tsx): jogadores
  // usam o próprio playerId; zonas (sem dono) usam o id do assignment.
  const konvaId = assignment.playerId ?? assignment.id;

  switch (assignment.type) {
    case 'route':
      return (
        <Arrow
          id={konvaId}
          points={pointsPx}
          stroke={color}
          fill={color}
          strokeWidth={STROKE_WIDTH_PX}
          tension={0}
          pointerLength={ARROW_POINTER_LENGTH_PX}
          pointerWidth={ARROW_POINTER_WIDTH_PX}
          opacity={opacity}
        />
      );
    case 'motion':
      return (
        <Arrow
          id={konvaId}
          points={pointsPx}
          stroke={color}
          fill={color}
          strokeWidth={STROKE_WIDTH_PX}
          tension={0}
          dash={MOTION_DASH_PX}
          pointerLength={ARROW_POINTER_LENGTH_PX}
          pointerWidth={ARROW_POINTER_WIDTH_PX}
          opacity={opacity}
        />
      );
    case 'block':
      return <BlockPolyline pointsPx={pointsPx} color={color} opacity={opacity} konvaId={konvaId} />;
    case 'zone':
      return <ZoneEllipse pointsPx={pointsPx} opacity={opacity} konvaId={konvaId} />;
    default:
      return null;
  }
}

function BlockPolyline({
  pointsPx,
  color,
  opacity,
  konvaId,
}: {
  pointsPx: number[];
  color: string;
  opacity: number;
  konvaId: string;
}) {
  const n = pointsPx.length;
  const endX = pointsPx[n - 2];
  const endY = pointsPx[n - 1];
  // Só há um ponto (polilinha degenerada): sem segmento anterior, cai no
  // próprio ponto final — atan2(0,0) é 0 por definição, não lança erro.
  const prevX = n >= 4 ? pointsPx[n - 4] : endX;
  const prevY = n >= 4 ? pointsPx[n - 3] : endY;

  // A tangente na ponta do bloqueio é a direção do ÚLTIMO segmento da
  // polilinha (penúltimo ponto -> último ponto), não da linha inteira —
  // assim a barra do "T" acompanha corretamente qualquer quebra de rota.
  const angle = Math.atan2(endY - prevY, endX - prevX);
  const halfBarPx = (BLOCK_T_BAR_LENGTH_YARDS * PIXELS_PER_YARD) / 2;
  const perpAngle1 = angle + Math.PI / 2;
  const perpAngle2 = angle - Math.PI / 2;
  const tStart = [endX + halfBarPx * Math.cos(perpAngle1), endY + halfBarPx * Math.sin(perpAngle1)];
  const tEnd = [endX + halfBarPx * Math.cos(perpAngle2), endY + halfBarPx * Math.sin(perpAngle2)];

  return (
    <>
      <Line id={konvaId} points={pointsPx} stroke={color} strokeWidth={STROKE_WIDTH_PX} opacity={opacity} />
      <Line
        id={konvaId}
        points={[...tStart, ...tEnd]}
        stroke={color}
        strokeWidth={STROKE_WIDTH_PX}
        opacity={opacity}
      />
    </>
  );
}

function ZoneEllipse({
  pointsPx,
  opacity,
  konvaId,
}: {
  pointsPx: number[];
  opacity: number;
  konvaId: string;
}) {
  const [cx, cy] = pointsPx;
  const radiusPx = (ZONE_DIAMETER_YARDS / 2) * PIXELS_PER_YARD;
  return (
    <Ellipse
      id={konvaId}
      x={cx}
      y={cy}
      radiusX={radiusPx}
      radiusY={radiusPx}
      fill={ZONE_COLOR}
      fillOpacity={ZONE_FILL_OPACITY}
      stroke={ZONE_COLOR}
      strokeWidth={STROKE_WIDTH_PX}
      opacity={opacity}
    />
  );
}
