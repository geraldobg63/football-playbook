import { FIELD_WIDTH_YARDS } from '../features/field/constants';

/**
 * Dicionário matemático de "personnel groupings" — cada formação reposiciona
 * os MESMOS 11 jogadores de um time (mesmos ids/labels de defaultFormation.ts),
 * nunca cria ou remove entidades. Coordenadas em JARDAS reais, ancoradas na
 * jarda 50 do campo de jogo (x = 60, contando os 10 jd de endzone).
 */

export interface FormationPosition {
  /** Deve bater com um Player.id existente (ver store/defaultFormation.ts). */
  playerId: string;
  x: number;
  y: number;
}

const SCRIMMAGE_X_YARDS = 60;
const CENTER_Y_YARDS = FIELD_WIDTH_YARDS / 2; // ≈ 26,667
const OL_X_YARDS = SCRIMMAGE_X_YARDS - 1; // linha ofensiva, 1 jd atrás da bola
const DL_X_YARDS = SCRIMMAGE_X_YARDS + 1; // linha defensiva, 1 jd à frente da bola
const CB_WIDE_Y_OFFSET_YARDS = 21.667; // alinhamento largo padrão dos corners/WRs externos

// A linha ofensiva (5 ids) não muda de formato entre "personnel groupings" —
// só os 6 jogadores restantes (QB + 5 skill) se movem. Exportada porque
// store/defaultFormation.ts reaproveita essas mesmas 5 posições pra montar
// a formação inicial (que, na linha ofensiva, é idêntica ao "Pro Set" — só
// o backfield/recebedores do default divergem intencionalmente).
export function offensiveLine(): FormationPosition[] {
  return [
    { playerId: 'off-lt', x: OL_X_YARDS, y: CENTER_Y_YARDS - 4 },
    { playerId: 'off-lg', x: OL_X_YARDS, y: CENTER_Y_YARDS - 2 },
    { playerId: 'off-c', x: OL_X_YARDS, y: CENTER_Y_YARDS },
    { playerId: 'off-rg', x: OL_X_YARDS, y: CENTER_Y_YARDS + 2 },
    { playerId: 'off-rt', x: OL_X_YARDS, y: CENTER_Y_YARDS + 4 },
  ];
}

export const OFFENSIVE_FORMATIONS: Record<string, FormationPosition[]> = {
  // 21 personnel: QB, 2 RB (FB+TB lado a lado), 1 TE, 2 WR.
  'Pro Set': [
    ...offensiveLine(),
    { playerId: 'off-te', x: OL_X_YARDS, y: CENTER_Y_YARDS + 6.5 },
    { playerId: 'off-qb', x: SCRIMMAGE_X_YARDS - 3, y: CENTER_Y_YARDS },
    { playerId: 'off-fb', x: SCRIMMAGE_X_YARDS - 6, y: CENTER_Y_YARDS - 3 },
    { playerId: 'off-tb', x: SCRIMMAGE_X_YARDS - 6, y: CENTER_Y_YARDS + 3 },
    { playerId: 'off-wr1', x: SCRIMMAGE_X_YARDS, y: CENTER_Y_YARDS - CB_WIDE_Y_OFFSET_YARDS },
    { playerId: 'off-wr2', x: SCRIMMAGE_X_YARDS, y: CENTER_Y_YARDS + CB_WIDE_Y_OFFSET_YARDS },
  ],
  // 10 personnel: QB, 1 RB, 4 WR (sem TE) — TE e FB reaproveitados como
  // receptores extras nos slots para fechar os dois "2x2".
  'Spread / 2x2': [
    ...offensiveLine(),
    { playerId: 'off-qb', x: SCRIMMAGE_X_YARDS - 5, y: CENTER_Y_YARDS },
    { playerId: 'off-tb', x: SCRIMMAGE_X_YARDS - 5, y: CENTER_Y_YARDS - 3 },
    { playerId: 'off-wr1', x: SCRIMMAGE_X_YARDS, y: CENTER_Y_YARDS - 24 },
    { playerId: 'off-te', x: SCRIMMAGE_X_YARDS, y: CENTER_Y_YARDS - 15 },
    { playerId: 'off-fb', x: SCRIMMAGE_X_YARDS, y: CENTER_Y_YARDS + 15 },
    { playerId: 'off-wr2', x: SCRIMMAGE_X_YARDS, y: CENTER_Y_YARDS + 24 },
  ],
  // 11 personnel: QB, 1 RB, 1 TE, 3 WR — trio de recebedores do lado forte
  // (TB reaproveitado como o slot mais interno do trio).
  'Trips Right': [
    ...offensiveLine(),
    { playerId: 'off-te', x: OL_X_YARDS, y: CENTER_Y_YARDS - 6.5 },
    { playerId: 'off-qb', x: SCRIMMAGE_X_YARDS - 3, y: CENTER_Y_YARDS },
    { playerId: 'off-fb', x: SCRIMMAGE_X_YARDS - 6, y: CENTER_Y_YARDS },
    { playerId: 'off-tb', x: OL_X_YARDS, y: CENTER_Y_YARDS + 9 },
    { playerId: 'off-wr2', x: SCRIMMAGE_X_YARDS, y: CENTER_Y_YARDS + 16 },
    { playerId: 'off-wr1', x: SCRIMMAGE_X_YARDS, y: CENTER_Y_YARDS + 24 },
  ],
  // 5 WR espalhados, QB sozinho em shotgun — TE/FB/TB viram receptores.
  Empty: [
    ...offensiveLine(),
    { playerId: 'off-qb', x: SCRIMMAGE_X_YARDS - 5, y: CENTER_Y_YARDS },
    { playerId: 'off-te', x: SCRIMMAGE_X_YARDS, y: CENTER_Y_YARDS - 24 },
    { playerId: 'off-wr1', x: SCRIMMAGE_X_YARDS, y: CENTER_Y_YARDS - 14 },
    { playerId: 'off-fb', x: SCRIMMAGE_X_YARDS, y: CENTER_Y_YARDS + 9 },
    { playerId: 'off-tb', x: SCRIMMAGE_X_YARDS, y: CENTER_Y_YARDS + 17 },
    { playerId: 'off-wr2', x: SCRIMMAGE_X_YARDS, y: CENTER_Y_YARDS + 25 },
  ],
};

export const DEFENSIVE_FORMATIONS: Record<string, FormationPosition[]> = {
  // 4 linha, 3 backers, 2 safeties bem abertos (metades rasas do Cover 2).
  '4-3 Base (Cover 2)': [
    { playerId: 'def-le', x: DL_X_YARDS, y: CENTER_Y_YARDS - 6 },
    { playerId: 'def-dt1', x: DL_X_YARDS, y: CENTER_Y_YARDS - 2 },
    { playerId: 'def-dt2', x: DL_X_YARDS, y: CENTER_Y_YARDS + 2 },
    { playerId: 'def-re', x: DL_X_YARDS, y: CENTER_Y_YARDS + 6.5 },
    { playerId: 'def-wlb', x: SCRIMMAGE_X_YARDS + 4, y: CENTER_Y_YARDS - 6 },
    { playerId: 'def-mlb', x: SCRIMMAGE_X_YARDS + 4, y: CENTER_Y_YARDS },
    { playerId: 'def-slb', x: SCRIMMAGE_X_YARDS + 4, y: CENTER_Y_YARDS + 5 },
    { playerId: 'def-cb1', x: DL_X_YARDS, y: CENTER_Y_YARDS - CB_WIDE_Y_OFFSET_YARDS },
    { playerId: 'def-cb2', x: DL_X_YARDS, y: CENTER_Y_YARDS + CB_WIDE_Y_OFFSET_YARDS },
    { playerId: 'def-fs', x: SCRIMMAGE_X_YARDS + 12, y: CENTER_Y_YARDS - 12 },
    { playerId: 'def-ss', x: SCRIMMAGE_X_YARDS + 12, y: CENTER_Y_YARDS + 12 },
  ],
  // 3 linha (alinhados como 5-tech/nose), 4 backers (DT2 sobe pra fora),
  // 1 safety único e profundo no meio (Cover 3).
  '3-4 Base (Cover 3)': [
    { playerId: 'def-le', x: DL_X_YARDS, y: CENTER_Y_YARDS - 8 },
    { playerId: 'def-dt1', x: DL_X_YARDS, y: CENTER_Y_YARDS - 1 },
    { playerId: 'def-re', x: DL_X_YARDS, y: CENTER_Y_YARDS + 8 },
    { playerId: 'def-dt2', x: SCRIMMAGE_X_YARDS + 4, y: CENTER_Y_YARDS - 11 },
    { playerId: 'def-wlb', x: SCRIMMAGE_X_YARDS + 4, y: CENTER_Y_YARDS - 4 },
    { playerId: 'def-mlb', x: SCRIMMAGE_X_YARDS + 4, y: CENTER_Y_YARDS + 2 },
    { playerId: 'def-slb', x: SCRIMMAGE_X_YARDS + 4, y: CENTER_Y_YARDS + 11 },
    { playerId: 'def-cb1', x: DL_X_YARDS, y: CENTER_Y_YARDS - CB_WIDE_Y_OFFSET_YARDS },
    { playerId: 'def-cb2', x: DL_X_YARDS, y: CENTER_Y_YARDS + CB_WIDE_Y_OFFSET_YARDS },
    { playerId: 'def-fs', x: SCRIMMAGE_X_YARDS + 14, y: CENTER_Y_YARDS },
    { playerId: 'def-ss', x: SCRIMMAGE_X_YARDS + 6, y: CENTER_Y_YARDS + 8 },
  ],
  // 4 linha, 2 backers, +1 corner de slot (SLB reaproveitado) — 5 DBs no
  // total, safety único e profundo (Cover 1 / man-free).
  'Nickel 4-2-5 (Cover 1)': [
    { playerId: 'def-le', x: DL_X_YARDS, y: CENTER_Y_YARDS - 6 },
    { playerId: 'def-dt1', x: DL_X_YARDS, y: CENTER_Y_YARDS - 2 },
    { playerId: 'def-dt2', x: DL_X_YARDS, y: CENTER_Y_YARDS + 2 },
    { playerId: 'def-re', x: DL_X_YARDS, y: CENTER_Y_YARDS + 6.5 },
    { playerId: 'def-wlb', x: SCRIMMAGE_X_YARDS + 4, y: CENTER_Y_YARDS - 3 },
    { playerId: 'def-mlb', x: SCRIMMAGE_X_YARDS + 4, y: CENTER_Y_YARDS + 3 },
    { playerId: 'def-slb', x: DL_X_YARDS, y: CENTER_Y_YARDS + 16 },
    { playerId: 'def-cb1', x: DL_X_YARDS, y: CENTER_Y_YARDS - CB_WIDE_Y_OFFSET_YARDS },
    { playerId: 'def-cb2', x: DL_X_YARDS, y: CENTER_Y_YARDS + CB_WIDE_Y_OFFSET_YARDS },
    { playerId: 'def-fs', x: SCRIMMAGE_X_YARDS + 14, y: CENTER_Y_YARDS },
    { playerId: 'def-ss', x: SCRIMMAGE_X_YARDS + 4, y: CENTER_Y_YARDS + 11 },
  ],
  // 4 linha, 1 backer blitzando colado na linha, +2 dime backs (WLB/SLB
  // reaproveitados) — 6 DBs no total, dupla profundidade atrás do blitz.
  'Dime 4-1-6 (Blitz)': [
    { playerId: 'def-le', x: DL_X_YARDS, y: CENTER_Y_YARDS - 6 },
    { playerId: 'def-dt1', x: DL_X_YARDS, y: CENTER_Y_YARDS - 2 },
    { playerId: 'def-dt2', x: DL_X_YARDS, y: CENTER_Y_YARDS + 2 },
    { playerId: 'def-re', x: DL_X_YARDS, y: CENTER_Y_YARDS + 6.5 },
    { playerId: 'def-mlb', x: SCRIMMAGE_X_YARDS + 2, y: CENTER_Y_YARDS },
    { playerId: 'def-wlb', x: DL_X_YARDS, y: CENTER_Y_YARDS - 14 },
    { playerId: 'def-slb', x: DL_X_YARDS, y: CENTER_Y_YARDS + 14 },
    { playerId: 'def-cb1', x: DL_X_YARDS, y: CENTER_Y_YARDS - CB_WIDE_Y_OFFSET_YARDS },
    { playerId: 'def-cb2', x: DL_X_YARDS, y: CENTER_Y_YARDS + CB_WIDE_Y_OFFSET_YARDS },
    { playerId: 'def-fs', x: SCRIMMAGE_X_YARDS + 12, y: CENTER_Y_YARDS - 5 },
    { playerId: 'def-ss', x: SCRIMMAGE_X_YARDS + 12, y: CENTER_Y_YARDS + 5 },
  ],
};
