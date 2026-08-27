const DEFAULT_MODEL = "gemini-3.1-flash-lite";

export const isGeminiEnabled = () => {
  if (process.env.GEMINI_ENABLED === "0") return false;
  return Boolean(String(process.env.GEMINI_API_KEY || "").trim());
};

export const geminiModel = () => process.env.GEMINI_MODEL || DEFAULT_MODEL;

const extractJson = (text) => {
  if (!text) throw new Error("Empty model response");
  const trimmed = String(text).trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1].trim() : trimmed;
  const objStart = raw.indexOf("{");
  const objEnd = raw.lastIndexOf("}");
  const arrStart = raw.indexOf("[");
  const arrEnd = raw.lastIndexOf("]");
  if (objStart !== -1 && objEnd !== -1 && (arrStart === -1 || objStart < arrStart)) {
    return JSON.parse(raw.slice(objStart, objEnd + 1));
  }
  if (arrStart !== -1 && arrEnd !== -1) {
    return JSON.parse(raw.slice(arrStart, arrEnd + 1));
  }
  throw new Error("No JSON in model response");
};

export const generateJson = async ({
  parts,
  temperature = 0.1,
  timeoutMs = 55000,
} = {}) => {
  if (!isGeminiEnabled()) {
    const err = new Error("Auto Select is not configured.");
    err.code = "GEMINI_DISABLED";
    throw err;
  }
  const model = geminiModel();
  const key = String(process.env.GEMINI_API_KEY).trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature,
        responseMimeType: "application/json",
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(payload?.error?.message || `Auto Select failed (${res.status})`);
    err.code = "GEMINI_ERROR";
    err.status = res.status;
    throw err;
  }
  const text =
    payload?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  return {
    model,
    parsed: extractJson(text),
    text,
  };
};

export const parseDataUrl = (dataUrl) => {
  const match = String(dataUrl || "").match(
    /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/
  );
  if (!match) {
    throw new Error("Invalid image data.");
  }
  return {
    mimeType: match[1],
    data: match[2].replace(/\s+/g, ""),
  };
};

export const normalizeAutoSelectZones = (parsed, imageWidth, imageHeight) => {
  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.zones)
      ? parsed.zones
      : Array.isArray(parsed?.boxes)
        ? parsed.boxes
        : [];

  const width = Number(imageWidth) || 0;
  const height = Number(imageHeight) || 0;
  if (width <= 0 || height <= 0) {
    throw new Error("Image size is required.");
  }

  const zones = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    let x;
    let y;
    let w;
    let h;
    if (
      [item.x, item.y, item.width, item.height].every((n) => Number.isFinite(Number(n)))
    ) {
      x = Number(item.x);
      y = Number(item.y);
      w = Number(item.width);
      h = Number(item.height);
      // Heuristic: values in 0..1.5 are normalized ratios.
      if (x <= 1.5 && y <= 1.5 && w <= 1.5 && h <= 1.5) {
        x *= width;
        y *= height;
        w *= width;
        h *= height;
      }
    } else if (
      [item.xmin, item.ymin, item.xmax, item.ymax].every((n) =>
        Number.isFinite(Number(n))
      )
    ) {
      let xmin = Number(item.xmin);
      let ymin = Number(item.ymin);
      let xmax = Number(item.xmax);
      let ymax = Number(item.ymax);
      if (xmin <= 1.5 && ymin <= 1.5 && xmax <= 1.5 && ymax <= 1.5) {
        xmin *= width;
        ymin *= height;
        xmax *= width;
        ymax *= height;
      }
      x = xmin;
      y = ymin;
      w = xmax - xmin;
      h = ymax - ymin;
    } else {
      continue;
    }

    x = Math.max(0, Math.min(width - 1, x));
    y = Math.max(0, Math.min(height - 1, y));
    w = Math.max(4, Math.min(width - x, w));
    h = Math.max(4, Math.min(height - y, h));
    zones.push({
      type: "rect",
      x,
      y,
      width: w,
      height: h,
      label: typeof item.label === "string" ? item.label.slice(0, 80) : undefined,
    });
  }

  return zones;
};
