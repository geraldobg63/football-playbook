import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Falha alto e cedo, com uma mensagem acionável — sem isso, o supabase-js
  // lançaria um erro genérico bem mais fundo na primeira chamada de rede,
  // dificultando descobrir que a causa raiz é .env.local ausente/incompleto.
  throw new Error(
    'VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY ausentes — confira o .env.local e reinicie o servidor de desenvolvimento.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
