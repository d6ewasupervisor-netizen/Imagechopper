import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { loginWithPassword } from "../../lib/auth";
import { useEditorStore } from "../../store/useEditorStore";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

const LoginModal = ({ open, onClose }: LoginModalProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const setAuthSession = useEditorStore((state) => state.setAuthSession);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const session = await loginWithPassword(email.trim(), password);
      setAuthSession(session.user.email, session.user.isPro);
      toast.success(
        session.user.isPro ? "Signed in — Pro unlocked." : "Signed in."
      );
      setPassword("");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title" id="login-title">
            Sign in
          </div>
          <button className="btn small ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <form className="modal-body login-form" onSubmit={handleSubmit}>
          <p className="hint">
            Sign in with your Pro account to unlock unlimited zones, ZIP/JPEG/WebP
            export, metadata, and project files.
          </p>
          <label className="menu-label" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            className="menu-input"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label className="menu-label" htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            className="menu-input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <div className="modal-footer login-actions">
            <button className="btn ghost" type="button" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? "Signing in..." : "Sign in"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginModal;
