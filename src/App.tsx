import { useEffect } from "react";
import { Toaster } from "sonner";
import { EditorProvider } from "./context/EditorContext";
import EditorShell from "./components/editor/EditorShell";
import { fetchCurrentUser } from "./lib/auth";
import { useEditorStore } from "./store/useEditorStore";

const AuthBootstrap = () => {
  const setAuthSession = useEditorStore((state) => state.setAuthSession);
  const setAuthReady = useEditorStore((state) => state.setAuthReady);
  const clearAuthSession = useEditorStore((state) => state.clearAuthSession);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await fetchCurrentUser();
        if (cancelled) return;
        if (user) {
          setAuthSession(user.email, user.isPro);
        } else {
          clearAuthSession();
        }
      } catch {
        if (!cancelled) clearAuthSession();
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clearAuthSession, setAuthReady, setAuthSession]);

  return null;
};

const App = () => {
  return (
    <EditorProvider>
      <AuthBootstrap />
      <Toaster richColors closeButton position="top-right" />
      <EditorShell />
    </EditorProvider>
  );
};

export default App;
