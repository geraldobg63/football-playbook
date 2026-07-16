import type Konva from 'konva';
import { Circle, Layer, Shape } from 'react-konva';
import { PIXELS_PER_YARD } from '../../utils/constants';
import { clamp } from '../../utils/math';
import { useFieldStore, type Assignment, type DrawingMode } from '../../store/useFieldStore';
import { FIELD_LENGTH_YARDS, FIELD_WIDTH_YARDS } from './constants';

const ROUTE_COLOR = '#facc15'; // amarelo — alto contraste com o gramado
const BLOCK_COLOR = '#f5f5f0'; // branco — mesma família das marcações do campo
const HANDLE_FILL = '#38bdf8'; // azul claro — bem distinto de rotas/bloqueios
const HANDLE_STROKE = '#0c4a6e';
const STROKE_WIDTH_PX = 3;

// Comprimento total da barra perpendicular ("T") na ponta de um bloqueio,
// em jardas — metade para cada lado do ponto final da curva.
const BLOCK_T_BAR_LENGTH_YARDS = 2;

// Geometria da cabeça da seta (rotas), em pixels/radianos.
const ARROW_HEAD_LENGTH_PX = 12;
const ARROW_HEAD_SPREAD_RAD = Math.PI / 7; // ≈ 25.7° de abertura por "asa"

const HANDLE_RADIUS_PX = 6;

interface AssignmentsLayerProps {
  assignments: Assignment[];
  /** Linha ainda sendo desenhada (arraste em andamento) — mesmo desenho,
   * com opacidade reduzida para indicar que ainda não foi confirmada. */
  previewAssignment?: Assignment | null;
  drawingMode: DrawingMode;
  /** True durante a exportação PNG (exportToPng.ts) — força os handles de
   * controle a sumirem mesmo em 'move'/'edit-curve', para não aparecerem
   * no arquivo exportado. */
  isExporting: boolean;
}

/**
 * Camada vetorial para rotas de passe e esquemas de bloqueio, desenhados
 * como curvas de Bezier quadráticas (P0 = jogador, P1 = controlPoint,
 * P2 = ponta). Os handles de controle só ficam interativos nos modos
 * 'move'/'edit-curve' — por isso o Layer precisa de `listening` habilitado
 * (diferente da versão puramente decorativa anterior).
 */
export function AssignmentsLayer({
  assignments,
  previewAssignment,
  drawingMode,
  isExporting,
}: AssignmentsLayerProps) {
  const showHandles = (drawingMode === 'move' || drawingMode === 'edit-curve') && !isExporting;

  return (
    <Layer>
      {assignments.map((assignment) => (
        <AssignmentCurve key={assignment.id} assignment={assignment} opacity={1} />
      ))}
      {previewAssignment && <AssignmentCurve assignment={previewAssignment} opacity={0.65} />}
      {showHandles &&
        assignments.map((assignment) => (
          <ControlPointHandle key={`handle-${assignment.id}`} assignment={assignment} />
        ))}
    </Layer>
  );
}

/** Ponto de controle em jardas: o salvo na store, ou o ponto médio
 * geométrico como fallback (assignments antigas / preview em construção). */
function resolveControlPointYards(assignment: Assignment): [number, number] {
  if (assignment.controlPoint) return assignment.controlPoint;
  const [x0, y0, x1, y1] = assignment.points;
  return [(x0 + x1) / 2, (y0 + y1) / 2];
}

function AssignmentCurve({ assignment, opacity }: { assignment: Assignment; opacity: number }) {
  const [x0, y0, x1, y1] = assignment.points;
  const [cx, cy] = resolveControlPointYards(assignment);

  // Conversão jarda -> pixel só aqui, na borda de renderização.
  const startX = x0 * PIXELS_PER_YARD;
  const startY = y0 * PIXELS_PER_YARD;
  const endX = x1 * PIXELS_PER_YARD;
  const endY = y1 * PIXELS_PER_YARD;
  const controlX = cx * PIXELS_PER_YARD;
  const controlY = cy * PIXELS_PER_YARD;

  // Tangente da curva no ponto final: para uma Bezier quadrática P0-P1-P2,
  // a direção no fim é dada pelo vetor P1 -> P2 (controle -> fim).
  const tangentAngle = Math.atan2(endY - controlY, endX - controlX);

  const color = assignment.type === 'route' ? ROUTE_COLOR : BLOCK_COLOR;

  return (
    <Shape
      listening={false}
      opacity={opacity}
      sceneFunc={(context) => {
        context.strokeStyle = color;
        context.fillStyle = color;
        context.lineWidth = STROKE_WIDTH_PX;

        context.beginPath();
        context.moveTo(startX, startY);
        context.quadraticCurveTo(controlX, controlY, endX, endY);
        context.stroke();

        if (assignment.type === 'route') {
          drawArrowHead(context, endX, endY, tangentAngle);
        } else {
          drawBlockTBar(context, endX, endY, tangentAngle);
        }
      }}
    />
  );
}

function drawArrowHead(context: Konva.Context, tipX: number, tipY: number, angle: number) {
  const wing1Angle = angle - ARROW_HEAD_SPREAD_RAD;
  const wing2Angle = angle + ARROW_HEAD_SPREAD_RAD;

  context.beginPath();
  context.moveTo(tipX, tipY);
  context.lineTo(
    tipX - ARROW_HEAD_LENGTH_PX * Math.cos(wing1Angle),
    tipY - ARROW_HEAD_LENGTH_PX * Math.sin(wing1Angle),
  );
  context.lineTo(
    tipX - ARROW_HEAD_LENGTH_PX * Math.cos(wing2Angle),
    tipY - ARROW_HEAD_LENGTH_PX * Math.sin(wing2Angle),
  );
  context.closePath();
  context.fill();
}

function drawBlockTBar(context: Konva.Context, tipX: number, tipY: number, angle: number) {
  const halfBarPx = (BLOCK_T_BAR_LENGTH_YARDS * PIXELS_PER_YARD) / 2;
  const perpAngle1 = angle + Math.PI / 2;
  const perpAngle2 = angle - Math.PI / 2;

  context.beginPath();
  context.moveTo(tipX + halfBarPx * Math.cos(perpAngle1), tipY + halfBarPx * Math.sin(perpAngle1));
  context.lineTo(tipX + halfBarPx * Math.cos(perpAngle2), tipY + halfBarPx * Math.sin(perpAngle2));
  context.stroke();
}

function ControlPointHandle({ assignment }: { assignment: Assignment }) {
  const updateControlPoint = useFieldStore((state) => state.updateControlPoint);
  const [cx, cy] = resolveControlPointYards(assignment);

  const dragBoundFunc = (pos: { x: number; y: number }) => ({
    x: clamp(pos.x, 0, FIELD_LENGTH_YARDS * PIXELS_PER_YARD),
    y: clamp(pos.y, 0, FIELD_WIDTH_YARDS * PIXELS_PER_YARD),
  });

  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    const xYards = clamp(e.target.x() / PIXELS_PER_YARD, 0, FIELD_LENGTH_YARDS);
    const yYards = clamp(e.target.y() / PIXELS_PER_YARD, 0, FIELD_WIDTH_YARDS);
    updateControlPoint(assignment.id, xYards, yYards);
  };

  return (
    <Circle
      x={cx * PIXELS_PER_YARD}
      y={cy * PIXELS_PER_YARD}
      radius={HANDLE_RADIUS_PX}
      fill={HANDLE_FILL}
      stroke={HANDLE_STROKE}
      strokeWidth={1.5}
      draggable
      dragBoundFunc={dragBoundFunc}
      onDragMove={handleDragMove}
    />
  );
}
