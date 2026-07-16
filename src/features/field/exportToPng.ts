import { useFieldStore } from '../../store/useFieldStore';
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
 * pronto para impressão. Duas armadilhas contornadas aqui:
 *
 * 1) O canvas em tela é 1:1 — exportar sem escalar gera serrilhado ao
 *    imprimir. `pixelRatio: 3` resolve em ~300 DPI.
 * 2) Os handles de edição das curvas precisam sumir ANTES da captura, ou
 *    aparecem no PNG final. Por isso ligamos `isExporting`, esperamos o
 *    React/Konva repintarem sem eles, só então chamamos `toDataURL`.
 */
export async function exportFieldToPng(): Promise<void> {
  const stage = stageRef.current;
  if (!stage) return;

  const { setIsExporting } = useFieldStore.getState();

  setIsExporting(true);
  await new Promise((resolve) => setTimeout(resolve, HIDE_EDIT_UI_DELAY_MS));

  try {
    const dataUrl = stage.toDataURL({ pixelRatio: EXPORT_PIXEL_RATIO, mimeType: 'image/png' });
    triggerDownload(dataUrl, buildFileName());
  } finally {
    setIsExporting(false);
  }
}
