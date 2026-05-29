const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");

const port = Number(process.env.PORT || 8787);
const publicBaseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${port}`;
const webRoot = path.join(__dirname, "..", "parent-web");
const jsonDbPath = process.env.JSON_DB_PATH || path.join(__dirname, "safesteps-dev-db.json");
const databaseUrl = process.env.DATABASE_URL || "";
const retentionDays = Number(process.env.LOCATION_RETENTION_DAYS || 30);
const rateWindowMs = 60_000;
const rateLimitMax = Number(process.env.RATE_LIMIT_MAX || 120);
const rateBuckets = new Map();

let pgPool = null;
let state = {
  parents: [],
  parentSessions: [],
  children: [],
  pairingSessions: [],
  locationPings: [],
  purchases: [],
  dataDeletionRequests: []
};

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(12).toString("hex")}`;
}

function secret(bytes = 24) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function passwordHash(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
}

function pairingCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function passkey() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function now() {
  return Date.now();
}

function loadJsonDb() {
  if (!fs.existsSync(jsonDbPath)) return;
  state = { ...state, ...JSON.parse(fs.readFileSync(jsonDbPath, "utf8")) };
}

function saveJsonDb() {
  fs.writeFileSync(jsonDbPath, JSON.stringify(state, null, 2));
}

async function initPostgres() {
  if (!databaseUrl) {
    loadJsonDb();
    return;
  }

  const { Pool } = require("pg");
  pgPool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false }
  });
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await withDatabaseRetry(() => pgPool.query(schema));
}

async function withDatabaseRetry(operation, attempts = 12) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const delayMs = Math.min(30000, attempt * 5000);
      console.warn(`Database not ready yet (${attempt}/${attempts}): ${error.code || error.message}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

async function allParents() {
  if (!pgPool) return state.parents;
  const result = await pgPool.query("SELECT id, name, email, token_hash AS \"tokenHash\", created_at AS \"createdAt\" FROM parents");
  return result.rows;
}

async function insertParent(parent) {
  if (!pgPool) {
    state.parents.push(parent);
    saveJsonDb();
    return;
  }
  await pgPool.query(
    "INSERT INTO parents (id, name, email, password_salt, password_hash, token_hash, created_at, deleted_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [parent.id, parent.name || null, parent.email || null, parent.passwordSalt || null, parent.passwordHash || null, parent.tokenHash, parent.createdAt, parent.deletedAt || null]
  );
}

async function findParentByToken(token) {
  const tokenHash = hash(token);
  if (!pgPool) {
    const session = state.parentSessions.find((item) => item.tokenHash === tokenHash && !item.revokedAt && item.expiresAt > now());
    if (session) return state.parents.find((parent) => parent.id === session.parentId && !parent.deletedAt) || null;
    return state.parents.find((parent) => parent.tokenHash === tokenHash && !parent.deletedAt) || null;
  }
  const sessionResult = await pgPool.query(
    "SELECT p.id, p.name, p.email, p.token_hash AS \"tokenHash\", p.created_at AS \"createdAt\" FROM parent_sessions s JOIN parents p ON p.id = s.parent_id WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > $2 AND p.deleted_at IS NULL",
    [tokenHash, now()]
  );
  if (sessionResult.rows[0]) return sessionResult.rows[0];
  const result = await pgPool.query(
    "SELECT id, name, email, token_hash AS \"tokenHash\", created_at AS \"createdAt\" FROM parents WHERE token_hash = $1 AND deleted_at IS NULL",
    [tokenHash]
  );
  return result.rows[0] || null;
}

async function findParentByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!pgPool) return state.parents.find((parent) => parent.email === normalized && !parent.deletedAt) || null;
  const result = await pgPool.query(
    "SELECT id, name, email, password_salt AS \"passwordSalt\", password_hash AS \"passwordHash\", token_hash AS \"tokenHash\", created_at AS \"createdAt\" FROM parents WHERE email = $1 AND deleted_at IS NULL",
    [normalized]
  );
  return result.rows[0] || null;
}

async function insertParentSession(session) {
  if (!pgPool) {
    state.parentSessions.push(session);
    saveJsonDb();
    return;
  }
  await pgPool.query(
    "INSERT INTO parent_sessions (id, parent_id, token_hash, created_at, expires_at, revoked_at) VALUES ($1, $2, $3, $4, $5, $6)",
    [session.id, session.parentId, session.tokenHash, session.createdAt, session.expiresAt, session.revokedAt || null]
  );
}

async function revokeParentToken(token) {
  const tokenHash = hash(token);
  if (!pgPool) {
    state.parentSessions.forEach((session) => {
      if (session.tokenHash === tokenHash) session.revokedAt = now();
    });
    saveJsonDb();
    return;
  }
  await pgPool.query("UPDATE parent_sessions SET revoked_at = $1 WHERE token_hash = $2", [now(), tokenHash]);
}

async function deleteParentAccount(parent) {
  if (!pgPool) {
    const childIds = state.children.filter((child) => child.parentId === parent.id).map((child) => child.id);
    state.locationPings = state.locationPings.filter((ping) => !childIds.includes(ping.childId));
    state.pairingSessions = state.pairingSessions.filter((session) => session.parentId !== parent.id);
    state.children = state.children.filter((child) => child.parentId !== parent.id);
    const found = state.parents.find((item) => item.id === parent.id);
    if (found) found.deletedAt = now();
    state.parentSessions.forEach((session) => {
      if (session.parentId === parent.id) session.revokedAt = now();
    });
    state.dataDeletionRequests.push({ id: id("del"), parentId: parent.id, email: parent.email || "", status: "completed", requestedAt: now(), completedAt: now() });
    saveJsonDb();
    return;
  }
  await pgPool.query("INSERT INTO data_deletion_requests (id, parent_id, email, status, requested_at, completed_at) VALUES ($1, $2, $3, $4, $5, $6)", [id("del"), parent.id, parent.email || null, "completed", now(), now()]);
  await pgPool.query("UPDATE parents SET deleted_at = $1 WHERE id = $2", [now(), parent.id]);
}

async function insertChild(child) {
  if (!pgPool) {
    state.children.push(child);
    saveJsonDb();
    return;
  }
  await pgPool.query(
    "INSERT INTO children (id, parent_id, name, device_token_hash, device_name, paired_at, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [child.id, child.parentId, child.name, child.deviceTokenHash || null, child.deviceName || null, child.pairedAt || null, child.createdAt]
  );
}

async function updateChildPairing(childId, deviceToken, deviceName) {
  const deviceTokenHash = hash(deviceToken);
  if (!pgPool) {
    const child = state.children.find((item) => item.id === childId);
    if (child) {
      child.deviceTokenHash = deviceTokenHash;
      child.deviceName = deviceName;
      child.pairedAt = now();
      saveJsonDb();
    }
    return;
  }
  await pgPool.query(
    "UPDATE children SET device_token_hash = $1, device_name = $2, paired_at = $3 WHERE id = $4",
    [deviceTokenHash, deviceName, now(), childId]
  );
}


async function deleteChildForParent(parentId, childId) {
  if (!pgPool) {
    const child = state.children.find((item) => item.id === childId && item.parentId === parentId);
    if (!child) return false;
    state.locationPings = state.locationPings.filter((ping) => ping.childId !== childId);
    state.pairingSessions = state.pairingSessions.filter((session) => session.childId !== childId);
    state.children = state.children.filter((item) => item.id !== childId);
    saveJsonDb();
    return true;
  }
  const result = await pgPool.query("DELETE FROM children WHERE id = $1 AND parent_id = $2 RETURNING id", [childId, parentId]);
  return result.rowCount > 0;
}
async function childrenForParent(parentId) {
  if (!pgPool) return state.children.filter((child) => child.parentId === parentId);
  const result = await pgPool.query(
    "SELECT id, parent_id AS \"parentId\", name, device_token_hash AS \"deviceTokenHash\", device_name AS \"deviceName\", paired_at AS \"pairedAt\", created_at AS \"createdAt\" FROM children WHERE parent_id = $1 ORDER BY created_at",
    [parentId]
  );
  return result.rows;
}

async function findChildByDeviceToken(token) {
  const tokenHash = hash(token);
  if (!pgPool) return state.children.find((child) => child.deviceTokenHash === tokenHash) || null;
  const result = await pgPool.query(
    "SELECT id, parent_id AS \"parentId\", name, device_token_hash AS \"deviceTokenHash\", device_name AS \"deviceName\", paired_at AS \"pairedAt\", created_at AS \"createdAt\" FROM children WHERE device_token_hash = $1",
    [tokenHash]
  );
  return result.rows[0] || null;
}

async function insertPairingSession(session) {
  if (!pgPool) {
    state.pairingSessions.push(session);
    saveJsonDb();
    return;
  }
  await pgPool.query(
    "INSERT INTO pairing_sessions (id, parent_id, child_id, code, passkey_hash, status, expires_at, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [session.id, session.parentId, session.childId, session.code, session.passkeyHash, session.status, session.expiresAt, session.createdAt]
  );
}

async function findPairingSession(code) {
  if (!pgPool) return state.pairingSessions.find((session) => session.code === code) || null;
  const result = await pgPool.query(
    "SELECT id, parent_id AS \"parentId\", child_id AS \"childId\", code, passkey_hash AS \"passkeyHash\", status, expires_at AS \"expiresAt\", created_at AS \"createdAt\" FROM pairing_sessions WHERE code = $1",
    [code]
  );
  return result.rows[0] || null;
}

async function updatePairingStatus(sessionId, status) {
  if (!pgPool) {
    const session = state.pairingSessions.find((item) => item.id === sessionId);
    if (session) {
      session.status = status;
      saveJsonDb();
    }
    return;
  }
  await pgPool.query("UPDATE pairing_sessions SET status = $1 WHERE id = $2", [status, sessionId]);
}


async function placesForParent(parentId) {
  if (!pgPool) return state.places.filter((place) => place.parentId === parentId);
  const result = await pgPool.query(
    "SELECT id, parent_id AS \"parentId\", name, kind, address, zone_mode AS \"zoneMode\", latitude, longitude, radius_meters AS \"radiusMeters\", created_at AS \"createdAt\" FROM places WHERE parent_id = $1 ORDER BY created_at",
    [parentId]
  );
  return result.rows;
}

async function insertPlace(place) {
  if (!pgPool) {
    state.places.push(place);
    saveJsonDb();
    return;
  }
  await pgPool.query(
    "INSERT INTO places (id, parent_id, name, kind, address, zone_mode, latitude, longitude, radius_meters, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
    [place.id, place.parentId, place.name, place.kind, place.address, place.zoneMode, place.latitude, place.longitude, place.radiusMeters, place.createdAt]
  );
}
async function latestPingsForChildren(children) {
  const childIds = children.map((child) => child.id);
  if (!childIds.length) return [];
  if (!pgPool) {
    return state.locationPings
      .filter((ping) => childIds.includes(ping.childId))
      .sort((a, b) => b.receivedAt - a.receivedAt);
  }
  const result = await pgPool.query(
    "SELECT id, child_id AS \"childId\", latitude, longitude, accuracy_meters AS \"accuracyMeters\", altitude_meters AS \"altitudeMeters\", speed_meters_per_second AS \"speedMetersPerSecond\", bearing_degrees AS \"bearingDegrees\", provider, captured_at AS \"capturedAt\", received_at AS \"receivedAt\", device FROM location_pings WHERE child_id = ANY($1) ORDER BY received_at DESC LIMIT 500",
    [childIds]
  );
  return result.rows;
}


async function clearChildLocationHistory(parentId, childId) {
  if (!pgPool) {
    const child = state.children.find((item) => item.id === childId && item.parentId === parentId);
    if (!child) return false;
    state.locationPings = state.locationPings.filter((ping) => ping.childId !== childId);
    saveJsonDb();
    return true;
  }
  const childResult = await pgPool.query("SELECT id FROM children WHERE id = $1 AND parent_id = $2", [childId, parentId]);
  if (!childResult.rowCount) return false;
  await pgPool.query("DELETE FROM location_pings WHERE child_id = $1", [childId]);
  return true;
}

async function parentDisplayNameById(parentId) {
  if (!pgPool) {
    const parent = state.parents.find((item) => item.id === parentId);
    return parent?.name || parent?.email || "parent";
  }
  const result = await pgPool.query("SELECT name, email FROM parents WHERE id = $1", [parentId]);
  const parent = result.rows[0] || {};
  return parent.name || parent.email || "parent";
}
async function insertLocationPing(ping) {
  if (!pgPool) {
    state.locationPings.push(ping);
    state.locationPings = state.locationPings.slice(-2000);
    saveJsonDb();
    return;
  }
  await pgPool.query(
    "INSERT INTO location_pings (id, child_id, latitude, longitude, accuracy_meters, altitude_meters, speed_meters_per_second, bearing_degrees, provider, captured_at, received_at, device) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
    [ping.id, ping.childId, ping.latitude, ping.longitude, ping.accuracyMeters, ping.altitudeMeters, ping.speedMetersPerSecond, ping.bearingDegrees, ping.provider, ping.capturedAt, ping.receivedAt, ping.device]
  );
}

async function cleanupOldLocations() {
  const cutoff = now() - retentionDays * 24 * 60 * 60 * 1000;
  if (!pgPool) {
    state.locationPings = state.locationPings.filter((ping) => ping.receivedAt >= cutoff);
    saveJsonDb();
    return;
  }
  await pgPool.query("DELETE FROM location_pings WHERE received_at < $1", [cutoff]);
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-SafeSteps-Device",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
  });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 100000) {
        reject(new Error("Body too large"));
      }
    });
    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function validPassword(value) {
  return typeof value === "string" && value.length >= 8;
}

function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 80);
}

function issueParentSession(parent) {
  const token = secret();
  const session = {
    id: id("ses"),
    parentId: parent.id,
    tokenHash: hash(token),
    createdAt: now(),
    expiresAt: now() + 90 * 24 * 60 * 60 * 1000
  };
  return insertParentSession(session).then(() => ({ parentToken: token, parentId: parent.id, name: parent.name || "", email: parent.email || "" }));
}

function rateLimitKey(request) {
  const ip = request.headers["x-forwarded-for"] || request.socket.remoteAddress || "local";
  return `${ip}:${request.method}:${new URL(request.url, `http://${request.headers.host}`).pathname}`;
}

function checkRateLimit(request) {
  const key = rateLimitKey(request);
  const bucket = rateBuckets.get(key) || { count: 0, resetAt: now() + rateWindowMs };
  if (bucket.resetAt < now()) {
    bucket.count = 0;
    bucket.resetAt = now() + rateWindowMs;
  }
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  return bucket.count <= rateLimitMax;
}

function bearerToken(request) {
  return (request.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
}

async function requireParent(request, response) {
  const parent = await findParentByToken(bearerToken(request));
  if (!parent) sendJson(response, 401, { error: "Parent authorization required" });
  return parent;
}

function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(webRoot, safePath);

  if (!filePath.startsWith(webRoot)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, contents) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain" });
      response.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    const type = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8"
    }[ext] || "application/octet-stream";
    response.writeHead(200, { "Content-Type": type });
    response.end(contents);
  });
}

async function api(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (!checkRateLimit(request)) {
    sendJson(response, 429, { error: "Too many requests. Please wait a minute and try again." });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/parent/signup") {
    const body = await readBody(request);
    const name = normalizeName(body.name);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    if (!name || !email.includes("@") || !validPassword(password)) {
      sendJson(response, 400, { error: "Enter your name, a valid email, and a password of at least 8 characters." });
      return;
    }
    if (await findParentByEmail(email)) {
      sendJson(response, 409, { error: "An account already exists for this email." });
      return;
    }
    const salt = secret(16);
    const parent = {
      id: id("par"),
      name,
      email,
      passwordSalt: salt,
      passwordHash: passwordHash(password, salt),
      tokenHash: hash(secret()),
      createdAt: now()
    };
    await insertParent(parent);
    sendJson(response, 201, await issueParentSession(parent));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/parent/login") {
    const body = await readBody(request);
    const parent = await findParentByEmail(body.email);
    if (!parent || parent.passwordHash !== passwordHash(String(body.password || ""), parent.passwordSalt || "")) {
      sendJson(response, 401, { error: "Email or password is incorrect." });
      return;
    }
    sendJson(response, 200, await issueParentSession(parent));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/parent/logout") {
    await revokeParentToken(bearerToken(request));
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "DELETE" && url.pathname === "/api/parent/account") {
    const parent = await requireParent(request, response);
    if (!parent) return;
    await deleteParentAccount(parent);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/purchases/verify") {
    const parent = await requireParent(request, response);
    if (!parent) return;
    const body = await readBody(request);
    sendJson(response, 202, {
      ok: true,
      status: "received",
      message: "Purchase verification endpoint is ready. Connect Google Play Developer API credentials before public release.",
      productId: body.productId || ""
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/parent/register") {
    const token = secret();
    const parent = { id: id("par"), tokenHash: hash(token), createdAt: now() };
    await insertParent(parent);
    sendJson(response, 201, { parentId: parent.id, parentToken: token, apiBaseUrl: publicBaseUrl });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/pairing-sessions") {
    const parent = await requireParent(request, response);
    if (!parent) return;
    const body = await readBody(request);
    const childName = String(body.childName || "Child").trim().slice(0, 40) || "Child";
    const existingChildren = await childrenForParent(parent.id);
    let child = existingChildren.find((item) => item.id === body.childId) || null;
    if (!child) {
      child = { id: id("chi"), parentId: parent.id, name: childName, createdAt: now() };
      await insertChild(child);
    }
    let code = pairingCode();
    while (await findPairingSession(code)) code = pairingCode();
    const pin = passkey();
    const session = {
      id: id("pair"),
      parentId: parent.id,
      childId: child.id,
      code,
      passkeyHash: hash(pin),
      status: "pending",
      expiresAt: now() + 10 * 60 * 1000,
      createdAt: now()
    };
    await insertPairingSession(session);
    sendJson(response, 201, { childId: child.id, code, passkey: pin, expiresAt: session.expiresAt });
    return;
  }


  if (request.method === "POST" && url.pathname === "/api/places") {
    const parent = await requireParent(request, response);
    if (!parent) return;
    const body = await readBody(request);
    const name = String(body.name || "Place").trim().replace(/\s+/g, " ").slice(0, 40) || "Place";
    const kind = ["home", "school", "park", "friend", "work", "other"].includes(String(body.kind || "").toLowerCase())
      ? String(body.kind).toLowerCase()
      : "other";
    const zoneMode = ["place", "safe", "restricted"].includes(String(body.zoneMode || "").toLowerCase())
      ? String(body.zoneMode).toLowerCase()
      : "place";
    const address = String(body.address || "").trim().replace(/\s+/g, " ").slice(0, 160);
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const radiusMeters = Math.max(25, Math.min(5000, Number(body.radiusMeters || 100)));
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      sendJson(response, 400, { error: "A place needs a valid latitude and longitude." });
      return;
    }
    const place = { id: id("pla"), parentId: parent.id, name, kind, address, zoneMode, latitude, longitude, radiusMeters, createdAt: now() };
    await insertPlace(place);
    sendJson(response, 201, { place });
    return;
  }


  if (request.method === "POST" && url.pathname.startsWith("/api/children/") && url.pathname.endsWith("/clear-location-history")) {
    const parent = await requireParent(request, response);
    if (!parent) return;
    const childId = decodeURIComponent(url.pathname.replace("/api/children/", "").replace("/clear-location-history", "")).trim();
    if (!childId) {
      sendJson(response, 400, { error: "Child id is required" });
      return;
    }
    const cleared = await clearChildLocationHistory(parent.id, childId);
    if (!cleared) {
      sendJson(response, 404, { error: "Child not found" });
      return;
    }
    sendJson(response, 200, { ok: true });
    return;
  }
  if (request.method === "DELETE" && url.pathname.startsWith("/api/children/")) {
    const parent = await requireParent(request, response);
    if (!parent) return;
    const childId = decodeURIComponent(url.pathname.replace("/api/children/", "")).trim();
    if (!childId) {
      sendJson(response, 400, { error: "Child id is required" });
      return;
    }
    const deleted = await deleteChildForParent(parent.id, childId);
    if (!deleted) {
      sendJson(response, 404, { error: "Child not found" });
      return;
    }
    sendJson(response, 200, { ok: true });
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/children") {
    const parent = await requireParent(request, response);
    if (!parent) return;
    const children = await childrenForParent(parent.id);
    const pings = await latestPingsForChildren(children);
    const places = await placesForParent(parent.id);
    sendJson(response, 200, { children: children.map((child) => withPings(child, pings, places)), places });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/child/pair") {
    const body = await readBody(request);
    const code = String(body.code || "").trim();
    const pin = String(body.passkey || "").trim();
    const session = await findPairingSession(code);
    if (!session || session.status !== "pending" || session.expiresAt < now() || session.passkeyHash !== hash(pin)) {
      sendJson(response, 400, { error: "Pairing code or passkey is invalid or expired" });
      return;
    }
    const deviceToken = secret();
    await updateChildPairing(session.childId, deviceToken, String(body.deviceName || "Android").slice(0, 80));
    await updatePairingStatus(session.id, "paired");
    sendJson(response, 200, {
      childId: session.childId,
      deviceToken,
      locationEndpoint: `${publicBaseUrl}/api/child/location-pings`,
      parentName: await parentDisplayNameById(session.parentId)
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/child/location-pings") {
    const child = await findChildByDeviceToken(bearerToken(request));
    if (!child) {
      sendJson(response, 401, { error: "Child device authorization required" });
      return;
    }
    const body = await readBody(request);
    const ping = {
      id: id("ping"),
      childId: child.id,
      latitude: Number(body.latitude),
      longitude: Number(body.longitude),
      accuracyMeters: numberOrNull(body.accuracyMeters),
      altitudeMeters: numberOrNull(body.altitudeMeters),
      speedMetersPerSecond: numberOrNull(body.speedMetersPerSecond),
      bearingDegrees: numberOrNull(body.bearingDegrees),
      provider: String(body.provider || ""),
      capturedAt: numberOrNull(body.capturedAt),
      receivedAt: now(),
      device: request.headers["x-safesteps-device"] || "Android"
    };
    if (!Number.isFinite(ping.latitude) || !Number.isFinite(ping.longitude)) {
      sendJson(response, 400, { error: "latitude and longitude are required" });
      return;
    }
    await insertLocationPing(ping);
    await cleanupOldLocations();
    sendJson(response, 202, { ok: true });
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function withPings(child, allPings, places = []) {
  const pings = allPings.filter((ping) => ping.childId === child.id).slice(0, 200);
  const latest = pings[0] || null;
  return {
    id: child.id,
    name: child.name,
    paired: Boolean(child.pairedAt),
    deviceName: child.deviceName || "",
    pairedAt: child.pairedAt || null,
    latest,
    placeStatus: placeStatusForPing(latest, places),
    pings
  };
}


function placeStatusForPing(ping, places) {
  if (!ping || !places.length) return { label: "No places saved yet", type: "none" };
  const matches = places
    .map((place) => ({ place, distanceMeters: distanceMeters(ping.latitude, ping.longitude, place.latitude, place.longitude) }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
  const nearest = matches[0];
  if (!nearest) return { label: "Away from saved places", type: "away" };
  const accuracy = Number(ping.accuracyMeters || 0);
  const radius = Number(nearest.place.radiusMeters || 100);
  const inside = nearest.distanceMeters <= radius;
  const near = accuracy > 0 && nearest.distanceMeters <= radius + accuracy;
  const placeName = nearest.place.name;
  const roundedDistance = Math.round(nearest.distanceMeters);
  if (nearest.place.zoneMode === "safe" && !near) {
    return { label: `Outside allowed area: ${placeName}`, type: "safe-alert", placeName, distanceMeters: roundedDistance };
  }
  if (nearest.place.zoneMode === "restricted" && inside) {
    return { label: `In restricted area: ${placeName}`, type: "restricted-alert", placeName, distanceMeters: roundedDistance };
  }
  if (inside) {
    return { label: `At ${placeName}`, type: "inside", placeName, distanceMeters: roundedDistance };
  }
  if (near) {
    return { label: `Approximate near ${placeName}`, type: "near", placeName, distanceMeters: roundedDistance };
  }
  return { label: `Away from places - ${roundedDistance} m from ${placeName}`, type: "away", placeName, distanceMeters: roundedDistance };
}

function distanceMeters(latA, lonA, latB, lonB) {
  const earthRadius = 6371000;
  const toRad = (value) => Number(value) * Math.PI / 180;
  const dLat = toRad(latB - latA);
  const dLon = toRad(lonB - lonA);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * Math.sin(dLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "OPTIONS") {
      sendJson(response, 204, {});
      return;
    }
    if (request.url.startsWith("/api/")) {
      await api(request, response);
      return;
    }
    serveStatic(request, response);
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: error.message || "Server error" });
  }
});

initPostgres().then(async () => {
  await cleanupOldLocations();
  const parents = await allParents();
  server.listen(port, () => {
    console.log(`SafeSteps backend listening on ${publicBaseUrl}`);
    console.log(pgPool ? "Database: Postgres" : `Database: JSON dev file (${jsonDbPath})`);
    console.log(`Existing parent accounts: ${parents.length}`);
  });
});
