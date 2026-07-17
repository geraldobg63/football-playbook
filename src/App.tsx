import { Field } from './features/field/Field';
import { FieldControls } from './features/field/FieldControls';
import { HelpGuide } from './features/field/HelpGuide';
import { PlaybookSidebar } from './features/playbook/PlaybookSidebar';

function App() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-y-auto bg-slate-950 md:flex-row md:overflow-y-hidden">
      <PlaybookSidebar />
      <div className="relative flex min-w-0 max-w-full flex-1 justify-start overflow-x-auto overflow-y-auto p-4">
        <Field />
      </div>
      <FieldControls />
      <HelpGuide />
    </div>
  );
}

export default App;
