const { bearerToken, sendJson, supabaseRequest } = require("../lib/supabase");

const MAX_BODY_BYTES = 12_000;

module.exports = async function auth(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "Use POST for account actions." });
  }
  const contentLength = Number(request.headers["content-length"]);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return sendJson(response, 413, { error: "The account request is too large." });
  }

  const body = request.body ?? {};
  const { action } = body;
  const authRequests = {
    signup: { path: "/auth/v1/signup", payload: { email: body.email, password: body.password } },
    login: { path: "/auth/v1/token?grant_type=password", payload: { email: body.email, password: body.password } },
    refresh: { path: "/auth/v1/token?grant_type=refresh_token", payload: { refresh_token: body.refreshToken } }
  };
  if (action === "logout") {
    try {
      const token = bearerToken(request);
      if (token) {
        const { response: upstream } = await supabaseRequest("/auth/v1/logout", {
          method: "POST",
          token
        });
        if (!upstream.ok) {
          return sendJson(response, 502, { error: "The server could not end this session. Try again." });
        }
      }
      return sendJson(response, 200, { loggedOut: true });
    } catch (error) {
      console.error("Supabase logout request failed.", error);
      return sendJson(response, error.status ?? 502, {
        error: error.status === 503 ? error.message : "The logout service is unavailable."
      });
    }
  }
  if (!Object.hasOwn(authRequests, action)) {
    return sendJson(response, 400, { error: "Choose sign up, log in, or refresh the session." });
  }
  if (
    typeof body.email === "string"
    && (body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email))
  ) {
    return sendJson(response, 400, { error: "Enter a valid email address." });
  }
  if (
    ["signup", "login"].includes(action)
    && (typeof body.password !== "string"
      || (action === "signup" && body.password.length < 8)
      || body.password.length > 128)
  ) {
    return sendJson(response, 400, { error: "Password must be between 8 and 128 characters." });
  }
  if (action === "refresh" && (typeof body.refreshToken !== "string" || !body.refreshToken)) {
    return sendJson(response, 400, { error: "The login session expired. Log in again." });
  }

  try {
    const authRequest = authRequests[action];
    const { response: upstream, data } = await supabaseRequest(authRequest.path, {
      method: "POST",
      body: authRequest.payload
    });
    if (!upstream.ok) {
      const message = data?.msg || data?.message || data?.error_description;
      const status = upstream.status === 422 ? 409 : upstream.status;
      return sendJson(response, status, {
        error: action === "login"
          ? "Email or password is incorrect."
          : typeof message === "string"
            ? message.slice(0, 240)
            : "The account request could not be completed."
      });
    }

    if (action === "signup" && (!data.access_token || !data.refresh_token)) {
      return sendJson(response, 503, {
        error: "Supabase did not start a session. Disable email confirmation in the Supabase Auth settings, then try again."
      });
    }
    if (!data.access_token || !data.refresh_token || !data.user?.id || !data.user?.email) {
      return sendJson(response, 502, { error: "The authentication service returned an incomplete session." });
    }
    return sendJson(response, 200, {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Number(data.expires_at) * 1000 || Date.now() + Number(data.expires_in || 3600) * 1000,
      user: { id: data.user.id, email: data.user.email }
    });
  } catch (error) {
    console.error("Supabase authentication request failed.", error);
    return sendJson(response, error.status ?? 502, {
      error: error.status === 503
        ? error.message
        : "The authentication service is unavailable. Try again shortly."
    });
  }
};
