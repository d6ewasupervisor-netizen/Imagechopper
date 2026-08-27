import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "dist");
const PORT = Number(process.env.PORT || 3000);
const AUTH_SECRET = process.env.AUTH_SECRET || "dev-only-change-me";
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

const seededUsers = [
  {
    email: (process.env.PRO_USER_EMAIL || "tgauthier2011@gmail.com").trim().toLowerCase(),
    password: process.env.PRO_USER_PASSWORD || "",
    isPro: true,
    plan: "pro",
  },
].filter((user) => user.email && user.password);

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

const timingSafeEqualString = (left, right) => {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

const signToken = (payload) => {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", AUTH_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
};

const verifyToken = (token) => {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", AUTH_SECRET).update(body).digest("base64url");
  if (!timingSafeEqualString(sig, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload?.email || !payload?.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
};

const findUser = (email, password) => {
  const normalized = String(email || "").trim().toLowerCase();
  return (
    seededUsers.find(
      (user) =>
        user.email === normalized && timingSafeEqualString(user.password, String(password || ""))
    ) || null
  );
};

const publicUser = (user, payload) => ({
  email: user?.email || payload?.email || "",
  isPro: Boolean(user?.isPro ?? payload?.isPro),
  plan: user?.plan || payload?.plan || (payload?.isPro ? "pro" : "free"),
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, usersConfigured: seededUsers.length });
});

app.post("/api/login", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const user = findUser(email, password);
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const payload = {
    email: user.email,
    isPro: user.isPro,
    plan: user.plan,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const token = signToken(payload);
  return res.json({ token, user: publicUser(user, payload) });
});

app.get("/api/me", (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Not signed in." });
  }
  const user = seededUsers.find((entry) => entry.email === payload.email);
  return res.json({ user: publicUser(user, payload) });
});

app.post("/api/logout", (_req, res) => {
  res.json({ ok: true });
});

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { index: false, maxAge: "1h" }));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(distDir, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res.status(503).send("Build missing. Run npm run build before starting the server.");
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ImageChopper listening on http://0.0.0.0:${PORT}`);
  if (seededUsers.length === 0) {
    console.warn("No Pro users configured. Set PRO_USER_EMAIL and PRO_USER_PASSWORD.");
  } else {
    console.log(`Pro accounts ready: ${seededUsers.map((u) => u.email).join(", ")}`);
  }
});
