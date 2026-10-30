const SESSION_KEY = "hillguard-active-session";
const statusElement = document.querySelector("#moderation-status");
const queueElement = document.querySelector("#moderation-queue");
const countElement = document.querySelector("#moderation-count");
const refreshButton = document.querySelector("#refresh-moderation");

function getSession() {
  const stored = sessionStorage.getItem(SESSION_KEY);
  if (!stored) return null;
  try {
    const session = JSON.parse(stored);
    return typeof session.accessToken === "string"
      && typeof session.refreshToken === "string"
      && Number.isFinite(session.expiresAt)
      ? session
      : null;
  } catch (error) {
    console.error("Could not read the moderator login session.", error);
    return null;
  }
}

let session = getSession();

async function refreshSession() {
  if (!session?.refreshToken) throw new Error("Log in on the dashboard before opening the review queue.");
  const response = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "refresh", refreshToken: session.refreshToken })
  });
  const result = await response.json();
  if (!response.ok) {
    sessionStorage.removeItem(SESSION_KEY);
    session = null;
    throw new Error(result.error || "Your login expired. Log in again.");
  }
  session = result;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

async function moderatorRequest(path, { method = "GET", body } = {}, retried = false) {
  if (!session) throw new Error("Log in on the dashboard before opening the review queue.");
  if (session.expiresAt <= Date.now() + 30_000) await refreshSession();
  const response = await fetch(path, {
    method,
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" })
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store"
  });
  const responseText = await response.text();
  let result;
  try {
    result = responseText ? JSON.parse(responseText) : {};
  } catch {
    throw new Error("The moderation API is unavailable. Configure Supabase and run the Vercel server.");
  }
  if (response.status === 401 && !retried && session.refreshToken) {
    await refreshSession();
    return moderatorRequest(path, { method, body }, true);
  }
  if (!response.ok) throw new Error(result.error || `The server returned HTTP ${response.status}.`);
  return result;
}

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function renderReport(report) {
  const card = document.createElement("article");
  card.className = "moderation-card";
  const details = document.createElement("div");
  details.className = "moderation-details";
  details.append(
    createTextElement("p", "section-kicker", `${report.type === "landslide" ? "LANDSLIDE" : "ROAD BLOCK"} · ${new Date(report.createdAt).toLocaleString()}`),
    createTextElement("h2", "", report.location),
    createTextElement("p", "", report.description),
    createTextElement("p", "moderation-location", `${report.locationMode === "gps" ? "GPS" : "Reference location"} · ${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}`)
  );
  const image = document.createElement("img");
  image.className = "moderation-evidence";
  image.src = report.evidenceUrl;
  image.alt = `Evidence photo submitted for ${report.type} report`;
  image.loading = "lazy";
  image.referrerPolicy = "no-referrer";
  const actions = document.createElement("div");
  actions.className = "moderation-actions";
  const approve = createTextElement("button", "primary-button", "Approve report");
  approve.type = "button";
  const reject = createTextElement("button", "secondary-button", "Reject report");
  reject.type = "button";
  approve.addEventListener("click", () => void submitReview(report.id, "approved", card, [approve, reject]));
  reject.addEventListener("click", () => void submitReview(report.id, "rejected", card, [approve, reject]));
  actions.append(approve, reject);
  card.append(details, image, actions);
  return card;
}

async function loadQueue() {
  refreshButton.disabled = true;
  statusElement.textContent = "Loading pending reports…";
  try {
    const result = await moderatorRequest("/api/moderation");
    queueElement.replaceChildren(...result.reports.map(renderReport));
    countElement.textContent = `${result.reports.length} pending`;
    statusElement.textContent = result.reports.length
      ? "Review each report and evidence independently. Decisions update server records and account tiers."
      : "The moderation queue is empty.";
  } catch (error) {
    console.error("Could not load the moderator review queue.", error);
    statusElement.textContent = error.message;
    countElement.textContent = "Unavailable";
    queueElement.replaceChildren();
  } finally {
    refreshButton.disabled = false;
  }
}

async function submitReview(reportId, decision, card, buttons) {
  if (!window.confirm(`${decision === "approved" ? "Approve" : "Reject"} this report? This decision will be visible to the community.`)) return;
  buttons.forEach((button) => { button.disabled = true; });
  try {
    await moderatorRequest("/api/moderation", {
      method: "POST",
      body: { reportId, decision }
    });
    card.remove();
    const remaining = queueElement.querySelectorAll(".moderation-card").length;
    countElement.textContent = `${remaining} pending`;
    statusElement.textContent = `Report ${decision}. The server has saved the moderation decision.`;
  } catch (error) {
    console.error("Could not save the moderation decision.", error);
    statusElement.textContent = error.message;
    buttons.forEach((button) => { button.disabled = false; });
  }
}

refreshButton.addEventListener("click", () => void loadQueue());
void loadQueue();
