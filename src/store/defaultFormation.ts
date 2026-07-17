import type { Player } from './useFieldStore';
import { FIELD_WIDTH_YARDS } from '../features/field/constants';
import { offensiveLine } from '../utils/formations';

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

// Rótulos/times dos 5 da linha ofensiva — as COORDENADAS vêm de
// offensiveLine() (utils/formations.ts), a mesma usada pelo "Pro Set", já
// que a linha ofensiva do default É idêntica à do Pro Set. O backfield/
// recebedores abaixo continuam com coordenadas próprias: divergem de
// propósito do "Pro Set" (I-formation clássica em vez de backfield lado a
// lado), então não fazem sentido compartilhados.
const OFFENSIVE_LINE_META: Record<string, { label: string }> = {
  'off-lt': { label: 'LT' },
  'off-lg': { label: 'LG' },
  'off-c': { label: 'C' },
  'off-rg': { label: 'RG' },
  'off-rt': { label: 'RT' },
};

function createOffense(): Player[] {
  const y = FIELD_CENTER_Y_YARDS;
  const lineX = SCRIMMAGE_X_YARDS - 1; // linha ofensiva 1 jd atrás da bola
  const line: Player[] = offensiveLine().map((pos) => ({
    id: pos.playerId,
    label: OFFENSIVE_LINE_META[pos.playerId].label,
    team: 'offense',
    x: pos.x,
    y: pos.y,
  }));
  return [
    ...line,
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
