import crypto from "node:crypto";

export const COOKIE = "chop_session";
export const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const DEFAULT_ALLOWED = ["+15095727660"];

export const authSecret = () => {
  const secret = String(process.env.AUTH_SECRET || "").trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT) {
    throw new Error("AUTH_SECRET is required");
  }
  return "dev-only-change-me";
};

export const toE164 = (raw) => {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
};

export const allowedPhones = () => {
  const fromEnv = String(process.env.CHOP_ALLOWED_PHONES || "")
    .split(",")
    .map((value) => toE164(value))
    .filter(Boolean);
  return [...new Set([...DEFAULT_ALLOWED, ...fromEnv])];
};

export const isAllowedPhone = (raw) => {
  const phone = toE164(raw);
  return Boolean(phone && allowedPhones().includes(phone));
};

export const last4 = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.slice(-4) || null;
};

const timingSafeEqualString = (left, right) => {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

export const signToken = (payload) => {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", authSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
};

export const verifyToken = (token) => {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", authSecret()).update(body).digest("base64url");
  if (!timingSafeEqualString(sig, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload?.phone || !payload?.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
};

export const issueSession = (phone) =>
  signToken({
    phone,
    isPro: true,
    plan: "pro",
    exp: Date.now() + TOKEN_TTL_MS,
  });

export const publicUser = (payload) => ({
  phone: payload?.phone || "",
  last4: last4(payload?.phone),
  isPro: Boolean(payload?.isPro ?? true),
  plan: payload?.plan || "pro",
});

const readCookie = (req, name) => {
  const raw = req.headers.cookie || "";
  const parts = raw.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (part.startsWith(`${name}=`)) {
      return decodeURIComponent(part.slice(name.length + 1));
    }
  }
  return "";
};

export const getUser = (req) => {
  const header = req.headers.authorization || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  return verifyToken(readCookie(req, COOKIE) || bearer);
};

export const requireAuth = (req, res, next) => {
  const user = getUser(req);
  if (!user) {
    return res.status(401).json({ error: "Sign in required." });
  }
  req.auth = user;
  return next();
};

const cookieOptions = () => {
  const secure = process.env.NODE_ENV === "production" || Boolean(process.env.RAILWAY_ENVIRONMENT);
  return {
    path: "/",
    maxAge: TOKEN_TTL_MS,
    httpOnly: true,
    sameSite: "lax",
    secure,
  };
};

export const setSessionCookie = (res, token) => {
  const opts = cookieOptions();
  const parts = [
    `${COOKIE}=${encodeURIComponent(token)}`,
    `Path=${opts.path}`,
    `Max-Age=${Math.floor(opts.maxAge / 1000)}`,
    "HttpOnly",
    `SameSite=${opts.sameSite}`,
  ];
  if (opts.secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
};

export const clearSessionCookie = (res) => {
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
};
