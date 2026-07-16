import type Konva from 'konva';
import { Circle, Group, Text } from 'react-konva';
import { PIXELS_PER_YARD } from '../../utils/constants';
import { clamp } from '../../utils/math';
import { FIELD_LENGTH_YARDS, FIELD_WIDTH_YARDS } from './constants';
import { useFieldStore, type Player } from '../../store/useFieldStore';

const TEAM_COLORS: Record<Player['team'], string> = {
  offense: '#1e3a8a', // azul escuro
  defense: '#7f1d1d', // vermelho escuro
};

const LABEL_WHITE = '#ffffff';
export const PLAYER_RADIUS_YARDS = 1.5;

// Limites do campo de jogo inteiro (incluindo endzones), em pixels — o
// centro do jogador nunca pode ser arrastado para fora desta caixa.
const FIELD_BOUNDS_PX = {
  maxX: FIELD_LENGTH_YARDS * PIXELS_PER_YARD,
  maxY: FIELD_WIDTH_YARDS * PIXELS_PER_YARD,
};

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
 */
export function PlayerNode({ player, draggable }: PlayerNodeProps) {
  const updatePlayerPosition = useFieldStore((state) => state.updatePlayerPosition);
  const updatePlayerLabel = useFieldStore((state) => state.updatePlayerLabel);

  const radiusPx = PLAYER_RADIUS_YARDS * PIXELS_PER_YARD;

  // Restringe a posição já durante o arraste (não só ao soltar), para que o
  // jogador nunca visualmente escape do campo em nenhum frame intermediário.
  const dragBoundFunc = (pos: { x: number; y: number }) => ({
    x: clamp(pos.x, 0, FIELD_BOUNDS_PX.maxX),
    y: clamp(pos.y, 0, FIELD_BOUNDS_PX.maxY),
  });

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const xPx = e.target.x();
    const yPx = e.target.y();

    // Pixels -> jardas reais, com clamp de segurança (0-120 x, 0-53.33 y)
    // independente do dragBoundFunc já ter restringido o arraste em si.
    const xYards = clamp(xPx / PIXELS_PER_YARD, 0, FIELD_LENGTH_YARDS);
    const yYards = clamp(yPx / PIXELS_PER_YARD, 0, FIELD_WIDTH_YARDS);

    updatePlayerPosition(player.id, xYards, yYards);
  };

  // Duplo-clique renomeia a sigla via prompt nativo. `cancelBubble` evita
  // que o mesmo duplo-clique também suba até o Stage e dispare o
  // finishDrawing() de uma rota em andamento (ver Field.tsx).
  const handleDblClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;

    const newLabel = window.prompt('Nova sigla (máx 3 letras):', player.label);
    if (newLabel === null) return; // usuário cancelou o prompt

    const trimmedLabel = newLabel.trim().substring(0, 3).toUpperCase();
    if (!trimmedLabel) return; // confirmado em branco — não faz sentido aplicar

    updatePlayerLabel(player.id, trimmedLabel);
  };

  const handleMouseEnter = () => {
    document.body.style.cursor = 'pointer';
  };

  const handleMouseLeave = () => {
    document.body.style.cursor = 'default';
  };

  return (
    <Group
      id={player.id}
      x={player.x * PIXELS_PER_YARD}
      y={player.y * PIXELS_PER_YARD}
      draggable={draggable}
      dragBoundFunc={dragBoundFunc}
      onDragEnd={handleDragEnd}
      onDblClick={handleDblClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Circle
        radius={radiusPx}
        fill={TEAM_COLORS[player.team]}
        stroke={LABEL_WHITE}
        strokeWidth={1.5}
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
}
