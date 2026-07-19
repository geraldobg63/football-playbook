import type { FieldRule } from '../../utils/constants';

/**
 * Constantes matemáticas do campo de futebol americano.
 *
 * Todas as distâncias vivem em JARDAS (a unidade nativa do esporte) e só são
 * convertidas para pixels no momento do desenho, via PIXELS_PER_YARD (em
 * utils/constants.ts — é global porque futuras entidades, como jogadores,
 * também precisam dela). Isso separa a fonte da verdade dimensional (regras
 * do esporte) da escala visual, permitindo re-escalar o campo inteiro (zoom,
 * telas diferentes) sem tocar em nenhuma regra geométrica.
 */

// --- Dimensões oficiais do campo (em jardas) -----------------------------

// Zona de ataque (endzone) em cada extremidade do campo.
export const ENDZONE_LENGTH_YARDS = 10;

// Área de jogo entre as duas goal lines.
export const PLAYING_FIELD_LENGTH_YARDS = 100;

// Comprimento total = 100 jd de jogo + 10 jd de endzone em cada ponta.
export const FIELD_LENGTH_YARDS =
  PLAYING_FIELD_LENGTH_YARDS + ENDZONE_LENGTH_YARDS * 2; // 120

// Largura oficial = 53 jardas e 1/3 (160 pés ÷ 3).
export const FIELD_WIDTH_YARDS = 160 / 3; // 53.333...

// --- Marcações de jarda ----------------------------------------------------

// Linhas de jarda "cheias" (goal line a goal line) a cada 5 jardas.
export const YARD_LINE_INTERVAL_YARDS = 5;

// Números pintados a cada 10 jardas.
export const YARD_NUMBER_INTERVAL_YARDS = 10;

// Distância da linha lateral até a base dos números (regra oficial NFL).
export const YARD_NUMBER_INSET_FROM_SIDELINE_YARDS = 9;

// --- Hash marks --------------------------------------------------------

// Distância de cada linha lateral até a fileira de hash marks, em jardas.
// Varia por regra de campo — a regra ativa vem do useFieldStore e seleciona
// a entrada correspondente deste mapa em tempo de renderização:
//  - NFL: 23,58 jd (70 pés e 9 pol da lateral)
//  - NCAA: 20,00 jd (60 pés da lateral)
//  - High School (NFHS): 17,77 jd (53 pés e 4 pol da lateral)
export const HASH_MARK_INSET_YARDS_BY_RULE: Record<FieldRule, number> = {
  NFL: 23.58,
  NCAA: 20.0,
  HIGHSCHOOL: 17.77,
};

// Hash marks são desenhadas a cada 1 jarda ao longo de todo o campo de jogo.
export const HASH_MARK_INTERVAL_YARDS = 1;

// >>> AJUSTE AQUI o comprimento visual (largura) de cada hash mark <<<
// O valor oficial é bem curto (2 pés ≈ 0,667 jd). Usamos 1 jd para que a
// marcação continue legível na escala padrão de 10px/jarda; aumente ou
// diminua este número para engrossar/afinar as marcas no desenho.
export const HASH_MARK_LENGTH_YARDS = 1;

// --- Flag 5x5 (campo simplificado) ---------------------------------------
// Malha: 10 (Left Endzone) + 60 (área de jogo) + 10 (Right Endzone) = 80 de
// comprimento total, por 35 de largura. Mais estreito e curto que o campo
// de Tackle, mas com marcação de linhas/números a cada 10 unidades (ver
// FlagYardLines/FlagYardNumbers em FieldGeometry.tsx) — só sem hash marks.
export const FLAG_FIELD_WIDTH_YARDS = 35;
export const FLAG_ENDZONE_LENGTH_YARDS = 10;
export const FLAG_PLAYING_FIELD_LENGTH_YARDS = 60;
export const FLAG_FIELD_LENGTH_YARDS =
  FLAG_PLAYING_FIELD_LENGTH_YARDS + FLAG_ENDZONE_LENGTH_YARDS * 2; // 80

// Linhas verticais cheias a cada 10 unidades — mesma cadência da numeração
// (ver FlagYardNumbers), diferente do Tackle onde linha (5 jd) e número
// (10 jd) têm intervalos distintos.
export const FLAG_YARD_LINE_INTERVAL_YARDS = 10;

// Distância da linha lateral até a base dos números — proporcional ao
// mesmo afastamento do Tackle (9 jd num campo de 53,33 jd de largura,
// ~17% da largura), aplicado aos 35 jd do campo de Flag.
export const FLAG_YARD_NUMBER_INSET_FROM_SIDELINE_YARDS = 6;

// Tipo inline (em vez de importar GameMode de store/useFieldStore.ts) só
// pra evitar uma dependência de módulo cruzada nova neste arquivo de
// constantes — estruturalmente idêntico ao GameMode de verdade, então
// qualquer valor `Play['gameMode']` passa aqui sem conversão.
type FieldGameMode = 'tackle' | 'flag5x5';

/** Tamanho nativo (pixels, resolução de impressão) do canvas de captura de
 * uma jogada, por modalidade — usado tanto pelo export individual
 * (exportToPng.ts) quanto pelo em lote (BatchExportStage.tsx/
 * exportPlaysToPdf.ts). O campo de Flag 5x5 é bem menor que o de Tackle:
 * capturar uma jogada de Flag num canvas do tamanho do Tackle deixaria os
 * jogadores amontoados num canto, com o resto do canvas vazio. */
export function getFieldCanvasSizePx(
  gameMode: FieldGameMode,
  pixelsPerYard: number,
): { widthPx: number; heightPx: number } {
  return gameMode === 'flag5x5'
    ? { widthPx: FLAG_FIELD_LENGTH_YARDS * pixelsPerYard, heightPx: FLAG_FIELD_WIDTH_YARDS * pixelsPerYard }
    : { widthPx: FIELD_LENGTH_YARDS * pixelsPerYard, heightPx: FIELD_WIDTH_YARDS * pixelsPerYard };
}
