import express, { Request, Response } from "express";
import cors from "cors";
import fetch, { RequestInit } from "node-fetch";
import { randomUUID } from "node:crypto";

type AmadeusTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

type StoredToken = {
  token: string;
  expiresAt: number;
};

type AmadeusLocation = {
  iataCode?: string;
};

const {
  AMADEUS_CLIENT_ID,
  AMADEUS_CLIENT_SECRET,
  AMADEUS_BASE = "https://test.api.amadeus.com",
} = process.env;

if (!AMADEUS_CLIENT_ID || !AMADEUS_CLIENT_SECRET) {
  console.warn(
    "Amadeus proxy: AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET must be set in the environment."
  );
}

let cachedToken: StoredToken | null = null;

const tokenEndpoint = `${AMADEUS_BASE}/v1/security/oauth2/token`;
const locationEndpoint = `${AMADEUS_BASE}/v1/reference-data/locations`;

const TOKEN_REFRESH_THRESHOLD_MS = 60_000;

const getAccessToken = async (): Promise<string> => {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + TOKEN_REFRESH_THRESHOLD_MS) {
    console.log("[amadeus] Reusing cached token");
    return cachedToken.token;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: AMADEUS_CLIENT_ID ?? "",
    client_secret: AMADEUS_CLIENT_SECRET ?? "",
  });

  const request: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  };

  console.log("[amadeus] Fetching new access token…");
  const response = await fetch(tokenEndpoint, request);
  if (!response.ok) {
    const errorPayload = await response.text();
    throw new Error(`Failed to obtain token: ${response.status} ${errorPayload}`);
  }

  const tokenResponse = (await response.json()) as AmadeusTokenResponse;
  const expiresAt = now + tokenResponse.expires_in * 1000;
  cachedToken = { token: tokenResponse.access_token, expiresAt };

  return tokenResponse.access_token;
};

const buildSearchUrl = (keyword: string, limit: number) =>
  `${locationEndpoint}?subType=AIRPORT,CITY&keyword=${encodeURIComponent(keyword)}&page[limit]=${limit}`;

const callAmadeusLocations = async (url: string) => {
  const token = await getAccessToken();
  console.log("[amadeus] Request:", url);
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorPayload = await response.text();
    console.error("[amadeus] API error response:", response.status, errorPayload);
    throw new Error(`Amadeus API error: ${response.status} ${errorPayload}`);
  }

  console.log("[amadeus] Response OK:", response.status);
  return response.json();
};

type StoredWebhookEvent = {
  id: string;
  channelId: string;
  receivedAt: string;
  payload: unknown;
  headers: Record<string, string>;
};

type DispatchRequestBody = {
  destinationUrl?: string;
  payload?: unknown;
  headers?: Record<string, unknown>;
  authToken?: string;
  sourceInstanceId?: string;
};

const webhookInbox = new Map<string, StoredWebhookEvent[]>();
const MAX_EVENTS_PER_CHANNEL = 25;

const normalizeHeaders = (input?: Record<string, unknown>) => {
  if (!input || typeof input !== "object") return {};
  const entries = Object.entries(input)
    .filter(([key, value]) => typeof key === "string" && typeof value === "string")
    .map(([key, value]) => [key.toLowerCase(), value] as const);
  return Object.fromEntries(entries);
};

const storeEvent = (channelId: string, event: StoredWebhookEvent) => {
  const existing = webhookInbox.get(channelId) ?? [];
  existing.unshift(event);
  webhookInbox.set(channelId, existing.slice(0, MAX_EVENTS_PER_CHANNEL));
  console.log(`[webhooks] Stored event ${event.id} for channel ${channelId}. Count=${existing.length + 1}`);
};

const deleteEvent = (channelId: string, eventId: string) => {
  const existing = webhookInbox.get(channelId);
  if (!existing) return false;
  const next = existing.filter((event) => event.id !== eventId);
  if (next.length === existing.length) return false;
  webhookInbox.set(channelId, next);
  return true;
};

export const createServer = () => {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  // Lightweight request logger to help trace issues.
  app.use((req, res, next) => {
    console.log(`[http] ${req.method} ${req.url}`);
    next();
  });

  // Flag error responses so we notice failures quickly.
  app.use((req, res, next) => {
    res.on("finish", () => {
      if (res.statusCode >= 400) {
        console.warn(`[http] ${req.method} ${req.url} -> ${res.statusCode}`);
      }
    });
    next();
  });

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      time: new Date().toISOString(),
      apiPort: process.env.API_PORT ?? 5175,
      amadeusBase: AMADEUS_BASE,
      amadeusClientId: AMADEUS_CLIENT_ID ? "set" : "missing",
    });
  });

  app.get("/api/airports/search", async (req: Request, res: Response) => {
    const keyword = String(req.query.q ?? "").trim();
    const limit = Math.min(Number(req.query.limit ?? 10) || 10, 50);

    if (!keyword) {
      res.status(400).json({ error: "Missing query parameter 'q'." });
      return;
    }

    try {
      console.log(`[airports/search] q="${keyword}" limit=${limit}`);
      const url = buildSearchUrl(keyword, limit);
      const data = await callAmadeusLocations(url);
      res.json(data);
    } catch (error) {
      console.error("Amadeus search error", error);
      res.status(502).json({ error: "Failed to fetch data from Amadeus." });
    }
  });

  app.get("/api/airports/validate", async (req: Request, res: Response) => {
    const code = String(req.query.code ?? "").trim().toUpperCase();
    if (!code) {
      res.status(400).json({ error: "Missing query parameter 'code'." });
      return;
    }

    try {
      console.log(`[airports/validate] code="${code}"`);
      const url = `${locationEndpoint}?subType=AIRPORT&keyword=${encodeURIComponent(code)}&page[limit]=20`;
      const data = await callAmadeusLocations(url);
      const match =
        data?.data?.find((item: AmadeusLocation) => item.iataCode?.toUpperCase() === code) ?? null;
      res.json({ valid: Boolean(match), match });
    } catch (error) {
      console.error("Amadeus validate error", error);
      res.status(502).json({ error: "Failed to validate airport code with Amadeus." });
    }
  });

  app.post("/api/webhooks/dispatch", async (req: Request, res: Response) => {
    const body = req.body as DispatchRequestBody;
    if (!body || typeof body.destinationUrl !== "string" || !body.destinationUrl.trim()) {
      res.status(400).json({ error: "destinationUrl is required" });
      return;
    }

    const destinationUrl = body.destinationUrl.trim();
    const finalHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "apmwg-exchange-demo/1.0",
      ...(body.sourceInstanceId ? { "X-Apmwg-Source": body.sourceInstanceId } : {}),
      ...normalizeHeaders(body.headers),
    };

    if (body.authToken && !finalHeaders.authorization && !finalHeaders.Authorization) {
      finalHeaders.Authorization = `Bearer ${body.authToken}`;
    }

    try {
      console.log(`[webhooks/dispatch] -> ${destinationUrl}`);
      const response = await fetch(destinationUrl, {
        method: "POST",
        headers: finalHeaders,
        body: JSON.stringify(body.payload ?? {}),
      });
      const text = await response.text();
      res.json({
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        body: text.slice(0, 8_192),
      });
    } catch (error) {
      console.error("Webhook dispatch failed", error);
      res.status(502).json({ error: error instanceof Error ? error.message : "Dispatch error" });
    }
  });

  const inboundHandler = (req: Request, res: Response) => {
    const channelId = String(req.params.channelId ?? "").trim();
    if (!channelId) {
      res.status(400).json({ error: "Missing channelId" });
      return;
    }
    const event: StoredWebhookEvent = {
      id: randomUUID(),
      channelId,
      receivedAt: new Date().toISOString(),
      payload: req.body,
      headers: Object.fromEntries(
        Object.entries(req.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(", ") : String(value)])
      ),
    };
    storeEvent(channelId, event);
    console.log(`[webhooks/inbound] Accepted event ${event.id} on channel ${channelId}`);
    res.status(202).json({ status: "accepted", eventId: event.id });
  };

  app.post("/webhooks/:channelId", inboundHandler);
  app.post("/api/webhooks/inbound/:channelId", inboundHandler);

  app.get("/api/webhooks/:channelId", (req: Request, res: Response) => {
    const channelId = String(req.params.channelId ?? "").trim();
    if (!channelId) {
      res.status(400).json({ error: "Missing channelId" });
      return;
    }
    console.log(`[webhooks/list] channel=${channelId}`);
    res.json({ events: webhookInbox.get(channelId) ?? [] });
  });

  app.delete("/api/webhooks/:channelId", (req: Request, res: Response) => {
    const channelId = String(req.params.channelId ?? "").trim();
    if (!channelId) {
      res.status(400).json({ error: "Missing channelId" });
      return;
    }
    webhookInbox.delete(channelId);
    console.log(`[webhooks/clear] channel=${channelId}`);
    res.status(204).end();
  });

  app.delete("/api/webhooks/:channelId/:eventId", (req: Request, res: Response) => {
    const channelId = String(req.params.channelId ?? "").trim();
    const eventId = String(req.params.eventId ?? "").trim();
    if (!channelId || !eventId) {
      res.status(400).json({ error: "Missing identifiers" });
      return;
    }
    const removed = deleteEvent(channelId, eventId);
    if (!removed) {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    console.log(`[webhooks/delete] channel=${channelId} event=${eventId}`);
    res.status(204).end();
  });

  return app;
};

export const startServer = (port: number | string) => {
  const app = createServer();
  const serverPort = typeof port === "string" ? Number(port) : port;

  const server = app.listen(serverPort, () => {
    console.log(`Amadeus proxy listening on port ${serverPort}`);
    console.log(
      `[startup] AMADEUS_BASE=${AMADEUS_BASE} | AMADEUS_CLIENT_ID=${AMADEUS_CLIENT_ID ? "set" : "missing"} | API_PORT=${serverPort}`
    );
  });

  server.on("connection", (socket) => {
    const addr = `${socket.remoteAddress ?? "unknown"}:${socket.remotePort ?? "?"}`;
    console.log(`[connection] ${addr}`);
  });

  server.on("clientError", (err, socket) => {
    console.error("[clientError]", err);
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
  });

  server.on("request", (req) => {
    console.log(`[request] ${req.method} ${req.url}`);
  });

  server.setTimeout(15000, (socket) => {
    console.warn("[timeout] closing slow socket");
    socket.destroy();
  });

  return server;
};
