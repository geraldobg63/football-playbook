/**
 * Constantes verdadeiramente globais — usadas pelo campo hoje e por
 * qualquer entidade futura (jogadores, rotas) que precise converter
 * posições do mundo (jardas) para coordenadas de desenho (pixels). Por
 * isso vivem fora de features/field: não são uma preocupação exclusiva
 * do campo.
 */

// Escala base: quantos pixels representam 1 jarda.
export const PIXELS_PER_YARD = 10;

// Regras de campo suportadas. A regra ativa (ver store/useFieldStore.ts)
// determina dimensões que variam por competição, como o afastamento das
// hash marks em relação às linhas laterais.
export type FieldRule = 'NFL' | 'NCAA' | 'HIGHSCHOOL';
