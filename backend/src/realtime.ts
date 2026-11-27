import type { Server as HttpServer, IncomingMessage } from "http";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { WebSocket, WebSocketServer } from "ws";
import type { Role } from "@prisma/client";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";

// Live updates. Browsers keep one WebSocket open to /ws. After any change is
// saved, the server tells every signed-in browser WHICH KIND of data changed
// ("donors", "inventory", ...) and the browser reloads it. Messages carry no
// records and no personal information, only the topic names, and each topic
// is sent only to the roles that may read that data.

type Topic =
  | "donors" | "donations" | "blood-units" | "test-records" | "inventory" | "analytics"
  | "events" | "pre-registrations" | "dashboard" | "notifications" | "users" | "audit-logs";

const ALL: Role[] = ["SUPER_ADMIN", "ADMIN", "MEDTECH"];
const OPERATIONS: Role[] = ["ADMIN", "MEDTECH"];

// Who may be told about each topic (mirrors the permissions of the API routes).
const TOPIC_ROLES: Record<Topic, Role[]> = {
  donors: OPERATIONS,
  donations: OPERATIONS,
  "blood-units": OPERATIONS,
  "test-records": OPERATIONS,
  inventory: OPERATIONS,
  analytics: OPERATIONS,
  events: ALL,
  "pre-registrations": ALL,
  dashboard: ALL,
  notifications: ALL,
  users: ["SUPER_ADMIN", "ADMIN"],
  "audit-logs": ["SUPER_ADMIN"],
};

// Which topics a change under each part of the API affects.
const AFFECTS: Array<[prefix: string, topics: Topic[]]> = [
  ["/api/donors", ["donors", "dashboard", "analytics", "notifications"]],
  ["/api/donations", ["donations", "donors", "blood-units", "test-records", "inventory", "events", "pre-registrations", "dashboard", "analytics", "notifications"]],
  ["/api/blood-units", ["blood-units", "donations", "test-records", "inventory", "dashboard", "analytics", "notifications"]],
  ["/api/pre-registrations", ["pre-registrations", "events", "donors", "dashboard", "notifications"]],
  ["/api/events", ["events", "pre-registrations", "dashboard", "notifications"]],
  ["/api/public", ["pre-registrations", "events", "dashboard", "notifications"]],
  ["/api/users", ["users", "dashboard", "notifications"]],
  ["/api/auth", ["notifications"]],
];

interface Client { socket: WebSocket; role: Role; userId: string; alive: boolean }
const clients = new Set<Client>();

export function publishChange(topics: Topic[]): void {
  const unique = [...new Set<Topic>([...topics, "audit-logs"])];
  for (const c of clients) {
    if (c.socket.readyState !== WebSocket.OPEN) continue;
    const allowed = unique.filter((t) => TOPIC_ROLES[t].includes(c.role));
    if (allowed.length) c.socket.send(JSON.stringify({ type: "change", topics: allowed }));
  }
}

// Express middleware: when a request that changes data succeeds, publish it.
// Placed once in app.ts, so no controller needs to remember to announce.
export function announceChanges(req: Request, res: Response, next: NextFunction): void {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  res.on("finish", () => {
    if (res.statusCode >= 400) return;
    const url = req.originalUrl.split("?")[0];
    const hit = AFFECTS.find(([prefix]) => url.startsWith(prefix));
    if (hit) publishChange(hit[1]);
  });
  next();
}

function originAllowed(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  return !origin || env.corsOrigins.includes(origin); // same rule as the API's CORS list
}

export function attachRealtime(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 4 * 1024 });

  wss.on("connection", (socket, req) => {
    if (!originAllowed(req)) return socket.close(4403, "Origin not allowed");

    // The browser must prove who it is within 5 seconds (token goes in the first
    // message, not in the address, so it never appears in server logs).
    let client: Client | null = null;
    const timer = setTimeout(() => { if (!client) socket.close(4401, "Authentication required"); }, 5000);

    socket.on("message", async (raw) => {
      if (client) return; // only the first message (auth) is read
      try {
        const msg = JSON.parse(raw.toString());
        if (msg?.type !== "auth" || typeof msg.token !== "string") throw new Error("bad");
        const payload = jwt.verify(msg.token, env.jwtSecret) as jwt.JwtPayload;
        if (!payload.sub || payload.purpose) throw new Error("bad"); // reveal tokens are not login tokens
        const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, status: true } });
        if (!user || user.status !== "ACTIVE") throw new Error("inactive");
        client = { socket, role: user.role, userId: user.id, alive: true };
        clients.add(client);
        clearTimeout(timer);
        socket.send(JSON.stringify({ type: "ready" }));
      } catch {
        socket.close(4401, "Authentication failed");
      }
    });
    socket.on("pong", () => { if (client) client.alive = true; });
    socket.on("close", () => { clearTimeout(timer); if (client) clients.delete(client); });
    socket.on("error", () => { clearTimeout(timer); if (client) clients.delete(client); });
  });

  // Drop connections that stopped answering (closed laptops, lost signal). The
  // ping every 30 seconds also keeps the connection open through hosting proxies.
  const heartbeat = setInterval(() => {
    for (const c of clients) {
      if (!c.alive) { c.socket.terminate(); clients.delete(c); continue; }
      c.alive = false;
      c.socket.ping();
    }
  }, 30_000);
  wss.on("close", () => clearInterval(heartbeat));
  return wss;
}
