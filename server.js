const http = require("http");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const { URL } = require("url");
const crypto = require("crypto");

const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const TASKS_FILE = path.join(DATA_DIR, "tarefas.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SESSION_DURATION_MS = 6 * 60 * 60 * 1000;

const sessions = new Map();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
};

function now() {
  return Date.now();
}

function parseJson(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    createdAt: user.createdAt,
  };
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, encoded) {
  const [scheme, salt, hash] = String(encoded).split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;

  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  const left = Buffer.from(derived, "hex");
  const right = Buffer.from(hash, "hex");

  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

async function ensureDataFiles() {
  await fsp.mkdir(DATA_DIR, { recursive: true });

  try {
    await fsp.access(TASKS_FILE, fs.constants.F_OK);
  } catch {
    await fsp.writeFile(TASKS_FILE, "[]\n", "utf8");
  }

  try {
    await fsp.access(USERS_FILE, fs.constants.F_OK);
  } catch {
    const admin = {
      id: crypto.randomUUID(),
      username: "admin",
      passwordHash: hashPassword("admin"),
      role: "admin",
      createdAt: now(),
    };
    await fsp.writeFile(USERS_FILE, `${JSON.stringify([admin], null, 2)}\n`, "utf8");
  }
}

async function readTasks() {
  const raw = await fsp.readFile(TASKS_FILE, "utf8");
  const parsed = parseJson(raw || "[]", []);
  return Array.isArray(parsed) ? parsed : [];
}

async function writeTasks(tasks) {
  await fsp.writeFile(TASKS_FILE, `${JSON.stringify(tasks, null, 2)}\n`, "utf8");
}

async function readUsers() {
  const raw = await fsp.readFile(USERS_FILE, "utf8");
  const parsed = parseJson(raw || "[]", []);
  return Array.isArray(parsed) ? parsed : [];
}

async function writeUsers(users) {
  await fsp.writeFile(USERS_FILE, `${JSON.stringify(users, null, 2)}\n`, "utf8");
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function sendNotFound(res) {
  return sendText(res, 404, "Not Found");
}

function sendMethodNotAllowed(res) {
  return sendText(res, 405, "Method Not Allowed");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error("Payload too large"));
      }
    });

    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function makeSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = now() + SESSION_DURATION_MS;
  sessions.set(token, { userId, expiresAt });
  return { token, expiresAt };
}

function removeExpiredSessions() {
  const timestamp = now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= timestamp) {
      sessions.delete(token);
    }
  }
}

function getTokenFromRequest(req) {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) {
    return auth.slice(7).trim();
  }

  const fallback = req.headers["x-session-token"];
  return typeof fallback === "string" ? fallback : "";
}

async function requireAuth(req, res, options = {}) {
  removeExpiredSessions();
  const token = getTokenFromRequest(req);
  if (!token) {
    sendJson(res, 401, { error: "Não autenticado." });
    return null;
  }

  const session = sessions.get(token);
  if (!session || session.expiresAt <= now()) {
    sessions.delete(token);
    sendJson(res, 401, { error: "Sessão expirada." });
    return null;
  }

  const users = await readUsers();
  const user = users.find((u) => u.id === session.userId);
  if (!user) {
    sessions.delete(token);
    sendJson(res, 401, { error: "Usuário não encontrado." });
    return null;
  }

  if (options.role && user.role !== options.role) {
    sendJson(res, 403, { error: "Acesso negado." });
    return null;
  }

  return { token, user, expiresAt: session.expiresAt };
}

function sanitizePath(urlPathname) {
  const decoded = decodeURIComponent(urlPathname);
  const normalized = path.normalize(decoded).replace(/^([.][.][/\\])+/, "");
  const filePath = path.join(ROOT_DIR, normalized);

  if (!filePath.startsWith(ROOT_DIR)) {
    return null;
  }

  return filePath;
}

async function serveStatic(res, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = sanitizePath(requestedPath);
  if (!filePath) return sendNotFound(res);

  let stat;
  try {
    stat = await fsp.stat(filePath);
  } catch {
    return sendNotFound(res);
  }

  if (stat.isDirectory()) {
    return serveStatic(res, path.join(requestedPath, "index.html"));
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-cache",
  });
  fs.createReadStream(filePath).pipe(res);
}

async function handleAuth(req, res, pathname) {
  if (pathname === "/api/auth/login") {
    if (req.method !== "POST") return sendMethodNotAllowed(res);

    try {
      const body = await readBody(req);
      const payload = parseJson(body, null);
      const username = String(payload?.username || "").trim();
      const password = String(payload?.password || "");

      if (!username || !password) {
        return sendJson(res, 400, { error: "Usuário e senha são obrigatórios." });
      }

      const users = await readUsers();
      const user = users.find((u) => u.username.toLowerCase() === username.toLowerCase());

      if (!user || !verifyPassword(password, user.passwordHash)) {
        return sendJson(res, 401, { error: "Credenciais inválidas." });
      }

      const session = makeSession(user.id);
      return sendJson(res, 200, {
        token: session.token,
        expiresAt: session.expiresAt,
        user: sanitizeUser(user),
      });
    } catch {
      return sendJson(res, 400, { error: "JSON inválido." });
    }
  }

  if (pathname === "/api/auth/session") {
    if (req.method !== "GET") return sendMethodNotAllowed(res);

    const auth = await requireAuth(req, res);
    if (!auth) return;

    return sendJson(res, 200, {
      user: sanitizeUser(auth.user),
      expiresAt: auth.expiresAt,
    });
  }

  if (pathname === "/api/auth/logout") {
    if (req.method !== "POST") return sendMethodNotAllowed(res);

    const auth = await requireAuth(req, res);
    if (!auth) return;

    sessions.delete(auth.token);
    return sendJson(res, 200, { ok: true });
  }

  return sendNotFound(res);
}

async function handleUsers(req, res, pathname) {
  if (pathname === "/api/users/options") {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    if (req.method !== "GET") return sendMethodNotAllowed(res);

    const users = await readUsers();
    return sendJson(
      res,
      200,
      users
        .map((u) => ({ id: u.id, username: u.username }))
        .sort((a, b) => a.username.localeCompare(b.username, "pt-BR")),
    );
  }

  const auth = await requireAuth(req, res, { role: "admin" });
  if (!auth) return;

  if (pathname === "/api/users") {
    if (req.method === "GET") {
      const users = await readUsers();
      return sendJson(
        res,
        200,
        users
          .map((u) => sanitizeUser(u))
          .sort((a, b) => a.username.localeCompare(b.username, "pt-BR")),
      );
    }

    if (req.method === "POST") {
      try {
        const body = await readBody(req);
        const payload = parseJson(body, null);

        const username = String(payload?.username || "").trim();
        const password = String(payload?.password || "");
        const role = payload?.role === "admin" ? "admin" : "user";

        if (username.length < 3) {
          return sendJson(res, 400, { error: "Usuário deve ter ao menos 3 caracteres." });
        }

        if (password.length < 3) {
          return sendJson(res, 400, { error: "Senha deve ter ao menos 3 caracteres." });
        }

        const users = await readUsers();
        const exists = users.some((u) => u.username.toLowerCase() === username.toLowerCase());
        if (exists) {
          return sendJson(res, 409, { error: "Usuário já existe." });
        }

        const newUser = {
          id: crypto.randomUUID(),
          username,
          passwordHash: hashPassword(password),
          role,
          createdAt: now(),
        };

        users.push(newUser);
        await writeUsers(users);

        return sendJson(res, 201, sanitizeUser(newUser));
      } catch {
        return sendJson(res, 400, { error: "JSON inválido." });
      }
    }

    return sendMethodNotAllowed(res);
  }

  if (pathname.startsWith("/api/users/")) {
    const userId = pathname.split("/")[3] || "";
    if (!userId) return sendNotFound(res);

    if (req.method === "PUT") {
      try {
        const body = await readBody(req);
        const payload = parseJson(body, null);

        const username = String(payload?.username || "").trim();
        const password = String(payload?.password || "");
        const role = payload?.role === "admin" ? "admin" : "user";

        if (username.length < 3) {
          return sendJson(res, 400, { error: "Usuário deve ter ao menos 3 caracteres." });
        }

        const users = await readUsers();
        const idx = users.findIndex((u) => u.id === userId);
        if (idx === -1) {
          return sendJson(res, 404, { error: "Usuário não encontrado." });
        }

        const duplicate = users.some(
          (u, i) => i !== idx && u.username.toLowerCase() === username.toLowerCase(),
        );
        if (duplicate) {
          return sendJson(res, 409, { error: "Já existe outro usuário com esse nome." });
        }

        const admins = users.filter((u) => u.role === "admin");
        const target = users[idx];
        if (target.role === "admin" && role !== "admin" && admins.length === 1) {
          return sendJson(res, 400, { error: "Não é possível remover o último admin." });
        }

        target.username = username;
        target.role = role;
        if (password) {
          if (password.length < 3) {
            return sendJson(res, 400, { error: "Senha deve ter ao menos 3 caracteres." });
          }
          target.passwordHash = hashPassword(password);
        }

        users[idx] = target;
        await writeUsers(users);

        return sendJson(res, 200, sanitizeUser(target));
      } catch {
        return sendJson(res, 400, { error: "JSON inválido." });
      }
    }

    if (req.method === "DELETE") {
      const users = await readUsers();
      const idx = users.findIndex((u) => u.id === userId);
      if (idx === -1) {
        return sendJson(res, 404, { error: "Usuário não encontrado." });
      }

      const target = users[idx];
      if (target.id === auth.user.id) {
        return sendJson(res, 400, { error: "Você não pode excluir o usuário logado." });
      }

      const admins = users.filter((u) => u.role === "admin");
      if (target.role === "admin" && admins.length === 1) {
        return sendJson(res, 400, { error: "Não é possível excluir o último admin." });
      }

      users.splice(idx, 1);
      await writeUsers(users);

      for (const [token, session] of sessions.entries()) {
        if (session.userId === target.id) {
          sessions.delete(token);
        }
      }

      return sendJson(res, 200, { ok: true });
    }

    return sendMethodNotAllowed(res);
  }

  return sendNotFound(res);
}

async function handleTasks(req, res, pathname) {
  if (pathname !== "/api/tarefas") return sendNotFound(res);

  const auth = await requireAuth(req, res);
  if (!auth) return;

  if (req.method === "GET") {
    const tasks = await readTasks();
    return sendJson(res, 200, tasks);
  }

  if (req.method === "PUT") {
    try {
      const body = await readBody(req);
      const payload = parseJson(body, null);
      if (!Array.isArray(payload)) {
        return sendJson(res, 400, { error: "Payload deve ser um array." });
      }

      await writeTasks(payload);
      return sendJson(res, 200, { ok: true, total: payload.length });
    } catch {
      return sendJson(res, 400, { error: "JSON inválido." });
    }
  }

  return sendMethodNotAllowed(res);
}

async function handleApi(req, res, pathname) {
  if (pathname.startsWith("/api/auth/")) {
    return handleAuth(req, res, pathname);
  }

  if (
    pathname === "/api/users/options" ||
    pathname === "/api/users" ||
    pathname.startsWith("/api/users/")
  ) {
    return handleUsers(req, res, pathname);
  }

  if (pathname === "/api/tarefas") {
    return handleTasks(req, res, pathname);
  }

  return sendNotFound(res);
}

async function handler(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const { pathname } = requestUrl;

  if (pathname.startsWith("/api/")) {
    return handleApi(req, res, pathname);
  }

  return serveStatic(res, pathname);
}

async function start() {
  await ensureDataFiles();

  const server = http.createServer((req, res) => {
    handler(req, res).catch((error) => {
      console.error("Erro interno:", error);
      sendJson(res, 500, { error: "Erro interno do servidor." });
    });
  });

  server.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log("Usuário padrão: admin | Senha padrão: admin");
  });
}

start().catch((error) => {
  console.error("Falha ao iniciar o servidor:", error);
  process.exit(1);
});
