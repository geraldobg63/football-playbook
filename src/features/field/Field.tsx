import { Stage, Layer, Rect, Line, Text } from 'react-konva';
import {
  PIXELS_PER_YARD,
  FIELD_LENGTH_YARDS,
  FIELD_WIDTH_YARDS,
  ENDZONE_LENGTH_YARDS,
  PLAYING_FIELD_LENGTH_YARDS,
  YARD_LINE_INTERVAL_YARDS,
  YARD_NUMBER_INTERVAL_YARDS,
  YARD_NUMBER_INSET_FROM_SIDELINE_YARDS,
  HASH_MARK_INSET_FROM_SIDELINE_YARDS,
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

/**
 * Renderiza o campo de futebol americano de forma inteiramente vetorial
 * (nenhuma imagem é usada). O Layer estático é `listening={false}` porque
 * o campo em si nunca é interativo — camadas futuras (jogadores, rotas,
 * ferramentas de desenho) serão adicionadas como Layers/Groups irmãos
 * dentro do mesmo Stage, sobrepostas a este fundo.
 */
export function Field({ pixelsPerYard = PIXELS_PER_YARD }: FieldProps) {
  const yd = (yards: number) => yards * pixelsPerYard;

  // Eixo X = comprimento do campo (120 jd) · Eixo Y = largura (53 1/3 jd).
  const fieldWidthPx = yd(FIELD_LENGTH_YARDS);
  const fieldHeightPx = yd(FIELD_WIDTH_YARDS);
  const endzoneLengthPx = yd(ENDZONE_LENGTH_YARDS);

  return (
    <Stage width={fieldWidthPx} height={fieldHeightPx}>
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
        />
        <YardNumbers
          yd={yd}
          fieldHeightPx={fieldHeightPx}
          endzoneLengthPx={endzoneLengthPx}
          pixelsPerYard={pixelsPerYard}
        />
        <FieldBorder widthPx={fieldWidthPx} heightPx={fieldHeightPx} />
      </Layer>
    </Stage>
  );
}

// --- Sub-componentes de desenho ------------------------------------------
// Cada um cuida de uma única camada de marcação. Mantê-los separados torna
// trivial religar/desligar marcações específicas conforme o playbook evolui
// (ex.: esconder hash marks em modo "diagrama simplificado").

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
}: {
  yd: (yards: number) => number;
  fieldHeightPx: number;
  endzoneLengthPx: number;
}) {
  const hashLength = yd(HASH_MARK_LENGTH_YARDS);
  const topRowY = yd(HASH_MARK_INSET_FROM_SIDELINE_YARDS);
  const bottomRowY = fieldHeightPx - yd(HASH_MARK_INSET_FROM_SIDELINE_YARDS);

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
