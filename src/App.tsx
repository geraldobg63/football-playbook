import { Field } from './features/field/Field';
import { FieldControls } from './features/field/FieldControls';
import { HelpGuide } from './features/field/HelpGuide';
import { PlaybookSidebar } from './features/playbook/PlaybookSidebar';

function App() {
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
