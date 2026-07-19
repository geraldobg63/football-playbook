import { memo, useCallback, useEffect, useMemo } from 'react';
import type Konva from 'konva';
import { Circle, Group, Text } from 'react-konva';
import { PIXELS_PER_YARD } from '../../utils/constants';
import { COLOR_OFFENSE_FILL, COLOR_DEFENSE_FILL } from '../../utils/colors';
import { clamp } from '../../utils/math';
import { FIELD_LENGTH_YARDS, FIELD_WIDTH_YARDS, FLAG_FIELD_LENGTH_YARDS, FLAG_FIELD_WIDTH_YARDS } from './constants';
import { useFieldStore, type Player } from '../../store/useFieldStore';

// Sideline Survival — alto contraste sob luz solar: fills vivos e saturados
// (azul royal / vermelho) em vez dos tons escuros anteriores, que "sumiam"
// sobre o verde escuro do gramado numa tela de celular ao sol. Cores vindas
// dos tokens semânticos (utils/colors.ts) — fonte única compartilhada com
// AssignmentsLayer e os rótulos de FieldControls.
const TEAM_COLORS: Record<Player['team'], string> = {
  offense: COLOR_OFFENSE_FILL,
  defense: COLOR_DEFENSE_FILL,
};

const LABEL_WHITE = '#ffffff';
// Contorno branco reforçado (era 1.5) — a borda mais espessa cria uma
// separação nítida entre a peça e o gramado, essencial sob sol forte.
const PLAYER_STROKE_WIDTH_PX = 2.5;
export const PLAYER_RADIUS_YARDS = 1.5;

// Sideline Survival C1 — folga MODESTA no alvo de toque, só pra perdoar
// quase-acertos. Vive em coordenadas nativas (px de PIXELS_PER_YARD), então
// o anel de hit é fixo em relação ao espaçamento entre jogadores (~2 jd =
// 22px). Valores agressivos (testamos 40) faziam o anel de um jogador
// "engolir" o toque do vizinho — em press coverage, o CB por cima do WR
// roubava o arraste até no centro exato do WR. Por isso um valor pequeno:
// a solução real de C1 (dedo grande + peça de 9px no mobile) é o PAN/ZOOM
// do Stage (ver Field.tsx), que separa os jogadores na TELA e faz o dedo
// mapear pra menos px nativos — aí a folga não precisa ser grande.
const PLAYER_HIT_STROKE_WIDTH_PX = 15;

// Limites do campo de jogo inteiro (incluindo endzones), em JARDAS, por
// modalidade — o campo de Flag é bem menor (ver FLAG_* em ./constants).
// Convertidos para pixels dentro do componente, já que PIXELS_PER_YARD é
// fixo entre os dois modos.
const FIELD_BOUNDS_YARDS_BY_MODE = {
  tackle: { maxX: FIELD_LENGTH_YARDS, maxY: FIELD_WIDTH_YARDS },
  flag5x5: { maxX: FLAG_FIELD_LENGTH_YARDS, maxY: FLAG_FIELD_WIDTH_YARDS },
} as const;

// Tamanho da célula do grid de "snap", em pixels — 1/4 de jarda. Fino o
// bastante para não travar o posicionamento, mas ainda dá aquela sensação
// de encaixe ao arrastar.
const GRID_SIZE = PIXELS_PER_YARD * 0.25;

/** Arredonda uma posição em pixels para o ponto de grid mais próximo. */
const snapToGrid = (pos: { x: number; y: number }) => {
  return {
    x: Math.round(pos.x / GRID_SIZE) * GRID_SIZE,
    y: Math.round(pos.y / GRID_SIZE) * GRID_SIZE,
  };
};

// Mesma lógica do dragBoundFunc acima: não dependem de props/estado do
// jogador, então vivem fora do componente para manter uma referência
// estável entre renders.
function handleMouseEnter() {
  document.body.style.cursor = 'pointer';
}

function handleMouseLeave() {
  document.body.style.cursor = 'default';
}

interface PlayerNodeProps {
  player: Player;
  /** Só arrastável no modo 'move' — em 'route'/'block' o clique no jogador
   * inicia o desenho de uma linha em vez de mover o nó (ver Field.tsx). */
  draggable: boolean;
}

/**
 * Nó gráfico de um jogador: círculo colorido por time + sigla da posição.
 * A posição é lida da store em JARDAS e convertida para pixels apenas aqui,
 * na borda de renderização — o resto do app nunca pensa em pixels.
 *
 * `memo`'d porque Field.tsx re-renderiza (via Zustand) a cada mousemove
 * durante um desenho — sem isso, os 22 jogadores reexecutariam a função de
 * render inteira a cada frame só porque o componente-pai renderizou de
 * novo, mesmo com `player`/`draggable` inalterados.
 */
export const PlayerNode = memo(function PlayerNode({ player, draggable }: PlayerNodeProps) {
  const gameMode = useFieldStore((state) => state.gameMode);
  const updatePlayerPosition = useFieldStore((state) => state.updatePlayerPosition);
  const updatePlayerLabel = useFieldStore((state) => state.updatePlayerLabel);

  const radiusPx = PLAYER_RADIUS_YARDS * PIXELS_PER_YARD;

  const fieldBoundsYards = FIELD_BOUNDS_YARDS_BY_MODE[gameMode];
  const fieldBoundsPx = useMemo(
    () => ({
      maxX: fieldBoundsYards.maxX * PIXELS_PER_YARD,
      maxY: fieldBoundsYards.maxY * PIXELS_PER_YARD,
    }),
    [fieldBoundsYards.maxX, fieldBoundsYards.maxY],
  );

  // Restringe a posição já durante o arraste (não só ao soltar), para que o
  // jogador nunca visualmente escape do campo em nenhum frame intermediário
  // — e então encaixa no grid de 1/4 de jarda. Clamp primeiro, snap depois:
  // assim o limite do campo continua valendo mesmo perto das bordas.
  // Memoizado por `fieldBoundsPx` (só muda quando gameMode muda, não a cada
  // render) pra preservar a mesma otimização de referência estável que a
  // versão hoisted anterior tinha — antes de existir Flag 5x5 os limites
  // eram sempre os mesmos, então a função vivia fora do componente; agora
  // dependem da modalidade ativa.
  const dragBoundFunc = useCallback(
    (pos: { x: number; y: number }) =>
      snapToGrid({
        x: clamp(pos.x, 0, fieldBoundsPx.maxX),
        y: clamp(pos.y, 0, fieldBoundsPx.maxY),
      }),
    [fieldBoundsPx.maxX, fieldBoundsPx.maxY],
  );

  // handleMouseEnter/handleMouseLeave escrevem direto em document.body —
  // fora do controle do React. Hoje os 22 jogadores nunca desmontam de
  // verdade (formações só reposicionam), mas se algum dia um Group
  // desmontar enquanto o mouse ainda estiver sobre ele, handleMouseLeave
  // nunca dispararia e o cursor 'pointer' ficaria preso pra sempre. Este
  // cleanup é a rede de segurança pra esse cenário.
  useEffect(() => {
    return () => {
      document.body.style.cursor = 'default';
    };
  }, []);

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const xPx = e.target.x();
      const yPx = e.target.y();

      // Pixels -> jardas reais, com clamp de segurança (limites da
      // modalidade ativa) independente do dragBoundFunc já ter restringido
      // o arraste em si.
      const xYards = clamp(xPx / PIXELS_PER_YARD, 0, fieldBoundsYards.maxX);
      const yYards = clamp(yPx / PIXELS_PER_YARD, 0, fieldBoundsYards.maxY);

      updatePlayerPosition(player.id, xYards, yYards);
    },
    [player.id, updatePlayerPosition, fieldBoundsYards.maxX, fieldBoundsYards.maxY],
  );

  // Duplo-clique renomeia a sigla via prompt nativo — mas só faz sentido no
  // modo 'move' (draggable=true). Em qualquer modo de desenho, o usuário
  // naturalmente termina uma rota/bloqueio/motion dando duplo-clique NO
  // jogador de destino: se interceptássemos aqui incondicionalmente, esse
  // duplo-clique nunca chegaria ao Stage e finishDrawing() nunca rodaria,
  // deixando o desenho travado "em andamento" pra sempre. Por isso só
  // cancela o bubbling (e abre o prompt) quando não há desenho possível.
  const handleDblClick = useCallback(
    // Serve 'dblclick' (mouse) E 'dbltap' (toque) — o Konva não sintetiza um
    // a partir do outro, então sem o dbltap renomear era impossível no
    // celular. Não lê nenhuma propriedade nativa do evento além de
    // cancelBubble, por isso o mesmo handler atende os dois.
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (!draggable) return;

      e.cancelBubble = true;

      const newLabel = window.prompt('Nova sigla (máx 3 letras):', player.label);
      if (newLabel === null) return; // usuário cancelou o prompt

      const trimmedLabel = newLabel.trim().substring(0, 3).toUpperCase();
      if (!trimmedLabel) return; // confirmado em branco — não faz sentido aplicar

      updatePlayerLabel(player.id, trimmedLabel);
    },
    [draggable, player.id, player.label, updatePlayerLabel],
  );

  return (
    <Group
      id={player.id}
      x={player.x * PIXELS_PER_YARD}
      y={player.y * PIXELS_PER_YARD}
      draggable={draggable}
      dragBoundFunc={dragBoundFunc}
      onDragEnd={handleDragEnd}
      onDblClick={handleDblClick}
      onDblTap={handleDblClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Circle
        radius={radiusPx}
        fill={TEAM_COLORS[player.team]}
        stroke={LABEL_WHITE}
        strokeWidth={PLAYER_STROKE_WIDTH_PX}
        hitStrokeWidth={PLAYER_HIT_STROKE_WIDTH_PX}
      />
      <Text
        text={player.label}
        width={radiusPx * 2}
        height={radiusPx * 2}
        offsetX={radiusPx}
        offsetY={radiusPx}
        align="center"
        verticalAlign="middle"
        fontSize={radiusPx * 0.9}
        fontStyle="bold"
        fontFamily="Arial, sans-serif"
        fill={LABEL_WHITE}
        listening={false}
      />
    </Group>
  );
});
