import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { displayName, sendLoginCode, verifyLoginCode } from "../../lib/auth";
import { useEditorStore } from "../../store/useEditorStore";

const LoginGate = () => {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const setAuthSession = useEditorStore((state) => state.setAuthSession);

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await sendLoginCode(phone.trim());
      setCodeSent(true);
      setCode("");
      toast.success("Code sent.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the login code.");
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const session = await verifyLoginCode(phone.trim(), code.trim());
      setAuthSession(displayName(session.user), session.user.isPro);
      toast.success("Signed in.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-gate">
      <div className="login-gate-card">
        <div className="brand">ImageChopper</div>
        {!codeSent ? (
          <form className="login-form" onSubmit={handleSend}>
            <label className="menu-label" htmlFor="login-phone">
              Mobile number
            </label>
            <input
              id="login-phone"
              className="menu-input"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? "Sending..." : "Text me a code"}
            </button>
          </form>
        ) : (
          <form className="login-form" onSubmit={handleVerify}>
            <label className="menu-label" htmlFor="login-code">
              6-digit code
            </label>
            <input
              id="login-code"
              className="menu-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="[0-9]*"
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? "Signing in..." : "Enter"}
            </button>
            <button
              className="btn ghost"
              type="button"
              disabled={busy}
              onClick={() => {
                setCodeSent(false);
                setCode("");
              }}
            >
              Use a different number
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginGate;
