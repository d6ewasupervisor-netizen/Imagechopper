import { useEffect } from "react";
import { Toaster } from "sonner";
import { EditorProvider } from "./context/EditorContext";
import EditorShell from "./components/editor/EditorShell";
import LoginGate from "./components/auth/LoginGate";
import { displayName, fetchCurrentUser } from "./lib/auth";
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
          setAuthSession(displayName(user), user.isPro);
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

const ShellGate = () => {
  const authReady = useEditorStore((state) => state.authReady);
  const userEmail = useEditorStore((state) => state.userEmail);

  if (!authReady) {
    return (
      <div className="login-gate">
        <div className="login-gate-card">
          <div className="brand">ImageChopper</div>
        </div>
      </div>
    );
  }

  if (!userEmail) {
    return <LoginGate />;
  }

  return <EditorShell />;
};

const App = () => {
  return (
    <EditorProvider>
      <AuthBootstrap />
      <Toaster richColors closeButton position="top-right" />
      <ShellGate />
    </EditorProvider>
  );
};

export default App;
