import { getSession } from "./session";

// Live updates. One WebSocket stays open while a staff member is signed in.
// The server only says WHICH KIND of data changed (a "topic"); screens that
// show that kind of data then reload it. No records travel over the socket.

export type LiveStatus = "off" | "connecting" | "live" | "reconnecting";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4000/api";

function socketUrl(): string {
  const u = new URL(API_URL);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  u.pathname = "/ws";
  u.search = "";
  return u.toString();
}

const topicListeners = new Map<string, Set<() => void>>();
const statusListeners = new Set<(s: LiveStatus) => void>();
let socket: WebSocket | null = null;
let status: LiveStatus = "off";
let wanted = false;
let attempts = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let wasDown = false;

function setStatus(s: LiveStatus) {
  if (status === s) return;
  status = s;
  statusListeners.forEach((fn) => fn(s));
}

function emit(topic: string) {
  topicListeners.get(topic)?.forEach((fn) => fn());
}

function open() {
  const session = getSession();
  if (!wanted || !session || socket) return;
  setStatus(attempts === 0 ? "connecting" : "reconnecting");
  let ws: WebSocket;
  try {
    ws = new WebSocket(socketUrl());
  } catch {
    schedule();
    return;
  }
  socket = ws;
  ws.onopen = () => ws.send(JSON.stringify({ type: "auth", token: session.token }));
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data as string);
      if (msg.type === "ready") {
        attempts = 0;
        setStatus("live");
        // Anything changed while the connection was down: refresh every open screen.
        if (wasDown) { wasDown = false; for (const t of topicListeners.keys()) emit(t); }
      } else if (msg.type === "change" && Array.isArray(msg.topics)) {
        (msg.topics as string[]).forEach(emit);
      }
    } catch { /* ignore malformed messages */ }
  };
  ws.onclose = (e) => {
    socket = null;
    if (!wanted) return;
    wasDown = true;
    if (e.code === 4401 || e.code === 4403) { setStatus("off"); return; } // session or origin rejected: do not hammer the server
    schedule();
  };
  ws.onerror = () => { /* onclose follows */ };
}

function schedule() {
  setStatus("reconnecting");
  if (retryTimer) clearTimeout(retryTimer);
  const wait = Math.min(30_000, 1000 * 2 ** attempts++);
  retryTimer = setTimeout(open, wait);
}

export function startLive() {
  wanted = true;
  open();
}

export function stopLive() {
  wanted = false;
  attempts = 0;
  wasDown = false;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  socket?.close();
  socket = null;
  setStatus("off");
}

export function onTopic(topic: string, fn: () => void): () => void {
  let set = topicListeners.get(topic);
  if (!set) topicListeners.set(topic, (set = new Set()));
  set.add(fn);
  return () => { set!.delete(fn); };
}

export function onLiveStatus(fn: (s: LiveStatus) => void): () => void {
  statusListeners.add(fn);
  fn(status);
  return () => { statusListeners.delete(fn); };
}

// "/blood-units/BLD-2026-000001?x=1" -> "blood-units"
export function topicOfPath(path: string): string {
  return path.replace(/^\//, "").split(/[/?]/)[0];
}

// Coming back to a sleeping tab: reconnect straight away instead of waiting.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && wanted && !socket) { attempts = 0; open(); }
  });
}
