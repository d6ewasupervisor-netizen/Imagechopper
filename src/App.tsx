import { EditorProvider } from "./context/EditorContext";
import EditorShell from "./components/editor/EditorShell";

const App = () => {
  return (
    <EditorProvider>
      <EditorShell />
    </EditorProvider>
  );
};

export default App;
