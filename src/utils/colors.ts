/**
 * Tokens semânticos de cor tática (Sideline Survival / auditoria A3) — fonte
 * ÚNICA das cores de time usadas no motor gráfico. Antes espalhadas como hex
 * soltos em PlayerNode, AssignmentsLayer e nos rótulos de FieldControls, com
 * matizes divergentes ("ataque" era azul-300 no rótulo, navy na peça); aqui
 * centralizadas pra que cada time signifique a MESMA cor em todo lugar.
 *
 * Convenção da taxonomia:
 *  - FILL: preenchimento das PEÇAS (círculo do jogador em PlayerNode).
 *  - PATH: VETORES desenhados (rotas/bloqueios/motions/zonas em
 *    AssignmentsLayer).
 *
 * O ataque separa FILL (azul) de PATH (amarelo) de propósito — convenção de
 * prancheta: a peça e a rota que ela corre precisam ser distinguíveis à
 * primeira vista. A defesa usa o mesmo vermelho vivo pros dois (peça e
 * cobertura), já que zonas/vetores defensivos são lidos como um bloco só.
 * Todos escolhidos vivos e saturados pra alto contraste sob luz solar.
 */
export const COLOR_OFFENSE_FILL = '#2563eb'; // azul royal (blue-600)
export const COLOR_OFFENSE_PATH = '#eab308'; // amarelo vivo (yellow-500)
export const COLOR_DEFENSE_FILL = '#ef4444'; // vermelho vivo (red-500)
export const COLOR_DEFENSE_PATH = '#ef4444'; // vermelho vivo (red-500)
