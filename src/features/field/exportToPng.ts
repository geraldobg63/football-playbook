import { useFieldStore } from '../../store/useFieldStore';
import { PIXELS_PER_YARD } from '../../utils/constants';
import { getFieldCanvasSizePx } from './constants';
import { stageRef } from './stageRef';

// pixelRatio 3x sobre um canvas 10px/jarda dá ~300 DPI num campo impresso
// em tamanho de pôster — o canvas em tela é 1:1, então exportar sem
// escalar geraria serrilhado visível na impressão.
const EXPORT_PIXEL_RATIO = 3;

// Tempo para o React/Konva repintarem sem os handles de edição antes da
// captura (ver `isExporting` em useFieldStore) — um `setTimeout` garante
// que rodamos depois do próximo ciclo de renderização, mesmo com o
// batching automático do React 18+.
const HIDE_EDIT_UI_DELAY_MS = 50;

// Marcas diacríticas combinantes (categoria Unicode "Mn"), o que sobra de
// um "ã" depois de normalizar para NFD ("a" + til combinante).
const DIACRITIC_MARKS_REGEX = /\p{Mn}/gu;

function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITIC_MARKS_REGEX, '') // remove acentos (ex.: "ã" -> "a")
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function buildFileName(): string {
  const { activePlayName } = useFieldStore.getState();
  return activePlayName ? `playbook-${slugify(activePlayName)}.png` : 'playbook-export.png';
}

function triggerDownload(dataUrl: string, fileName: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exporta o campo atual (Stage do Konva) como PNG de alta resolução,
 * pronto para impressão. Três armadilhas contornadas aqui:
 *
 * 1) O canvas em tela é 1:1 — exportar sem escalar gera serrilhado ao
 *    imprimir. `pixelRatio: 3` resolve em ~300 DPI.
 * 2) Os handles de edição das curvas precisam sumir ANTES da captura, ou
 *    aparecem no PNG final. Por isso ligamos `isExporting`, esperamos o
 *    React/Konva repintarem sem eles, só então chamamos `toDataURL`.
 * 3) Com o Modo Foco, o Stage pode estar exibido menor (ou maior) que o
 *    tamanho nativo do campo (ver stageScale em Field.tsx) — toDataURL()
 *    usa o width/height ATUAL do Stage como base do pixelRatio, então
 *    exportar sem corrigir isso geraria um PNG na resolução do zoom da
 *    tela, não em qualidade de impressão. Por isso o Stage é forçado de
 *    volta pro tamanho/escala nativos só durante a captura, e restaurado
 *    logo em seguida — o próximo render do React (via as props
 *    width/height/scaleX/scaleY de Field.tsx) reconcilia de volta pro
 *    tamanho responsivo atual de qualquer jeito, então a restauração
 *    manual aqui é só pra não deixar o campo "pulando" visualmente entre
 *    o clique em Exportar e o próximo re-render.
 */
export async function exportFieldToPng(): Promise<void> {
  const stage = stageRef.current;
  if (!stage) return;

  const { setIsExporting } = useFieldStore.getState();

  setIsExporting(true);
  await new Promise((resolve) => setTimeout(resolve, HIDE_EDIT_UI_DELAY_MS));

  const previousWidth = stage.width();
  const previousHeight = stage.height();
  const previousScale = stage.scale() ?? { x: 1, y: 1 };
  const previousPosition = stage.position() ?? { x: 0, y: 0 };

  // Tamanho NATIVO do campo (mesmo cálculo de Field.tsx) pra modalidade
  // ATUAL — usado só pra forçar o Stage de volta pra essa resolução na hora
  // de exportar, já que Modo Foco/pan/zoom podem ter escalado, deslocado
  // (position) e reposicionado o Stage em tela. Sem resetar escala=1,
  // posição=(0,0) e tamanho nativo, o PNG sairia na resolução do zoom atual
  // e recortado pela região que estivesse visível (pan) em vez do campo
  // inteiro em qualidade de impressão.
  const { gameMode } = useFieldStore.getState();
  const { widthPx, heightPx } = getFieldCanvasSizePx(gameMode, PIXELS_PER_YARD);
  stage.width(widthPx);
  stage.height(heightPx);
  stage.scale({ x: 1, y: 1 });
  stage.position({ x: 0, y: 0 });
  stage.batchDraw();

  try {
    const dataUrl = stage.toDataURL({ pixelRatio: EXPORT_PIXEL_RATIO, mimeType: 'image/png' });
    triggerDownload(dataUrl, buildFileName());
  } finally {
    stage.width(previousWidth);
    stage.height(previousHeight);
    stage.scale(previousScale);
    stage.position(previousPosition);
    stage.batchDraw();
    setIsExporting(false);
  }
}
