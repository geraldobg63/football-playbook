import type { Folder, Play } from './useFieldStore';

const STORAGE_KEY = '@playbook_data';
const FOLDERS_STORAGE_KEY = '@playbook_folders';

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
    // folderId é opcional (undefined = Raiz) — jogadas salvas antes desse
    // campo existir também precisam continuar válidas.
    (play.folderId === undefined || typeof play.folderId === 'string') &&
    typeof play.fieldRule === 'string' &&
    Array.isArray(play.players) &&
    Array.isArray(play.assignments) &&
    typeof play.createdAt === 'number'
  );
}

function isValidFolder(value: unknown): value is Folder {
  if (typeof value !== 'object' || value === null) return false;
  const folder = value as Record<string, unknown>;
  return typeof folder.id === 'string' && typeof folder.name === 'string';
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

/** Mesmo padrão de loadSavedPlays acima, numa chave própria — pastas e
 * jogadas evoluem/persistem independentemente uma da outra. */
export function loadSavedFolders(): Folder[] {
  try {
    const raw = localStorage.getItem(FOLDERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidFolder);
  } catch {
    return [];
  }
}

export function persistFolders(folders: Folder[]): void {
  try {
    localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(folders));
  } catch {
    // ignorado de propósito — ver comentário em persistSavedPlays.
  }
}
