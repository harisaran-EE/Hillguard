const DATABASE_NAME = "hillguard-local";
const DATABASE_VERSION = 1;
const REPORTS_STORE = "reports";
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const CLUSTER_RADIUS_KM = 2;
const CLUSTER_WINDOW_MS = 60 * 60 * 1000;
const GEOFENCE_RADIUS_KM = 5;
const SAMPLE_LOCATION = { latitude: 26.141, longitude: 91.735 };
const SAMPLE_HAZARDS = [
  { latitude: 26.1698, longitude: 91.735, label: "NH-27 · sample slope report", type: "landslide" },
  { latitude: 26.213, longitude: 91.735, label: "Sample road restriction", type: "roadblock" }
];

const typeNames = {
  landslide: "Landslide",
  rockfall: "Rockfall",
  roadblock: "Road blockage",
  flooding: "Flooding"
};
const typeSymbols = {
  landslide: "⌁",
  rockfall: "△",
  roadblock: "⊘",
  flooding: "≈"
};
const sampleReports = [
  {
    id: "sample-1",
    type: "landslide",
    location: "NH-27 · Ridge pass",
    distance: "3.2 km · sample",
    time: "EXAMPLE REPORT",
    description: "Illustrative slope movement report. Conditions have not been checked.",
    status: "Sample · unverified",
    confidence: "Unverified",
    confidenceLevel: "unverified"
  },
  {
    id: "sample-2",
    type: "roadblock",
    location: "Pine bend",
    distance: "8.1 km · sample",
    time: "EXAMPLE REPORT",
    description: "Illustrative road restriction. No live closure information is available.",
    status: "Sample · medium",
    confidence: "Medium confidence",
    confidenceLevel: "medium"
  },
  {
    id: "sample-3",
    type: "rockfall",
    location: "Upper pass",
    distance: "11.4 km · sample",
    time: "EXAMPLE REPORT",
    description: "Fictional marker to demonstrate report categories and confidence colors.",
    status: "Sample · threshold",
    confidence: "Threshold · demo",
    confidenceLevel: "verified"
  }
];

const elements = {
  connectivity: document.querySelector("#connectivity"),
  connectivityLabel: document.querySelector("#connectivity-label"),
  safetyTitle: document.querySelector("#safety-title"),
  safetyDescription: document.querySelector("#safety-description"),
  queueCount: document.querySelector("#queue-count"),
  locationSummary: document.querySelector("#location-summary"),
  mapLocationLabel: document.querySelector("#map-location-label"),
  hazardAlert: document.querySelector("#hazard-alert"),
  alertCopy: document.querySelector("#alert-copy"),
  incidentList: document.querySelector("#incident-list"),
  reportCount: document.querySelector("#report-count"),
  filterAllCount: document.querySelector("#filter-all-count"),
  riskScore: document.querySelector("#risk-score"),
  riskScoreWrap: document.querySelector("#risk-score-wrap"),
  riskLevel: document.querySelector("#risk-level"),
  reportDialog: document.querySelector("#report-dialog"),
  guideDialog: document.querySelector("#guide-dialog"),
  routeDialog: document.querySelector("#route-dialog"),
  reportForm: document.querySelector("#report-form"),
  reportPhoto: document.querySelector("#report-photo"),
  photoPreview: document.querySelector("#photo-preview"),
  capturedLocation: document.querySelector("#captured-location"),
  toast: document.querySelector("#toast"),
  xpTotal: document.querySelector("#xp-total"),
  reputationBadge: document.querySelector("#reputation-badge")
};

let database;
let savedReports = [];
let currentFilter = "all";
let currentLocation = null;
let capturedReportLocation = null;
let photoPreviewUrl = null;
let toastTimeout;
let installPrompt;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(REPORTS_STORE, { keyPath: "id" });
      store.createIndex("createdAt", "createdAt");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local report storage."));
    request.onblocked = () => reject(new Error("Local report storage is blocked by another open tab."));
  });
}

function readSavedReports() {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(REPORTS_STORE, "readonly");
    const request = transaction.objectStore(REPORTS_STORE).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not read locally saved reports."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Reading locally saved reports failed."));
  });
}

function writeReport(report) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(REPORTS_STORE, "readwrite");
    transaction.objectStore(REPORTS_STORE).put(report);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save your report."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Saving your report was interrupted."));
  });
}

function getLocalLocation() {
  if (!currentLocation) return null;
  return {
    latitude: currentLocation.latitude,
    longitude: currentLocation.longitude
  };
}

function haversineDistanceKm(first, second) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const latitudeDifference = radians(second.latitude - first.latitude);
  const longitudeDifference = radians(second.longitude - first.longitude);
  const firstLatitude = radians(first.latitude);
  const secondLatitude = radians(second.latitude);
  const arc = Math.sin(latitudeDifference / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDifference / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

function calculateConfidence(report, reports) {
  const matchingReports = reports.filter((other) =>
    Math.abs(other.createdAt - report.createdAt) <= CLUSTER_WINDOW_MS
      && haversineDistanceKm(report, other) <= CLUSTER_RADIUS_KM
  );
  const count = matchingReports.length;

  if (count >= 4) {
    return { count, label: "Threshold reached · demo", level: "verified" };
  }
  if (count >= 2) {
    return { count, label: "Medium confidence · demo", level: "medium" };
  }
  return { count, label: "Unverified · demo", level: "unverified" };
}

async function refreshSavedReports() {
  savedReports = await readSavedReports();
  const reportsById = new Map(savedReports.map((report) => [report.id, report]));
  let changed = false;

  for (const report of savedReports) {
    const confidence = calculateConfidence(report, savedReports);
    if (
      report.confidenceCount !== confidence.count
      || report.confidence !== confidence.label
      || report.confidenceLevel !== confidence.level
    ) {
      changed = true;
    }
    report.confidenceCount = confidence.count;
    report.confidence = confidence.label;
    report.confidenceLevel = confidence.level;
    if (confidence.level === "verified" && !report.xpAwarded) {
      report.xpAwarded = true;
      changed = true;
    }
  }

  if (changed) {
    await Promise.all(savedReports.map(writeReport));
  }

  renderReports();
  renderReputation();
  renderQueueCount();
  updateGeofenceAlert();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function formatRelativeTime(timestamp) {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "JUST NOW";
  if (minutes < 60) return `${minutes} MIN AGO`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} HR AGO`;
  return `${Math.floor(hours / 24)} DAY AGO`;
}

function renderReportCard(report, local) {
  const icon = escapeHtml(typeSymbols[report.type] ?? "•");
  const typeName = escapeHtml(typeNames[report.type] ?? "Hazard report");
  const confidenceLevel = ["medium", "verified"].includes(report.confidenceLevel)
    ? report.confidenceLevel
    : "unverified";
  const label = local ? report.confidence : report.status;
  const tag = local ? `${report.confidenceCount} ${report.confidenceCount === 1 ? "REPORT" : "REPORTS"}` : "EXAMPLE";
  const photoNote = local && report.photoName
    ? `<span class="photo-attached">PHOTO ATTACHED</span>`
    : "";
  const locationDescription = local && report.locationMode === "sample"
    ? "Sample coordinates · test only"
    : local
      ? `${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}`
      : escapeHtml(report.distance);

  return `
    <article class="incident-card">
      <div class="incident-topline">
        <span class="type-badge"><span class="type-icon ${escapeHtml(report.type)}" aria-hidden="true">${icon}</span>${typeName}</span>
        <span class="incident-time">${local ? formatRelativeTime(report.createdAt) : report.time}</span>
      </div>
      <div class="incident-location">
        <h3>${escapeHtml(report.location)}</h3>
        <span class="distance">${locationDescription}</span>
      </div>
      <p class="incident-description">${escapeHtml(report.description)}</p>
      <div class="incident-footer">
        <span class="verification ${confidenceLevel}"><i class="verification-dot" aria-hidden="true"></i>${escapeHtml(label)}</span>
        <span class="confidence-tag ${confidenceLevel}">${escapeHtml(tag)}</span>
      </div>
      ${photoNote}
    </article>
  `;
}

function renderReports() {
  const allReports = [
    ...savedReports.map((report) => ({ ...report, local: true })),
    ...sampleReports.map((report) => ({ ...report, local: false }))
  ];
  const visibleReports = allReports.filter((report) =>
    currentFilter === "all" || report.type === currentFilter
  );

  elements.reportCount.textContent = `${allReports.length} ${allReports.length === 1 ? "report" : "reports"} · samples included`;
  elements.filterAllCount.textContent = String(allReports.length);

  if (visibleReports.length === 0) {
    elements.incidentList.innerHTML = '<p class="empty-state">No reports in this category yet. You can add a local demo report.</p>';
    return;
  }

  elements.incidentList.innerHTML = visibleReports
    .map((report) => renderReportCard(report, report.local))
    .join("");
}

function renderReputation() {
  const points = savedReports.filter((report) => report.xpAwarded).length * 50;
  const badge = points >= 601 ? "GUARDIAN" : points >= 201 ? "SENTINEL" : "SCOUT";
  elements.xpTotal.textContent = String(points);
  elements.reputationBadge.textContent = badge;
}

function renderQueueCount() {
  elements.queueCount.textContent = `${savedReports.length} LOCAL`;
}

function updateConnectivity() {
  const online = navigator.onLine;
  elements.connectivity.classList.toggle("offline", !online);
  elements.connectivityLabel.textContent = online ? "Online · local only" : "Offline engine active";
  elements.safetyTitle.textContent = online ? "Offline-ready guide" : "Offline mode · local data";
  elements.safetyDescription.textContent = online
    ? "Emergency steps are cached. Reports stay on this device; no sync server is configured."
    : "Cached safety guide and saved reports are available. New reports remain on this device.";
}

function updateGeofenceAlert() {
  const location = getLocalLocation();
  if (!location) {
    elements.hazardAlert.hidden = true;
    return;
  }

  const nearest = SAMPLE_HAZARDS
    .map((hazard) => ({ hazard, distance: haversineDistanceKm(location, hazard) }))
    .filter((entry) => entry.distance <= GEOFENCE_RADIUS_KM)
    .sort((first, second) => first.distance - second.distance)[0];

  if (!nearest) {
    elements.hazardAlert.hidden = true;
    return;
  }

  elements.alertCopy.textContent = `${nearest.hazard.label} is approximately ${nearest.distance.toFixed(1)} km away. Sample data only; not a real-world warning.`;
  elements.hazardAlert.hidden = false;
}

function updateRiskScore() {
  const rainfall = Number(document.querySelector("#rainfall-input").value);
  const slope = Number(document.querySelector("#slope-input").value);
  const history = Number(document.querySelector("#history-input").value);
  const score = Math.max(1, Math.min(10, rainfall + slope + history));
  let level;

  if (score <= 3) level = { id: "safe", label: "LOW · SAMPLE" };
  else if (score <= 6) level = { id: "watch", label: "MODERATE · SAMPLE" };
  else if (score <= 8) level = { id: "high", label: "HIGH · SAMPLE" };
  else level = { id: "critical", label: "CRITICAL · SAMPLE" };

  elements.riskScore.textContent = String(score);
  elements.riskLevel.textContent = level.label;
  elements.riskScoreWrap.dataset.level = level.id;
}

function openRoutePreview() {
  const location = getLocalLocation();
  const nearbyHazard = location && SAMPLE_HAZARDS.some((hazard) =>
    haversineDistanceKm(location, hazard) <= GEOFENCE_RADIUS_KM
  );
  document.querySelector("#route-copy").textContent = nearbyHazard
    ? "A sample hazard falls within the 5 km demo radius. The route option below is illustrative, not navigable."
    : "No sample marker is within the 5 km demo radius. Directions and live road checks are not connected.";
  elements.routeDialog.showModal();
}

function showToast(message) {
  window.clearTimeout(toastTimeout);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  toastTimeout = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 5000);
}

function setCurrentLocation(location, label, mode) {
  currentLocation = { ...location, mode };
  elements.locationSummary.textContent = label;
  elements.mapLocationLabel.textContent = label;
  updateGeofenceAlert();
}

function captureGps() {
  if (!navigator.geolocation) {
    elements.capturedLocation.textContent = "GPS is not available in this browser.";
    return;
  }

  elements.capturedLocation.textContent = "Waiting for GPS permission…";
  navigator.geolocation.getCurrentPosition(
    (position) => {
      capturedReportLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        mode: "gps"
      };
      const capturedTime = new Date();
      elements.capturedLocation.textContent = `${capturedReportLocation.latitude.toFixed(5)}, ${capturedReportLocation.longitude.toFixed(5)} · ${capturedTime.toLocaleTimeString()}`;
    },
    (error) => {
      const messages = {
        1: "Location permission was denied. Allow it in your browser settings or use a sample location for testing.",
        2: "Your location could not be determined. Try again or use a sample location for testing.",
        3: "GPS took too long to respond. Try again or use a sample location for testing."
      };
      capturedReportLocation = null;
      elements.capturedLocation.textContent = messages[error.code] ?? `Could not capture GPS: ${error.message}`;
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
  );
}

function formatConfidenceSummary(reports) {
  const verified = reports.filter((report) => report.confidenceLevel === "verified").length;
  if (verified > 0) {
    return `${verified} report${verified === 1 ? "" : "s"} reached the local demo confidence threshold. This is not official verification.`;
  }
  return "Report saved locally. Nothing was sent or synced.";
}

async function handleReportSubmit(event) {
  event.preventDefault();
  if (!elements.reportForm.reportValidity()) return;

  const formData = new FormData(elements.reportForm);
  const photo = elements.reportPhoto.files[0];
  if (!photo || !photo.type.startsWith("image/")) {
    showToast("Choose an image photo before saving the report.");
    return;
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    showToast("This prototype accepts photos up to 8 MB. Choose a smaller image.");
    return;
  }
  if (!capturedReportLocation) {
    showToast("Capture GPS or choose the explicitly labeled sample location before saving.");
    return;
  }

  const report = {
    id: crypto.randomUUID(),
    type: String(formData.get("type")),
    location: String(formData.get("location")).trim(),
    description: String(formData.get("description")).trim(),
    latitude: capturedReportLocation.latitude,
    longitude: capturedReportLocation.longitude,
    locationMode: capturedReportLocation.mode,
    createdAt: Date.now(),
    photo,
    photoName: photo.name,
    xpAwarded: false
  };

  try {
    await writeReport(report);
    await refreshSavedReports();
    elements.reportForm.reset();
    capturedReportLocation = null;
    elements.capturedLocation.textContent = "Location not captured";
    clearPhotoPreview();
    elements.reportDialog.close();
    showToast(formatConfidenceSummary(savedReports));
  } catch (error) {
    console.error("Could not save the local hazard report.", error);
    showToast(`Report was not saved: ${error.message}`);
  }
}

function showPhotoPreview() {
  clearPhotoPreview();
  const photo = elements.reportPhoto.files[0];
  if (!photo || !photo.type.startsWith("image/")) return;
  photoPreviewUrl = URL.createObjectURL(photo);
  elements.photoPreview.innerHTML = `<img src="${photoPreviewUrl}" alt="Selected report photo preview">`;
  elements.photoPreview.hidden = false;
}

function clearPhotoPreview() {
  if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
  photoPreviewUrl = null;
  elements.photoPreview.replaceChildren();
  elements.photoPreview.hidden = true;
}

document.querySelector("#banner-dismiss").addEventListener("click", () => {
  document.querySelector(".prototype-banner").hidden = true;
});

document.querySelector("#alert-dismiss").addEventListener("click", () => {
  elements.hazardAlert.hidden = true;
});

document.querySelector("#open-report-dock").addEventListener("click", () => {
  capturedReportLocation = null;
  elements.capturedLocation.textContent = "Location not captured";
  elements.reportDialog.showModal();
});
document.querySelector("#open-guide").addEventListener("click", () => elements.guideDialog.showModal());
document.querySelector("#open-route").addEventListener("click", openRoutePreview);
document.querySelector("#route-action").addEventListener("click", openRoutePreview);

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});

document.querySelector("#capture-location").addEventListener("click", captureGps);

document.querySelector("#use-demo-report-location").addEventListener("click", () => {
  capturedReportLocation = { ...SAMPLE_LOCATION, mode: "sample" };
  elements.capturedLocation.textContent = `${SAMPLE_LOCATION.latitude.toFixed(5)}, ${SAMPLE_LOCATION.longitude.toFixed(5)} · sample coordinates`;
});

document.querySelector("#locate-me").addEventListener("click", () => {
  if (!navigator.geolocation) {
    showToast("This browser does not provide GPS location.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };
      setCurrentLocation(location, "GPS location active", "gps");
    },
    (error) => {
      const message = error.code === 1
        ? "Location permission was denied. You can use the sample position to preview the demo geofence."
        : "Could not determine location. Check GPS and try again, or use the sample position.";
      showToast(message);
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
  );
});

document.querySelector("#demo-location").addEventListener("click", () => {
  setCurrentLocation(SAMPLE_LOCATION, "Sample location · demo only", "sample");
  showToast("Sample position enabled. Any proximity banner is illustrative, not a real alert.");
});

document.querySelector(".report-filters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;

  currentFilter = button.dataset.filter;
  document.querySelectorAll(".filter-chip").forEach((filterButton) => {
    filterButton.setAttribute("aria-pressed", String(filterButton === button));
  });
  renderReports();
});

elements.reportPhoto.addEventListener("change", showPhotoPreview);
elements.reportForm.addEventListener("submit", handleReportSubmit);

["#rainfall-input", "#slope-input", "#history-input"].forEach((selector) => {
  document.querySelector(selector).addEventListener("change", updateRiskScore);
});

window.addEventListener("online", () => {
  updateConnectivity();
  showToast("Connection restored. Local reports are still on this device; server sync is not configured.");
});
window.addEventListener("offline", updateConnectivity);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  document.querySelector("#install-app").hidden = false;
});

document.querySelector("#install-app").addEventListener("click", async () => {
  if (!installPrompt) return;
  await installPrompt.prompt();
  const choice = await installPrompt.userChoice;
  if (choice.outcome === "accepted") showToast("Hillguard was added to your device.");
  installPrompt = null;
  document.querySelector("#install-app").hidden = true;
});

window.addEventListener("appinstalled", () => {
  document.querySelector("#install-app").hidden = true;
  showToast("Hillguard is ready on your device.");
});

updateConnectivity();
updateRiskScore();
renderReports();
renderReputation();
renderQueueCount();

openDatabase()
  .then((openedDatabase) => {
    database = openedDatabase;
    return refreshSavedReports();
  })
  .catch((error) => {
    console.error("Local report storage could not be initialized.", error);
    elements.safetyTitle.textContent = "Local storage unavailable";
    elements.safetyDescription.textContent = "Saved reports could not load. Check browser storage permissions and reload.";
    showToast(`Local reports are unavailable: ${error.message}`);
  });

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("/service-worker.js")
    .catch((error) => {
      console.error("The offline app shell could not be registered.", error);
      showToast("Offline caching could not be enabled. The app still works while this page is open.");
    });
}
