import { useState, type FormEvent } from 'react';
import { supabase } from '../../supabase';

// Mesmo tratamento de foco/clique aplicado em todo botão do app (ver
// FieldControls.tsx).
const INTERACTIVE_BUTTON_CLASSES =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lobos-gold-400 active:scale-[0.97] transition-all';

// Mensagens cruas do Supabase são em inglês e nem sempre claras pro
// usuário final — traduz as mais comuns, cai pra mensagem original (ainda
// assim informativa) pra qualquer erro não mapeado aqui.
const KNOWN_AUTH_ERRORS: Record<string, string> = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'User already registered': 'Já existe uma conta cadastrada com esse e-mail.',
  'Email not confirmed': 'Confirme seu e-mail antes de entrar — verifique sua caixa de entrada.',
  'Password should be at least 6 characters': 'A senha precisa ter pelo menos 6 caracteres.',
};

function translateAuthError(message: string): string {
  return KNOWN_AUTH_ERRORS[message] ?? message;
}

type PendingAction = 'signIn' | 'signUp' | null;

/**
 * Tela de login/cadastro — porta de entrada única do app quando não há
 * sessão ativa (ver App.tsx). Um único formulário serve os dois fluxos:
 * "Entrar" submete via signInWithPassword, "Criar Conta" via signUp,
 * ambos usando o mesmo e-mail/senha já digitados.
 */
export function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);
    setPendingAction('signIn');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setPendingAction(null);
    if (error) setErrorMessage(translateAuthError(error.message));
  };

  const handleSignUp = async () => {
    setErrorMessage(null);
    setInfoMessage(null);
    setPendingAction('signUp');
    const { error } = await supabase.auth.signUp({ email, password });
    setPendingAction(null);
    if (error) {
      setErrorMessage(translateAuthError(error.message));
      return;
    }
    // Supabase por padrão exige confirmação de e-mail antes da sessão
    // valer — sem esse aviso o usuário ficaria sem entender por que
    // "Criar Conta" não abriu o app na hora.
    setInfoMessage('Conta criada! Verifique seu e-mail para confirmar o cadastro antes de entrar.');
  };

  const isPending = pendingAction !== null;

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-lobos-navy-950 p-4">
      <form
        onSubmit={handleSignIn}
        className="flex w-full max-w-sm flex-col gap-4 rounded-xl bg-lobos-navy-900 p-6 shadow-2xl ring-1 ring-white/5"
      >
        <div className="flex flex-col items-center gap-1 pb-2 text-center">
          <span className="text-3xl">🏈</span>
          <h1 className="text-xl font-bold tracking-tight text-slate-200">Uberlândia Lobos Playbook</h1>
          <p className="text-sm text-slate-400">Entre com sua conta para acessar o playbook</p>
        </div>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          E-mail
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@time.com"
            className="rounded border border-white/10 bg-lobos-navy-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:ring-2 focus:ring-lobos-gold-400 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Senha
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="rounded border border-white/10 bg-lobos-navy-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:ring-2 focus:ring-lobos-gold-400 focus:outline-none"
          />
        </label>

        {errorMessage && (
          <p
            role="alert"
            className="rounded border border-red-600/50 bg-red-950/50 px-3 py-2 text-sm text-red-300"
          >
            {errorMessage}
          </p>
        )}
        {infoMessage && (
          <p className="rounded border border-lobos-gold-500/50 bg-lobos-gold-500/10 px-3 py-2 text-sm text-lobos-gold-300">
            {infoMessage}
          </p>
        )}

        <div className="flex flex-col gap-2 pt-1">
          <button
            type="submit"
            disabled={isPending}
            className={`rounded bg-lobos-gold-500 px-3 py-2 text-sm font-semibold text-lobos-navy-950 hover:bg-lobos-gold-400 disabled:cursor-not-allowed disabled:bg-lobos-navy-800 disabled:text-slate-500 ${INTERACTIVE_BUTTON_CLASSES}`}
          >
            {pendingAction === 'signIn' ? 'Entrando…' : 'Entrar'}
          </button>
          <button
            type="button"
            onClick={handleSignUp}
            disabled={isPending}
            className={`rounded border-2 border-lobos-gold-500 px-3 py-2 text-sm font-semibold text-lobos-gold-500 hover:bg-lobos-gold-500/10 disabled:cursor-not-allowed disabled:border-lobos-navy-700 disabled:text-slate-500 ${INTERACTIVE_BUTTON_CLASSES}`}
          >
            {pendingAction === 'signUp' ? 'Criando…' : 'Criar Conta'}
          </button>
        </div>
      </form>
    </div>
  );
}
