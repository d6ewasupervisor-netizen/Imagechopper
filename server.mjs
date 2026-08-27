import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import {
  generateJson,
  isGeminiEnabled,
  normalizeAutoSelectZones,
  parseDataUrl,
} from "./server/gemini.mjs";

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
app.use(express.json({ limit: "20mb" }));

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

const requirePro = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Sign in required." });
  }
  if (!payload.isPro) {
    return res.status(403).json({ error: "Auto Select is a Pro feature." });
  }
  req.auth = payload;
  return next();
};

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    usersConfigured: seededUsers.length,
    autoSelectConfigured: isGeminiEnabled(),
  });
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

app.post("/api/auto-select", requirePro, async (req, res) => {
  try {
    if (!isGeminiEnabled()) {
      return res.status(503).json({ error: "Auto Select is not configured." });
    }

    const imageDataUrl = String(req.body?.imageDataUrl || "");
    const imageWidth = Number(req.body?.imageWidth);
    const imageHeight = Number(req.body?.imageHeight);
    if (!imageDataUrl || !Number.isFinite(imageWidth) || !Number.isFinite(imageHeight)) {
      return res.status(400).json({ error: "Image data and size are required." });
    }

    const { mimeType, data } = parseDataUrl(imageDataUrl);
    const prompt = [
      "You detect crop zones in an image for a photo chopping tool.",
      "Find every distinct rectangular photo/frame/cell that should be exported as its own crop.",
      "This includes contact-sheet frames, grids of photos, separate products, or clear framed regions.",
      "Return JSON only with this shape:",
      '{ "zones": [ { "x": 0, "y": 0, "width": 0.2, "height": 0.2, "label": "optional" } ] }',
      "Use NORMALIZED coordinates from 0 to 1 relative to the full image width/height.",
      "x,y is the top-left of each zone. Prefer tight boxes around each photo content or film frame interior.",
      "Do not return overlapping near-duplicates. Sort zones top-to-bottom, then left-to-right.",
      `Image pixel size: ${Math.round(imageWidth)}x${Math.round(imageHeight)}.`,
    ].join("\n");

    const result = await generateJson({
      parts: [
        { text: prompt },
        { inlineData: { mimeType, data } },
      ],
      temperature: 0.1,
      timeoutMs: 60000,
    });

    const zones = normalizeAutoSelectZones(result.parsed, imageWidth, imageHeight);
    if (zones.length === 0) {
      return res.status(422).json({ error: "No zones found. Try a clearer grid or photo set." });
    }

    return res.json({
      zones,
      count: zones.length,
    });
  } catch (error) {
    const status = error?.status && Number.isFinite(error.status) ? error.status : 500;
    return res.status(status >= 400 && status < 600 ? status : 500).json({
      error: error?.message || "Auto Select failed.",
    });
  }
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
  console.log(`Auto Select configured: ${isGeminiEnabled() ? "yes" : "no"}`);
});
