import { jsPDF } from 'jspdf';
import type Konva from 'konva';
import type { Play } from '../../store/useFieldStore';
import { BATCH_EXPORT_WIDTH_PX, BATCH_EXPORT_HEIGHT_PX } from './BatchExportStage';

const CATEGORY_LABELS: Record<Play['category'], string> = {
  offense: 'Ataque',
  defense: 'Defesa',
  special: 'Times Especiais',
};

// Mesmo pixelRatio do export individual (exportToPng.ts) — ~300 DPI,
// qualidade de impressão.
const EXPORT_PIXEL_RATIO = 3;

// Tempo pro <BatchExportStage> (React + Konva) terminar de montar/desenhar
// a jogada atual antes de capturar — mesma ideia do HIDE_EDIT_UI_DELAY_MS
// em exportToPng.ts, só um pouco maior porque aqui é uma montagem nova do
// Stage a cada jogada, não só uma troca de props num Stage já existente.
const RENDER_SETTLE_DELAY_MS = 120;

const PAGE_MARGIN_MM = 15;
const TITLE_FONT_SIZE_PT = 20;
const SUBTITLE_FONT_SIZE_PT = 12;
const TITLE_TO_IMAGE_GAP_MM = 14;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Desenha uma página do PDF pra uma jogada já capturada como PNG
 * (dataUrl): título centralizado, categoria logo abaixo, e a imagem do
 * campo centralizada ocupando o máximo de espaço possível sem distorcer
 * (mesma lógica de "contain" usada no redimensionamento responsivo do
 * Stage em tela — ver Field.tsx).
 */
function drawPlayPage(doc: jsPDF, play: Play, dataUrl: string): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(TITLE_FONT_SIZE_PT);
  doc.text(play.name, pageWidth / 2, PAGE_MARGIN_MM, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(SUBTITLE_FONT_SIZE_PT);
  doc.text(`Categoria: ${CATEGORY_LABELS[play.category]}`, pageWidth / 2, PAGE_MARGIN_MM + 7, {
    align: 'center',
  });

  const imageTopY = PAGE_MARGIN_MM + TITLE_TO_IMAGE_GAP_MM;
  const availableWidth = pageWidth - PAGE_MARGIN_MM * 2;
  const availableHeight = pageHeight - imageTopY - PAGE_MARGIN_MM;
  const nativeAspectRatio = BATCH_EXPORT_WIDTH_PX / BATCH_EXPORT_HEIGHT_PX;

  let imageWidth = availableWidth;
  let imageHeight = imageWidth / nativeAspectRatio;
  if (imageHeight > availableHeight) {
    imageHeight = availableHeight;
    imageWidth = imageHeight * nativeAspectRatio;
  }
  const imageX = (pageWidth - imageWidth) / 2;
  const imageY = imageTopY + (availableHeight - imageHeight) / 2;

  // 'SLOW' aqui é sobre esforço de compressão, não sobre demora perceptível
  // (o zlib desse tamanho de imagem roda em milissegundos) — sem passar
  // ESSE parâmetro, jsPDF embute o bitmap decodificado CRU, sem nenhuma
  // compressão: confirmado testando manualmente que uma única página assim
  // pesava ~20MB (bate quase exato com largura*altura*3 bytes RGB sem
  // compressão nenhuma). Com 'SLOW', a mesma imagem caiu pra ~70KB — a
  // diferença entre um PDF de 3 jogadas pesar ~200KB ou ~60MB.
  doc.addImage(dataUrl, 'PNG', imageX, imageY, imageWidth, imageHeight, undefined, 'SLOW');
}

/**
 * Exporta uma lista de jogadas pra um único PDF, uma por página. Usa o
 * <BatchExportStage> (fora da tela) pra capturar cada jogada: seta a
 * jogada atual via `setCurrentExportPlay`, espera o Stage renderizar,
 * captura com stage.toDataURL() (nativo do Konva — mesma técnica já
 * validada em exportToPng.ts, sem precisar de html2canvas: o conteúdo já
 * É um canvas, recapturá-lo via DOM/CSS só adicionaria uma camada mais
 * lenta e com qualidade pior pro mesmo resultado).
 *
 * Processa sequencialmente (uma jogada de cada vez, não em paralelo) de
 * propósito: só existe UM <BatchExportStage> off-screen compartilhado,
 * então rodar em paralelo faria as jogadas pisarem uma na renderização da
 * outra.
 */
export async function exportPlaysToPdf(
  plays: Play[],
  setCurrentExportPlay: (play: Play | null) => void,
  stageRef: React.RefObject<Konva.Stage | null>,
  onProgress?: (completed: number, total: number) => void,
): Promise<void> {
  if (plays.length === 0) return;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  try {
    for (let i = 0; i < plays.length; i++) {
      const play = plays[i];
      setCurrentExportPlay(play);
      await wait(RENDER_SETTLE_DELAY_MS);

      const stage = stageRef.current;
      if (!stage) continue; // defensivo — não deveria acontecer com o delay acima

      const dataUrl = stage.toDataURL({ pixelRatio: EXPORT_PIXEL_RATIO, mimeType: 'image/png' });

      if (i > 0) doc.addPage();
      drawPlayPage(doc, play, dataUrl);

      onProgress?.(i + 1, plays.length);
    }

    doc.save(`playbook-jogadas-selecionadas-${Date.now()}.pdf`);
  } finally {
    setCurrentExportPlay(null);
  }
}
