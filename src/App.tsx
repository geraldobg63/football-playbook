import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { Field } from './features/field/Field';
import { FieldControls } from './features/field/FieldControls';
import { HelpGuide } from './features/field/HelpGuide';
import { PlaybookSidebar } from './features/playbook/PlaybookSidebar';
import { Auth } from './features/auth/Auth';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  // Enquanto null/indefinido não sabemos ainda se há sessão — sem essa
  // distinção, a tela de Login "pisca" por baixo do app real (ou vice-versa)
  // no primeiro render, antes de getSession() responder.
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsCheckingSession(false);
    });

    // Mantém a sessão em tempo real: login/logout/expiração em qualquer
    // aba refletem aqui sem precisar recarregar a página.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isCheckingSession) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-lobos-navy-950">
        <p className="text-sm text-slate-400">Carregando…</p>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-lobos-navy-950">
      <header className="flex h-14 shrink-0 items-center border-b border-white/5 bg-lobos-navy-950 px-4">
        <h1 className="text-xl font-bold tracking-tight text-slate-200">
          🏈 Uberlândia Lobos Playbook
        </h1>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-y-hidden">
        <PlaybookSidebar />
        {/* Tratamento de "palco": moldura visual ao redor do Konva (ring,
            radius, sombra) sem tocar em nada da lógica de renderização —
            overflow-x-auto/overflow-y-auto/min-w-0/justify-start seguem
            exatamente como antes, só ganharam classes puramente visuais. */}
        <div className="relative flex min-w-0 max-w-full flex-1 justify-start overflow-x-auto overflow-y-auto rounded-xl bg-lobos-navy-900/40 p-4 ring-1 ring-white/5 shadow-2xl">
          <Field />
        </div>
        <FieldControls />
        <HelpGuide />
      </div>
    </div>
  );
}

export default App;
