import { memo, useEffect, useState } from 'react';
import { Layer, Rect, Line, Text, Image as KonvaImage } from 'react-konva';
import type { FieldRule } from '../../utils/constants';
import type { GameMode } from '../../store/useFieldStore';
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
  FLAG_FIELD_WIDTH_YARDS,
  FLAG_FIELD_LENGTH_YARDS,
  FLAG_ENDZONE_LENGTH_YARDS,
  FLAG_PLAYING_FIELD_LENGTH_YARDS,
  FLAG_YARD_LINE_INTERVAL_YARDS,
  FLAG_YARD_NUMBER_INSET_FROM_SIDELINE_YARDS,
} from './constants';

// Paleta puramente visual — não faz parte da matemática do campo.
const TURF_GREEN = '#1c6b41';
const LINE_WHITE = '#f5f5f0';

// Números do Flag viram marca d'água (ver FlagYardNumbers) — bem mais
// transparentes que o branco cheio (opacity 1) usado nos números do Tackle.
const FLAG_YARD_NUMBER_OPACITY = 0.35;

// Servida direto de /public pelo Vite, sem import — mesma técnica dos
// logos de liga em FieldControls.tsx.
const LOBOS_LOGO_SRC = '/lobos.png';
const LOBOS_LOGO_OPACITY = 0.6;
// A End Zone é uma faixa estreita e alta (10 jardas de largura x ~53,33 de
// altura) — a logo ocupa ~80% dela, preservando a proporção original do
// arquivo (equivalente a um "object-fit: contain" pós-rotação).
const LOBOS_LOGO_FILL_RATIO = 0.8;
const LOBOS_LOGO_ROTATION_DEG = 90;

interface FieldGeometryProps {
  pixelsPerYard: number;
  fieldRule: FieldRule;
  gameMode: GameMode;
}

/**
 * Fundo vetorial estático do campo — despacha pra uma das duas geometrias
 * conforme a modalidade ativa. `memo`'d e isolado num componente próprio
 * (em vez de viver inline em Field.tsx) porque só depende de
 * `pixelsPerYard`/`fieldRule`/`gameMode` — que quase nunca mudam — enquanto
 * Field.tsx re-renderiza a cada mousemove durante um desenho. Sem esse
 * isolamento, os elementos aqui dentro seriam recriados e re-reconciliados
 * a cada frame à toa.
 */
export const FieldGeometry = memo(function FieldGeometry({
  pixelsPerYard,
  fieldRule,
  gameMode,
}: FieldGeometryProps) {
  return gameMode === 'flag5x5' ? (
    <FlagFieldGeometry pixelsPerYard={pixelsPerYard} />
  ) : (
    <TackleFieldGeometry pixelsPerYard={pixelsPerYard} fieldRule={fieldRule} />
  );
});

/**
 * Campo de Tackle 11x11 — gramado, endzones, linhas de jarda a cada 5 jd,
 * hash marks, números e borda. Comportamento e matemática idênticos aos de
 * antes da modalidade Flag existir; nenhuma linha deste componente mudou.
 */
function TackleFieldGeometry({
  pixelsPerYard,
  fieldRule,
}: {
  pixelsPerYard: number;
  fieldRule: FieldRule;
}) {
  const yd = (yards: number) => yards * pixelsPerYard;

  // Eixo X = comprimento do campo (120 jd) · Eixo Y = largura (53 1/3 jd).
  const fieldWidthPx = yd(FIELD_LENGTH_YARDS);
  const fieldHeightPx = yd(FIELD_WIDTH_YARDS);
  const endzoneLengthPx = yd(ENDZONE_LENGTH_YARDS);
  const hashMarkInsetYards = HASH_MARK_INSET_YARDS_BY_RULE[fieldRule];

  return (
    <Layer listening={false} zIndex={0}>
      <FieldTurf widthPx={fieldWidthPx} heightPx={fieldHeightPx} />
      {/* Logos das End Zones: sem preenchimento sólido de cor por trás —
          a logo É o design da End Zone agora. listening={false} tanto aqui
          quanto na Layer (acima) garante que elas nunca capturem cliques
          do treinador; a Layer inteira já nasce em zIndex 0 (fundo). */}
      <EndzoneLogo
        centerX={endzoneLengthPx / 2}
        centerY={fieldHeightPx / 2}
        endzoneWidthPx={endzoneLengthPx}
        endzoneHeightPx={fieldHeightPx}
      />
      <EndzoneLogo
        centerX={fieldWidthPx - endzoneLengthPx / 2}
        centerY={fieldHeightPx / 2}
        endzoneWidthPx={endzoneLengthPx}
        endzoneHeightPx={fieldHeightPx}
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
}

/**
 * Campo de Flag 5x5 — malha 10+60+10 = 80 x 35 (ver FLAG_* em ./constants),
 * mais estreita e curta que o Tackle, mas com linhas verticais e números a
 * cada 10 unidades (sem hash marks). Reaproveita FieldTurf/EndzoneLogo/
 * FieldBorder do Tackle, que já são genéricos (recebem largura/altura em
 * pixels via props) — a mesma logo dos Lobos usada nas End Zones do Tackle
 * é reaproveitada aqui, só com as dimensões dos novos espaços de 10x35.
 */
function FlagFieldGeometry({ pixelsPerYard }: { pixelsPerYard: number }) {
  const yd = (yards: number) => yards * pixelsPerYard;

  // Mesma convenção de eixos do Tackle: X = comprimento do campo (aqui, 80
  // jd), Y = largura/lateral-a-lateral (aqui, 35 jd) — só os totais mudam.
  const fieldLengthPx = yd(FLAG_FIELD_LENGTH_YARDS);
  const fieldWidthPx = yd(FLAG_FIELD_WIDTH_YARDS);
  const endzoneLengthPx = yd(FLAG_ENDZONE_LENGTH_YARDS);

  return (
    <Layer listening={false} zIndex={0}>
      <FieldTurf widthPx={fieldLengthPx} heightPx={fieldWidthPx} />
      <EndzoneLogo
        centerX={endzoneLengthPx / 2}
        centerY={fieldWidthPx / 2}
        endzoneWidthPx={endzoneLengthPx}
        endzoneHeightPx={fieldWidthPx}
      />
      <EndzoneLogo
        centerX={fieldLengthPx - endzoneLengthPx / 2}
        centerY={fieldWidthPx / 2}
        endzoneWidthPx={endzoneLengthPx}
        endzoneHeightPx={fieldWidthPx}
      />
      <FlagYardLines yd={yd} fieldWidthPx={fieldWidthPx} endzoneLengthPx={endzoneLengthPx} />
      <FlagYardNumbers
        yd={yd}
        fieldWidthPx={fieldWidthPx}
        endzoneLengthPx={endzoneLengthPx}
        pixelsPerYard={pixelsPerYard}
      />
      <FieldBorder widthPx={fieldLengthPx} heightPx={fieldWidthPx} />
    </Layer>
  );
}

/**
 * Linhas verticais cheias a cada 10 unidades, goal line a goal line (0 a
 * 60 na área de jogo) — mesmo padrão de YardLines do Tackle, mas com
 * intervalo de 10 (não 5) e sem hash marks. A linha central (30, que
 * também é a marca de "First Down" do flag — cruzar o meio de campo
 * garante um novo 1º down) recebe o mesmo peso visual das goal lines.
 */
function FlagYardLines({
  yd,
  fieldWidthPx,
  endzoneLengthPx,
}: {
  yd: (yards: number) => number;
  fieldWidthPx: number;
  endzoneLengthPx: number;
}) {
  const lines = [];
  for (
    let fieldYard = 0;
    fieldYard <= FLAG_PLAYING_FIELD_LENGTH_YARDS;
    fieldYard += FLAG_YARD_LINE_INTERVAL_YARDS
  ) {
    const x = endzoneLengthPx + yd(fieldYard);
    const isHeavyLine =
      fieldYard === 0 ||
      fieldYard === FLAG_PLAYING_FIELD_LENGTH_YARDS ||
      fieldYard === FLAG_PLAYING_FIELD_LENGTH_YARDS / 2;
    lines.push(
      <Line
        key={`flag-yard-line-${fieldYard}`}
        points={[x, 0, x, fieldWidthPx]}
        stroke={LINE_WHITE}
        strokeWidth={isHeavyLine ? 3 : 1.5}
        listening={false}
      />,
    );
  }
  return <>{lines}</>;
}

/**
 * Números (10, 20, 30, 20, 10) próximos às margens, cada um com uma seta
 * apontando horizontalmente para a linha de 30 (centro) — mesma ideia de
 * YardNumbers do Tackle (distância até a linha mais próxima, espelhada),
 * mas com as setas indicativas que o Tackle não tem.
 */
function FlagYardNumbers({
  yd,
  fieldWidthPx,
  endzoneLengthPx,
  pixelsPerYard,
}: {
  yd: (yards: number) => number;
  fieldWidthPx: number;
  endzoneLengthPx: number;
  pixelsPerYard: number;
}) {
  const numberRowY = {
    top: yd(FLAG_YARD_NUMBER_INSET_FROM_SIDELINE_YARDS),
    bottom: fieldWidthPx - yd(FLAG_YARD_NUMBER_INSET_FROM_SIDELINE_YARDS),
  };
  const fontSizePx = pixelsPerYard * 3.5;
  const centerFieldYard = FLAG_PLAYING_FIELD_LENGTH_YARDS / 2; // 30

  const elements = [];
  for (
    let fieldYard = FLAG_YARD_LINE_INTERVAL_YARDS;
    fieldYard < FLAG_PLAYING_FIELD_LENGTH_YARDS;
    fieldYard += FLAG_YARD_LINE_INTERVAL_YARDS
  ) {
    const displayValue =
      fieldYard <= centerFieldYard ? fieldYard : FLAG_PLAYING_FIELD_LENGTH_YARDS - fieldYard;
    const x = endzoneLengthPx + yd(fieldYard);
    // Setas apontam pra dentro, em direção à linha de 30 — na metade mais
    // próxima da End Zone esquerda isso é a direita (+X); na metade mais
    // próxima da direita, é a esquerda (-X). Na própria linha de 30 não há
    // seta (já é o centro, não aponta pra lugar nenhum).
    const arrowDirection: 'left' | 'right' | null =
      fieldYard === centerFieldYard ? null : fieldYard < centerFieldYard ? 'right' : 'left';

    elements.push(
      // opacity=0.35: números do Flag são só uma marca d'água de referência
      // (o campo é bem menor, rotas/vetores já dominam o espaço visual) —
      // não precisam do mesmo contraste forte do Tackle, onde os números
      // dividem o campo com bem mais espaço livre em volta.
      <YardNumberLabel
        key={`flag-num-top-${fieldYard}`}
        x={x}
        y={numberRowY.top}
        rotationDeg={180}
        fontSizePx={fontSizePx}
        label={String(displayValue)}
        opacity={FLAG_YARD_NUMBER_OPACITY}
      />,
      <YardNumberLabel
        key={`flag-num-bottom-${fieldYard}`}
        x={x}
        y={numberRowY.bottom}
        rotationDeg={0}
        fontSizePx={fontSizePx}
        label={String(displayValue)}
        opacity={FLAG_YARD_NUMBER_OPACITY}
      />,
    );

    if (arrowDirection) {
      const arrowOffsetPx = fontSizePx * 1.3;
      elements.push(
        <DirectionArrow
          key={`flag-arrow-top-${fieldYard}`}
          x={x + (arrowDirection === 'right' ? arrowOffsetPx : -arrowOffsetPx)}
          y={numberRowY.top}
          direction={arrowDirection}
          sizePx={fontSizePx * 0.4}
        />,
        <DirectionArrow
          key={`flag-arrow-bottom-${fieldYard}`}
          x={x + (arrowDirection === 'right' ? arrowOffsetPx : -arrowOffsetPx)}
          y={numberRowY.bottom}
          direction={arrowDirection}
          sizePx={fontSizePx * 0.4}
        />,
      );
    }
  }
  return <>{elements}</>;
}

/** Pequeno triângulo apontando horizontalmente — indica em que direção fica
 * a linha de 30 (centro) a partir do número ao lado. */
function DirectionArrow({
  x,
  y,
  direction,
  sizePx,
}: {
  x: number;
  y: number;
  direction: 'left' | 'right';
  sizePx: number;
}) {
  const tipX = direction === 'right' ? x + sizePx : x - sizePx;
  return (
    <Line
      points={[x, y - sizePx, x, y + sizePx, tipX, y]}
      closed
      fill={LINE_WHITE}
      stroke={LINE_WHITE}
      strokeWidth={1}
      opacity={FLAG_YARD_NUMBER_OPACITY}
      listening={false}
    />
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
  return <Rect x={0} y={0} width={widthPx} height={heightPx} fill={TURF_GREEN} listening={false} />;
}

/** Carrega uma imagem via <img> nativo pro Konva Image poder desenhá-la —
 * react-konva não busca URLs sozinho, precisa de um HTMLImageElement já
 * carregado. `null` enquanto carrega; o chamador decide o que renderizar
 * nesse meio-tempo. */
function useHtmlImage(src: string): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new window.Image();
    img.onload = () => setImage(img);
    img.src = src;
    return () => {
      img.onload = null;
    };
  }, [src]);

  return image;
}

/**
 * Logo dos Lobos centralizada dentro de uma End Zone, girada 90° pra ficar
 * legível na orientação vertical estreita da faixa (larga em Y, estreita em
 * X). O tamanho parte da proporção NATURAL do arquivo (largura/altura reais
 * da imagem carregada) — só escala até caber em ~80% da End Zone, nunca
 * distorce. Não renderiza nada até a imagem carregar.
 */
function EndzoneLogo({
  centerX,
  centerY,
  endzoneWidthPx,
  endzoneHeightPx,
}: {
  centerX: number;
  centerY: number;
  endzoneWidthPx: number;
  endzoneHeightPx: number;
}) {
  const image = useHtmlImage(LOBOS_LOGO_SRC);
  if (!image) return null;

  // Pré-rotação, a LARGURA natural da imagem passa a ocupar o eixo Y da
  // tela (altura da End Zone) depois de girar 90°, e a ALTURA natural passa
  // a ocupar o eixo X (largura da End Zone) — por isso os alvos trocados
  // aqui embaixo.
  const targetScreenHeight = endzoneHeightPx * LOBOS_LOGO_FILL_RATIO;
  const targetScreenWidth = endzoneWidthPx * LOBOS_LOGO_FILL_RATIO;
  const scale = Math.min(
    targetScreenHeight / image.naturalWidth,
    targetScreenWidth / image.naturalHeight,
  );
  const displayWidth = image.naturalWidth * scale;
  const displayHeight = image.naturalHeight * scale;

  return (
    <KonvaImage
      image={image}
      x={centerX}
      y={centerY}
      width={displayWidth}
      height={displayHeight}
      offsetX={displayWidth / 2}
      offsetY={displayHeight / 2}
      rotation={LOBOS_LOGO_ROTATION_DEG}
      opacity={LOBOS_LOGO_OPACITY}
      listening={false}
    />
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
        listening={false}
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
        listening={false}
      />,
      <Line
        key={`hash-bottom-${fieldYard}`}
        points={[x, bottomRowY - hashLength / 2, x, bottomRowY + hashLength / 2]}
        stroke={LINE_WHITE}
        strokeWidth={1.5}
        listening={false}
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
  opacity = 1,
}: {
  x: number;
  y: number;
  rotationDeg: number;
  fontSizePx: number;
  label: string;
  /** Só o Flag passa um valor menor que 1 (marca d'água) — o Tackle não
   * informa esta prop e continua com o número em opacidade cheia. */
  opacity?: number;
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
      opacity={opacity}
      listening={false}
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
      listening={false}
    />
  );
}
