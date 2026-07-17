import { useEffect, useRef } from 'react';
import type Konva from 'konva';
import { Stage, Layer } from 'react-konva';
import { PIXELS_PER_YARD } from '../../utils/constants';
import { clamp } from '../../utils/math';
import { useFieldStore, type DrawingMode } from '../../store/useFieldStore';
import { PlayerNode } from './PlayerNode';
import { AssignmentsLayer } from './AssignmentsLayer';
import { FieldGeometry } from './FieldGeometry';
import { stageRef as sharedStageRef } from './stageRef';
import { FIELD_LENGTH_YARDS, FIELD_WIDTH_YARDS } from './constants';

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
      <FieldGeometry pixelsPerYard={pixelsPerYard} fieldRule={fieldRule} />
      {/* Camada interativa: separada do fundo estático (listening={false}
          dentro de FieldGeometry) para que só os jogadores capturem eventos
          de arraste. Só é "draggable" no modo 'move' — nos modos de desenho
          o clique inicia uma polilinha (ver handleStageClick acima). */}
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
