import type { Play } from './useFieldStore';

const STORAGE_KEY = '@playbook_data';

/** Lê as jogadas salvas do localStorage. Nunca lança — falha vira lista vazia. */
export function loadSavedPlays(): Play[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
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
