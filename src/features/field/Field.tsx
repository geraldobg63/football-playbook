import { useEffect, useRef, useState } from 'react';
import type Konva from 'konva';
import { Stage, Layer } from 'react-konva';
import { PIXELS_PER_YARD } from '../../utils/constants';
import { clamp } from '../../utils/math';
import { useFieldStore, type DrawingMode } from '../../store/useFieldStore';
import { PlayerNode } from './PlayerNode';
import { AssignmentsLayer } from './AssignmentsLayer';
import { FieldGeometry } from './FieldGeometry';
import { stageRef as sharedStageRef } from './stageRef';
import { FIELD_LENGTH_YARDS, FIELD_WIDTH_YARDS, FLAG_FIELD_LENGTH_YARDS, FLAG_FIELD_WIDTH_YARDS } from './constants';

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
  const gameMode = useFieldStore((state) => state.gameMode);
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

  // Dimensões do campo em jardas, por modalidade — Flag 5x5 usa um campo
  // bem menor (ver FLAG_* em ./constants). PIXELS_PER_YARD continua o
  // mesmo nos dois modos, só o total de jardas muda.
  const fieldLengthYards = gameMode === 'flag5x5' ? FLAG_FIELD_LENGTH_YARDS : FIELD_LENGTH_YARDS;
  const fieldWidthYards = gameMode === 'flag5x5' ? FLAG_FIELD_WIDTH_YARDS : FIELD_WIDTH_YARDS;

  // Tamanho NATIVO do campo (toda a matemática de jarda->pixel em
  // FieldGeometry/PlayerNode/AssignmentsLayer/exportToPng continua baseada
  // nele, sem nenhuma mudança) — o Modo Foco não altera essa escala de
  // verdade, só aplica um zoom uniforme por cima via Stage.scale abaixo.
  const nativeFieldWidthPx = yd(fieldLengthYards);
  const nativeFieldHeightPx = yd(fieldWidthYards);

  // Mede o espaço realmente disponível pro campo (o wrapper em App.tsx, que
  // cresce/encolhe quando as barras laterais retraem/expandem) e recalcula
  // sempre que ele mudar de tamanho — inclusive durante a transição CSS de
  // largura das barras, já que ResizeObserver dispara a cada frame de
  // layout, não só uma vez no fim.
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(
    null,
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Leitura síncrona imediata, antes do observer entrar em cena — o
    // primeiro callback de um ResizeObserver só chega de forma assíncrona
    // (depois do próximo layout/paint), então sem isso o primeiro frame
    // sempre usaria o fallback nativo abaixo mesmo quando o contêiner real
    // já tem um tamanho diferente, causando um "pulo" visual perceptível
    // logo após montar.
    const rect = el.getBoundingClientRect();
    setContainerSize({ width: rect.width, height: rect.height });

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setContainerSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Antes do primeiro tamanho ser medido (nem a leitura síncrona nem o
  // observer rodaram ainda), cai pro tamanho nativo — evita um Stage 0x0.
  const availableWidthPx = containerSize?.width ?? nativeFieldWidthPx;
  const availableHeightPx = containerSize?.height ?? nativeFieldHeightPx;

  // "contain": encolhe ou amplia o campo INTEIRO mantendo a proporção
  // original — a mesma escala vale pros eixos X e Y, então o gramado e os
  // jogadores nunca esticam/achatam, só ficam menores ou maiores juntos.
  // IMPORTANTE: stage.getPointerPosition() devolve coordenadas no espaço de
  // TELA (pixels do canvas, já escalados) — Konva NÃO desconta a escala do
  // próprio Stage sozinho nesse método (confirmado testando manualmente;
  // só getRelativePointerPosition()/dragBoundFunc de nós fazem isso). Por
  // isso pointerToYards() abaixo divide também por `stageScale`, senão todo
  // clique mapeia pra jarda errada sempre que o campo não estiver 1:1.
  const stageScale = Math.min(
    availableWidthPx / nativeFieldWidthPx,
    availableHeightPx / nativeFieldHeightPx,
  );
  const stageWidthPx = nativeFieldWidthPx * stageScale;
  const stageHeightPx = nativeFieldHeightPx * stageScale;

  // Pixels de TELA do ponteiro (getPointerPosition(), já em escala de
  // exibição) -> jardas reais, restringidas aos limites do campo inteiro
  // (0-120 x, 0-53.33 y). Descontar `stageScale` primeiro é essencial: sem
  // isso, um campo encolhido pelo Modo Foco faria todo clique mirar num
  // ponto errado do campo (mais perto do centro do que o cursor realmente
  // está), já que pixelsPerYard sozinho só vale na escala 1:1.
  const pointerToYards = (pointerPx: { x: number; y: number }) => ({
    x: clamp(pointerPx.x / (pixelsPerYard * stageScale), 0, fieldLengthYards),
    y: clamp(pointerPx.y / (pixelsPerYard * stageScale), 0, fieldWidthYards),
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
    <div ref={containerRef} className="h-full w-full">
      <Stage
        ref={stageRef}
        width={stageWidthPx}
        height={stageHeightPx}
        scaleX={stageScale}
        scaleY={stageScale}
        onClick={handleStageClick}
        onMouseDown={handleStageMouseDown}
        onMouseUp={handleStageMouseUp}
        onMouseMove={handleStageMouseMove}
        onDblClick={handleStageDblClick}
      >
        <FieldGeometry pixelsPerYard={pixelsPerYard} fieldRule={fieldRule} gameMode={gameMode} />
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
    </div>
  );
}
