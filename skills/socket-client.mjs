#!/usr/bin/env node
// Paranoia: Socket.IO client CLI for end-to-end repro and QA.
// Usage: see .claude/skills/socket-client/SKILL.md
//
// Requires `socket.io-client` to be installed in the repo. The script will
// load it from any workspace's node_modules. Install at the root if missing:
//   pnpm add -D -w socket.io-client

import { parseArgs } from "node:util";
import { setTimeout as sleep } from "node:timers/promises";

let ioModule;
try {
  ioModule = await import("socket.io-client");
} catch {
  console.error(
    "socket.io-client not found. Install it once at the root:\n" +
      "  pnpm add -D -w socket.io-client",
  );
  process.exit(2);
}
const { io } = ioModule;

const { values, positionals } = parseArgs({
  options: {
    "ws-url": { type: "string" },
    nickname: { type: "string" },
    "nickname-a": { type: "string", default: "Alice" },
    "nickname-b": { type: "string", default: "Bob" },
    room: { type: "string" },
    token: { type: "string" },
    text: { type: "string", default: "hello" },
    turns: { type: "string", default: "3" },
    category: { type: "string", default: "hypothetical" },
    count: { type: "string", default: "10" },
    interval: { type: "string", default: "100" },
    json: { type: "boolean", default: false },
  },
  allowPositionals: true,
});

const wsUrl = values["ws-url"] ?? process.env.WS_URL ?? "http://localhost:3000";

if (/\b(prod|production)\b/i.test(wsUrl) || /paranoia\.krulestwo\.com/.test(wsUrl)) {
  console.error(`Refusing: WS_URL appears to point to production: ${wsUrl}`);
  process.exit(2);
}

const log = (label, payload) => {
  if (values.json) console.log(JSON.stringify({ label, payload }));
  else console.log(`[${label}]`, payload ?? "");
};

function connect({ token, nickname, label }) {
  const socket = io(wsUrl, {
    transports: ["websocket"],
    auth: token ? { sessionToken: token } : { nickname },
    reconnection: false,
    timeout: 10_000,
  });
  const tag = label ?? nickname ?? "socket";
  socket.onAny((event, ...args) => log(`<- [${tag}] ${event}`, args[0]));
  return socket;
}

async function once(socket, event, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

async function cmdCreate() {
  const a = connect({ nickname: values.nickname ?? values["nickname-a"] });
  await once(a, "connect", 5000);
  a.emit("lobby:create", {
    nickname: values.nickname ?? values["nickname-a"],
    settings: { turns: Number(values.turns), category: values.category },
  });
  const lobby = await once(a, "lobby:created");
  log("lobby:created", lobby);
  a.disconnect();
}

async function cmdJoin() {
  if (!values.room) throw new Error("--room required");
  const b = connect({ nickname: values["nickname-b"] });
  await once(b, "connect", 5000);
  b.emit("lobby:join", { roomCode: values.room, nickname: values["nickname-b"] });
  const joined = await once(b, "lobby:joined");
  log("lobby:joined", joined);
  b.disconnect();
}

async function cmdReconnect() {
  if (!values.token) throw new Error("--token required");
  const s = connect({ token: values.token });
  await once(s, "connect", 5000);
  log("reconnected");
  await sleep(500);
  s.disconnect();
}

async function cmdOutOfTurn() {
  if (!values.token) throw new Error("--token required");
  const s = connect({ token: values.token });
  await once(s, "connect", 5000);
  s.emit("game:message", { text: values.text });
  try {
    const err = await once(s, "error", 3000);
    log("error", err);
  } catch (e) {
    log("no-error", e.message);
  }
  s.disconnect();
}

async function cmdSpam() {
  if (!values.token) throw new Error("--token required");
  const s = connect({ token: values.token });
  await once(s, "connect", 5000);
  const total = Number(values.count);
  const interval = Number(values.interval);
  for (let i = 0; i < total; i++) {
    s.emit("game:message", { text: `${values.text} #${i}` });
    await sleep(interval);
  }
  await sleep(500);
  s.disconnect();
}

function queueListener(socket, event) {
  const queue = [];
  const waiters = [];
  socket.on(event, (payload) => {
    while (waiters.length) {
      const w = waiters.shift();
      if (!w.done) {
        w.done = true;
        w.resolve(payload);
        return;
      }
    }
    queue.push(payload);
  });
  const next = (timeoutMs = 10_000) => {
    const waiter = { done: false, resolve: null };
    return new Promise((resolve, reject) => {
      if (queue.length) {
        waiter.done = true;
        return resolve(queue.shift());
      }
      waiter.resolve = resolve;
      waiters.push(waiter);
      setTimeout(() => {
        if (!waiter.done) {
          waiter.done = true;
          reject(new Error(`timeout waiting for ${event}`));
        }
      }, timeoutMs);
    });
  };
  next.cancel = () => {
    for (const w of waiters) w.done = true;
    waiters.length = 0;
  };
  return next;
}

async function cmdHappyPath() {
  const turns = Number(values.turns);
  // Player A creates
  const a = connect({ nickname: values["nickname-a"], label: "A" });
  await once(a, "connect", 5000);
  const aTurn = queueListener(a, "game:your_turn");
  const aVoting = queueListener(a, "game:voting_phase");
  const aResults = queueListener(a, "game:results");
  const aStarted = queueListener(a, "game:started");
  a.emit("lobby:create", {
    nickname: values["nickname-a"],
    settings: { turns, category: values.category },
  });
  const lobbyA = await once(a, "lobby:created");
  log("A lobby:created", lobbyA);

  // Player B joins
  const b = connect({ nickname: values["nickname-b"], label: "B" });
  await once(b, "connect", 5000);
  const bTurn = queueListener(b, "game:your_turn");
  const bVoting = queueListener(b, "game:voting_phase");
  const bResults = queueListener(b, "game:results");
  const bStarted = queueListener(b, "game:started");
  b.emit("lobby:join", { roomCode: lobbyA.roomCode, nickname: values["nickname-b"] });
  const lobbyB = await once(b, "lobby:joined");
  log("B lobby:joined", lobbyB);

  const started = await Promise.all([aStarted(), bStarted()]);
  log("game:started", started[0]);

  // Drive turns
  const players = { [lobbyA.playerId]: a, [lobbyB.playerId]: b };
  for (let n = 0; n < turns * 2; n++) {
    const me = await Promise.race([aTurn(), bTurn()]);
    aTurn.cancel();
    bTurn.cancel();
    const turnSocket = me.turnNumber % 2 === 1 ? a : b;
    turnSocket.emit("game:message", { text: `turn ${me.turnNumber} thoughts` });
    log(`-> game:message (turn ${me.turnNumber})`);
    await sleep(50);
  }

  const voting = await Promise.all([aVoting(), bVoting()]);
  log("game:voting_phase", voting[0]);

  // Submit naive votes — each player only votes on opponent's messages
  for (const [pid, sock] of Object.entries(players)) {
    const targets = voting[0].messages.filter((m) => m.fromPlayerId !== pid);
    sock.emit("vote:submit", {
      votes: targets.map((m, i) => ({ messageId: m.id, guessedModified: i % 2 === 0 })),
    });
  }
  const results = await Promise.all([aResults(), bResults()]);
  log("game:results", results[0]);

  a.disconnect();
  b.disconnect();
}

const command = positionals[0] ?? "happy-path";
const handlers = {
  create: cmdCreate,
  join: cmdJoin,
  reconnect: cmdReconnect,
  "out-of-turn": cmdOutOfTurn,
  spam: cmdSpam,
  "happy-path": cmdHappyPath,
};

if (!handlers[command]) {
  console.error(`Unknown command: ${command}. Known: ${Object.keys(handlers).join(", ")}`);
  process.exit(2);
}

try {
  await handlers[command]();
  process.exit(0);
} catch (e) {
  console.error("ERROR:", e.message);
  process.exit(1);
}
