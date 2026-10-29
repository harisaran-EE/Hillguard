const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 6;
const GEMINI_REQUEST_TIMEOUT_MS = 8_000;
const rateLimitBuckets = new Map();
const VALID_INTENSITIES = new Set(["dry", "drizzle", "moderate", "rain", "heavy", "unknown"]);

function sendJson(response, status, payload) {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

function isRateLimited(request, now = Date.now()) {
  const forwardedFor = request.headers["x-forwarded-for"];
  const clientIp = typeof forwardedFor === "string"
    ? forwardedFor.split(",")[0].trim()
    : "unknown";
  const bucket = rateLimitBuckets.get(clientIp);

  if (!bucket || now - bucket.windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
    rateLimitBuckets.set(clientIp, { windowStartedAt: now, count: 1 });
    if (rateLimitBuckets.size > 1000) {
      for (const [ip, entry] of rateLimitBuckets) {
        if (now - entry.windowStartedAt >= RATE_LIMIT_WINDOW_MS) rateLimitBuckets.delete(ip);
      }
    }
    return false;
  }
  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) return true;

  bucket.count += 1;
  return false;
}

function validateInput(input) {
  if (!input || input.consent !== true) {
    return "Explicit consent is required before requesting an AI summary.";
  }
  const weather = input.weather;
  const earthquakes = input.earthquakes;
  if (
    !weather || typeof weather.available !== "boolean"
    || !VALID_INTENSITIES.has(weather.intensity)
    || typeof weather.stale !== "boolean"
    || (weather.available
      ? !Number.isFinite(weather.precipitationMm)
        || weather.precipitationMm < 0
        || weather.precipitationMm > 1000
        || !Number.isInteger(weather.intervalMinutes)
        || weather.intervalMinutes < 1
        || weather.intervalMinutes > 1440
      : weather.precipitationMm !== null || weather.intervalMinutes !== null)
  ) {
    return "Weather summary data is invalid.";
  }
  if (
    !earthquakes || typeof earthquakes.available !== "boolean"
    || typeof earthquakes.stale !== "boolean"
    || (earthquakes.available
      ? !Number.isInteger(earthquakes.eventCount)
        || earthquakes.eventCount < 0
        || earthquakes.eventCount > 20000
      : earthquakes.eventCount !== null)
  ) {
    return "Earthquake summary data is invalid.";
  }
  if (!weather.available && !earthquakes.available) {
    return "No weather or USGS data is available to summarize.";
  }
  return "";
}

function parseSummaryResponse(payload) {
  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!text) throw new Error("The AI returned no summary.");

  const result = JSON.parse(text);
  if (typeof result.summary !== "string" || !result.summary.trim() || result.summary.length > 500) {
    throw new Error("The AI returned an invalid summary.");
  }
  return { summary: result.summary.trim() };
}

module.exports = async function summarizeConditions(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "Use POST to request a conditions summary." });
  }
  if (!request.headers["content-type"]?.includes("application/json")) {
    return sendJson(response, 415, { error: "Send the summary request as JSON." });
  }
  const contentLength = Number(request.headers["content-length"]);
  if (Number.isFinite(contentLength) && contentLength > 4000) {
    return sendJson(response, 413, { error: "The summary request is too large." });
  }
  if (isRateLimited(request)) {
    return sendJson(response, 429, { error: "Too many summary requests. Please wait a minute." });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return sendJson(response, 503, {
      error: "AI summary is not configured. Add GEMINI_API_KEY to the Vercel project and redeploy."
    });
  }

  const input = request.body ?? {};
  const validationError = validateInput(input);
  if (validationError) return sendJson(response, 400, { error: validationError });

  const { weather, earthquakes } = input;
  const observations = [
    "Data region: Northeast India and nearby border regions.",
    weather.available
      ? `Open-Meteo rainfall estimate: ${weather.intensity} intensity, ${weather.precipitationMm.toFixed(2)} mm in the latest ${weather.intervalMinutes}-minute interval${weather.stale ? " (stale)" : ""}.`
      : "Open-Meteo rainfall estimate: unavailable.",
    earthquakes.available
      ? `USGS earthquake catalog: ${earthquakes.eventCount} events in the past 365 days${earthquakes.stale ? " (saved or stale data)" : ""}.`
      : "USGS earthquake catalog: unavailable."
  ].join("\n");
  const systemInstruction = [
    "Summarize only the supplied weather estimate and earthquake catalog count in one or two short sentences.",
    "Do not infer danger, landslide risk, causation, trends, or future conditions.",
    "Do not say an area is safe or unsafe and do not give travel, evacuation, or emergency advice.",
    "Clearly identify model estimates and catalog counts as such; mention if data is stale or unavailable.",
    "If only one source is available, summarize only that source. Return JSON with one string property named summary."
  ].join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_REQUEST_TIMEOUT_MS);
  try {
    const model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ parts: [{ text: observations }] }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 160,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: { summary: { type: "STRING" } },
              required: ["summary"],
              propertyOrdering: ["summary"]
            }
          }
        })
      }
    );

    if (!upstream.ok) {
      console.error(`Gemini conditions summary failed with HTTP ${upstream.status}.`);
      return sendJson(response, 502, { error: "AI summary could not be completed. Please try again later." });
    }
    return sendJson(response, 200, parseSummaryResponse(await upstream.json()));
  } catch (error) {
    if (error.name === "AbortError") {
      return sendJson(response, 504, { error: "AI summary timed out. Please try again." });
    }
    console.error("Could not parse the Gemini conditions summary response.", error);
    return sendJson(response, 502, { error: "AI summary returned an unusable result. Please try again." });
  } finally {
    clearTimeout(timeout);
  }
};
