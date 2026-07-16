import { useEffect, useRef, useState } from 'react';
import type Konva from 'konva';
import { Stage, Layer, Rect, Line, Text } from 'react-konva';
import { PIXELS_PER_YARD } from '../../utils/constants';
import { clamp } from '../../utils/math';
import { useFieldStore, type Assignment } from '../../store/useFieldStore';
import { PlayerNode } from './PlayerNode';
import { AssignmentsLayer } from './AssignmentsLayer';
import { stageRef as sharedStageRef } from './stageRef';
import {
  FIELD_LENGTH_YARDS,
  FIELD_WIDTH_YARDS,
  ENDZONE_LENGTH_YARDS,
  PLAYING_FIELD_LENGTH_YARDS,
  YARD_LINE_INTERVAL_YARDS,
  YARD_NUMBER_INTERVAL_YARDS,
  YARD_NUMBER_INSET_FROM_SIDELINE_YARDS,
  HASH_MARK_INSET_YARDS_BY_RULE,
  HASH_MARK_INTERVAL_YARDS,
  HASH_MARK_LENGTH_YARDS,
} from './constants';

// Paleta puramente visual — não faz parte da matemática do campo.
const TURF_GREEN = '#1c6b41';
const ENDZONE_GREEN = '#0e4327';
const LINE_WHITE = '#f5f5f0';

interface FieldProps {
  /** Sobrescreve a escala padrão (px por jarda) definida em constants.ts. */
  pixelsPerYard?: number;
}

interface InProgressLine {
  playerId: string;
  type: 'route' | 'block';
  /** [x0, y0, x1, y1] em JARDAS reais — início (jogador) e ponta atual do mouse. */
  points: [number, number, number, number];
}

// Arraste menor que isso (em jardas) é tratado como clique acidental, não
// como intenção de desenhar — evita assignments de comprimento ~zero ao
// simplesmente clicar num jogador em modo 'route'/'block'.
const MIN_ASSIGNMENT_LENGTH_YARDS = 0.5;

/**
 * Renderiza o campo de futebol americano de forma inteiramente vetorial
 * (nenhuma imagem é usada), mais a camada de jogadores por cima. O Layer do
 * campo é `listening={false}` porque o fundo em si nunca é interativo — só
 * a camada de jogadores captura eventos de arraste. Camadas futuras (rotas,
 * ferramentas de desenho) entram como novos Layers/Groups irmãos dentro do
 * mesmo Stage.
 */
export function Field({ pixelsPerYard = PIXELS_PER_YARD }: FieldProps) {
  // Única leitura do Zustand dentro de toda a árvore do campo: os
  // sub-componentes abaixo permanecem "burros", recebendo a matemática já
  // resolvida em jardas/pixels via props, sem conhecer a store.
  const fieldRule = useFieldStore((state) => state.fieldRule);
  const players = useFieldStore((state) => state.players);
  const drawingMode = useFieldStore((state) => state.drawingMode);
  const assignments = useFieldStore((state) => state.assignments);
  const addAssignment = useFieldStore((state) => state.addAssignment);
  const isExporting = useFieldStore((state) => state.isExporting);
  const hashMarkInsetYards = HASH_MARK_INSET_YARDS_BY_RULE[fieldRule];

  // Linha de rota/bloqueio em construção durante o arraste atual — estado
  // puramente de interação (não pertence à store: nenhum outro componente
  // precisa dela até ela virar um Assignment confirmado no mouseUp).
  const [inProgressLine, setInProgressLine] = useState<InProgressLine | null>(null);

  // Captura a instância do Stage para a exportação PNG (exportToPng.ts).
  // O Stage nunca é remontado enquanto Field.tsx estiver vivo, então basta
  // sincronizar uma vez com a referência compartilhada fora da árvore.
  const stageRef = useRef<Konva.Stage>(null);
  useEffect(() => {
    sharedStageRef.current = stageRef.current;
  }, []);

  const yd = (yards: number) => yards * pixelsPerYard;

  // Eixo X = comprimento do campo (120 jd) · Eixo Y = largura (53 1/3 jd).
  const fieldWidthPx = yd(FIELD_LENGTH_YARDS);
  const fieldHeightPx = yd(FIELD_WIDTH_YARDS);
  const endzoneLengthPx = yd(ENDZONE_LENGTH_YARDS);

  // Pixels do ponteiro do mouse -> jardas reais, restringidas aos limites
  // do campo inteiro (0-120 x, 0-53.33 y), usando sempre PIXELS_PER_YARD.
  const pointerToYards = (pointerPx: { x: number; y: number }) => ({
    x: clamp(pointerPx.x / pixelsPerYard, 0, FIELD_LENGTH_YARDS),
    y: clamp(pointerPx.y / pixelsPerYard, 0, FIELD_WIDTH_YARDS),
  });

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Só inicia uma nova linha nos modos de desenho — em 'move' o clique
    // arrasta jogadores, e em 'edit-curve' arrasta handles de controle
    // (ambos tratados por outros nós Konva, não pelo Stage).
    if (drawingMode !== 'route' && drawingMode !== 'block') return;

    const stage = e.target.getStage();
    const pointerPx = stage?.getPointerPosition();
    if (!pointerPx) return;

    // "Colidiu com um PlayerNode": o alvo real do clique (Circle/Text) tem
    // como ancestral o Group do jogador, identificado pelo `id` do Konva.
    const clickedGroup = e.target.findAncestor('Group', true);
    const clickedPlayerId = clickedGroup?.id();
    const player = players.find((candidate) => candidate.id === clickedPlayerId);
    if (!player) return;

    const { x, y } = pointerToYards(pointerPx);
    setInProgressLine({ playerId: player.id, type: drawingMode, points: [player.x, player.y, x, y] });
  };

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!inProgressLine) return;

    const stage = e.target.getStage();
    const pointerPx = stage?.getPointerPosition();
    if (!pointerPx) return;

    const { x, y } = pointerToYards(pointerPx);
    setInProgressLine((current) =>
      current ? { ...current, points: [current.points[0], current.points[1], x, y] } : null,
    );
  };

  const handleStageMouseUp = () => {
    if (!inProgressLine) return;

    const [x0, y0, x1, y1] = inProgressLine.points;
    const dragDistanceYards = Math.hypot(x1 - x0, y1 - y0);
    if (dragDistanceYards > MIN_ASSIGNMENT_LENGTH_YARDS) {
      addAssignment({
        id: `assign-${inProgressLine.playerId}`,
        playerId: inProgressLine.playerId,
        type: inProgressLine.type,
        points: inProgressLine.points,
        // Ponto de controle inicial = ponto médio exato entre início e fim.
        // Uma Bezier quadrática com o controle no meio é matematicamente
        // idêntica a uma linha reta — a curva só aparece quando o usuário
        // arrasta o handle (ver AssignmentsLayer) para "puxar" a linha.
        controlPoint: [(x0 + x1) / 2, (y0 + y1) / 2],
      });
    }
    setInProgressLine(null);
  };

  const previewAssignment: Assignment | null = inProgressLine
    ? {
        id: 'preview',
        playerId: inProgressLine.playerId,
        type: inProgressLine.type,
        points: inProgressLine.points,
      }
    : null;

  return (
    <Stage
      ref={stageRef}
      width={fieldWidthPx}
      height={fieldHeightPx}
      onMouseDown={handleStageMouseDown}
      onMouseMove={handleStageMouseMove}
      onMouseUp={handleStageMouseUp}
    >
      <Layer listening={false}>
        <FieldTurf widthPx={fieldWidthPx} heightPx={fieldHeightPx} />
        <Endzones
          fieldWidthPx={fieldWidthPx}
          fieldHeightPx={fieldHeightPx}
          endzoneLengthPx={endzoneLengthPx}
        />
        <YardLines
          yd={yd}
          fieldHeightPx={fieldHeightPx}
          endzoneLengthPx={endzoneLengthPx}
        />
        <HashMarks
          yd={yd}
          fieldHeightPx={fieldHeightPx}
          endzoneLengthPx={endzoneLengthPx}
          insetYards={hashMarkInsetYards}
        />
        <YardNumbers
          yd={yd}
          fieldHeightPx={fieldHeightPx}
          endzoneLengthPx={endzoneLengthPx}
          pixelsPerYard={pixelsPerYard}
        />
        <FieldBorder widthPx={fieldWidthPx} heightPx={fieldHeightPx} />
      </Layer>
      {/* Camada interativa: separada do fundo estático (listening={false}
          acima) para que só os jogadores capturem eventos de arraste. Só é
          "draggable" no modo 'move' — em 'route'/'block' o clique inicia o
          desenho de uma linha (ver handleStageMouseDown acima). */}
      <Layer>
        {players.map((player) => (
          <PlayerNode key={player.id} player={player} draggable={drawingMode === 'move'} />
        ))}
      </Layer>
      <AssignmentsLayer
        assignments={assignments}
        previewAssignment={previewAssignment}
        drawingMode={drawingMode}
        isExporting={isExporting}
      />
    </Stage>
  );
}

// --- Sub-componentes de desenho ------------------------------------------
// Cada um cuida de uma única camada de marcação. Mantê-los separados torna
// trivial religar/desligar marcações específicas conforme o playbook evolui
// (ex.: esconder hash marks em modo "diagrama simplificado").

// Fundo opaco cobrindo o Stage inteiro — além de ser o gramado visualmente,
// isso garante que a exportação PNG (exportToPng.ts) nunca produza um
// arquivo com fundo transparente, que aparece preto/quebrado dependendo do
// visualizador usado para imprimir.
function FieldTurf({ widthPx, heightPx }: { widthPx: number; heightPx: number }) {
  return <Rect x={0} y={0} width={widthPx} height={heightPx} fill={TURF_GREEN} />;
}

function Endzones({
  fieldWidthPx,
  fieldHeightPx,
  endzoneLengthPx,
}: {
  fieldWidthPx: number;
  fieldHeightPx: number;
  endzoneLengthPx: number;
}) {
  return (
    <>
      <Rect x={0} y={0} width={endzoneLengthPx} height={fieldHeightPx} fill={ENDZONE_GREEN} />
      <Rect
        x={fieldWidthPx - endzoneLengthPx}
        y={0}
        width={endzoneLengthPx}
        height={fieldHeightPx}
        fill={ENDZONE_GREEN}
      />
    </>
  );
}

function YardLines({
  yd,
  fieldHeightPx,
  endzoneLengthPx,
}: {
  yd: (yards: number) => number;
  fieldHeightPx: number;
  endzoneLengthPx: number;
}) {
  const lines = [];
  // Uma linha a cada 5 jardas, da goal line (0) até a goal line oposta (100),
  // incluídas as próprias goal lines.
  for (
    let fieldYard = 0;
    fieldYard <= PLAYING_FIELD_LENGTH_YARDS;
    fieldYard += YARD_LINE_INTERVAL_YARDS
  ) {
    const x = endzoneLengthPx + yd(fieldYard);
    const isGoalLine = fieldYard === 0 || fieldYard === PLAYING_FIELD_LENGTH_YARDS;
    lines.push(
      <Line
        key={`yard-line-${fieldYard}`}
        points={[x, 0, x, fieldHeightPx]}
        stroke={LINE_WHITE}
        strokeWidth={isGoalLine ? 3 : 1.5}
      />,
    );
  }
  return <>{lines}</>;
}

function HashMarks({
  yd,
  fieldHeightPx,
  endzoneLengthPx,
  insetYards,
}: {
  yd: (yards: number) => number;
  fieldHeightPx: number;
  endzoneLengthPx: number;
  /** Afastamento da lateral até a fileira de hash marks, em jardas — varia
   * por regra de campo (ver HASH_MARK_INSET_YARDS_BY_RULE). */
  insetYards: number;
}) {
  const hashLength = yd(HASH_MARK_LENGTH_YARDS);
  const topRowY = yd(insetYards);
  const bottomRowY = fieldHeightPx - yd(insetYards);

  const ticks = [];
  // Uma marca a cada jarda, do 1 ao 99 (as goal lines em 0 e 100 já são
  // linhas cheias e não recebem hash mark).
  for (
    let fieldYard = HASH_MARK_INTERVAL_YARDS;
    fieldYard < PLAYING_FIELD_LENGTH_YARDS;
    fieldYard += HASH_MARK_INTERVAL_YARDS
  ) {
    const x = endzoneLengthPx + yd(fieldYard);
    ticks.push(
      <Line
        key={`hash-top-${fieldYard}`}
        points={[x, topRowY - hashLength / 2, x, topRowY + hashLength / 2]}
        stroke={LINE_WHITE}
        strokeWidth={1.5}
      />,
      <Line
        key={`hash-bottom-${fieldYard}`}
        points={[x, bottomRowY - hashLength / 2, x, bottomRowY + hashLength / 2]}
        stroke={LINE_WHITE}
        strokeWidth={1.5}
      />,
    );
  }
  return <>{ticks}</>;
}

function YardNumbers({
  yd,
  fieldHeightPx,
  endzoneLengthPx,
  pixelsPerYard,
}: {
  yd: (yards: number) => number;
  fieldHeightPx: number;
  endzoneLengthPx: number;
  pixelsPerYard: number;
}) {
  const numberRowY = {
    top: yd(YARD_NUMBER_INSET_FROM_SIDELINE_YARDS),
    bottom: fieldHeightPx - yd(YARD_NUMBER_INSET_FROM_SIDELINE_YARDS),
  };
  const fontSizePx = pixelsPerYard * 3.5;

  const labels = [];
  for (
    let fieldYard = YARD_NUMBER_INTERVAL_YARDS;
    fieldYard < PLAYING_FIELD_LENGTH_YARDS;
    fieldYard += YARD_NUMBER_INTERVAL_YARDS
  ) {
    // A placa mostra a distância até a goal line MAIS PRÓXIMA: sobe de 10
    // a 50 na primeira metade e desce de volta a 10 na segunda (100 - jd).
    const displayValue =
      fieldYard <= PLAYING_FIELD_LENGTH_YARDS / 2
        ? fieldYard
        : PLAYING_FIELD_LENGTH_YARDS - fieldYard;
    const x = endzoneLengthPx + yd(fieldYard);

    labels.push(
      // Fileira próxima à lateral "de cima" (y pequeno): rotacionada 180°
      // para que o topo do número aponte para o centro do campo (para baixo).
      <YardNumberLabel
        key={`num-top-${fieldYard}`}
        x={x}
        y={numberRowY.top}
        rotationDeg={180}
        fontSizePx={fontSizePx}
        label={String(displayValue)}
      />,
      // Fileira próxima à lateral "de baixo" (y grande): sem rotação, o
      // topo do número já aponta naturalmente para o centro (para cima).
      <YardNumberLabel
        key={`num-bottom-${fieldYard}`}
        x={x}
        y={numberRowY.bottom}
        rotationDeg={0}
        fontSizePx={fontSizePx}
        label={String(displayValue)}
      />,
    );
  }
  return <>{labels}</>;
}

function YardNumberLabel({
  x,
  y,
  rotationDeg,
  fontSizePx,
  label,
}: {
  x: number;
  y: number;
  rotationDeg: number;
  fontSizePx: number;
  label: string;
}) {
  // Caixa de texto fixa para poder centralizar o rótulo (offsetX/Y = metade
  // da caixa) e girá-lo ao redor do próprio centro.
  const boxWidth = fontSizePx * 2;
  const boxHeight = fontSizePx * 1.2;
  return (
    <Text
      text={label}
      x={x}
      y={y}
      width={boxWidth}
      height={boxHeight}
      offsetX={boxWidth / 2}
      offsetY={boxHeight / 2}
      rotation={rotationDeg}
      align="center"
      verticalAlign="middle"
      fontSize={fontSizePx}
      fontStyle="bold"
      fontFamily="Arial, sans-serif"
      fill={LINE_WHITE}
    />
  );
}

function FieldBorder({ widthPx, heightPx }: { widthPx: number; heightPx: number }) {
  return (
    <Rect
      x={0}
      y={0}
      width={widthPx}
      height={heightPx}
      stroke={LINE_WHITE}
      strokeWidth={3}
      fillEnabled={false}
    />
  );
}
