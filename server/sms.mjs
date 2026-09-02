const DEFAULT_URL = "https://sms-outbox-production.up.railway.app";

export const smsOutboxConfigured = () => Boolean(String(process.env.SMS_OUTBOX_KEY || "").trim());

const baseUrl = () => String(process.env.SMS_OUTBOX_URL || DEFAULT_URL).replace(/\/+$/, "");

const apiKey = () => String(process.env.SMS_OUTBOX_KEY || "").trim();

const outboxFetch = async (path, body) => {
  if (!smsOutboxConfigured()) {
    const err = new Error("SMS outbox is not configured (missing SMS_OUTBOX_KEY).");
    err.status = 503;
    err.code = "SMS_OUTBOX_NOT_CONFIGURED";
    throw err;
  }
  const res = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey(),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
};

const outboxError = (path, res, data) => {
  const err = new Error(data?.error || `${path} ${res.status}`);
  err.status = res.status;
  err.rule = data?.rule || null;
  err.code =
    res.status === 403
      ? data?.rule === "OPT_OUT"
        ? "SMS_OUTBOX_OPTED_OUT"
        : "SMS_OUTBOX_BLOCKED"
      : res.status === 429
        ? "SMS_OUTBOX_RATE_LIMITED"
        : "SMS_OUTBOX_FAILED";
  return err;
};

export const sendOtp = async (to, autofillHost) => {
  const payload = { to };
  if (autofillHost) payload.autofill_host = autofillHost;
  const { res, data } = await outboxFetch("/otp/send", payload);
  if (!res.ok) throw outboxError("otp/send", res, data);
  return data;
};

export const verifyOtp = async (to, code) => {
  const { res, data } = await outboxFetch("/otp/verify", {
    to,
    code: String(code || "").trim(),
  });
  return {
    ok: res.ok && data.ok === true,
    status: res.status,
    ...data,
  };
};

export const userFacingOtpError = (err) => {
  if (err?.rule === "OPT_OUT" || err?.code === "SMS_OUTBOX_OPTED_OUT") {
    return "This number replied STOP. Text START to (509) 572-9212 to receive codes again.";
  }
  if (err?.status === 429 || err?.code === "SMS_OUTBOX_RATE_LIMITED") {
    return "Too many codes requested. Wait a few minutes and try again.";
  }
  if (err?.status === 503 || err?.code === "SMS_OUTBOX_NOT_CONFIGURED") {
    return "Text login is temporarily unavailable.";
  }
  return err?.message || "Could not send the login code.";
};
