const {
  getModeratorUserIds,
  requireUser,
  sendJson,
  supabaseRequest
} = require("../lib/supabase");

const MODERATION_LIMIT = 50;

async function requireModerator(request, response) {
  const user = await requireUser(request, response);
  if (!user) return null;
  if (!getModeratorUserIds().has(user.id)) {
    sendJson(response, 403, { error: "This account is not authorized to review reports." });
    return null;
  }
  return user;
}

async function signedEvidenceUrl(photoPath) {
  const { response, data } = await supabaseRequest(
    `/storage/v1/object/sign/hazard-evidence/${photoPath}`,
    {
      method: "POST",
      serviceRole: true,
      body: { expiresIn: 300 }
    }
  );
  if (!response.ok || typeof data?.signedURL !== "string") {
    console.error("Could not create a temporary moderator evidence link.", data);
    throw new Error("Could not load a report photo.");
  }
  return data.signedURL.startsWith("http")
    ? data.signedURL
    : `${process.env.SUPABASE_URL.replace(/\/+$/, "")}/storage/v1${data.signedURL}`;
}

async function loadPendingReports() {
  const query = new URLSearchParams({
    select: "id,type,location,description,latitude,longitude,location_mode,created_at,photo_path,author_id",
    status: "eq.pending",
    order: "created_at.asc",
    limit: String(MODERATION_LIMIT)
  });
  const { response, data } = await supabaseRequest(`/rest/v1/reports?${query}`, {
    serviceRole: true
  });
  if (!response.ok) {
    console.error("Could not load the moderation queue.", data);
    throw new Error("Could not load the moderation queue.");
  }
  return Promise.all(data.map(async (report) => ({
    id: report.id,
    type: report.type,
    location: report.location,
    description: report.description,
    latitude: report.latitude,
    longitude: report.longitude,
    locationMode: report.location_mode,
    createdAt: report.created_at,
    evidenceUrl: await signedEvidenceUrl(report.photo_path)
  })));
}

async function reviewReport(request, response, moderator) {
  const body = request.body ?? {};
  if (
    typeof body.reportId !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.reportId)
    || !["approved", "rejected"].includes(body.decision)
  ) {
    return sendJson(response, 400, { error: "Choose an approval decision for a valid report." });
  }
  const query = new URLSearchParams({
    id: `eq.${body.reportId}`,
    status: "eq.pending",
    select: "id,status"
  });
  const { response: updateResponse, data } = await supabaseRequest(`/rest/v1/reports?${query}`, {
    method: "PATCH",
    serviceRole: true,
    headers: { Prefer: "return=representation" },
    body: {
      status: body.decision,
      reviewer_id: moderator.id,
      reviewed_at: new Date().toISOString()
    }
  });
  if (!updateResponse.ok) {
    console.error("Could not update the reviewed report.", data);
    return sendJson(response, 502, { error: "Could not save the review decision. Try again." });
  }
  if (!Array.isArray(data) || data.length !== 1) {
    return sendJson(response, 409, { error: "This report has already been reviewed or no longer exists." });
  }
  return sendJson(response, 200, { reviewed: true, status: body.decision });
}

module.exports = async function moderation(request, response) {
  try {
    const moderator = await requireModerator(request, response);
    if (!moderator) return;
    if (request.method === "GET") {
      return sendJson(response, 200, { reports: await loadPendingReports() });
    }
    if (request.method === "POST") {
      const contentLength = Number(request.headers["content-length"]);
      if (Number.isFinite(contentLength) && contentLength > 4000) {
        return sendJson(response, 413, { error: "The moderation request is too large." });
      }
      if (!request.headers["content-type"]?.includes("application/json")) {
        return sendJson(response, 415, { error: "Send the moderation decision as JSON." });
      }
      return await reviewReport(request, response, moderator);
    }
    response.setHeader("Allow", "GET, POST");
    return sendJson(response, 405, { error: "Use GET or POST for moderation." });
  } catch (error) {
    console.error("Moderation request failed.", error);
    return sendJson(response, error.status ?? 502, {
      error: error.status === 503 ? error.message : "The moderation service is unavailable. Try again shortly."
    });
  }
};
