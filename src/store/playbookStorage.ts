import type { Play } from './useFieldStore';

const STORAGE_KEY = '@playbook_data';

/** Confere só o formato de topo (campos presentes com o tipo básico certo) —
 * não valida fundo (ex.: se cada Player dentro de `players` tem os campos
 * certos). É o suficiente pra rejeitar dado de um schema antigo/corrompido
 * antes que ele quebre a renderização, sem reimplementar um validador de
 * schema completo pra um caso que já é defensivo por natureza. */
function isValidPlay(value: unknown): value is Play {
  if (typeof value !== 'object' || value === null) return false;
  const play = value as Record<string, unknown>;
  return (
    typeof play.id === 'string' &&
    typeof play.name === 'string' &&
    typeof play.category === 'string' &&
    typeof play.fieldRule === 'string' &&
    Array.isArray(play.players) &&
    Array.isArray(play.assignments) &&
    typeof play.createdAt === 'number'
  );
}

/** Lê as jogadas salvas do localStorage. Nunca lança — falha vira lista vazia.
 * Jogadas de um schema antigo/corrompido são descartadas individualmente em
 * vez de quebrar a lista inteira ou vazar pra renderização com campos
 * faltando. */
export function loadSavedPlays(): Play[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidPlay);
  } catch {
    return [];
  }
}

/** Persiste a lista inteira de jogadas no localStorage. Falha silenciosamente
 * (ex.: storage cheio/indisponível) — o estado em memória do Zustand
 * continua correto para o resto da sessão mesmo se a escrita falhar. */
export function persistSavedPlays(plays: Play[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plays));
  } catch {
    // ignorado de propósito — ver comentário acima.
  }
}
