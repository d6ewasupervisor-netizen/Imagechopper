import { Toaster } from "sonner";
import { EditorProvider } from "./context/EditorContext";
import EditorShell from "./components/editor/EditorShell";

const App = () => {
  return (
    <EditorProvider>
      <Toaster richColors closeButton position="top-right" />
      <EditorShell />
    </EditorProvider>
  );
};

export default App;
