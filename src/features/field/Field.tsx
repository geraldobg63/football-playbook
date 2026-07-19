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

/** Evento de ponteiro no Stage, agnóstico de origem (mouse ou dedo). Os
 * handlers de desenho nunca leem propriedades nativas do evento — extraem a
 * posição só via `stage.getPointerPosition()`, que o Konva já normaliza pros
 * dois casos —, então o MESMO handler serve mouse e touch. */
type StagePointerEvent = Konva.KonvaEventObject<MouseEvent | TouchEvent>;

// --- Pan/Zoom (Sideline Survival C3) -------------------------------------
// zoom=1 é o "fit" (campo inteiro visível, comportamento antigo); acima
// disso o treinador amplia uma região e navega — a solução de raiz pro C1
// (peças de ~9px + dedo grande no mobile), já que ao ampliar os jogadores
// se separam na TELA e o dedo mapeia pra menos px nativos.
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_BUTTON_STEP = 1.5; // multiplicador por clique nos botões +/-
const WHEEL_ZOOM_FACTOR = 1.12; // por "tick" da roda do mouse

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
    // Limpa a referência compartilhada no unmount (ex.: logout) — sem isso,
    // stageRef.current apontaria pra um Stage já destruído.
    return () => {
      sharedStageRef.current = null;
    };
  }, []);

  const yd = (yards: number) => yards * pixelsPerYard;

  // Dimensões do campo em jardas, por modalidade — Flag 5x5 usa um campo
  // bem menor (ver FLAG_* em ./constants). PIXELS_PER_YARD continua o
  // mesmo nos dois modos, só o total de jardas muda.
  const fieldLengthYards = gameMode === 'flag5x5' ? FLAG_FIELD_LENGTH_YARDS : FIELD_LENGTH_YARDS;
  const fieldWidthYards = gameMode === 'flag5x5' ? FLAG_FIELD_WIDTH_YARDS : FIELD_WIDTH_YARDS;

  // Tamanho NATIVO do campo (toda a matemática de jarda->pixel em
  // FieldGeometry/PlayerNode/AssignmentsLayer/exportToPng continua baseada
  // nele, sem nenhuma mudança) — pan/zoom e Modo Foco só aplicam transform
  // por cima via Stage.scale/position, nunca mexem nessa escala de verdade.
  const nativeFieldWidthPx = yd(fieldLengthYards);
  const nativeFieldHeightPx = yd(fieldWidthYards);

  // Estado de navegação: zoom (1 = fit) + deslocamento (pan) em px de TELA
  // relativo ao campo centralizado. Ver zoomTo()/handleWheel/handleTouch*.
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  // Enquanto dois dedos estão na tela (pinça/pan), o arraste de jogador é
  // desabilitado — senão o 1º dedo moveria uma peça no meio do gesto de
  // navegação. Ver handleTouch* + `draggable` do PlayerNode abaixo.
  const [isMultiTouch, setIsMultiTouch] = useState(false);

  // Trocar de modalidade reseta a navegação: o campo muda de tamanho
  // (120x53 <-> 80x35) e um zoom/pan herdado do modo anterior miraria a
  // região errada. Volta pro fit centralizado.
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [gameMode]);

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

  // "contain": a escala-base que faz o campo INTEIRO caber mantendo a
  // proporção original (a mesma para X e Y, então nunca distorce). O zoom do
  // usuário multiplica isso; `effScale` é a escala REAL aplicada ao Stage.
  const fitScale = Math.min(
    availableWidthPx / nativeFieldWidthPx,
    availableHeightPx / nativeFieldHeightPx,
  );
  const effScale = fitScale * zoom;

  // O Stage agora PREENCHE o container (antes era do tamanho do campo) pra
  // que o zoom possa transbordar e o pan revele outras regiões. O campo é
  // centralizado via baseOffset; `pan` desloca dentro do transbordo. Com
  // zoom=1 não há transbordo, então o pan é travado em 0 (fit puro).
  const scaledFieldWidthPx = nativeFieldWidthPx * effScale;
  const scaledFieldHeightPx = nativeFieldHeightPx * effScale;
  const baseOffsetX = (availableWidthPx - scaledFieldWidthPx) / 2;
  const baseOffsetY = (availableHeightPx - scaledFieldHeightPx) / 2;
  const maxPanX = Math.max(0, (scaledFieldWidthPx - availableWidthPx) / 2);
  const maxPanY = Math.max(0, (scaledFieldHeightPx - availableHeightPx) / 2);
  // Clamp no RENDER (não só ao setar): um resize que reduza o transbordo
  // (ex.: reabrir uma sidebar) re-limita o pan sem precisar de efeito extra.
  const clampedPanX = clamp(pan.x, -maxPanX, maxPanX);
  const clampedPanY = clamp(pan.y, -maxPanY, maxPanY);
  const stageX = baseOffsetX + clampedPanX;
  const stageY = baseOffsetY + clampedPanY;

  /**
   * Aplica um novo zoom mantendo fixo, sob o dedo/cursor, o ponto do campo
   * que estava em `prevFocus` (levando-o para `focus`). Unifica os três
   * gestos: botões e roda passam focus=prevFocus (zoom no lugar); a pinça
   * passa os dois centros (zoom + pan num gesto só). Deriva o novo `pan` a
   * partir da posição absoluta desejada do Stage e re-clampa ao transbordo.
   */
  const zoomTo = (
    newZoomRaw: number,
    focus: { x: number; y: number },
    prevFocus: { x: number; y: number } = focus,
  ) => {
    const newZoom = clamp(newZoomRaw, MIN_ZOOM, MAX_ZOOM);
    const newEff = fitScale * newZoom;
    // Ponto do campo (px nativo) que está sob prevFocus agora.
    const contentX = (prevFocus.x - stageX) / effScale;
    const contentY = (prevFocus.y - stageY) / effScale;
    // Posição absoluta do Stage pra esse ponto reaparecer sob `focus`.
    const newStageX = focus.x - contentX * newEff;
    const newStageY = focus.y - contentY * newEff;
    const newBaseX = (availableWidthPx - nativeFieldWidthPx * newEff) / 2;
    const newBaseY = (availableHeightPx - nativeFieldHeightPx * newEff) / 2;
    const newMaxPanX = Math.max(0, (nativeFieldWidthPx * newEff - availableWidthPx) / 2);
    const newMaxPanY = Math.max(0, (nativeFieldHeightPx * newEff - availableHeightPx) / 2);
    setZoom(newZoom);
    setPan({
      x: clamp(newStageX - newBaseX, -newMaxPanX, newMaxPanX),
      y: clamp(newStageY - newBaseY, -newMaxPanY, newMaxPanY),
    });
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const viewportCenter = () => ({ x: availableWidthPx / 2, y: availableHeightPx / 2 });

  // Pixels de TELA do ponteiro (getPointerPosition(), já em escala de
  // exibição) -> jardas reais, restringidas aos limites do campo. Desconta a
  // posição (pan/centragem) E a escala efetiva do Stage: sem isso, com zoom
  // ou campo encolhido todo clique miraria a jarda errada, já que
  // pixelsPerYard sozinho só vale em 1:1 e sem deslocamento.
  const pointerToYards = (pointerPx: { x: number; y: number }) => ({
    x: clamp((pointerPx.x - stageX) / (pixelsPerYard * effScale), 0, fieldLengthYards),
    y: clamp((pointerPx.y - stageY) / (pixelsPerYard * effScale), 0, fieldWidthYards),
  });

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const pointerPx = stage?.getPointerPosition();
    if (!pointerPx) return;
    const factor = e.evt.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR;
    zoomTo(zoom * factor, pointerPx);
  };

  // --- Gestos de dois dedos (pinça = zoom, deslize = pan) -----------------
  // Distância/centro do par de toques no frame anterior, pra derivar o
  // fator de zoom (dist atual / anterior) e o deslocamento (centro atual vs.
  // anterior) num gesto contínuo. Em coordenadas do container (não da tela).
  const lastPinchRef = useRef<{ dist: number; center: { x: number; y: number } } | null>(null);

  const readTwoTouches = (touches: TouchList) => {
    const stage = stageRef.current;
    if (!stage) return null;
    const rect = stage.container().getBoundingClientRect();
    const p1 = { x: touches[0].clientX - rect.left, y: touches[0].clientY - rect.top };
    const p2 = { x: touches[1].clientX - rect.left, y: touches[1].clientY - rect.top };
    return {
      dist: Math.hypot(p2.x - p1.x, p2.y - p1.y),
      center: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
    };
  };

  // Os manipuladores de toque vivem DEPOIS dos handlers de desenho (fim do
  // componente), porque roteiam pra eles — ver "Roteamento de ponteiro".

  const handleStageClick = (e: StagePointerEvent) => {
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

  const handleStageMouseMove = (e: StagePointerEvent) => {
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

  const handleStageMouseDown = (e: StagePointerEvent) => {
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

  const handleStageMouseUp = (e: StagePointerEvent) => {
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

  // --- Roteamento de ponteiro (mouse x toque) ----------------------------
  // O Konva NÃO sintetiza 'click'/'dblclick' a partir de um toque: ele tem
  // eventos próprios ('tap'/'dbltap'). Como TODO o fluxo de desenho é
  // dirigido por clique (iniciar rota no jogador, clicar pra quebrar, zona,
  // borracha) e por duplo-clique (finalizar), ligar só os handlers de mouse
  // deixava todas as ferramentas mortas no celular — o arraste continuava
  // funcionando porque é nativo do nó, não do fluxo de clique. Aqui os
  // MESMOS handlers são ligados nos dois mundos.
  //
  // Navegadores móveis ainda podem sintetizar eventos de mouse depois de um
  // toque ("compatibility mouse events"). Sem esta guarda, um único toque
  // rodaria o fluxo duas vezes (tap + click emulado), duplicando pontos da
  // polilinha. Marcamos o instante do último toque e ignoramos eventos de
  // mouse que cheguem logo em seguida.
  const lastTouchAtRef = useRef(0);
  const isEchoOfTouch = () => Date.now() - lastTouchAtRef.current < 600;
  const markTouch = () => {
    lastTouchAtRef.current = Date.now();
  };

  const handleMouseClick = (e: StagePointerEvent) => {
    if (isEchoOfTouch()) return;
    handleStageClick(e);
  };
  const handleMouseDown = (e: StagePointerEvent) => {
    if (isEchoOfTouch()) return;
    handleStageMouseDown(e);
  };
  const handleMouseMove = (e: StagePointerEvent) => {
    if (isEchoOfTouch()) return;
    handleStageMouseMove(e);
  };
  const handleMouseUp = (e: StagePointerEvent) => {
    if (isEchoOfTouch()) return;
    handleStageMouseUp(e);
  };
  const handleDblClick = () => {
    if (isEchoOfTouch()) return;
    handleStageDblClick();
  };

  const handleTouchStart = (e: StagePointerEvent) => {
    markTouch();
    const touches = (e.evt as TouchEvent).touches;
    if (touches.length === 2) {
      // Dois dedos = CÂMERA. Descarta qualquer desenho por arraste que o
      // primeiro dedo tenha começado, pra pinça não virar rota.
      dragStartRef.current = null;
      setIsMultiTouch(true);
      lastPinchRef.current = readTwoTouches(touches);
      return;
    }
    // Um dedo = DESENHO, sempre. Nunca navega a câmera (pan/zoom só existem
    // em dois dedos, na roda do mouse e nos botões), então não há disputa
    // pelo mesmo dedo: com Rota/Bloqueio/Motion/Zona/Borracha ativos o toque
    // vai direto pro motor de desenho. No modo 'move' o próprio nó do
    // jogador consome o arraste (draggable), e este handler é inócuo.
    if (touches.length === 1 && !isMultiTouch) handleStageMouseDown(e);
  };

  const handleTouchMove = (e: StagePointerEvent) => {
    markTouch();
    const touches = (e.evt as TouchEvent).touches;
    if (touches.length === 2) {
      e.evt.preventDefault();
      if (!isMultiTouch) setIsMultiTouch(true);
      const info = readTwoTouches(touches);
      const last = lastPinchRef.current;
      if (info && last && last.dist > 0) {
        zoomTo((zoom * info.dist) / last.dist, info.center, last.center);
      }
      lastPinchRef.current = info;
      return;
    }
    // Resíduo de um gesto de dois dedos (um dedo já saiu): não converte em
    // desenho até todos levantarem.
    if (isMultiTouch) return;
    // Um dedo arrastando: alimenta a "borracha elástica" da linha em curso.
    handleStageMouseMove(e);
  };

  const handleTouchEnd = (e: StagePointerEvent) => {
    markTouch();
    const remaining = (e.evt as TouchEvent).touches.length;
    if (remaining >= 2) return; // segue em gesto de câmera

    lastPinchRef.current = null;
    if (isMultiTouch) {
      // Só libera o modo desenho quando TODOS os dedos saírem — evita que o
      // dedo remanescente de uma pinça vire um traço acidental.
      if (remaining === 0) {
        setIsMultiTouch(false);
        dragStartRef.current = null;
      }
      return;
    }
    handleStageMouseUp(e);
  };

  // 'tap'/'dbltap' são os equivalentes de toque de 'click'/'dblclick' — é o
  // que ressuscita o fluxo de cliques (iniciar/quebrar rota, zona, borracha)
  // e o de finalização por duplo toque.
  const handleTap = (e: StagePointerEvent) => {
    markTouch();
    if (isMultiTouch) return;
    handleStageClick(e);
  };
  const handleDblTap = () => {
    markTouch();
    if (isMultiTouch) return;
    handleStageDblClick();
  };

  return (
    // touch-none (touch-action: none): entrega os eventos de toque direto
    // pro Konva, sem o browser tentar interpretar o gesto como scroll/zoom
    // primeiro. Sem isso, arrastar um jogador no celular disputa com a
    // rolagem da página (listeners de toque são passivos por padrão, então
    // o preventDefault interno do Konva pode não pegar o 1º touchmove).
    // `relative` ancora os controles de zoom flutuantes abaixo.
    <div ref={containerRef} className="relative h-full w-full touch-none">
      <Stage
        ref={stageRef}
        width={availableWidthPx}
        height={availableHeightPx}
        scaleX={effScale}
        scaleY={effScale}
        x={stageX}
        y={stageY}
        onClick={handleMouseClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onDblClick={handleDblClick}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTap={handleTap}
        onDblTap={handleDblTap}
      >
        <FieldGeometry pixelsPerYard={pixelsPerYard} fieldRule={fieldRule} gameMode={gameMode} />
        {/* Camada interativa: separada do fundo estático (listening={false}
            dentro de FieldGeometry) para que só os jogadores capturem eventos
            de arraste. Só é "draggable" no modo 'move' — nos modos de desenho
            o clique inicia uma polilinha (ver handleStageClick acima). Durante
            um gesto de dois dedos (isMultiTouch) o arraste é suspenso pra não
            mover uma peça enquanto o treinador dá pinça/pan. */}
        <Layer>
          {players.map((player) => (
            <PlayerNode
              key={player.id}
              player={player}
              draggable={drawingMode === 'move' && !isMultiTouch}
            />
          ))}
        </Layer>
        <AssignmentsLayer
          assignments={assignments}
          players={players}
          activeDrawingId={activeDrawingId}
          isEraseMode={drawingMode === 'erase'}
        />
      </Stage>

      <ZoomControls
        zoom={zoom}
        onZoomIn={() => zoomTo(zoom * ZOOM_BUTTON_STEP, viewportCenter())}
        onZoomOut={() => zoomTo(zoom / ZOOM_BUTTON_STEP, viewportCenter())}
        onReset={resetView}
      />
    </div>
  );
}

/**
 * Controles de zoom flutuantes (fora do <Stage>, então nunca aparecem na
 * exportação PNG) — a via de navegação mais confiável e "à prova de luvas"
 * pra beira do campo, além do wheel (desktop) e da pinça (touch). Ancorados
 * no canto inferior esquerdo pra não colidir com o guia de ajuda (inferior
 * direito) nem com as abas de retração das barras (centro das laterais).
 */
function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  const atFit = zoom <= MIN_ZOOM + 0.001;
  const atMax = zoom >= MAX_ZOOM - 0.001;
  const buttonClasses =
    'flex h-9 w-9 touch-manipulation items-center justify-center rounded-md bg-lobos-navy-950/80 text-lg font-bold text-white ring-1 ring-white/10 hover:bg-lobos-navy-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lobos-gold-400 active:scale-[0.97] transition-all disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-col gap-1">
      <button
        type="button"
        onClick={onZoomIn}
        disabled={atMax}
        aria-label="Aproximar"
        className={`pointer-events-auto ${buttonClasses}`}
      >
        +
      </button>
      <button
        type="button"
        onClick={onZoomOut}
        disabled={atFit}
        aria-label="Afastar"
        className={`pointer-events-auto ${buttonClasses}`}
      >
        −
      </button>
      <button
        type="button"
        onClick={onReset}
        disabled={atFit}
        aria-label="Enquadrar campo inteiro"
        className={`pointer-events-auto ${buttonClasses} text-sm`}
      >
        ⤢
      </button>
    </div>
  );
}
