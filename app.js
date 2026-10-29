const DATABASE_NAME = "hillguard-local";
const DATABASE_VERSION = 1;
const REPORTS_STORE = "reports";
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const GEOFENCE_RADIUS_KM = 5;
const SAMPLE_WEATHER_LABEL = "Guwahati reference area";
const WEATHER_CACHE_KEY = "hillguard-weather-sample-v2";
const WEATHER_CACHE_TTL_MS = 30 * 60 * 1000;
const WEATHER_STALE_AFTER_MS = 2 * 60 * 60 * 1000;
const WEATHER_REQUEST_TIMEOUT_MS = 12000;
const RAIN_MAP_GRID_STEP_DEGREES = 0.12;
const RAIN_MAP_SPOT_RADIUS_METERS = 7000;
const HAZARD_GRID_DEGREES = 0.1;
const HAZARD_HISTORY_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;
const EARTHQUAKE_REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const EARTHQUAKE_REQUEST_TIMEOUT_MS = 15000;
const EARTHQUAKE_REGION = {
  minLatitude: 21,
  maxLatitude: 31,
  minLongitude: 88,
  maxLongitude: 98
};
const EARTHQUAKE_CACHE_KEY = "hillguard-usgs-earthquakes-v1";
const SAMPLE_LOCATION = { latitude: 26.141, longitude: 91.735 };
const SAMPLE_HAZARDS = [
  { latitude: 26.1698, longitude: 91.735, label: "NH-27 · sample slope report", type: "landslide" },
  { latitude: 26.213, longitude: 91.735, label: "Sample road restriction", type: "roadblock" }
];

const typeNames = {
  landslide: "Landslide",
  roadblock: "Road block"
};
const typeSymbols = {
  landslide: "⌁",
  roadblock: "⊘"
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
  }
];
const THUNDERSTORM_CODES = new Set([95, 96, 99]);
const RAIN_WEATHER_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, ...THUNDERSTORM_CODES]);
const RAINFALL_COLORS = {
  drizzle: "#10b981",
  moderate: "#f59e0b",
  rain: "#f97316",
  heavy: "#ef4444"
};

const elements = {
  connectivity: document.querySelector("#connectivity"),
  connectivityLabel: document.querySelector("#connectivity-label"),
  safetyTitle: document.querySelector("#safety-title"),
  safetyDescription: document.querySelector("#safety-description"),
  queueCount: document.querySelector("#queue-count"),
  locationSummary: document.querySelector("#location-summary"),
  rainMap: document.querySelector("#rain-map"),
  rainMapStatus: document.querySelector("#rain-map-status"),
  hazardAlert: document.querySelector("#hazard-alert"),
  alertCopy: document.querySelector("#alert-copy"),
  incidentList: document.querySelector("#incident-list"),
  hazardMapStatus: document.querySelector("#hazard-map-status"),
  hazardRefresh: document.querySelector("#refresh-hazards"),
  reportCount: document.querySelector("#report-count"),
  filterAllCount: document.querySelector("#filter-all-count"),
  reportDialog: document.querySelector("#report-dialog"),
  guideDialog: document.querySelector("#guide-dialog"),
  routeDialog: document.querySelector("#route-dialog"),
  reportForm: document.querySelector("#report-form"),
  reportPhoto: document.querySelector("#report-photo"),
  photoPreview: document.querySelector("#photo-preview"),
  capturedLocation: document.querySelector("#captured-location"),
  toast: document.querySelector("#toast"),
  successfulReportTotal: document.querySelector("#successful-report-total"),
  reputationBadge: document.querySelector("#reputation-badge"),
  reputationTitle: document.querySelector("#reputation-title"),
  reputationProgress: document.querySelector("#reputation-progress"),
  weatherCondition: document.querySelector("#weather-condition"),
  weatherLocation: document.querySelector("#weather-location"),
  weatherState: document.querySelector("#weather-state"),
  weatherUpdated: document.querySelector("#weather-updated"),
  rainAmount: document.querySelector("#rain-amount"),
  rainAmountLabel: document.querySelector("#rain-amount-label"),
  rainLevel: document.querySelector("#rain-level"),
  weatherRefresh: document.querySelector("#refresh-weather"),
  contactState: document.querySelector("#contact-state"),
  contactDistrict: document.querySelector("#contact-district"),
  contactDirectoryStatus: document.querySelector("#contact-directory-status"),
  contactList: document.querySelector("#contact-list")
};

let database;
let savedReports = [];
let currentFilter = "all";
let currentLocation = null;
let capturedReportLocation = null;
let photoPreviewUrl = null;
let toastTimeout;
let installPrompt;
let weatherRequestId = 0;
let weatherAbortController = null;
let currentWeather = null;
let rainfallMap;
let rainfallMapLayer;
let hazardActivityLayer;
let rainfallCenterMarker;
let rainfallMapTilesUnavailable = false;
let earthquakeEvents = [];
let earthquakeFetchedAtMs = 0;
let earthquakeFetchError = "";
let earthquakeCacheError = "";
let earthquakeAbortController = null;
let earthquakeRequestId = 0;

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "bright";
  const toggle = document.querySelector("#theme-toggle");
  const label = isDark ? "Switch to bright mode" : "Switch to dark mode";
  toggle.setAttribute("aria-label", label);
  toggle.setAttribute("title", label);
  toggle.setAttribute("aria-pressed", String(isDark));
  document.querySelector("#theme-label").textContent = isDark ? "Bright mode" : "Dark mode";
  document.querySelector('meta[name="theme-color"]').content = isDark ? "#0d1522" : "#0f172a";
}

function getSavedTheme() {
  try {
    return localStorage.getItem("hillguard-theme") === "dark" ? "dark" : "bright";
  } catch (error) {
    console.warn("Could not read the saved color theme.", error);
    return "bright";
  }
}

applyTheme(getSavedTheme());

document.querySelector("#theme-toggle").addEventListener("click", () => {
  const theme = document.documentElement.dataset.theme === "dark" ? "bright" : "dark";
  applyTheme(theme);
  try {
    localStorage.setItem("hillguard-theme", theme);
  } catch (error) {
    console.error("Could not save the color theme preference.", error);
    showToast("Theme changed, but this browser could not save your preference.");
  }
});

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

async function refreshSavedReports() {
  savedReports = await readSavedReports();
  renderReports();
  renderReputation();
  renderQueueCount();
  updateGeofenceAlert();
  renderHazardActivity();
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
  const isHumanApproved = local
    && report.humanReviewStatus === "approved"
    && Number.isFinite(report.humanApprovedAt);
  const confidenceLevel = local
    ? isHumanApproved ? "verified" : "unverified"
    : ["medium", "verified"].includes(report.confidenceLevel)
      ? report.confidenceLevel
      : "unverified";
  const label = local
    ? isHumanApproved
      ? "Human approved"
      : "Pending human review"
    : report.status;
  const tag = local ? "LOCAL" : "EXAMPLE";
  const saviourTag = local && getHumanApprovedReportCount() >= 20 && isHumanApproved
    ? '<span class="saviour-report-tag">SAVIOUR</span>'
    : "";
  const aiReview = local ? formatAiReviewSummary(report) : "";
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
      ${aiReview ? `<p class="ai-review-result">${escapeHtml(aiReview)}</p>` : ""}
      <div class="incident-footer">
        <span class="verification ${confidenceLevel}"><i class="verification-dot" aria-hidden="true"></i>${escapeHtml(label)}</span>
        <span class="confidence-tag ${confidenceLevel}">${escapeHtml(tag)}</span>
      </div>
      ${saviourTag}
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
    elements.incidentList.innerHTML = '<p class="empty-state">No reports in this category yet. Add a report with a captured location and photo.</p>';
    return;
  }

  elements.incidentList.innerHTML = visibleReports
    .map((report) => renderReportCard(report, report.local))
    .join("");
}

function renderReputation() {
  const successes = getHumanApprovedReportCount();
  const badge = successes >= 20 ? "SAVIOUR" : successes >= 5 ? "GUARDIAN" : "SCOUT";
  elements.successfulReportTotal.textContent = String(successes);
  elements.reputationBadge.textContent = badge;
  elements.reputationTitle.textContent = badge === "SAVIOUR"
    ? "Saviour · local"
    : badge === "GUARDIAN"
      ? "Guardian · local"
      : "Local report contributor";
  elements.reputationProgress.textContent = badge === "SAVIOUR"
    ? "Saviour tag shown on human-approved local reports"
    : badge === "GUARDIAN"
      ? `${successes} human-approved reports · stored on this device`
      : `Human moderation is not connected · ${successes}/5 approved`;
  elements.reputationBadge.dataset.rank = badge.toLowerCase();
}

function getHumanApprovedReportCount() {
  return savedReports.filter((report) =>
    report.locationMode !== "sample"
    && report.humanReviewStatus === "approved"
    && Number.isFinite(report.humanApprovedAt)
  ).length;
}

function formatAiReviewSummary(report) {
  if (report.aiReviewStatus === "pending") return "AI photo triage pending · human review required";
  if (report.aiReviewStatus === "offline") return "Saved offline · AI triage not requested";
  if (report.aiReviewStatus === "unavailable") return "AI triage unavailable · human review required";
  if (report.aiReviewStatus === "not-requested") return "AI triage not requested";
  if (report.aiReviewStatus !== "complete" || !report.aiReview) return "";

  const categories = {
    likely_match: "AI suggests the photo may match",
    uncertain: "AI is uncertain about the photo",
    likely_mismatch: "AI suggests the photo may not match"
  };
  const category = categories[report.aiReview.category] ?? categories.uncertain;
  return `${category} · ${report.aiReview.reason} · not verified; human review required`;
}

function renderQueueCount() {
  elements.queueCount.textContent = `${savedReports.length} LOCAL`;
}

function contactPhoneLink(phone, label) {
  const telephoneUri = phone.replace(/[^\d+]/g, "");
  return `<a class="contact-number" href="tel:${telephoneUri}">${escapeHtml(label)}</a>`;
}

function renderContactDirectory() {
  const state = CONTACT_STATES.find((entry) => entry.name === elements.contactState.value);
  const district = elements.contactDistrict.value;
  const selectedArea = state && district ? `${district}, ${state.name}` : "";
  const fireContacts = state ? FIRE_CONTACTS[state.name] : null;
  const districtControlRoom = district && fireContacts?.regionalControlRooms?.find((contact) =>
    contact.districts.includes(district)
  );
  const districtStations = fireContacts?.districtStations?.[district] ?? [];
  const hasLocalStationNumber = districtStations.length > 0;

  if (!state) {
    elements.contactDirectoryStatus.textContent = "National emergency and regional monitoring contacts are shown. Choose a state and district to check for a published local fire-station number.";
  } else if (district) {
    const fireStatus = hasLocalStationNumber
      ? "Officially listed contacts for the local fire stations are shown below."
      : districtControlRoom
        ? "No direct station number was published; a regional fire control room is listed below."
        : fireContacts?.stateControlRoom
          ? "No direct station number was published; the state headquarters control room is listed below."
          : "No direct station or state fire control-room number was verified; call nationwide emergency response at 112.";
    elements.contactDirectoryStatus.textContent = `${selectedArea}: ${fireStatus} Numbers are labeled by their actual coverage; no hotline is presented as a unique district-station line.`;
  } else {
    elements.contactDirectoryStatus.textContent = `${state.name}: select a district to check for a published direct station number. Available regional, state, and national contacts are labeled by their coverage.`;
  }

  const cards = [];

  for (const station of districtStations) {
    cards.push(`<article class="contact-card">
      <div class="contact-card-heading"><span class="contact-type-icon fire" aria-hidden="true">FES</span><div><h3>${escapeHtml(station.name)}</h3><span>${escapeHtml(district)}, ${escapeHtml(state.name)} · official station contact</span></div></div>
      <p>Direct contact details published for this fire station by the state fire service.</p>
      <div class="contact-number-list">${station.numbers.map(([number, label]) => contactPhoneLink(number, label)).join("")}</div>
      <a class="contact-source-link" href="${escapeHtml(fireContacts.stationContactSource.source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(fireContacts.stationContactSource.sourceLabel)}</a>
    </article>`);
  }

  if (districtControlRoom) {
    cards.push(`<article class="contact-card">
      <div class="contact-card-heading"><span class="contact-type-icon fire" aria-hidden="true">FES</span><div><h3>${escapeHtml(districtControlRoom.label)}</h3><span>${escapeHtml(districtControlRoom.coverage)}</span></div></div>
      <p>${escapeHtml(districtControlRoom.description)}</p>
      <div class="contact-number-list">${districtControlRoom.numbers.map(([number, label]) => contactPhoneLink(number, label)).join("")}</div>
      <a class="contact-source-link" href="${escapeHtml(districtControlRoom.source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(districtControlRoom.sourceLabel)}</a>
      <a class="contact-source-link" href="${escapeHtml(fireContacts.stationDirectory.source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(fireContacts.stationDirectory.sourceLabel)} · station names only</a>
    </article>`);
  }

  if (!hasLocalStationNumber && !districtControlRoom && fireContacts?.stateControlRoom) {
    const controlRoom = fireContacts.stateControlRoom;
    cards.push(`<article class="contact-card">
      <div class="contact-card-heading"><span class="contact-type-icon fire" aria-hidden="true">FES</span><div><h3>${escapeHtml(controlRoom.label)}</h3><span>${escapeHtml(controlRoom.coverage)}</span></div></div>
      <p>${escapeHtml(controlRoom.description)}</p>
      <div class="contact-number-list">${controlRoom.numbers.map(([number, label]) => contactPhoneLink(number, label)).join("")}</div>
      <a class="contact-source-link" href="${escapeHtml(controlRoom.source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(controlRoom.sourceLabel)}</a>
    </article>`);
  } else if (!hasLocalStationNumber && !districtControlRoom && fireContacts?.stateOffice) {
    const stateOffice = fireContacts.stateOffice;
    cards.push(`<article class="contact-card">
      <div class="contact-card-heading"><span class="contact-type-icon fire" aria-hidden="true">FES</span><div><h3>${escapeHtml(stateOffice.label)}</h3><span>${escapeHtml(stateOffice.coverage)}</span></div></div>
      <p>${escapeHtml(stateOffice.description)}</p>
      <div class="contact-number-list">${stateOffice.numbers.map(([number, label]) => contactPhoneLink(number, label)).join("")}</div>
      <a class="contact-source-link" href="${escapeHtml(stateOffice.source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(stateOffice.sourceLabel)}</a>
      <a class="contact-source-link" href="${escapeHtml(fireContacts.stationDirectory.source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(fireContacts.stationDirectory.sourceLabel)} · station names only</a>
    </article>`);
  }

  cards.push(
    `<article class="contact-card">
      <div class="contact-card-heading"><span class="contact-type-icon emergency" aria-hidden="true">112</span><div><h3>Emergency response</h3><span>India · nationwide</span></div></div>
      <p>Request fire and rescue assistance through India’s emergency response number.</p>
      <div class="contact-number-list">${contactPhoneLink("112", "Call 112")}</div>
      <a class="contact-source-link" href="https://112.gov.in/" target="_blank" rel="noopener noreferrer">Emergency Response Support System · Government of India</a>
    </article>`
  );

  cards.push(
    `<article class="contact-card">
      <div class="contact-card-heading"><span class="contact-type-icon weather" aria-hidden="true">MET</span><div><h3>Regional Meteorological Centre</h3><span>India Meteorological Department · Guwahati</span></div></div>
      <p>Weather Section contact published by IMD. District warning and forecast pages are available from the centre’s portal.</p>
      <div class="contact-number-list">${contactPhoneLink("0361-2968241", "Weather Section · 0361 2968241")}</div>
      <a class="contact-source-link" href="https://mausam.imd.gov.in/guwahati/contactus.php" target="_blank" rel="noopener noreferrer">IMD contact listing</a>
      <a class="contact-source-link" href="https://mausam.imd.gov.in/guwahati/" target="_blank" rel="noopener noreferrer">IMD Guwahati forecasts and warnings</a>
    </article>`
  );

  cards.push(
    `<article class="contact-card">
      <div class="contact-card-heading"><span class="contact-type-icon seismic" aria-hidden="true">NCS</span><div><h3>24×7 Earthquake Monitoring Centre</h3><span>National Centre for Seismology · New Delhi</span></div></div>
      <p>National seismic monitoring contact; this is not a district office or an emergency dispatch line.</p>
      <div class="contact-number-list">${contactPhoneLink("+91-11-24344484", "+91 11 2434 4484")}${contactPhoneLink("+91-11-24344547", "+91 11 2434 4547")}</div>
      <a class="contact-source-link" href="https://seismo.gov.in/contact-us" target="_blank" rel="noopener noreferrer">National Centre for Seismology · official contacts</a>
    </article>`
  );

  elements.contactList.innerHTML = cards.join("");
}

function initializeContactDirectory() {
  for (const state of CONTACT_STATES) {
    elements.contactState.add(new Option(state.name, state.name));
  }

  elements.contactState.addEventListener("change", () => {
    const state = CONTACT_STATES.find((entry) => entry.name === elements.contactState.value);
    elements.contactDistrict.replaceChildren(new Option(
      state ? "Select a district" : "Select a state first",
      ""
    ));
    elements.contactDistrict.disabled = !state;
    for (const district of state?.districts.split("|") ?? []) {
      elements.contactDistrict.add(new Option(district, district));
    }
    renderContactDirectory();
  });
  elements.contactDistrict.addEventListener("change", renderContactDirectory);
  renderContactDirectory();
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
  if (!location || currentLocation?.mode !== "sample") {
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

  elements.alertCopy.textContent = `${nearest.hazard.label} is approximately ${nearest.distance.toFixed(1)} km from the Guwahati reference point. This is an example record, not a current incident alert.`;
  elements.hazardAlert.hidden = false;
}

function getWeatherLocationKey(location) {
  return `${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}`;
}

function getRainfallGridCoordinates(location) {
  const longitudeStep = RAIN_MAP_GRID_STEP_DEGREES / Math.cos(location.latitude * Math.PI / 180);
  return [-1, 0, 1].flatMap((latitudeOffset) =>
    [-1, 0, 1].map((longitudeOffset) => ({
      latitude: location.latitude + latitudeOffset * RAIN_MAP_GRID_STEP_DEGREES,
      longitude: location.longitude + longitudeOffset * longitudeStep
    }))
  );
}

function setRainMapStatus(message) {
  elements.rainMapStatus.textContent = message;
}

function initializeRainMap() {
  if (!window.L) {
    setRainMapStatus("The map could not load. Rain estimates are still shown below.");
    return;
  }

  rainfallMap = window.L.map(elements.rainMap, {
    center: [SAMPLE_LOCATION.latitude, SAMPLE_LOCATION.longitude],
    zoom: 9,
    scrollWheelZoom: false
  });
  const tileLayer = window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
  }).addTo(rainfallMap);
  tileLayer.on("tileerror", () => {
    rainfallMapTilesUnavailable = true;
    if (currentWeather) {
      renderRainfallMap(
        currentWeather.reading,
        !navigator.onLine || Date.now() - currentWeather.reading.fetchedAtMs > WEATHER_CACHE_TTL_MS
      );
    } else {
      setRainMapStatus("OpenStreetMap tiles unavailable · rainfall estimates may still load.");
    }
  });
  tileLayer.on("load", () => {
    if (!rainfallMapTilesUnavailable) return;
    rainfallMapTilesUnavailable = false;
    if (currentWeather) {
      renderRainfallMap(
        currentWeather.reading,
        !navigator.onLine || Date.now() - currentWeather.reading.fetchedAtMs > WEATHER_CACHE_TTL_MS
      );
    }
  });
  rainfallMapLayer = window.L.layerGroup().addTo(rainfallMap);
  hazardActivityLayer = window.L.layerGroup().addTo(rainfallMap);
  rainfallCenterMarker = window.L.circleMarker(
    [SAMPLE_LOCATION.latitude, SAMPLE_LOCATION.longitude],
    { radius: 6, color: "#fff", weight: 2, fillColor: "#2563eb", fillOpacity: 1 }
  ).addTo(rainfallMap);
  rainfallCenterMarker.bindPopup("Sample weather-map center · Guwahati area");
  rainfallMap.on("moveend", renderHazardActivity);
  rainfallMap.whenReady(() => window.setTimeout(() => rainfallMap.invalidateSize(), 0));
}

function centerRainfallMap(location, label, zoom = 9) {
  if (!rainfallMap) return;
  rainfallMap.setView([location.latitude, location.longitude], zoom);
  rainfallCenterMarker.setLatLng([location.latitude, location.longitude]);
  rainfallCenterMarker.bindPopup(`${label} · rainfall map center`);
  renderHazardActivity();
}

function getHazardCellKey(location) {
  const latitudeCell = Math.floor(location.latitude / HAZARD_GRID_DEGREES);
  const longitudeCell = Math.floor(location.longitude / HAZARD_GRID_DEGREES);
  return `${latitudeCell}:${longitudeCell}`;
}

function getHazardTier(count) {
  if (count >= 6) return "red";
  if (count >= 3) return "orange";
  return "yellow";
}

function groupByHazardCell(events) {
  const cells = new Map();
  for (const event of events) {
    const key = getHazardCellKey(event);
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(event);
  }

  return Array.from(cells.values(), (cellEvents) => ({
    count: cellEvents.length,
    latitude: cellEvents.reduce((sum, event) => sum + event.latitude, 0) / cellEvents.length,
    longitude: cellEvents.reduce((sum, event) => sum + event.longitude, 0) / cellEvents.length,
    latest: cellEvents.reduce((latest, event) => event.time > latest.time ? event : latest)
  }));
}

function isWithinEarthquakeRegion(location) {
  return location.latitude >= EARTHQUAKE_REGION.minLatitude
    && location.latitude <= EARTHQUAKE_REGION.maxLatitude
    && location.longitude >= EARTHQUAKE_REGION.minLongitude
    && location.longitude <= EARTHQUAKE_REGION.maxLongitude;
}

function hasValidCoordinates(location) {
  return Number.isFinite(location.latitude)
    && location.latitude >= -90
    && location.latitude <= 90
    && Number.isFinite(location.longitude)
    && location.longitude >= -180
    && location.longitude <= 180;
}

function getRecentLandslideReports(now = Date.now()) {
  const cutoff = now - HAZARD_HISTORY_WINDOW_MS;
  return savedReports.filter((report) =>
    report.type === "landslide"
    && report.locationMode === "gps"
    && report.humanReviewStatus !== "rejected"
    && hasValidCoordinates(report)
    && Number.isFinite(report.createdAt)
    && report.createdAt >= cutoff
    && report.createdAt <= now
  );
}

function normalizeEarthquakeFeature(feature, startTime, endTime) {
  const coordinates = feature.geometry?.coordinates;
  const time = feature.properties?.time;
  if (
    feature.geometry?.type !== "Point"
    || !Array.isArray(coordinates)
    || !Number.isFinite(time)
    || time < startTime
    || time > endTime
  ) {
    return null;
  }

  const longitude = coordinates[0];
  const latitude = coordinates[1];
  if (!hasValidCoordinates({ latitude, longitude })) return null;
  const event = {
    id: String(feature.id ?? ""),
    latitude,
    longitude,
    time,
    magnitude: Number.isFinite(feature.properties?.mag) ? feature.properties.mag : null,
    place: typeof feature.properties?.place === "string" ? feature.properties.place : "Location not listed"
  };
  return isWithinEarthquakeRegion(event) ? event : null;
}

function readEarthquakeCache() {
  try {
    const stored = localStorage.getItem(EARTHQUAKE_CACHE_KEY);
    if (!stored) return null;
    const cache = JSON.parse(stored);
    if (
      cache.version !== 1
      || !Number.isFinite(cache.fetchedAtMs)
      || !Array.isArray(cache.events)
      || cache.events.some((event) =>
        typeof event.id !== "string"
        || !Number.isFinite(event.latitude)
        || !Number.isFinite(event.longitude)
        || !Number.isFinite(event.time)
        || (event.magnitude !== null && !Number.isFinite(event.magnitude))
        || typeof event.place !== "string"
        || !hasValidCoordinates(event)
        || !isWithinEarthquakeRegion(event)
      )
    ) {
      throw new Error("The saved earthquake catalog has an invalid format.");
    }
    return cache;
  } catch (error) {
    console.error("Could not read the cached USGS earthquake catalog.", error);
    earthquakeFetchError = `Saved earthquake data could not be read: ${error.message}`;
    return null;
  }
}

async function fetchEarthquakeHistory(signal) {
  const endTime = Date.now();
  const startTime = endTime - HAZARD_HISTORY_WINDOW_MS;
  const url = new URL("https://earthquake.usgs.gov/fdsnws/event/1/query");
  url.search = new URLSearchParams({
    format: "geojson",
    starttime: new Date(startTime).toISOString(),
    endtime: new Date(endTime).toISOString(),
    minlatitude: String(EARTHQUAKE_REGION.minLatitude),
    maxlatitude: String(EARTHQUAKE_REGION.maxLatitude),
    minlongitude: String(EARTHQUAKE_REGION.minLongitude),
    maxlongitude: String(EARTHQUAKE_REGION.maxLongitude),
    limit: "20000",
    orderby: "time"
  }).toString();

  const response = await fetch(url, { signal, cache: "no-store" });
  if (!response.ok) throw new Error(`USGS returned HTTP ${response.status}.`);

  const payload = await response.json();
  if (payload.type !== "FeatureCollection" || !Array.isArray(payload.features)) {
    throw new Error("USGS returned an invalid earthquake catalog.");
  }

  return payload.features
    .map((feature) => normalizeEarthquakeFeature(feature, startTime, endTime))
    .filter((event) => event !== null);
}

function formatHazardStatus() {
  const now = Date.now();
  const cutoff = now - HAZARD_HISTORY_WINDOW_MS;
  const recentEarthquakes = earthquakeEvents.filter((event) => event.time >= cutoff && event.time <= now);
  const localLandslides = getRecentLandslideReports(now);
  const earthquakeUpdate = earthquakeFetchedAtMs
    ? new Date(earthquakeFetchedAtMs).toLocaleString()
    : "";
  const savedDataNote = earthquakeFetchError && earthquakeFetchedAtMs
    ? " · saved catalog; refresh failed"
    : "";
  const earthquakeStatus = recentEarthquakes.length
    ? `USGS catalog: ${recentEarthquakes.length} earthquake events in Northeast India and nearby border regions in 365 days${earthquakeUpdate ? ` · updated ${earthquakeUpdate}` : ""}${savedDataNote}.`
    : earthquakeFetchError
      ? `USGS earthquake data unavailable${earthquakeFetchedAtMs ? ` · showing saved data from ${earthquakeUpdate}` : ""}.`
      : earthquakeFetchedAtMs
        ? `USGS catalog: no earthquake events in the last 365 days${earthquakeUpdate ? ` · updated ${earthquakeUpdate}` : ""}.`
        : "Loading USGS earthquake catalog for Northeast India and nearby border regions…";
  const cacheNote = earthquakeCacheError ? ` ${earthquakeCacheError}` : "";
  elements.hazardMapStatus.textContent = `${earthquakeStatus} Landslide reports on this device: ${localLandslides.length} · unverified, not shared.${cacheNote}`;
}

function hasNearbyRain(location) {
  const reading = currentWeather?.reading;
  if (
    !reading
    || elements.weatherState.dataset.state !== "ready"
    || Date.now() - reading.fetchedAtMs > WEATHER_CACHE_TTL_MS
  ) {
    return false;
  }

  return reading.rainMapReadings.some((point) =>
    point.rainfallMm > 0.01 && haversineDistanceKm(location, point) <= 8
  );
}

function createHazardPopup(type, group, rainNearby = false) {
  const tier = getHazardTier(group.count);
  const date = new Date(group.latest.time).toLocaleDateString();
  const rainMessage = rainNearby
    ? "<p>Open-Meteo indicates rain at a nearby sample point; this is an estimate and does not change the incident-count tier.</p>"
    : "";
  if (type === "earthquake") {
    const magnitude = Number.isFinite(group.latest.magnitude)
      ? ` · magnitude ${group.latest.magnitude.toFixed(1)}`
      : "";
    return `<strong>${group.count} USGS earthquake event${group.count === 1 ? "" : "s"} · ${tier.toUpperCase()}</strong><p>Approx. 10 × 11 km map cell · past 365 days. Latest: ${escapeHtml(group.latest.place)} · ${date}${magnitude}.</p><p>Activity counts are not a forecast or an official warning.</p><a href="https://earthquake.usgs.gov/" target="_blank" rel="noopener noreferrer">USGS earthquake catalog</a>`;
  }

  return `<strong>${group.count} local landslide report${group.count === 1 ? "" : "s"} · ${tier.toUpperCase()}</strong><p>Approx. 10 × 11 km map cell · past 365 days. Latest report: ${date}.</p><p>Reports are unverified, stored only on this device, and are not an official warning.</p>${rainMessage}<a href="https://www.nrsc.gov.in/nrscnew/resources_atlas_landslide.php" target="_blank" rel="noopener noreferrer">NRSC/ISRO Landslide Atlas · historical context</a>`;
}

function addHazardMarker(type, group, rainNearby = false) {
  const tier = getHazardTier(group.count);
  const rainClass = rainNearby ? " rain-nearby" : "";
  const symbol = type === "earthquake"
    ? '<svg class="earthquake-crack" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.8 2.5 8.7 11h4.1l-2.6 10.5 7-12h-4.1l2.2-7Z"/></svg>'
    : '<span class="falling-rocks" aria-hidden="true"><i></i><i></i><i></i></span>';
  const rainDrop = rainNearby
    ? '<svg class="rain-nearby-drop" viewBox="0 0 16 20" aria-label="Rain estimated nearby"><path d="M8 1C6 5 2.5 8.5 2.5 12a5.5 5.5 0 0 0 11 0C13.5 8.5 10 5 8 1Z"/></svg>'
    : "";
  const icon = window.L.divIcon({
    className: "hazard-map-icon",
    html: `<span class="hazard-map-marker ${type} ${tier}${rainClass}" aria-hidden="true"><span class="hazard-map-symbol">${symbol}</span><span class="hazard-map-count">${group.count}</span>${rainDrop}</span>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21]
  });
  const latest = type === "earthquake" ? group.latest.place : "Unverified local report";
  const marker = window.L.marker([group.latitude, group.longitude], {
    icon,
    title: `${type === "earthquake" ? "Earthquake activity" : "Landslide reports"}: ${group.count} in the past 365 days · ${latest}${rainNearby ? " · rain estimated nearby" : ""}`
  });
  marker.bindPopup(createHazardPopup(type, group, rainNearby), { autoPan: false });
  marker.addTo(hazardActivityLayer);
}

function renderHazardActivity() {
  if (hazardActivityLayer) {
    if (rainfallMap) rainfallMap.closePopup();
    hazardActivityLayer.clearLayers();
  }
  const now = Date.now();
  const cutoff = now - HAZARD_HISTORY_WINDOW_MS;
  const recentEarthquakes = earthquakeEvents.filter((event) => event.time >= cutoff && event.time <= now);
  const localLandslides = getRecentLandslideReports(now);

  if (hazardActivityLayer && rainfallMap) {
    const visibleBounds = rainfallMap.getBounds().pad(0.15);
    for (const group of groupByHazardCell(recentEarthquakes)) {
      if (visibleBounds.contains([group.latitude, group.longitude])) {
        addHazardMarker("earthquake", group);
      }
    }
    for (const group of groupByHazardCell(localLandslides)) {
      if (visibleBounds.contains([group.latitude, group.longitude])) {
        addHazardMarker("landslide", group, hasNearbyRain(group));
      }
    }
  }

  formatHazardStatus();
}

async function refreshEarthquakeHistory(force = false) {
  const now = Date.now();
  if (
    !force
    && earthquakeFetchedAtMs
    && now - earthquakeFetchedAtMs < EARTHQUAKE_REFRESH_INTERVAL_MS
  ) {
    renderHazardActivity();
    return;
  }
  if (!navigator.onLine) {
    earthquakeFetchError = "Offline";
    renderHazardActivity();
    return;
  }

  if (earthquakeAbortController) earthquakeAbortController.abort();
  const requestId = ++earthquakeRequestId;
  const controller = new AbortController();
  earthquakeAbortController = controller;
  const timeout = window.setTimeout(
    () => controller.abort(),
    EARTHQUAKE_REQUEST_TIMEOUT_MS
  );
  if (elements.hazardRefresh) elements.hazardRefresh.disabled = true;
  earthquakeFetchError = "";
  renderHazardActivity();

  try {
    const events = await fetchEarthquakeHistory(controller.signal);
    if (requestId !== earthquakeRequestId) return;
    earthquakeEvents = events;
    earthquakeFetchedAtMs = Date.now();
    earthquakeFetchError = "";
    try {
      localStorage.setItem(EARTHQUAKE_CACHE_KEY, JSON.stringify({
        version: 1,
        fetchedAtMs: earthquakeFetchedAtMs,
        events
      }));
      earthquakeCacheError = "";
    } catch (error) {
      earthquakeCacheError = "Earthquake data could not be saved for offline use.";
      console.error("Could not cache the USGS earthquake catalog.", error);
    }
    renderHazardActivity();
  } catch (error) {
    if (requestId !== earthquakeRequestId) return;
    earthquakeFetchError = error.name === "AbortError"
      ? "The USGS request timed out."
      : error.message;
    console.error("Could not retrieve the USGS earthquake catalog.", error);
    renderHazardActivity();
  } finally {
    window.clearTimeout(timeout);
    if (requestId === earthquakeRequestId) {
      earthquakeAbortController = null;
      if (elements.hazardRefresh) elements.hazardRefresh.disabled = false;
    }
  }
}

function isValidWeatherReading(reading) {
  return Number.isFinite(reading?.rainfallMm)
    && reading.rainfallMm >= 0
    && Number.isFinite(reading?.intervalSeconds)
    && reading.intervalSeconds > 0
    && Number.isFinite(reading?.observedAtSeconds)
    && Number.isFinite(reading?.fetchedAtMs)
    && (reading.weatherCode === null || Number.isFinite(reading.weatherCode))
    && Array.isArray(reading.rainMapReadings)
    && reading.rainMapReadings.length === 9
    && reading.rainMapReadings.every((point) =>
      Number.isFinite(point.latitude)
        && Number.isFinite(point.longitude)
        && Number.isFinite(point.rainfallMm)
        && point.rainfallMm >= 0
        && Number.isFinite(point.intervalSeconds)
        && point.intervalSeconds > 0
        && Number.isFinite(point.observedAtSeconds)
        && (point.weatherCode === null || Number.isFinite(point.weatherCode))
    );
}

function readSampleWeatherCache() {
  try {
    const stored = localStorage.getItem(WEATHER_CACHE_KEY);
    if (!stored) return null;

    const reading = JSON.parse(stored);
    if (
      reading.locationKey !== getWeatherLocationKey(SAMPLE_LOCATION)
      || !isValidWeatherReading(reading)
    ) {
      throw new Error("The saved weather reading has an invalid format.");
    }
    return reading;
  } catch (error) {
    console.error("Could not read the cached sample weather estimate.", error);
    elements.weatherState.dataset.state = "error";
    elements.weatherState.textContent = "Saved weather cache could not be read.";
    return null;
  }
}

function calculateRainfallIntensity(reading) {
  const rate = reading.rainfallMm * 3600 / reading.intervalSeconds;
  const score = reading.rainfallMm <= 0.01 ? 0 : Math.min(10, Math.ceil(rate / 2));
  const level = score === 0
    ? THUNDERSTORM_CODES.has(reading.weatherCode)
      ? { id: "heavy", label: "Thunderstorm indicated" }
      : RAIN_WEATHER_CODES.has(reading.weatherCode)
        ? { id: "drizzle", label: "Drizzle" }
        : { id: "dry", label: "Dry" }
    : rate <= 2.5
      ? { id: "drizzle", label: "Drizzle" }
      : rate <= 7.5
        ? { id: "moderate", label: "Moderate" }
        : rate <= 15
          ? { id: "rain", label: "Rain" }
          : { id: "heavy", label: "Heavy" };

  return { score, level };
}

function getRainfallCategory(reading) {
  const intensity = calculateRainfallIntensity(reading);
  return {
    ...intensity,
    rate: reading.rainfallMm * 3600 / reading.intervalSeconds,
    isThunderstorm: THUNDERSTORM_CODES.has(reading.weatherCode)
  };
}

function renderRainfallMap(reading, stale) {
  if (!rainfallMap || !rainfallMapLayer) return;

  rainfallMapLayer.clearLayers();
  let visibleSpots = 0;
  let stormSpots = 0;
  let drySamples = 0;

  for (const point of reading.rainMapReadings) {
    const category = getRainfallCategory(point);
    if (category.level.id === "dry" && !category.isThunderstorm) {
      window.L.circleMarker([point.latitude, point.longitude], {
        radius: 4,
        color: stale ? "#64748b" : "#334155",
        weight: 1.5,
        opacity: stale ? 0.45 : 0.75,
        fillColor: "#fff",
        fillOpacity: 0.85
      })
        .bindPopup("No rain indicated at this sample point · approximate model estimate")
        .addTo(rainfallMapLayer);
      drySamples += 1;
      continue;
    }

    const color = RAINFALL_COLORS[category.level.id] ?? RAINFALL_COLORS.drizzle;
    window.L.circle([point.latitude, point.longitude], {
      radius: RAIN_MAP_SPOT_RADIUS_METERS,
      color,
      weight: category.isThunderstorm ? 2 : 1,
      opacity: stale ? 0.35 : 0.65,
      fillColor: color,
      fillOpacity: stale ? 0.08 : 0.2
    }).addTo(rainfallMapLayer);

    const amount = point.rainfallMm.toFixed(2);
    const description = category.isThunderstorm
      ? `Thunderstorm indicated · ${amount} mm in the latest model interval`
      : `${category.level.label} · ${amount} mm in the latest model interval`;
    const popup = window.L.popup().setContent(
      `${description}<br><small>Approximate model estimate · not an official alert</small>`
    );
    if (category.isThunderstorm) {
      const stormIcon = window.L.divIcon({
        className: "storm-map-marker",
        html: '<span aria-label="Thunderstorm indicated">⚠</span>',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
      window.L.marker([point.latitude, point.longitude], { icon: stormIcon })
        .bindPopup(popup)
        .addTo(rainfallMapLayer);
      stormSpots += 1;
    }

    visibleSpots += 1;
  }

  if (visibleSpots === 0) {
    setRainMapStatus(stale
      ? `No rain indicated in ${drySamples} saved sample points · this does not guarantee clear conditions.`
      : `No rain indicated at ${drySamples} sample points · this does not guarantee clear conditions.`);
  } else {
    const stormText = stormSpots > 0
      ? ` · ${stormSpots} thunderstorm signal${stormSpots === 1 ? "" : "s"}`
      : "";
    setRainMapStatus(
      `${stale ? "Saved, possibly stale estimate" : "Approximate model estimate"} · ${visibleSpots} rainfall spot${visibleSpots === 1 ? "" : "s"}${stormText}`
    );
  }
  if (rainfallMapTilesUnavailable) {
    setRainMapStatus(`${elements.rainMapStatus.textContent} · OpenStreetMap tiles unavailable`);
  }
}

function renderWeather(reading, { cached = false, stale = false, status = "" } = {}) {
  const amount = reading.rainfallMm;
  const intensity = calculateRainfallIntensity(reading);
  const ageMs = Date.now() - reading.observedAtSeconds * 1000;
  const cacheAgeMs = Date.now() - reading.fetchedAtMs;
  const isStale = stale
    || !navigator.onLine
    || cacheAgeMs > WEATHER_CACHE_TTL_MS
    || ageMs > WEATHER_STALE_AFTER_MS
    || ageMs < -WEATHER_REQUEST_TIMEOUT_MS;
  const rainIndicated = amount > 0.01
    || RAIN_WEATHER_CODES.has(reading.weatherCode)
    || THUNDERSTORM_CODES.has(reading.weatherCode);
  const condition = amount > 0.01
    ? "Rain indicated"
    : THUNDERSTORM_CODES.has(reading.weatherCode)
      ? "Thunderstorm indicated by model"
      : rainIndicated
      ? "Rain conditions · trace indicated"
      : "No rain indicated in latest interval";
  const intervalMinutes = Math.max(1, Math.round(reading.intervalSeconds / 60));
  const updatedAt = new Date(reading.fetchedAtMs).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
  const modelTime = new Date(reading.observedAtSeconds * 1000).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
  elements.weatherCondition.textContent = isStale ? `Stale estimate · ${condition.toLowerCase()}` : condition;
  elements.rainAmount.textContent = amount.toFixed(2);
  elements.rainAmountLabel.textContent = `Precipitation · last ${intervalMinutes} min`;
  elements.rainLevel.textContent = isStale
    ? `Stale · ${intensity.level.label}`
    : intensity.level.label;
  elements.rainLevel.dataset.level = isStale ? "unknown" : intensity.level.id;

  elements.weatherUpdated.textContent = `Fetched ${updatedAt} · model interval ${modelTime}`;
  elements.weatherState.dataset.state = isStale ? "stale" : "ready";
  elements.weatherState.textContent = status || (
    isStale
      ? navigator.onLine
        ? "Stale estimate · refresh for an update"
        : "Offline · saved estimate may be stale"
      : cached
        ? "Cached Open-Meteo estimate"
        : "Open-Meteo forecast-model estimate"
  );
  renderRainfallMap(reading, isStale);
  renderHazardActivity();
}

function setWeatherUnavailable(message, isError = false) {
  elements.weatherCondition.textContent = "Weather unavailable";
  elements.rainAmount.textContent = "—";
  elements.rainAmountLabel.textContent = "Precipitation · latest interval";
  elements.rainLevel.textContent = "Unknown";
  elements.rainLevel.dataset.level = "unavailable";
  elements.weatherState.dataset.state = isError ? "error" : "loading";
  elements.weatherState.textContent = message;
  elements.weatherUpdated.textContent = "No current reading";
  if (rainfallMapLayer) rainfallMapLayer.clearLayers();
  renderHazardActivity();
  setRainMapStatus(rainfallMap ? message : `Map unavailable · ${message}`);
}

async function fetchWeatherReading(location, signal) {
  const coordinates = getRainfallGridCoordinates(location);
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: coordinates.map((point) => point.latitude.toFixed(4)).join(","),
    longitude: coordinates.map((point) => point.longitude.toFixed(4)).join(","),
    current: "rain,showers,weather_code",
    timezone: "GMT",
    timeformat: "unixtime"
  }).toString();

  const response = await fetch(url, { signal, cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Weather service returned HTTP ${response.status}.`);
  }

  const payload = await response.json();
  const locations = Array.isArray(payload) ? payload : [payload];
  if (locations.length !== coordinates.length) {
    throw new Error("Weather service returned an incomplete reading.");
  }

  const fetchedAtMs = Date.now();
  const rainMapReadings = locations.map((locationData) => {
    const current = locationData.current;
    const rain = current?.rain;
    const showers = current?.showers;
    if (
      !Number.isFinite(locationData.latitude)
      || !Number.isFinite(locationData.longitude)
      || !Number.isFinite(rain)
      || !Number.isFinite(showers)
      || !Number.isFinite(current.interval)
      || !Number.isFinite(current.time)
      || (current.weather_code !== null && !Number.isFinite(current.weather_code))
    ) {
      throw new Error("Weather service returned an incomplete reading.");
    }

    return {
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      rainfallMm: Math.max(0, rain + showers),
      intervalSeconds: current.interval,
      observedAtSeconds: current.time,
      weatherCode: current.weather_code
    };
  });
  const centerReading = rainMapReadings[4];
  const reading = {
    locationKey: getWeatherLocationKey(location),
    rainfallMm: centerReading.rainfallMm,
    intervalSeconds: centerReading.intervalSeconds,
    observedAtSeconds: centerReading.observedAtSeconds,
    weatherCode: centerReading.weatherCode,
    fetchedAtMs,
    rainMapReadings
  };
  reading.rainIntensityScore = calculateRainfallIntensity(reading).score;
  return reading;
}

async function refreshWeather(location, label, mode, force = false) {
  const requestId = ++weatherRequestId;
  if (weatherAbortController) weatherAbortController.abort();

  const locationKey = getWeatherLocationKey(location);
  const sampleCache = mode === "sample" ? readSampleWeatherCache() : null;
  const matchingCache = currentWeather?.reading.locationKey === locationKey
    ? currentWeather.reading
    : sampleCache?.locationKey === locationKey
      ? sampleCache
      : null;

  elements.weatherLocation.textContent = label;
  if (matchingCache) {
    currentWeather = { reading: matchingCache, locationMode: mode };
    renderWeather(matchingCache, { cached: true });
    if (!force && Date.now() - matchingCache.fetchedAtMs < WEATHER_CACHE_TTL_MS) return;
  } else {
    setWeatherUnavailable(navigator.onLine ? "Connecting to weather service…" : "No saved reading for this location while offline.");
  }

  if (!navigator.onLine) {
    if (!matchingCache) {
      setWeatherUnavailable("Offline · no cached reading for this location.");
    } else {
      renderWeather(matchingCache, { cached: true, stale: true, status: "Offline · showing saved estimate" });
    }
    return;
  }

  weatherAbortController = new AbortController();
  const controller = new AbortController();
  weatherAbortController = controller;
  const timeout = window.setTimeout(
    () => controller.abort(new DOMException("Weather request timed out.", "TimeoutError")),
    WEATHER_REQUEST_TIMEOUT_MS
  );
  elements.weatherRefresh.disabled = true;
  elements.weatherState.dataset.state = "loading";
  elements.weatherState.textContent = matchingCache
    ? "Refreshing weather estimate…"
    : "Connecting to weather service…";

  try {
    const reading = await fetchWeatherReading(location, controller.signal);
    if (requestId !== weatherRequestId) return;
    currentWeather = { reading, locationMode: mode };

    if (mode === "sample") {
      try {
        localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(reading));
      } catch (error) {
        console.error("Could not cache the sample weather estimate for offline use.", error);
        renderWeather(reading, { status: "Live estimate · browser cache unavailable" });
        return;
      }
    }

    renderWeather(reading);
  } catch (error) {
    if (requestId !== weatherRequestId) return;
    if (matchingCache) {
      renderWeather(matchingCache, {
        cached: true,
        stale: true,
        status: `Refresh failed · showing saved estimate (${error.message})`
      });
      console.error("Could not refresh the weather estimate; showing cached data.", error);
    } else {
      const message = error.name === "AbortError" || error.name === "TimeoutError"
        ? "Weather request timed out. Try refreshing."
        : `Weather service unavailable: ${error.message}`;
      setWeatherUnavailable(message, true);
      console.error("Could not retrieve a weather estimate.", error);
    }
  } finally {
    window.clearTimeout(timeout);
    if (requestId === weatherRequestId) {
      elements.weatherRefresh.disabled = false;
      weatherAbortController = null;
    }
  }
}

function openRoutePreview() {
  const location = getLocalLocation();
  const nearbyHazard = location && SAMPLE_HAZARDS.some((hazard) =>
    haversineDistanceKm(location, hazard) <= GEOFENCE_RADIUS_KM
  );
  document.querySelector("#route-copy").textContent = nearbyHazard
    ? "An example hazard marker is within 5 km of the selected reference point. The route option below is illustrative, not navigable."
    : "No example marker is within 5 km of the selected point. Directions and live road checks are not connected.";
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
  centerRainfallMap(location, mode === "sample" ? "Guwahati reference point" : "Your location");
  updateGeofenceAlert();
  void refreshWeather(location, label, mode);
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
        1: "Location permission was denied. Allow it in your browser settings or use the Guwahati reference point.",
        2: "Your location could not be determined. Try again or use the Guwahati reference point.",
        3: "GPS took too long to respond. Try again or use the Guwahati reference point."
      };
      capturedReportLocation = null;
      elements.capturedLocation.textContent = messages[error.code] ?? `Could not capture GPS: ${error.message}`;
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
  );
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Could not encode the resized report photo."));
        return;
      }
      resolve(reader.result.slice(reader.result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the resized report photo."));
    reader.readAsDataURL(blob);
  });
}

async function preparePhotoForAi(photo) {
  if (typeof createImageBitmap !== "function") {
    throw new Error("This browser cannot safely resize the photo for AI review.");
  }

  const bitmap = await createImageBitmap(photo);
  try {
    let scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Could not prepare the report photo for AI review.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.82, 0.68, 0.54]) {
        const compressed = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
        if (compressed && compressed.size <= 2 * 1024 * 1024) {
          return {
            mimeType: "image/jpeg",
            data: await blobToBase64(compressed)
          };
        }
      }
      scale *= 0.72;
    }
  } finally {
    bitmap.close();
  }

  throw new Error("The photo is too large to prepare for AI review.");
}

async function requestAiTriage(report) {
  const image = await preparePhotoForAi(report.photo);
  const response = await fetch("/api/review-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      consent: true,
      type: report.type,
      description: report.description,
      image
    })
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || `AI review returned HTTP ${response.status}.`);
  }
  if (
    !result
    || !["likely_match", "uncertain", "likely_mismatch"].includes(result.category)
    || !["low", "medium", "high"].includes(result.confidence)
    || typeof result.reason !== "string"
    || result.reason.length > 240
    || result.humanReviewRequired !== true
  ) {
    throw new Error("AI review returned an invalid triage result.");
  }
  return result;
}

async function handleReportSubmit(event) {
  event.preventDefault();
  if (!elements.reportForm.reportValidity()) return;

  const formData = new FormData(elements.reportForm);
  const type = String(formData.get("type"));
  if (!["landslide", "roadblock"].includes(type)) {
    showToast("Choose landslide or road block to submit a report.");
    return;
  }
  const location = String(formData.get("location")).trim();
  const description = String(formData.get("description")).trim();
  if (!location || !description) {
    showToast("Add a nearby place and a short description of what you saw.");
    return;
  }

  const photo = elements.reportPhoto.files[0];
  if (!photo || !photo.type.startsWith("image/")) {
    showToast("Choose an image photo before saving the report.");
    return;
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    showToast("HillSafe accepts photos up to 8 MB. Choose a smaller image.");
    return;
  }
  if (!capturedReportLocation) {
    showToast("Capture GPS or choose the clearly labeled Guwahati reference point before saving.");
    return;
  }

  const requestAiReview = elements.reportForm.elements.aiConsent.checked;
  const report = {
    id: crypto.randomUUID(),
    type,
    location,
    description,
    latitude: capturedReportLocation.latitude,
    longitude: capturedReportLocation.longitude,
    locationMode: capturedReportLocation.mode,
    createdAt: Date.now(),
    photo,
    photoName: photo.name,
    aiReviewStatus: requestAiReview
      ? navigator.onLine
        ? "pending"
        : "offline"
      : "not-requested",
    aiReview: null,
    humanReviewStatus: "pending",
    humanApprovedAt: null
  };
  const submitButton = elements.reportForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  try {
    await writeReport(report);
    await refreshSavedReports();
    elements.reportForm.reset();
    capturedReportLocation = null;
    elements.capturedLocation.textContent = "Location not captured";
    clearPhotoPreview();
    elements.reportDialog.close();
    showToast(requestAiReview && navigator.onLine
      ? "Report saved locally. Requesting optional AI photo triage; human review is still required."
      : requestAiReview
        ? "Report saved locally. AI triage is unavailable offline; human review is still required."
        : "Report saved locally without AI review. It is pending human review.");

    if (!requestAiReview || !navigator.onLine) return;

    try {
      report.aiReview = await requestAiTriage(report);
      report.aiReviewStatus = "complete";
      report.aiReviewAt = Date.now();
      await writeReport(report);
      await refreshSavedReports();
      showToast("AI triage suggestion received. This report is still pending human review.");
    } catch (error) {
      console.error("AI photo triage failed; the report remains saved for human review.", error);
      report.aiReviewStatus = "unavailable";
      report.aiReviewError = error.message;
      try {
        await writeReport(report);
        await refreshSavedReports();
      } catch (saveError) {
        console.error("Could not save the AI review failure status.", saveError);
        showToast(`Report was saved, but its AI status could not be updated: ${saveError.message}`);
        return;
      }
      showToast(`Report saved; AI triage failed. It remains pending human review. ${error.message}`);
    }
  } catch (error) {
    console.error("Could not save the local hazard report.", error);
    showToast(`Report was not saved: ${error.message}`);
  } finally {
    submitButton.disabled = false;
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
  document.querySelector(".source-banner").hidden = true;
});

document.querySelector("#alert-dismiss").addEventListener("click", () => {
  elements.hazardAlert.hidden = true;
});

function openReportDialog() {
  capturedReportLocation = null;
  elements.capturedLocation.textContent = "Location not captured";
  elements.reportDialog.showModal();
}

document.querySelectorAll("#open-report-dock, #open-report-header, #open-report-mobile").forEach((button) => {
  button.addEventListener("click", openReportDialog);
});
document.querySelector("#open-guide").addEventListener("click", () => elements.guideDialog.showModal());
document.querySelector("#open-guide-rail").addEventListener("click", () => elements.guideDialog.showModal());
document.querySelector("#open-guide-mobile").addEventListener("click", () => elements.guideDialog.showModal());
document.querySelector("#open-route").addEventListener("click", openRoutePreview);
document.querySelector("#open-route-mobile").addEventListener("click", openRoutePreview);

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});

document.querySelector("#capture-location").addEventListener("click", captureGps);

document.querySelector("#use-reference-report-location").addEventListener("click", () => {
  capturedReportLocation = { ...SAMPLE_LOCATION, mode: "sample" };
  elements.capturedLocation.textContent = `${SAMPLE_LOCATION.latitude.toFixed(5)}, ${SAMPLE_LOCATION.longitude.toFixed(5)} · Guwahati reference coordinates, not GPS`;
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
        ? "Location permission was denied. You can view the Guwahati reference point instead."
        : "Could not determine location. Check GPS and try again, or view the Guwahati reference point.";
      showToast(message);
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
  );
});

document.querySelector("#reference-location").addEventListener("click", () => {
  setCurrentLocation(SAMPLE_LOCATION, "Guwahati reference point", "sample");
  showToast("Guwahati reference point selected. It is not your GPS location.");
});

elements.hazardRefresh.addEventListener("click", () => {
  void refreshEarthquakeHistory(true);
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

window.addEventListener("online", () => {
  updateConnectivity();
  showToast("Connection restored. Local reports are still on this device; server sync is not configured.");
  void refreshEarthquakeHistory(true);
  const location = getLocalLocation() ?? { ...SAMPLE_LOCATION, mode: "sample" };
  const label = currentLocation?.mode === "gps"
    ? "GPS location active"
    : currentLocation
      ? "Guwahati reference point"
      : SAMPLE_WEATHER_LABEL;
  void refreshWeather(location, label, currentLocation?.mode ?? "sample");
});
window.addEventListener("offline", () => {
  updateConnectivity();
  if (earthquakeAbortController) earthquakeAbortController.abort();
  earthquakeRequestId += 1;
  earthquakeAbortController = null;
  earthquakeFetchError = "Offline";
  if (elements.hazardRefresh) elements.hazardRefresh.disabled = false;
  renderHazardActivity();
  const reading = currentWeather?.reading ?? readSampleWeatherCache();
  if (reading) {
    renderWeather(reading, { cached: true, stale: true, status: "Offline · showing last retrieved model estimate" });
  } else {
    setWeatherUnavailable("Offline · no cached weather reading is available.");
  }
});

window.setInterval(() => {
  if (
    currentWeather
    && Date.now() - currentWeather.reading.fetchedAtMs > WEATHER_CACHE_TTL_MS
    && elements.weatherState.dataset.state === "ready"
  ) {
    renderWeather(currentWeather.reading, {
      cached: true,
      stale: true,
      status: "Estimate is over 30 minutes old · refresh for an update"
    });
  }
}, 60000);

window.setInterval(() => {
  void refreshEarthquakeHistory();
}, EARTHQUAKE_REFRESH_INTERVAL_MS);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  document.querySelector("#install-app").hidden = false;
});

document.querySelector("#install-app").addEventListener("click", async () => {
  if (!installPrompt) return;
  await installPrompt.prompt();
  const choice = await installPrompt.userChoice;
  if (choice.outcome === "accepted") showToast("HillSafe was added to your device.");
  installPrompt = null;
  document.querySelector("#install-app").hidden = true;
});

window.addEventListener("appinstalled", () => {
  document.querySelector("#install-app").hidden = true;
  showToast("HillSafe is ready on your device.");
});

updateConnectivity();
renderReports();
renderReputation();
renderQueueCount();
initializeContactDirectory();

initializeRainMap();
const cachedEarthquakeCatalog = readEarthquakeCache();
if (cachedEarthquakeCatalog) {
  earthquakeEvents = cachedEarthquakeCatalog.events;
  earthquakeFetchedAtMs = cachedEarthquakeCatalog.fetchedAtMs;
}
renderHazardActivity();
void refreshEarthquakeHistory();
const savedWeather = readSampleWeatherCache();
if (savedWeather) {
  renderWeather(savedWeather, { cached: true });
}
void refreshWeather(SAMPLE_LOCATION, SAMPLE_WEATHER_LABEL, "sample");

elements.weatherRefresh.addEventListener("click", () => {
  const location = getLocalLocation() ?? { ...SAMPLE_LOCATION, mode: "sample" };
  const label = currentLocation?.mode === "gps"
    ? "GPS location active"
    : currentLocation
      ? "Guwahati reference point"
      : SAMPLE_WEATHER_LABEL;
  void refreshWeather(location, label, currentLocation?.mode ?? "sample", true);
});

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
