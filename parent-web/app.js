let family = [];
let places = [];
let selectedId = "";
let pendingPairings = JSON.parse(localStorage.getItem("safestepsPendingPairings") || "{}");
let parentToken = localStorage.getItem("safestepsParentToken") || "";
let parentId = localStorage.getItem("safestepsParentId") || "";
let parentEmail = localStorage.getItem("safestepsParentEmail") || "";
let parentName = localStorage.getItem("safestepsParentName") || "";
let selectedPlan = localStorage.getItem("safestepsSelectedPlan") || "starter";
let onboardingActive = false;

const apiBase = window.location.protocol.startsWith("http") ? window.location.origin : "http://localhost:8787";
const welcomeScreen = document.getElementById("welcomeScreen");
const parentApp = document.getElementById("parentApp");
const childWebSetup = document.getElementById("childWebSetup");
const chooseParent = document.getElementById("chooseParent");
const chooseChild = document.getElementById("chooseChild");
const childBack = document.getElementById("childBack");
const planName = document.getElementById("planName");
const planPrice = document.getElementById("planPrice");
const memberList = document.getElementById("memberList");
const addMemberForm = document.getElementById("addMemberForm");
const placeForm = document.getElementById("placeForm");
const placeName = document.getElementById("placeName");
const placeRadius = document.getElementById("placeRadius");
const placeList = document.getElementById("placeList");
const authForm = document.getElementById("authForm");
const accountCard = document.getElementById("accountCard");
const accountGreeting = document.getElementById("accountGreeting");
const accountEmail = document.getElementById("accountEmail");
const signupButton = document.getElementById("signupButton");
const logoutButton = document.getElementById("logoutButton");
const deleteAccountButton = document.getElementById("deleteAccountButton");
const authStatus = document.getElementById("authStatus");
const selectedName = document.getElementById("selectedName");
const selectedSummary = document.getElementById("selectedSummary");
const statusPill = document.getElementById("statusPill");
const serverStatus = document.getElementById("serverStatus");
const mapViewButton = document.getElementById("mapViewButton");
const setupViewButton = document.getElementById("setupViewButton");
const manageChildrenButton = document.getElementById("manageChildrenButton");
const quickActions = document.getElementById("quickActions");
const startTracking = document.getElementById("startTracking");
const stopTracking = document.getElementById("stopTracking");
const clearHistoryButton = document.getElementById("clearHistoryButton");
const autoTrack = document.getElementById("autoTrack");
const modeLabel = document.getElementById("modeLabel");
const historyRange = document.getElementById("historyRange");
const lastUpdate = document.getElementById("lastUpdate");
const accuracy = document.getElementById("accuracy");
const qualityLabel = document.getElementById("qualityLabel");
const pairTitle = document.getElementById("pairTitle");
const pairHelp = document.getElementById("pairHelp");
const pairCode = document.getElementById("pairCode");
const passkeyCode = document.getElementById("passkeyCode");
const pairStatus = document.getElementById("pairStatus");
const refreshPairCode = document.getElementById("refreshPairCode");
const resetChildButton = document.getElementById("resetChildButton");
const trackingState = document.getElementById("trackingState");
const battery = document.getElementById("battery");
const speed = document.getElementById("speed");
const place = document.getElementById("place");
const mapTitle = document.getElementById("mapTitle");
const mapStatusDot = document.getElementById("mapStatusDot");
const historyList = document.getElementById("historyList");
const parentOnboarding = document.getElementById("parentOnboarding");
const onboardingBegin = document.getElementById("onboardingBegin");
const onboardingAddForm = document.getElementById("onboardingAddForm");
const onboardingChildName = document.getElementById("onboardingChildName");
const onboardingPairCode = document.getElementById("onboardingPairCode");
const onboardingPasskey = document.getElementById("onboardingPasskey");
const onboardingAddAnother = document.getElementById("onboardingAddAnother");
const onboardingStartMap = document.getElementById("onboardingStartMap");
const planOptions = Array.from(document.querySelectorAll(".plan-option"));
let map;
let routeLayer;
let markerLayer;
let placeLayer;
let dashboardView = "map";

function setDashboardView(view) {
  onboardingActive = false;
  parentApp.classList.remove("onboarding-active");
  dashboardView = view === "setup" ? "setup" : "map";
  parentApp.classList.toggle("view-setup", dashboardView === "setup");
  parentApp.classList.toggle("view-map", dashboardView === "map");
  mapViewButton.classList.toggle("active", dashboardView === "map");
  setupViewButton.classList.toggle("active", dashboardView === "setup");
  manageChildrenButton.classList.toggle("active", dashboardView === "setup");
  if (dashboardView === "map") {
    setTimeout(() => {
      if (map) map.invalidateSize();
    }, 0);
  }
}

function planLimit() {
  if (selectedPlan === "family") return 6;
  if (selectedPlan === "plus") return 2;
  return 1;
}

function showParentOnboarding(step = "welcome") {
  showParentApp();
  onboardingActive = true;
  parentApp.classList.add("onboarding-active");
  parentApp.classList.remove("view-map", "view-setup");
  parentOnboarding.querySelectorAll(".onboarding-card").forEach((card) => {
    card.classList.toggle("is-hidden", card.dataset.step !== step);
  });
  if (step === "pairing") {
    const child = currentChild();
    onboardingPairCode.textContent = child?.pairCode || "------";
    onboardingPasskey.textContent = child?.passkey || "----";
  }
}

function finishOnboarding() {
  localStorage.setItem("safestepsParentOnboardingDone", "true");
  onboardingActive = false;
  parentApp.classList.remove("onboarding-active");
  setDashboardView("map");
}

function selectPlan(plan) {
  selectedPlan = ["starter", "plus", "family"].includes(plan) ? plan : "starter";
  localStorage.setItem("safestepsSelectedPlan", selectedPlan);
  planOptions.forEach((option) => option.classList.toggle("active", option.dataset.plan === selectedPlan));
  renderPlan();
}
function currentChild() {
  return family.find((child) => child.id === selectedId) || family[0] || null;
}

function showWelcome() {
  welcomeScreen.classList.remove("is-hidden");
  parentApp.classList.add("is-hidden");
  childWebSetup.classList.add("is-hidden");
}

function showParentApp() {
  welcomeScreen.classList.add("is-hidden");
  childWebSetup.classList.add("is-hidden");
  parentApp.classList.remove("is-hidden");
  setTimeout(() => {
    if (map) map.invalidateSize();
  }, 0);
}

function showChildSetupInfo() {
  welcomeScreen.classList.add("is-hidden");
  parentApp.classList.add("is-hidden");
  childWebSetup.classList.remove("is-hidden");
}

function parentDisplayName() {
  if (parentName) return parentName;
  if (!parentEmail) return "there";
  const name = parentEmail.split("@")[0].replace(/[._-]+/g, " ").trim();
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : "there";
}

function renderAuthState() {
  const signedIn = Boolean(parentToken);
  setVisible(authForm, !signedIn);
  setVisible(accountCard, signedIn);
  parentApp.classList.toggle("is-signed-in", signedIn);
  if (signedIn) {
    accountGreeting.textContent = `Hi, ${parentDisplayName()}`;
    accountEmail.textContent = parentEmail;
  } else {
    accountGreeting.textContent = "Hi there";
    accountEmail.textContent = "";
  }
}

function setVisible(element, visible) {
  element.hidden = !visible;
  element.classList.toggle("is-hidden", !visible);
  element.style.display = visible ? "" : "none";
}

async function ensureParent() {
  if (parentToken) return;
  throw new Error("Log in or sign up to continue");
}

async function authenticate(mode) {
  const name = document.getElementById("authName").value.trim();
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  if (!email || !password || (mode === "signup" && !name)) {
    throw new Error(mode === "signup" ? "Enter your name, email, and password to continue" : "Enter your email and password to continue");
  }
  const response = await fetch(`${apiBase}/api/parent/${mode}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Account request failed");
  if (!data.parentToken) throw new Error("Login succeeded but the session was not returned. Please try again.");
  parentToken = data.parentToken;
  parentId = data.parentId;
  parentEmail = data.email || email;
  parentName = data.name || name || "";
  localStorage.setItem("safestepsParentToken", parentToken);
  localStorage.setItem("safestepsParentId", parentId);
  localStorage.setItem("safestepsParentEmail", parentEmail);
  localStorage.setItem("safestepsParentName", parentName);
  authStatus.textContent = `Signed in as ${parentEmail}`;
  renderAuthState();
  await loadChildren();
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (parentToken) {
    headers.Authorization = `Bearer ${parentToken}`;
  }
  const response = await fetch(`${apiBase}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function loadChildren() {
  await ensureParent();
  const data = await api("/api/children");
  places = data.places || [];
  family = data.children.map(normalizeChild);
  parentApp.classList.toggle("has-family", family.length > 0);
  if (!selectedId || !family.some((child) => child.id === selectedId)) {
    selectedId = family[0]?.id || "";
  }
  serverStatus.textContent = family.length
    ? `${family.filter((child) => child.paired).length}/${family.length} child phones paired`
    : "Add a child to create a pairing code";
  serverStatus.classList.remove("error");
  render();
}

function normalizeChild(child) {
  const pings = child.pings || [];
  const latest = child.latest;
    const latestAccuracyLabel = latest ? accuracyLabel(latest.accuracyMeters) : "Waiting for accurate location";
return {
    id: child.id,
    name: child.name,
    paired: child.paired,
    tracking: Boolean(latest),
    auto: true,
    battery: 100,
    place: latest ? `${Number(latest.latitude).toFixed(5)}, ${Number(latest.longitude).toFixed(5)}` : "Waiting for phone",
    latitude: latest ? Number(latest.latitude) : null,
    longitude: latest ? Number(latest.longitude) : null,
    placeStatus: child.placeStatus || { label: "No saved places yet", type: "none" },
    speed: latest && latest.speedMetersPerSecond > 1 ? "Moving" : latest ? "Stationary" : "Not started",
    accuracy: latest ? Math.max(0, Math.round(latest.accuracyMeters || 0)) : 0,
    quality: latest ? accuracyQuality(latest.accuracyMeters) : "Waiting",
    accuracyLabel: latestAccuracyLabel,
    stale: latest ? isStale(latest.receivedAt) : false,
    lastUpdate: latest ? timeAgo(latest.receivedAt) : child.paired ? "No location yet" : "Not paired",
    pairCode: pendingPairings[child.id]?.code || "",
    passkey: pendingPairings[child.id]?.passkey || "",
    route: pings.length ? pings.slice().reverse().map((ping) => projectLatLng(ping.latitude, ping.longitude)) : [[51.5072, -0.1276]],
    history: pings.length
      ? pings.slice(0, 8).map((ping) => [
          new Date(ping.receivedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          historyLabel(ping)
        ])
      : [[child.paired ? "Now" : "--", child.paired ? "Waiting for first location update" : "Pairing code created"]]
  };
}

function render() {
  renderPlan();
  renderMembers();
  const child = currentChild();
  if (!child) {
    setVisible(quickActions, false);
    setVisible(resetChildButton, false);
    selectedName.textContent = "Add a child";
    selectedSummary.textContent = "Create a pairing code to get started";
    statusPill.textContent = "Setup";
    mapTitle.textContent = "No child selected";
    mapStatusDot.textContent = "Waiting";
    mapStatusDot.className = "status-dot";
    pairTitle.textContent = "Add a child";
    pairHelp.textContent = "Enter a child name on the left to create a pairing code.";
    pairCode.textContent = "Create a child";
    pairCode.classList.add("empty");
    passkeyCode.textContent = "Passkey appears here";
    pairStatus.textContent = "Ready";
    trackingState.textContent = "Off";
    battery.textContent = "--";
    speed.textContent = "--";
    place.textContent = "--";
    lastUpdate.textContent = "--";
    accuracy.textContent = "--";
    qualityLabel.textContent = "Waiting";
    historyList.innerHTML = "";
    renderEmptyMap();
    return;
  }

  setVisible(quickActions, true);
  setVisible(resetChildButton, true);
  selectedName.textContent = child.name;
  statusPill.textContent = child.tracking ? "Live" : child.paired ? "Paired" : "Pairing";
  statusPill.classList.toggle("off", !child.tracking);
  selectedSummary.textContent = childSummary(child);
  mapTitle.textContent = child.tracking ? `${child.name}'s live location` : `${child.name}'s map`;
  mapStatusDot.textContent = child.tracking ? "Live" : child.paired ? "Waiting" : "Not paired";
  mapStatusDot.className = `status-dot${child.tracking ? " live" : child.paired ? "" : " off"}`;
  autoTrack.checked = child.auto;
  modeLabel.textContent = child.auto ? "Auto" : "Manual";
  lastUpdate.textContent = child.lastUpdate;
  accuracy.textContent = child.accuracyLabel;
  qualityLabel.textContent = child.quality;
  pairCode.textContent = child.pairCode || (child.paired ? "Already paired" : "Create a code");
  pairCode.classList.toggle("empty", !child.pairCode || child.paired);
  passkeyCode.textContent = child.passkey ? `Passkey ${child.passkey}` : "Passkey appears here";
  pairStatus.textContent = child.paired ? "Paired" : "Pending";
  pairTitle.textContent = child.paired ? `${child.name} is paired` : `Pair ${child.name}`;
  pairHelp.textContent = pairingHelp(child);
  trackingState.textContent = child.tracking ? "On" : "Off";
  battery.textContent = `${child.battery}%`;
  speed.textContent = child.speed;
  place.textContent = child.placeStatus?.label || child.place;
  renderHistory();
  renderMap(child);
}

function childSummary(child) {
  if (child.tracking) {
    const staleText = child.stale ? " - may be stale" : "";
    return `${child.placeStatus?.label || child.place} - updated ${child.lastUpdate}${staleText} - ${child.accuracyLabel}`;
  }
  if (child.paired) {
    return "Paired, waiting for the child phone to start sharing";
  }
  return "Not paired yet";
}

function pairingHelp(child) {
  if (child.paired) {
    return `${child.name}'s phone is connected. Start sharing location from the child phone to see live updates.`;
  }
  if (child.pairCode && child.passkey) {
    return `Give this code and passkey to ${child.name}. Codes expire after 10 minutes.`;
  }
  return `Create a pairing code for ${child.name}, then enter it on the child phone.`;
}

function renderPlan() {
  planOptions.forEach((option) => option.classList.toggle("active", option.dataset.plan === selectedPlan));
  if (selectedPlan === "starter") {
    planName.textContent = "Starter - 1 child";
    planPrice.textContent = "GBP 2.99/month after Google Play trial";
    return;
  }
  if (selectedPlan === "plus") {
    planName.textContent = "Plus - 2 children";
    planPrice.textContent = "GBP 3.99/month after Google Play trial";
    return;
  }
  planName.textContent = "Family - up to 6 children";
  planPrice.textContent = "GBP 7.99/month after Google Play trial";
}

function renderMembers() {
  memberList.innerHTML = "";
  family.forEach((child) => {
    const button = document.createElement("button");
    button.className = `member-button${child.id === selectedId ? " active" : ""}`;
    button.type = "button";
    const chipClass = child.tracking ? "live" : child.paired ? "waiting" : "unpaired";
    const chipLabel = child.stale ? "Stale" : child.tracking ? "Live" : child.paired ? "Waiting" : "Pair";
    button.innerHTML = `<strong>${escapeHtml(child.name)}</strong><span>${child.tracking ? escapeHtml(child.lastUpdate) : child.paired ? "Waiting for location" : "Pairing needed"}</span><div class="member-meta"><span class="member-chip ${child.stale ? "waiting" : chipClass}">${chipLabel}</span><span class="member-chip">${escapeHtml(child.accuracyLabel)}</span></div>`;
    button.addEventListener("click", () => {
      selectedId = child.id;
      render();
    });
    memberList.appendChild(button);
  });
}


function renderPlaces() {
  if (!placeList) return;
  placeList.innerHTML = "";
  if (!places.length) {
    placeList.innerHTML = `<p class="empty-note">No saved places yet.</p>`;
    return;
  }
  places.forEach((savedPlace) => {
    const row = document.createElement("div");
    row.className = "place-item";
    row.innerHTML = `<strong>${escapeHtml(savedPlace.name)}</strong><span>${Math.round(savedPlace.radiusMeters)} m radius</span>`;
    placeList.appendChild(row);
  });
}

function renderPlaceCircles() {
  if (!placeLayer || !window.L) return;
  places.forEach((savedPlace) => {
    L.circle([Number(savedPlace.latitude), Number(savedPlace.longitude)], {
      radius: Number(savedPlace.radiusMeters || 100),
      color: "#0e8aa3",
      weight: 2,
      fillColor: "#0e8aa3",
      fillOpacity: 0.08
    }).bindPopup(`${savedPlace.name}<br>${Math.round(savedPlace.radiusMeters)} m area`).addTo(placeLayer);
  });
}

async function createPlace() {
  const child = currentChild();
  if (!child || !Number.isFinite(child.latitude) || !Number.isFinite(child.longitude)) {
    serverStatus.textContent = "Wait for this child's live location before saving a place.";
    serverStatus.classList.add("error");
    return;
  }
  const name = placeName.value.trim();
  if (!name) {
    placeName.placeholder = "Name this place first";
    return;
  }
  const data = await api("/api/places", {
    method: "POST",
    body: JSON.stringify({ name, radiusMeters: Number(placeRadius.value), latitude: child.latitude, longitude: child.longitude })
  });
  places.push(data.place);
  placeName.value = "";
  serverStatus.textContent = `${data.place.name} saved`;
  serverStatus.classList.remove("error");
  renderPlaces();
  renderMap(child);
}
function renderHistory() {
  const hours = Number(historyRange.value);
  const label = hours === 168 ? "7 days" : `${hours} hour${hours > 1 ? "s" : ""}`;
  historyList.innerHTML = "";
  currentChild().history.forEach(([time, event]) => {
    const row = document.createElement("div");
    row.className = "history-item";
    row.innerHTML = `<div><strong>${escapeHtml(event)}</strong><span>Showing ${label}</span></div><span>${escapeHtml(time)}</span>`;
    historyList.appendChild(row);
  });
}

function renderEmptyMap() {
  ensureMap();
  routeLayer.clearLayers();
  markerLayer.clearLayers();
}

function renderMap(child) {
  ensureMap();
  routeLayer.clearLayers();
  markerLayer.clearLayers();
  const points = child.route.filter((point) => Array.isArray(point) && point.length === 2);
  if (!points.length) return;
  const latLngs = points.map(([lat, lng]) => [lat, lng]);
  L.polyline(latLngs, { color: child.tracking ? "#1f6feb" : "#8b98aa", weight: 3, opacity: 0.86 }).addTo(routeLayer);
  const latest = latLngs[latLngs.length - 1];
  L.circleMarker(latest, {
    radius: 10,
    color: "#ffffff",
    weight: 3,
    fillColor: child.tracking ? "#157347" : "#b42318",
    fillOpacity: 1
  }).bindPopup(`${child.name}<br>${child.place}`).addTo(markerLayer);
  map.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40], maxZoom: 16 });
}

function projectLatLng(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return [lat, lng];
}

function ensureMap() {
  if (map || !window.L) return;
  map = L.map("mapCanvas", { zoomControl: true }).setView([51.5072, -0.1276], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);
  routeLayer = L.layerGroup().addTo(map);
  markerLayer = L.layerGroup().addTo(map);
  placeLayer = L.layerGroup().addTo(map);
}

function timeAgo(timestamp) {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 10) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `${minutes} min ago`;
}

function isStale(timestamp) {
  return Date.now() - Number(timestamp || 0) > 5 * 60 * 1000;
}

function accuracyQuality(accuracyMeters) {
  const meters = Number(accuracyMeters);
  if (!Number.isFinite(meters) || meters <= 0) return "Unknown";
  if (meters <= 25) return "Good";
  if (meters <= 75) return "Fair";
  return "Poor";
}

function historyLabel(ping) {
  const movement = Number(ping.speedMetersPerSecond) > 1 ? "Moving" : "Stationary";
  const coords = `${Number(ping.latitude).toFixed(5)}, ${Number(ping.longitude).toFixed(5)}`;
  return `${movement} - ${accuracyLabel(ping.accuracyMeters)} - ${coords}`;
}

function accuracyLabel(accuracyMeters) {
  const meters = Number(accuracyMeters);
  if (!Number.isFinite(meters) || meters <= 0) return "Waiting for accurate location";
  const rounded = Math.round(meters);
  if (rounded <= 25) return `Precise location - accuracy ${rounded} m`;
  return `Approximate location - accuracy ${rounded} m`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function createPairing(childName, childId = "") {
  serverStatus.textContent = `Creating pairing code for ${childName}...`;
  serverStatus.classList.remove("error");
  const data = await api("/api/pairing-sessions", {
    method: "POST",
    body: JSON.stringify({ childName, childId })
  });
  pendingPairings[data.childId] = { code: data.code, passkey: data.passkey, expiresAt: data.expiresAt };
  localStorage.setItem("safestepsPendingPairings", JSON.stringify(pendingPairings));
  selectedId = data.childId;
  await loadChildren();
  if (onboardingActive) {
    onboardingPairCode.textContent = data.code;
    onboardingPasskey.textContent = data.passkey;
    showParentOnboarding("pairing");
  }
  serverStatus.textContent = `Pairing code ready for ${childName}`;
  serverStatus.classList.remove("error");
}
async function clearRouteHistory() {
  const child = currentChild();
  if (!child) return;
  const confirmed = window.confirm(`Clear ${child.name}'s route history? This keeps the phone paired and only removes the blue trail.`);
  if (!confirmed) return;
  serverStatus.textContent = `Clearing ${child.name}'s route history...`;
  serverStatus.classList.remove("error");
  await api(`/api/children/${encodeURIComponent(child.id)}/clear-location-history`, { method: "POST" });
  await loadChildren();
  serverStatus.textContent = `${child.name}'s route history was cleared.`;
}

async function resetSelectedChild() {
  const child = currentChild();
  if (!child) return;
  const confirmed = window.confirm(`Remove ${child.name} and delete their pairing and location history? You can add them again with a new code.`);
  if (!confirmed) return;
  serverStatus.textContent = `Removing ${child.name}...`;
  serverStatus.classList.remove("error");
  await api(`/api/children/${encodeURIComponent(child.id)}`, { method: "DELETE" });
  delete pendingPairings[child.id];
  localStorage.setItem("safestepsPendingPairings", JSON.stringify(pendingPairings));
  selectedId = "";
  await loadChildren();
  setDashboardView("setup");
  serverStatus.textContent = `${child.name} removed. Add the child again to start fresh.`;
}

placeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await createPlace();
  } catch (error) {
    serverStatus.textContent = error.message;
    serverStatus.classList.add("error");
  }
});
addMemberForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.getElementById("memberName");
  const name = input.value.trim();
  if (!name) return;
  if (family.length >= planLimit()) {
    input.value = "";
    input.placeholder = `Selected plan allows ${planLimit()} child${planLimit() > 1 ? "ren" : ""}`;
    return;
  }
  input.value = "";
  serverStatus.textContent = "Creating pairing code...";
  try {
    await createPairing(name);
  } catch (error) {
    serverStatus.textContent = error.message;
    serverStatus.classList.add("error");
  }
});

chooseParent.addEventListener("click", () => {
  localStorage.setItem("safestepsLastRole", "parent");
  if (!localStorage.getItem("safestepsParentOnboardingDone") || !family.length) {
    showParentOnboarding("welcome");
  } else {
    showParentApp();
    setDashboardView("map");
  }
  ensureMap();
});

chooseChild.addEventListener("click", () => {
  localStorage.setItem("safestepsLastRole", "child");
  showChildSetupInfo();
});

childBack.addEventListener("click", showWelcome);
mapViewButton.addEventListener("click", () => setDashboardView("map"));
setupViewButton.addEventListener("click", () => setDashboardView("setup"));
manageChildrenButton.addEventListener("click", () => setDashboardView("setup"));

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authStatus.textContent = "Signing in...";
  try {
    await authenticate("login");
  } catch (error) {
    authStatus.textContent = error.message;
  }
});

signupButton.addEventListener("click", async () => {
  authStatus.textContent = "Creating account...";
  try {
    await authenticate("signup");
  } catch (error) {
    authStatus.textContent = error.message;
  }
});


planOptions.forEach((option) => {
  option.addEventListener("click", () => selectPlan(option.dataset.plan));
});

onboardingBegin.addEventListener("click", () => {
  if (!parentToken) {
    authStatus.textContent = "Log in or sign up first, then continue setup.";
    return;
  }
  showParentOnboarding("child-name");
});

onboardingAddForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = onboardingChildName.value.trim();
  if (!name) {
    onboardingChildName.placeholder = "Enter your child's name";
    return;
  }
  if (family.length >= planLimit()) {
    serverStatus.textContent = `Your selected plan allows ${planLimit()} child${planLimit() > 1 ? "ren" : ""}. Choose a larger plan to add more.`;
    serverStatus.classList.add("error");
    return;
  }
  try {
    await createPairing(name);
    onboardingChildName.value = "";
  } catch (error) {
    serverStatus.textContent = error.message;
    serverStatus.classList.add("error");
  }
});

onboardingAddAnother.addEventListener("click", () => {
  if (family.length >= planLimit()) {
    serverStatus.textContent = `Your selected plan allows ${planLimit()} child${planLimit() > 1 ? "ren" : ""}. Choose a larger plan to add more.`;
    serverStatus.classList.add("error");
    return;
  }
  showParentOnboarding("child-name");
});

onboardingStartMap.addEventListener("click", finishOnboarding);

logoutButton.addEventListener("click", async () => {
  if (parentToken) {
    await api("/api/parent/logout", { method: "POST" }).catch(() => {});
  }
  parentToken = "";
  parentId = "";
  parentEmail = "";
  parentName = "";
  family = [];
  parentApp.classList.remove("has-family");
  localStorage.removeItem("safestepsParentToken");
  localStorage.removeItem("safestepsParentId");
  localStorage.removeItem("safestepsParentEmail");
  localStorage.removeItem("safestepsParentName");
  authStatus.textContent = "Logged out.";
  renderAuthState();
  render();
});

deleteAccountButton.addEventListener("click", async () => {
  if (!parentToken) {
    authStatus.textContent = "Log in before deleting an account.";
    return;
  }
  const confirmed = window.confirm("Delete this SafeSteps account and all child location data?");
  if (!confirmed) return;
  await api("/api/parent/account", { method: "DELETE" });
  parentToken = "";
  parentId = "";
  parentEmail = "";
  parentName = "";
  family = [];
  parentApp.classList.remove("has-family");
  localStorage.removeItem("safestepsParentToken");
  localStorage.removeItem("safestepsParentId");
  localStorage.removeItem("safestepsParentEmail");
  localStorage.removeItem("safestepsParentName");
  authStatus.textContent = "Account deleted.";
  renderAuthState();
  render();
});

startTracking.addEventListener("click", () => {
  serverStatus.textContent = "Start sharing from the child phone";
});

stopTracking.addEventListener("click", () => {
  serverStatus.textContent = "Stop sharing from the child phone";
});

autoTrack.addEventListener("change", render);
historyRange.addEventListener("change", renderHistory);
clearHistoryButton.addEventListener("click", async () => {
  try {
    await clearRouteHistory();
  } catch (error) {
    serverStatus.textContent = error.message;
    serverStatus.classList.add("error");
  }
});

refreshPairCode.addEventListener("click", async () => {
  const child = currentChild();
  try {
    await createPairing(child?.name || "Child", child?.id || "");
  } catch (error) {
    serverStatus.textContent = error.message;
    serverStatus.classList.add("error");
  }
});


resetChildButton.addEventListener("click", async () => {
  try {
    await resetSelectedChild();
  } catch (error) {
    serverStatus.textContent = error.message;
    serverStatus.classList.add("error");
  }
});
if (localStorage.getItem("safestepsLastRole") === "parent" || parentToken) {
  showParentApp();
} else {
  showWelcome();
}
ensureMap();
if (parentEmail) {
  authStatus.textContent = `Signed in as ${parentEmail}`;
}
renderAuthState();
selectPlan(selectedPlan);
setDashboardView("map");
loadChildren().catch((error) => {
  serverStatus.textContent = error.message;
  serverStatus.classList.add("error");
  render();
});
setInterval(() => loadChildren().catch(() => {}), 3000);
