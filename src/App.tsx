import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { useFieldStore, type GameMode } from './store/useFieldStore';
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

  // Modo Foco: retrai a barra do Playbook (esquerda) e/ou de Ferramentas
  // (direita) pra maximizar o campo. Só afeta o layout de 3 colunas em
  // telas md+ — nas classes condicionais de PlaybookSidebar/FieldControls
  // abaixo, o colapso vive inteiramente atrás do prefixo `md:`.
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);

  const loadUserPlaybook = useFieldStore((state) => state.loadUserPlaybook);
  const clearUserPlaybook = useFieldStore((state) => state.clearUserPlaybook);
  const gameMode = useFieldStore((state) => state.gameMode);
  const setGameMode = useFieldStore((state) => state.setGameMode);

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

  // Chaveado no ID do usuário (não no objeto `session` inteiro) — um
  // refresh de token silencioso troca a referência de `session` sem trocar
  // de usuário, e recarregar o playbook inteiro nesse caso seria
  // desperdício. Só busca de novo quando o usuário realmente muda (login
  // com outra conta) e limpa quando a sessão encerra (logout/expiração),
  // pra nunca deixar o playbook de um usuário visível pro próximo.
  useEffect(() => {
    if (session?.user.id) {
      loadUserPlaybook(session.user.id);
    } else {
      clearUserPlaybook();
    }
  }, [session?.user.id, loadUserPlaybook, clearUserPlaybook]);

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
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/5 bg-lobos-navy-950 px-4">
        <h1 className="text-xl font-bold tracking-tight text-slate-200">
          🏈 Uberlândia Lobos Playbook
        </h1>
        <GameModeToggle mode={gameMode} onChange={setGameMode} />
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-y-hidden">
        <PlaybookSidebar isOpen={isLeftSidebarOpen} />
        {/* Tratamento de "palco": moldura visual ao redor do Konva (ring,
            radius, sombra) sem tocar em nada da lógica de renderização —
            overflow-x-auto/overflow-y-auto/min-w-0/justify-start seguem
            exatamente como antes, só ganharam classes puramente visuais.
            `relative` é o que ancora as duas abas flutuantes abaixo. */}
        <div className="relative flex min-w-0 max-w-full flex-1 justify-start overflow-x-auto overflow-y-auto rounded-xl bg-lobos-navy-900/40 p-4 ring-1 ring-white/5 shadow-2xl">
          {/* Badge só informativo, propagando gameMode até a área do canvas
              sem tocar em nenhuma linha do componente Field/Konva (regra de
              segurança desta etapa) — vive aqui, em App.tsx, por fora do
              <Stage>. pointer-events-none por precaução: já tivemos uma
              regressão nesta sessão de um elemento flutuante sobre o campo
              roubando cliques de desenho — não deveria acontecer aqui (não
              tem largura/altura relevante cobrindo jogadores), mas mantém a
              mesma disciplina defensiva. */}
          <span className="pointer-events-none absolute top-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-lobos-navy-950/80 px-3 py-1 text-xs font-semibold text-lobos-gold-400 ring-1 ring-white/10">
            {GAME_MODE_LABELS[gameMode]}
          </span>
          <SidebarToggleTab
            side="left"
            isOpen={isLeftSidebarOpen}
            onClick={() => setIsLeftSidebarOpen((open) => !open)}
          />
          <Field />
          <SidebarToggleTab
            side="right"
            isOpen={isRightSidebarOpen}
            onClick={() => setIsRightSidebarOpen((open) => !open)}
          />
        </div>
        <FieldControls isOpen={isRightSidebarOpen} />
        <HelpGuide />
      </div>
    </div>
  );
}

const GAME_MODE_LABELS: Record<GameMode, string> = {
  tackle: 'Tackle 11x11',
  flag5x5: 'Flag 5x5',
};

/**
 * Botão de segmento (Tackle/Flag) no header — preparação estrutural pra
 * multi-modalidade (ver GameMode em useFieldStore.ts). Mesmo padrão visual
 * dos outros toggles de "estado ativo" do app (pill dourada), mas puramente
 * de estado nesta etapa: nada na renderização do campo reage a isso ainda.
 */
function GameModeToggle({
  mode,
  onChange,
}: {
  mode: GameMode;
  onChange: (mode: GameMode) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Modalidade"
      className="flex items-center gap-1 rounded-full bg-lobos-navy-900 p-1 ring-1 ring-white/10"
    >
      {(Object.keys(GAME_MODE_LABELS) as GameMode[]).map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={mode === option}
          onClick={() => onChange(option)}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lobos-gold-400 active:scale-[0.97] ${
            mode === option
              ? 'bg-lobos-gold-500 text-lobos-navy-950'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          {GAME_MODE_LABELS[option]}
        </button>
      ))}
    </div>
  );
}

/**
 * Aba flutuante semitransparente (Modo Foco): retrai/expande a barra
 * lateral correspondente. Grudada na borda INTERNA do contêiner do campo
 * (`left-0`/`right-0` dentro do wrapper `relative` acima) — nunca dentro
 * do <Stage> do Konva, então não aparece na exportação PNG (que só captura
 * o próprio canvas, ver exportToPng.ts).
 */
function SidebarToggleTab({
  side,
  isOpen,
  onClick,
}: {
  side: 'left' | 'right';
  isOpen: boolean;
  onClick: () => void;
}) {
  // A seta aponta pra direção em que o painel vai se mover ao clicar —
  // convenção comum em painéis retráteis (ex.: barra lateral do VS Code):
  // aberta, aponta pro lado de fora (vai recolher pra lá); fechada, aponta
  // de volta pro centro (vai expandir de volta).
  const oppositeSide = side === 'left' ? 'right' : 'left';
  const chevronDirection = isOpen ? side : oppositeSide;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        isOpen
          ? `Recolher barra ${side === 'left' ? 'esquerda' : 'direita'}`
          : `Expandir barra ${side === 'left' ? 'esquerda' : 'direita'}`
      }
      className={`absolute top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center bg-black/50 px-1 py-6 text-white transition-all hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lobos-gold-400 active:scale-[0.97] md:flex ${
        side === 'left' ? 'left-0 rounded-r-md' : 'right-0 rounded-l-md'
      }`}
    >
      <ChevronIcon direction={chevronDirection} />
    </button>
  );
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {direction === 'left' ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
    </svg>
  );
}

export default App;
