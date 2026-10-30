const {
  getAuthenticatedUser,
  requireUser,
  sendJson,
  supabaseRequest
} = require("../lib/supabase");
const { randomUUID } = require("node:crypto");

const ALLOWED_TYPES = new Set(["landslide", "roadblock"]);
const MAX_IMAGE_BASE64_LENGTH = 2_800_000;
const MAX_REPORTS_PER_REQUEST = 250;

function isValidImageData(data) {
  return typeof data === "string"
    && data.length > 0
    && data.length <= MAX_IMAGE_BASE64_LENGTH
    && data.length % 4 === 0
    && /^[A-Za-z0-9+/]+={0,2}$/.test(data);
}

function toClientReport(report, isOwner) {
  const precise = isOwner || report.status !== "approved";
  return {
    id: report.id,
    type: report.type,
    location: report.location,
    description: report.description,
    latitude: precise ? report.latitude : Number(report.latitude.toFixed(3)),
    longitude: precise ? report.longitude : Number(report.longitude.toFixed(3)),
    locationMode: report.location_mode,
    createdAt: Date.parse(report.created_at),
    aiReviewStatus: report.ai_review ? "complete" : "not-requested",
    aiReview: report.ai_review,
    humanReviewStatus: report.status,
    humanApprovedAt: report.reviewed_at ? Date.parse(report.reviewed_at) : null,
    status: report.status === "approved" ? "Human approved" : "Pending human review",
    confidenceLevel: report.status === "approved" ? "verified" : "unverified",
    distance: "Shared community report"
  };
}

async function loadReports(user) {
  const fields = "id,type,location,description,latitude,longitude,location_mode,created_at,ai_review,status,reviewed_at,author_id";
  const approvedQuery = new URLSearchParams({
    select: fields,
    status: "eq.approved",
    order: "created_at.desc",
    limit: String(MAX_REPORTS_PER_REQUEST)
  });
  const { response: approvedResponse, data: approvedData } = await supabaseRequest(
    `/rest/v1/reports?${approvedQuery}`,
    { serviceRole: true }
  );
  if (!approvedResponse.ok) {
    console.error("Could not load shared approved reports.", approvedData);
    throw new Error("Could not load community reports.");
  }
  const reports = approvedData.map((report) => toClientReport(report, report.author_id === user?.id));

  if (user) {
    const ownQuery = new URLSearchParams({
      select: fields,
      author_id: `eq.${user.id}`,
      status: "eq.pending",
      order: "created_at.desc",
      limit: String(MAX_REPORTS_PER_REQUEST)
    });
    const { response: ownResponse, data: ownData } = await supabaseRequest(
      `/rest/v1/reports?${ownQuery}`,
      { serviceRole: true }
    );
    if (!ownResponse.ok) {
      console.error("Could not load the user's pending reports.", ownData);
      throw new Error("Could not load your pending reports.");
    }
    reports.push(...ownData.map((report) => toClientReport(report, true)));
  }

  return reports.sort((first, second) => second.createdAt - first.createdAt);
}

async function verifyOwnedReport(reportId, user) {
  const query = new URLSearchParams({
    select: "id",
    id: `eq.${reportId}`,
    author_id: `eq.${user.id}`,
    limit: "1"
  });
  const { response, data } = await supabaseRequest(`/rest/v1/reports?${query}`, {
    serviceRole: true
  });
  if (!response.ok) throw new Error("Could not verify report ownership.");
  return data.length > 0;
}

async function createReport(request, response, user) {
  const body = request.body ?? {};
  const image = body.image;
  if (body.shareConsent !== true) {
    return sendJson(response, 400, { error: "Explicit consent to share the report and evidence is required." });
  }
  if (!ALLOWED_TYPES.has(body.type)) {
    return sendJson(response, 400, { error: "Choose landslide or road block." });
  }
  if (
    typeof body.location !== "string"
    || !body.location.trim()
    || body.location.trim().length > 70
    || typeof body.description !== "string"
    || !body.description.trim()
    || body.description.trim().length > 240
  ) {
    return sendJson(response, 400, { error: "Add a nearby place and a short description." });
  }
  if (
    !image
    || image.mimeType !== "image/jpeg"
    || !isValidImageData(image.data)
  ) {
    return sendJson(response, 400, { error: "Provide a resized JPEG photo under 2 MB." });
  }
  if (
    !Number.isFinite(body.latitude)
    || body.latitude < -90
    || body.latitude > 90
    || !Number.isFinite(body.longitude)
    || body.longitude < -180
    || body.longitude > 180
    || !["gps", "sample"].includes(body.locationMode)
  ) {
    return sendJson(response, 400, { error: "Capture GPS or choose the labeled reference location." });
  }

  const photoBytes = Buffer.from(image.data, "base64");
  if (
    photoBytes.length > 2 * 1024 * 1024
    || photoBytes.length < 3
    || photoBytes[0] !== 0xff
    || photoBytes[1] !== 0xd8
    || photoBytes[2] !== 0xff
  ) {
    return sendJson(response, 400, { error: "The report photo is not a valid resized JPEG." });
  }
  const reportId = randomUUID();
  const photoPath = `${user.id}/${reportId}.jpg`;
  const upload = await supabaseRequest(
    `/storage/v1/object/hazard-evidence/${photoPath}`,
    {
      method: "POST",
      serviceRole: true,
      body: photoBytes,
      headers: { "Content-Type": "image/jpeg", "x-upsert": "false" }
    }
  );
  if (!upload.response.ok) {
    console.error("Could not upload report evidence.", upload.data);
    return sendJson(response, 502, { error: "Could not store the report photo. The report was not saved." });
  }

  const { response: insertResponse, data } = await supabaseRequest("/rest/v1/reports", {
    method: "POST",
    serviceRole: true,
    headers: { Prefer: "return=representation" },
    body: {
      id: reportId,
      author_id: user.id,
      type: body.type,
      location: body.location.trim(),
      description: body.description.trim(),
      latitude: body.latitude,
      longitude: body.longitude,
      location_mode: body.locationMode,
      photo_path: photoPath
    }
  });
  if (!insertResponse.ok || !Array.isArray(data) || !data[0]) {
    console.error("Could not save report metadata.", data);
    await supabaseRequest("/storage/v1/object/remove/hazard-evidence", {
      method: "POST",
      serviceRole: true,
      body: { prefixes: [photoPath] }
    }).catch((error) => console.error("Could not remove an orphaned report photo.", error));
    return sendJson(response, 502, { error: "Could not save the report. Try again shortly." });
  }
  return sendJson(response, 201, { report: toClientReport(data[0], true) });
}

async function saveAiReview(request, response, user) {
  const body = request.body ?? {};
  const review = body.aiReview;
  if (
    typeof body.reportId !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.reportId)
    || !review
    || !["likely_match", "uncertain", "likely_mismatch"].includes(review.category)
    || !["low", "medium", "high"].includes(review.confidence)
    || typeof review.reason !== "string"
    || !review.reason.trim()
    || review.reason.length > 240
    || review.humanReviewRequired !== true
  ) {
    return sendJson(response, 400, { error: "The AI triage result is invalid." });
  }
  if (!await verifyOwnedReport(body.reportId, user)) {
    return sendJson(response, 404, { error: "Report not found." });
  }
  const query = new URLSearchParams({
    id: `eq.${body.reportId}`,
    author_id: `eq.${user.id}`,
    select: "id"
  });
  const { response: updateResponse, data } = await supabaseRequest(`/rest/v1/reports?${query}`, {
    method: "PATCH",
    serviceRole: true,
    headers: { Prefer: "return=representation" },
    body: { ai_review: review }
  });
  if (!updateResponse.ok || !Array.isArray(data) || data.length !== 1) {
    console.error("Could not save the optional AI triage result.", data);
    return sendJson(response, 502, { error: "AI triage completed, but its result could not be saved." });
  }
  return sendJson(response, 200, { saved: true });
}

module.exports = async function reports(request, response) {
  try {
    if (request.method === "GET") {
      const user = await getAuthenticatedUser(request);
      const reports = await loadReports(user);
      return sendJson(response, 200, { reports });
    }
    if (request.method === "POST") {
      const user = await requireUser(request, response);
      if (!user) return;
      const contentLength = Number(request.headers["content-length"]);
      if (Number.isFinite(contentLength) && contentLength > 3_900_000) {
        return sendJson(response, 413, { error: "The resized photo exceeds the report request limit." });
      }
      if (!request.headers["content-type"]?.includes("application/json")) {
        return sendJson(response, 415, { error: "Send the report as JSON." });
      }
      return await createReport(request, response, user);
    }
    if (request.method === "PATCH") {
      const user = await requireUser(request, response);
      if (!user) return;
      return await saveAiReview(request, response, user);
    }
    response.setHeader("Allow", "GET, POST, PATCH");
    return sendJson(response, 405, { error: "Use GET, POST, or PATCH for community reports." });
  } catch (error) {
    console.error("Community report request failed.", error);
    return sendJson(response, error.status ?? 502, {
      error: error.status === 503 ? error.message : "The community report service is unavailable. Try again shortly."
    });
  }
};
