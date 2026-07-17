import { memo } from 'react';
import { Layer, Rect, Line, Text } from 'react-konva';
import type { FieldRule } from '../../utils/constants';
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

interface FieldGeometryProps {
  pixelsPerYard: number;
  fieldRule: FieldRule;
}

/**
 * Fundo vetorial estático do campo (gramado, endzones, linhas de jarda,
 * hash marks, números e borda) — nenhuma imagem é usada. `Layer
 * listening={false}` porque esse fundo nunca é interativo, só a camada de
 * jogadores em Field.tsx captura eventos.
 *
 * `memo`'d e isolado num componente próprio (em vez de viver inline em
 * Field.tsx) porque só depende de `pixelsPerYard`/`fieldRule` — que quase
 * nunca mudam — enquanto Field.tsx re-renderiza a cada mousemove durante um
 * desenho. Sem esse isolamento, os ~219 elementos aqui dentro seriam
 * recriados e re-reconciliados a cada frame à toa.
 */
export const FieldGeometry = memo(function FieldGeometry({
  pixelsPerYard,
  fieldRule,
}: FieldGeometryProps) {
  const yd = (yards: number) => yards * pixelsPerYard;

  // Eixo X = comprimento do campo (120 jd) · Eixo Y = largura (53 1/3 jd).
  const fieldWidthPx = yd(FIELD_LENGTH_YARDS);
  const fieldHeightPx = yd(FIELD_WIDTH_YARDS);
  const endzoneLengthPx = yd(ENDZONE_LENGTH_YARDS);
  const hashMarkInsetYards = HASH_MARK_INSET_YARDS_BY_RULE[fieldRule];

  return (
    <Layer listening={false}>
      <FieldTurf widthPx={fieldWidthPx} heightPx={fieldHeightPx} />
      <Endzones
        fieldWidthPx={fieldWidthPx}
        fieldHeightPx={fieldHeightPx}
        endzoneLengthPx={endzoneLengthPx}
      />
      <YardLines yd={yd} fieldHeightPx={fieldHeightPx} endzoneLengthPx={endzoneLengthPx} />
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
  );
});

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
