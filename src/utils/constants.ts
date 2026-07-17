/**
 * Constantes verdadeiramente globais — usadas pelo campo hoje e por
 * qualquer entidade futura (jogadores, rotas) que precise converter
 * posições do mundo (jardas) para coordenadas de desenho (pixels). Por
 * isso vivem fora de features/field: não são uma preocupação exclusiva
 * do campo.
 */

// Escala base: quantos pixels representam 1 jarda. O aumento pra 13 (30%
// acima do original 10) ficou largo demais para o layout de 3 colunas
// (sidebar esquerda + campo + FieldControls direita) — reduzida ~15% para
// 11, um meio-termo entre o tamanho original e aquele aumento. Como é a
// única fonte de verdade da escala (Field.tsx, PlayerNode.tsx,
// AssignmentsLayer.tsx e exportToPng.ts leem só daqui), o Stage do Konva e
// tudo dentro dele reescala proporcionalmente sem tocar em mais nada.
export const PIXELS_PER_YARD = 11;

// Regras de campo suportadas. A regra ativa (ver store/useFieldStore.ts)
// determina dimensões que variam por competição, como o afastamento das
// hash marks em relação às linhas laterais.
export type FieldRule = 'NFL' | 'NCAA' | 'HIGHSCHOOL';
