import type Konva from 'konva';

/**
 * Referência mutável e compartilhada para a instância do Konva Stage.
 * Field.tsx é o único lugar que a escreve (a partir do seu próprio
 * useRef, sincronizado no mount); qualquer outro componente fora da
 * árvore do campo (ex.: o botão de exportar PNG na toolbar) só a lê.
 * Isso evita prop drilling ou Context para algo puramente imperativo que
 * nunca precisa disparar um re-render.
 */
export const stageRef: { current: Konva.Stage | null } = { current: null };
