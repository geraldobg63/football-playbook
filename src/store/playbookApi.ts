import { supabase } from '../supabase';
import type { Folder, GameMode, Play } from './useFieldStore';

/**
 * Ponte entre o schema do Supabase (snake_case, JSONB) e os tipos do app
 * (camelCase, campos de renderização soltos). O resto da store nunca lida
 * com nomes de coluna ou com o formato da linha — só com `Folder`/`Play`.
 */

interface FolderRow {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

/** Tudo que é necessário pra restaurar o campo no Konva vive junto dentro
 * da coluna JSONB `data` — fieldRule/players/assignments não têm colunas
 * próprias na tabela `plays`. */
interface PlayData {
  fieldRule: Play['fieldRule'];
  players: Play['players'];
  assignments: Play['assignments'];
}

interface PlayRow {
  id: string;
  user_id: string;
  folder_id: string | null;
  name: string;
  category: string;
  /** Coluna própria na tabela `plays` (confirmada via introspecção REST —
   * `folders` não tem essa coluna). Jogadas salvas antes desta feature vêm
   * com `null` aqui: tratadas como 'tackle' em playFromRow pra não sumirem
   * da visão do treinador (Tackle 11x11 é o único modo que sempre existiu). */
  modalidade: string | null;
  data: PlayData;
  created_at: string;
}

function folderFromRow(row: FolderRow): Folder {
  return { id: row.id, name: row.name };
}

function playFromRow(row: PlayRow): Play {
  return {
    id: row.id,
    name: row.name,
    category: row.category as Play['category'],
    folderId: row.folder_id ?? undefined,
    gameMode: (row.modalidade as GameMode | null) ?? 'tackle',
    fieldRule: row.data.fieldRule,
    players: row.data.players,
    assignments: row.data.assignments,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function fetchFolders(userId: string): Promise<Folder[]> {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as FolderRow[]).map(folderFromRow);
}

/**
 * Filtra por modalidade ativa — o treinador só vê jogadas compatíveis com o
 * modo selecionado no toggle do header. Em 'tackle' também aceita
 * `modalidade IS NULL`: jogadas salvas antes desta coluna existir não têm
 * valor nenhum ali, e como Tackle 11x11 sempre foi o único modo do app,
 * tratar NULL como 'tackle' é o único jeito de não fazer esses dados
 * antigos sumirem da lista quando o filtro entrar em produção. `folders`
 * não tem coluna `modalidade` (confirmado via introspecção) — pastas
 * continuam sendo compartilhadas entre os dois modos, não fazem parte
 * deste filtro.
 */
export async function fetchPlays(userId: string, gameMode: GameMode): Promise<Play[]> {
  let query = supabase.from('plays').select('*').eq('user_id', userId);
  query =
    gameMode === 'tackle'
      ? query.or('modalidade.eq.tackle,modalidade.is.null')
      : query.eq('modalidade', gameMode);
  const { data, error } = await query.order('created_at', { ascending: true });
  if (error) throw error;
  return (data as PlayRow[]).map(playFromRow);
}

export async function insertFolder(userId: string, name: string): Promise<Folder> {
  const { data, error } = await supabase
    .from('folders')
    .insert({ user_id: userId, name })
    .select()
    .single();
  if (error) throw error;
  return folderFromRow(data as FolderRow);
}

export async function updateFolderName(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('folders').update({ name }).eq('id', id);
  if (error) throw error;
}

export async function deleteFolderRow(id: string): Promise<void> {
  const { error } = await supabase.from('folders').delete().eq('id', id);
  if (error) throw error;
}

/** Roda ANTES de deleteFolderRow — sem isso, jogadas da pasta excluída
 * ficariam com um folder_id apontando pra uma pasta que não existe mais. */
export async function unassignPlaysFromFolder(folderId: string): Promise<void> {
  const { error } = await supabase.from('plays').update({ folder_id: null }).eq('folder_id', folderId);
  if (error) throw error;
}

interface PlayInput {
  name: string;
  category: Play['category'];
  folderId?: string;
  gameMode: GameMode;
  fieldRule: Play['fieldRule'];
  players: Play['players'];
  assignments: Play['assignments'];
}

export async function insertPlay(userId: string, play: PlayInput): Promise<Play> {
  const { data, error } = await supabase
    .from('plays')
    .insert({
      user_id: userId,
      folder_id: play.folderId ?? null,
      name: play.name,
      category: play.category,
      modalidade: play.gameMode,
      data: { fieldRule: play.fieldRule, players: play.players, assignments: play.assignments },
    })
    .select()
    .single();
  if (error) throw error;
  return playFromRow(data as PlayRow);
}

/** Sobrescreve uma jogada já existente (mesmo id) em vez de criar outra —
 * usado quando saveCurrentPlay recebe um id de jogada pra atualizar. */
export async function updatePlay(id: string, play: PlayInput): Promise<Play> {
  const { data, error } = await supabase
    .from('plays')
    .update({
      folder_id: play.folderId ?? null,
      name: play.name,
      category: play.category,
      modalidade: play.gameMode,
      data: { fieldRule: play.fieldRule, players: play.players, assignments: play.assignments },
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return playFromRow(data as PlayRow);
}

export async function deletePlayRow(id: string): Promise<void> {
  const { error } = await supabase.from('plays').delete().eq('id', id);
  if (error) throw error;
}
