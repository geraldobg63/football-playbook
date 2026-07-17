import { useEffect, useMemo, useRef } from 'react';
import type Konva from 'konva';
import { Stage, Layer, Rect, Line, Text } from 'react-konva';
import { PIXELS_PER_YARD } from '../../utils/constants';
import { clamp } from '../../utils/math';
import { useFieldStore, type DrawingMode } from '../../store/useFieldStore';
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

// Modos que iniciam algum tipo de desenho no Stage. 'move' e 'erase' ficam
// de fora — 'move' porque o clique/arraste ali pertence ao PlayerNode, e
// 'erase' porque tem seu próprio fluxo (ver handleStageClick). Um type
// guard (em vez de um Set simples) deixa o TypeScript estreitar
// `drawingMode` corretamente depois do early-return abaixo.
function isDrawingMode(mode: DrawingMode): mode is 'route' | 'block' | 'motion' | 'zone' {
  return mode === 'route' || mode === 'block' || mode === 'motion' || mode === 'zone';
}

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
  const activeDrawingId = useFieldStore((state) => state.activeDrawingId);
  const startDrawing = useFieldStore((state) => state.startDrawing);
  const updateDrawingPoint = useFieldStore((state) => state.updateDrawingPoint);
  const addDrawingPoint = useFieldStore((state) => state.addDrawingPoint);
  const finishDrawing = useFieldStore((state) => state.finishDrawing);
  const addZoneAssignment = useFieldStore((state) => state.addZoneAssignment);
  const removeAssignment = useFieldStore((state) => state.removeAssignment);
  const hashMarkInsetYards = HASH_MARK_INSET_YARDS_BY_RULE[fieldRule];

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

  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (drawingMode === 'erase') {
      // Colisão com um PlayerNode (Group com id = player.id) OU direto com
      // uma forma da AssignmentsLayer (que só escuta clique neste modo —
      // ver isEraseMode abaixo). Em ambos os casos o id encontrado já é o
      // identificador que removeAssignment espera (playerId, ou o próprio
      // id do assignment no caso de uma zona sem dono).
      const clickedGroup = e.target.findAncestor('Group', true);
      const targetId = clickedGroup?.id() || e.target.id();
      if (targetId) removeAssignment(targetId);
      return;
    }

    if (!isDrawingMode(drawingMode)) return;

    const stage = e.target.getStage();
    const pointerPx = stage?.getPointerPosition();
    if (!pointerPx) return;
    const { x, y } = pointerToYards(pointerPx);

    if (activeDrawingId) {
      // Já desenhando: este clique fixa o ponto atual (onde o mouse já
      // está) e abre um novo par que passa a seguir o mouse — é isso que
      // cria a "quebra" da polilinha a cada clique.
      addDrawingPoint(x, y);
      return;
    }

    if (drawingMode === 'zone') {
      // Zona não tem jogador dono e não entra no fluxo de múltiplos
      // cliques: um clique já cria a elipse inteira.
      addZoneAssignment(x, y);
      return;
    }

    // route/block/motion: só inicia o vetor se o clique colidiu com um
    // PlayerNode. O alvo real do clique (Circle/Text) tem como ancestral
    // o Group do jogador, identificado pelo `id` do Konva.
    const clickedGroup = e.target.findAncestor('Group', true);
    const clickedPlayerId = clickedGroup?.id();
    const player = players.find((candidate) => candidate.id === clickedPlayerId);
    if (!player) return;

    startDrawing(drawingMode, player.id, player.x, player.y, x, y);
  };

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!activeDrawingId) return;

    const stage = e.target.getStage();
    const pointerPx = stage?.getPointerPosition();
    if (!pointerPx) return;

    const { x, y } = pointerToYards(pointerPx);
    updateDrawingPoint(x, y);
  };

  const handleStageDblClick = () => {
    if (!activeDrawingId) return;
    finishDrawing();
  };

  // Konva só sintetiza 'click' quando mousedown E mouseup caem na MESMA
  // forma — um arraste real (mousedown num jogador, solta em outro ponto)
  // não dispara click nenhum, e o fluxo baseado em onClick abaixo fica
  // inteiramente mudo. Como "clicar e arrastar" é o jeito mais intuitivo de
  // desenhar uma linha, capturamos esse gesto aqui via mousedown/mouseup
  // brutos: se o ponteiro se moveu além de um limiar entre os dois, tratamos
  // como arraste e criamos a linha reta (início -> soltura) num único gesto,
  // sem depender do modelo de múltiplos cliques. Só entra em jogo ao
  // INICIAR um desenho (activeDrawingId ainda nulo) — nunca interfere com
  // uma polilinha já em andamento nem com o modo 'zone' (que não parte de
  // um jogador).
  const dragStartRef = useRef<{
    type: 'route' | 'block' | 'motion';
    playerId: string;
    anchorXYards: number;
    anchorYYards: number;
    downPointerPx: { x: number; y: number };
  } | null>(null);
  const DRAG_THRESHOLD_PX = 20;

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawingMode(drawingMode) || drawingMode === 'zone' || activeDrawingId) return;

    const stage = e.target.getStage();
    const pointerPx = stage?.getPointerPosition();
    if (!pointerPx) return;

    const clickedGroup = e.target.findAncestor('Group', true);
    const clickedPlayerId = clickedGroup?.id();
    const player = players.find((candidate) => candidate.id === clickedPlayerId);
    if (!player) return;

    dragStartRef.current = {
      type: drawingMode,
      playerId: player.id,
      anchorXYards: player.x,
      anchorYYards: player.y,
      downPointerPx: pointerPx,
    };
  };

  const handleStageMouseUp = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const dragStart = dragStartRef.current;
    dragStartRef.current = null;
    if (!dragStart) return;

    const stage = e.target.getStage();
    const pointerPx = stage?.getPointerPosition();
    if (!pointerPx) return;

    const movedPx = Math.hypot(
      pointerPx.x - dragStart.downPointerPx.x,
      pointerPx.y - dragStart.downPointerPx.y,
    );
    if (movedPx < DRAG_THRESHOLD_PX) return; // sem arraste real: o onClick normal cuida do clique

    // Se soltou em cima do MESMO jogador onde começou, Konva ainda vai
    // sintetizar um 'click' pra esse gesto (down-target === up-target) —
    // deixar esse click seguir seu fluxo normal (início da polilinha) em vez
    // de TAMBÉM finalizar aqui, senão os dois disparam em sequência: o
    // arraste fecha o desenho, e o click logo depois reabre um novo por
    // cima, deixando um desenho fantasma "em andamento" e quebrando a
    // dinâmica de quebras (clique-clique-duplo-clique).
    const releasedGroup = e.target.findAncestor('Group', true);
    if (releasedGroup?.id() === dragStart.playerId) return;

    // O arraste só faz o papel do PRIMEIRO clique (usando o ponto de soltura
    // como pull inicial) — não finaliza sozinho. Assim o desenho continua
    // "aberto" exatamente como se tivesse começado por clique normal: dá pra
    // seguir clicando pra adicionar quebras, e o duplo-clique finaliza como
    // sempre. Sem isso, quem começa arrastando nunca consegue quebrar a rota
    // depois, porque finishDrawing() já teria fechado tudo aqui.
    const { x, y } = pointerToYards(pointerPx);
    startDrawing(dragStart.type, dragStart.playerId, dragStart.anchorXYards, dragStart.anchorYYards, x, y);
  };

  // A geometria do campo (~219 Line/Text) só muda quando pixelsPerYard ou
  // fieldRule mudam — praticamente nunca durante o uso normal. Sem memo,
  // Field re-renderiza (via Zustand) a cada mousemove enquanto se desenha
  // uma rota, e essa camada inteira seria recriada e re-reconciliada a
  // cada frame à toa. `yd` é recalculado AQUI DENTRO (em vez de usar o `yd`
  // do escopo externo) só pra não precisar listar uma função recriada a
  // cada render como dependência do useMemo, o que invalidaria o cache
  // sempre — o resultado matemático é idêntico.
  const fieldGeometryLayer = useMemo(() => {
    const ydLocal = (yards: number) => yards * pixelsPerYard;
    return (
      <Layer listening={false}>
        <FieldTurf widthPx={fieldWidthPx} heightPx={fieldHeightPx} />
        <Endzones
          fieldWidthPx={fieldWidthPx}
          fieldHeightPx={fieldHeightPx}
          endzoneLengthPx={endzoneLengthPx}
        />
        <YardLines
          yd={ydLocal}
          fieldHeightPx={fieldHeightPx}
          endzoneLengthPx={endzoneLengthPx}
        />
        <HashMarks
          yd={ydLocal}
          fieldHeightPx={fieldHeightPx}
          endzoneLengthPx={endzoneLengthPx}
          insetYards={hashMarkInsetYards}
        />
        <YardNumbers
          yd={ydLocal}
          fieldHeightPx={fieldHeightPx}
          endzoneLengthPx={endzoneLengthPx}
          pixelsPerYard={pixelsPerYard}
        />
        <FieldBorder widthPx={fieldWidthPx} heightPx={fieldHeightPx} />
      </Layer>
    );
  }, [pixelsPerYard, fieldWidthPx, fieldHeightPx, endzoneLengthPx, hashMarkInsetYards]);

  return (
    <Stage
      ref={stageRef}
      width={fieldWidthPx}
      height={fieldHeightPx}
      onClick={handleStageClick}
      onMouseDown={handleStageMouseDown}
      onMouseUp={handleStageMouseUp}
      onMouseMove={handleStageMouseMove}
      onDblClick={handleStageDblClick}
    >
      {fieldGeometryLayer}
      {/* Camada interativa: separada do fundo estático (listening={false}
          acima) para que só os jogadores capturem eventos de arraste. Só é
          "draggable" no modo 'move' — nos modos de desenho o clique inicia
          uma polilinha (ver handleStageClick acima). */}
      <Layer>
        {players.map((player) => (
          <PlayerNode key={player.id} player={player} draggable={drawingMode === 'move'} />
        ))}
      </Layer>
      <AssignmentsLayer
        assignments={assignments}
        players={players}
        activeDrawingId={activeDrawingId}
        isEraseMode={drawingMode === 'erase'}
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
