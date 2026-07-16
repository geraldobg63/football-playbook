import { Field } from './features/field/Field';
import { FieldControls } from './features/field/FieldControls';
import { HelpGuide } from './features/field/HelpGuide';
import { PlaybookSidebar } from './features/playbook/PlaybookSidebar';

function App() {
  return (
    <div className="flex h-screen w-screen bg-slate-950">
      <PlaybookSidebar />
      <div className="relative flex flex-1 items-center justify-start overflow-auto p-4">
        <FieldControls />
        <Field />
      </div>
      <HelpGuide />
    </div>
  );
}

export default App;
