import type Konva from 'konva';
import { Stage, Layer } from 'react-konva';
import type { Play } from '../../store/useFieldStore';
import { PIXELS_PER_YARD } from '../../utils/constants';
import { FieldGeometry } from '../field/FieldGeometry';
import { PlayerNode } from '../field/PlayerNode';
import { AssignmentsLayer } from '../field/AssignmentsLayer';
import { getFieldCanvasSizePx } from '../field/constants';

interface BatchExportStageProps {
  /** Jogada sendo capturada agora, ou null quando nenhuma exportação está
   * em andamento (nada é renderizado nesse caso). */
  play: Play | null;
  stageRef: React.RefObject<Konva.Stage | null>;
}

/**
 * Stage do Konva paralelo e invisível, usado só pela exportação em lote
 * (exportPlaysToPdf.ts) — renderiza uma `Play` ARBITRÁRIA (não o estado ao
 * vivo do Zustand) reaproveitando os mesmos componentes visuais do editor
 * (FieldGeometry/PlayerNode/AssignmentsLayer), então o PDF sai idêntico ao
 * que o treinador vê em tela. Fica fora da viewport (não `display:none`,
 * que zeraria as dimensões do canvas) pra nunca aparecer nem interferir na
 * jogada que o usuário está editando na tela principal.
 */
export function BatchExportStage({ play, stageRef }: BatchExportStageProps) {
  if (!play) return null;

  const { widthPx, heightPx } = getFieldCanvasSizePx(play.gameMode, PIXELS_PER_YARD);

  return (
    <div
      aria-hidden="true"
      style={{ position: 'fixed', top: 0, left: '-99999px', pointerEvents: 'none' }}
    >
      <Stage ref={stageRef} width={widthPx} height={heightPx}>
        <FieldGeometry pixelsPerYard={PIXELS_PER_YARD} fieldRule={play.fieldRule} gameMode={play.gameMode} />
        <Layer>
          {play.players.map((player) => (
            <PlayerNode key={player.id} player={player} draggable={false} />
          ))}
        </Layer>
        <AssignmentsLayer
          assignments={play.assignments}
          players={play.players}
          activeDrawingId={null}
          isEraseMode={false}
        />
      </Stage>
    </div>
  );
}
