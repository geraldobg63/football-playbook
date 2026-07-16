import type { Player } from './useFieldStore';
import { FIELD_WIDTH_YARDS } from '../features/field/constants';

/**
 * Formação inicial: ataque pro-style (I-formation) alinhado contra uma
 * defesa base 4-3, com a linha de scrimmage na jarda 50 do campo de jogo.
 * Em coordenadas absolutas do campo inteiro isso é x = 60 (10 jd de endzone
 * + 50 jd de jogo). Todas as posições abaixo são jardas reais (0-120 no
 * eixo X, 0-53,33 no eixo Y) — a conversão para pixels acontece só na
 * renderização (PlayerNode), nunca aqui.
 */
const SCRIMMAGE_X_YARDS = 60;
const FIELD_CENTER_Y_YARDS = FIELD_WIDTH_YARDS / 2; // ≈ 26,667

export function createDefaultFormation(): Player[] {
  return [...createOffense(), ...createDefense()];
}

function createOffense(): Player[] {
  const y = FIELD_CENTER_Y_YARDS;
  const lineX = SCRIMMAGE_X_YARDS - 1; // linha ofensiva 1 jd atrás da bola
  return [
    { id: 'off-lt', label: 'LT', team: 'offense', x: lineX, y: y - 4 },
    { id: 'off-lg', label: 'LG', team: 'offense', x: lineX, y: y - 2 },
    { id: 'off-c', label: 'C', team: 'offense', x: lineX, y },
    { id: 'off-rg', label: 'RG', team: 'offense', x: lineX, y: y + 2 },
    { id: 'off-rt', label: 'RT', team: 'offense', x: lineX, y: y + 4 },
    { id: 'off-te', label: 'TE', team: 'offense', x: lineX, y: y + 6.5 },
    { id: 'off-qb', label: 'QB', team: 'offense', x: SCRIMMAGE_X_YARDS - 3, y },
    { id: 'off-fb', label: 'FB', team: 'offense', x: SCRIMMAGE_X_YARDS - 7, y },
    { id: 'off-tb', label: 'TB', team: 'offense', x: SCRIMMAGE_X_YARDS - 11, y },
    { id: 'off-wr1', label: 'WR', team: 'offense', x: lineX, y: y - 21.667 },
    { id: 'off-wr2', label: 'WR', team: 'offense', x: lineX, y: y + 21.667 },
  ];
}

function createDefense(): Player[] {
  const y = FIELD_CENTER_Y_YARDS;
  const lineX = SCRIMMAGE_X_YARDS + 1; // linha defensiva 1 jd à frente da bola
  return [
    { id: 'def-le', label: 'LE', team: 'defense', x: lineX, y: y - 6 },
    { id: 'def-dt1', label: 'DT', team: 'defense', x: lineX, y: y - 2 },
    { id: 'def-dt2', label: 'DT', team: 'defense', x: lineX, y: y + 2 },
    { id: 'def-re', label: 'RE', team: 'defense', x: lineX, y: y + 6.833 },
    { id: 'def-wlb', label: 'LB', team: 'defense', x: SCRIMMAGE_X_YARDS + 4, y: y - 6 },
    { id: 'def-mlb', label: 'LB', team: 'defense', x: SCRIMMAGE_X_YARDS + 4, y },
    { id: 'def-slb', label: 'LB', team: 'defense', x: SCRIMMAGE_X_YARDS + 4, y: y + 5 },
    { id: 'def-cb1', label: 'CB', team: 'defense', x: lineX, y: y - 21.667 },
    { id: 'def-cb2', label: 'CB', team: 'defense', x: lineX, y: y + 21.667 },
    { id: 'def-fs', label: 'FS', team: 'defense', x: SCRIMMAGE_X_YARDS + 10, y },
    { id: 'def-ss', label: 'SS', team: 'defense', x: SCRIMMAGE_X_YARDS + 6, y: y + 6.833 },
  ];
}
