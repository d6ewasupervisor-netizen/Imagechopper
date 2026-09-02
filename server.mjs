import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import {
  generateJson,
  isGeminiEnabled,
  normalizeAutoSelectZones,
  parseDataUrl,
  refinePhotoContentZones,
} from "./server/gemini.mjs";
import {
  allowedPhones,
  clearSessionCookie,
  getUser,
  issueSession,
  isAllowedPhone,
  publicUser,
  requireAuth,
  setSessionCookie,
  toE164,
} from "./server/session.mjs";
import { sendOtp, smsOutboxConfigured, userFacingOtpError, verifyOtp } from "./server/sms.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "dist");
const PORT = Number(process.env.PORT || 3000);
const OTP_AUTOFILL_HOST = "chop.tactag.app";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "20mb" }));

app.get(["/health", "/api/health"], (_req, res) => {
  res.json({
    ok: true,
    service: "imagechopper",
    otpConfigured: smsOutboxConfigured(),
    allowedPhones: allowedPhones().length,
    autoSelectConfigured: isGeminiEnabled(),
  });
});

app.get("/api/me", (req, res) => {
  const payload = getUser(req);
  if (!payload) {
    return res.status(401).json({ error: "Not signed in." });
  }
  return res.json({ user: publicUser(payload) });
});

app.post("/api/auth/otp/send", async (req, res) => {
  const phone = toE164(req.body?.phone);
  if (!phone) {
    return res.status(400).json({ error: "Enter a valid US phone number." });
  }
  if (!isAllowedPhone(phone)) {
    return res.status(403).json({ error: "This number is not allowed to use ImageChopper." });
  }
  try {
    const host = String(req.get("host") || "")
      .split(":")[0]
      .toLowerCase();
    await sendOtp(phone, host === OTP_AUTOFILL_HOST ? host : null);
    return res.json({ ok: true, expires_in_min: 10 });
  } catch (err) {
    return res.status(err.status || 502).json({
      error: userFacingOtpError(err),
      rule: err.rule || null,
    });
  }
});

app.post("/api/auth/otp/verify", async (req, res) => {
  const phone = toE164(req.body?.phone);
  const code = String(req.body?.code || "").trim();
  if (!phone) {
    return res.status(400).json({ error: "Enter a valid US phone number." });
  }
  if (!isAllowedPhone(phone)) {
    return res.status(403).json({ error: "This number is not allowed to use ImageChopper." });
  }
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: "Enter the 6-digit code." });
  }
  try {
    const result = await verifyOtp(phone, code);
    if (!result.ok) {
      return res.status(401).json({ error: "Incorrect code." });
    }
    const token = issueSession(phone);
    setSessionCookie(res, token);
    return res.json({ token, user: publicUser({ phone, isPro: true, plan: "pro" }) });
  } catch (err) {
    return res.status(err.status || 502).json({ error: err.message });
  }
});

app.post("/api/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.post("/api/auto-select", requireAuth, async (req, res) => {
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
      "You detect crop zones for a photo chopping tool.",
      "Goal: return one zone per PHOTOGRAPH that should be exported.",
      "",
      "What to INCLUDE:",
      "- Only the photographic image content itself (faces, subjects, scene pixels).",
      "- For contact sheets / 35mm film frames: the inner picture rectangle only.",
      "",
      "What to EXCLUDE (never include in the box):",
      "- Black film borders / film bars above or below photos",
      "- Frame numbers, KODAK/FILM text, sprocket graphics",
      "- White gutters, margins, and spacing between frames",
      "- Page headers/titles (e.g. CONTACT SHEET, PRINT #, film metadata)",
      "- Empty background around the sheet",
      "",
      "Contact-sheet rule:",
      "If each cell looks like a film strip with a black top bar, photo in the middle, and black bottom bar,",
      "box ONLY the middle photo. Do not wrap the whole film cell.",
      "Inset tightly to the photo edges where the picture meets the black border.",
      "",
      "Return JSON only:",
      '{ "zones": [ { "x": 0.12, "y": 0.18, "width": 0.14, "height": 0.09, "label": "1" } ] }',
      "Use NORMALIZED coordinates from 0 to 1 (full image width/height).",
      "x,y = top-left of each photo content box.",
      "No overlapping near-duplicates. Sort top-to-bottom, then left-to-right.",
      "Prefer slightly tight boxes over loose ones that include borders.",
      `Image pixel size: ${Math.round(imageWidth)}x${Math.round(imageHeight)}.`,
    ].join("\n");

    const result = await generateJson({
      parts: [
        { text: prompt },
        { inlineData: { mimeType, data } },
      ],
      temperature: 0.05,
      timeoutMs: 60000,
    });

    let zones = normalizeAutoSelectZones(result.parsed, imageWidth, imageHeight);
    zones = refinePhotoContentZones(zones, imageWidth, imageHeight);
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
  console.log(`OTP configured: ${smsOutboxConfigured() ? "yes" : "no"}`);
  console.log(`Allowed phones: ${allowedPhones().length}`);
  console.log(`Auto Select configured: ${isGeminiEnabled() ? "yes" : "no"}`);
});
