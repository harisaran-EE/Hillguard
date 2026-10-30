function sendJson(response, status, payload) {
  response.status(status);
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

function readConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceRoleKey) {
    const error = new Error("Server storage is not configured. Set the Supabase project URL, anon key, and service-role key in Vercel.");
    error.status = 503;
    throw error;
  }
  return { url, anonKey, serviceRoleKey };
}

function parseResponseBody(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: "The storage service returned an invalid response." };
  }
}

async function supabaseRequest(path, options = {}) {
  const config = readConfig();
  const serviceRole = options.serviceRole === true;
  const apiKey = serviceRole ? config.serviceRoleKey : config.anonKey;
  const headers = {
    apikey: apiKey,
    Authorization: `Bearer ${options.token || apiKey}`,
    ...options.headers
  };
  let body = options.body;
  if (
    body !== undefined
    && body !== null
    && typeof body !== "string"
    && !(body instanceof ArrayBuffer)
    && !ArrayBuffer.isView(body)
    && !(typeof FormData !== "undefined" && body instanceof FormData)
  ) {
    headers["Content-Type"] ??= "application/json";
    body = JSON.stringify(body);
  }
  const response = await fetch(`${config.url}${path}`, {
    method: options.method ?? "GET",
    headers,
    body
  });
  const data = parseResponseBody(await response.text());
  return { response, data };
}

function bearerToken(request) {
  const authorization = request.headers.authorization;
  if (typeof authorization !== "string") return "";
  const match = authorization.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? "";
}

async function getAuthenticatedUser(request) {
  const token = bearerToken(request);
  if (!token) return null;
  const { response, data } = await supabaseRequest("/auth/v1/user", { token });
  if (!response.ok) return null;
  if (!data || typeof data.id !== "string" || typeof data.email !== "string") return null;
  return { id: data.id, email: data.email.toLowerCase() };
}

function getModeratorUserIds() {
  return new Set(
    (process.env.MODERATOR_USER_IDS ?? "")
      .split(",")
      .map((userId) => userId.trim().toLowerCase())
      .filter((userId) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(userId))
  );
}

async function requireUser(request, response) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    sendJson(response, 401, { error: "Log in to continue." });
    return null;
  }
  return user;
}

module.exports = {
  bearerToken,
  getAuthenticatedUser,
  getModeratorUserIds,
  parseResponseBody,
  readConfig,
  requireUser,
  sendJson,
  supabaseRequest
};
