const { getModeratorUserIds, requireUser, sendJson, supabaseRequest } = require("../lib/supabase");

module.exports = async function profile(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return sendJson(response, 405, { error: "Use GET to load your account profile." });
  }

  try {
    const user = await requireUser(request, response);
    if (!user) return;
    const query = new URLSearchParams({
      select: "id",
      author_id: `eq.${user.id}`,
      status: "eq.approved",
      location_mode: "eq.gps",
      limit: "1"
    });
    const { response: upstream, data } = await supabaseRequest(`/rest/v1/reports?${query}`, {
      serviceRole: true,
      headers: { Prefer: "count=exact" }
    });
    if (!upstream.ok) {
      console.error("Could not load the account's approved report count.", data);
      return sendJson(response, 502, { error: "Could not load your report tier. Try again shortly." });
    }
    const range = upstream.headers.get("content-range") ?? "";
    const countMatch = range.match(/\/(\d+)$/);
    if (!countMatch) {
      console.error("Supabase did not return an exact approved-report count.", range);
      return sendJson(response, 502, { error: "Could not verify your report tier." });
    }
    const approvedReportCount = Number(countMatch[1]);
    return sendJson(response, 200, {
      email: user.email,
      approvedReportCount,
      tier: approvedReportCount >= 20 ? "SAVIOUR" : approvedReportCount >= 5 ? "GUARDIAN" : "SCOUT",
      isModerator: getModeratorUserIds().has(user.id)
    });
  } catch (error) {
    console.error("Could not load the authenticated account profile.", error);
    return sendJson(response, error.status ?? 502, {
      error: error.status === 503 ? error.message : "Could not load your account profile."
    });
  }
};
