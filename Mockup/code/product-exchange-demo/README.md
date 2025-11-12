# Product Information Exchange Demo

> React + TypeScript + Vite workspace illustrating schema, taxonomy, product, and rule management plus webhook-based exchange flows.

This guide explains how to spin up **two demo instances** (supplier + retailer) on the same machine or LAN, exchange payloads via the built-in webhook relay, and observe inbound events.

---

## 1. Prerequisites

- Node.js 20+
- npm 10+
- Two free terminal windows (one per instance) plus an optional third for the API/server process.

Install dependencies once:

```bash
npm install
```

---

## 2. Start the shared API / webhook relay

The Express service in `server/` handles Amadeus lookups and acts as a lightweight webhook dispatcher/inbox. Run it in a dedicated terminal:

```bash
npm run dev:api
```

It exposes:

- `POST /api/webhooks/dispatch` – proxy used by the UI to push payloads to partner endpoints.
- `POST /webhooks/:channelId` – inbound endpoint partners can call directly (channel ID = instance ID).
- `GET/DELETE /api/webhooks/:channelId` – fetch/clear the in-memory inbox for an instance.

Leave this process running for all demo instances.

---

## 3. Launch two UI instances

In two separate terminals run Vite, pointing each instance at a unique port:

```bash
# Instance A (supplier)
npm run dev -- --port 5173

# Instance B (retailer)
npm run dev -- --port 5174
```

Visit `http://localhost:5173` and `http://localhost:5174` in Chrome (or any modern browser).

---

## 4. Configure instance identity & channel

For each UI:

1. Open the **Settings** tab.
2. Give each instance a distinct `Display name` and keep the auto-generated `Instance identifier` (e.g., `apmwg-node-abc123` for supplier, `apmwg-node-def456` for retailer).
3. Under **Outbound channel** set:
   - `Protocol`: leave as `webhook`.
   - `Destination URL`: for supplier, target retailer’s inbound endpoint via the shared relay:
     ```
     http://localhost:5175/webhooks/<retailerInstanceId>
     ```
     Replace `<retailerInstanceId>` with the ID shown at the top of the retailer settings page.
   - Optional `Auth token` if you want to simulate protected endpoints.
4. Save settings.

Mirror the setup on the retailer side if you want bi-directional updates (pointing to the supplier’s instance ID).

---

## 5. Send payloads via the Exchange tab

On the supplier instance:

1. Go to **Exchange**.
2. Select or create a product under **Specified Products** if none exist; the “Supplier Payload” panel will show the JSON snapshot.
3. In **Webhook Outbound**:
   - Ensure the destination URL matches what you set in Settings (editable field available for quick overrides).
   - Use **Send product update**, **Send schema catalog**, or **Send taxonomy**. The UI calls `/api/webhooks/dispatch`, relaying the payload to the retailer’s endpoint.
   - Monitor the “Recent deliveries” stack for status, HTTP codes, and response snippets.

---

## 6. Observe inbound events

On the retailer instance:

1. In **Exchange → Inbound Webhooks**, copy the “Direct API” or “Through this app” URL if you want to share it externally.
2. Click **Refresh inbox** to see payloads captured by the relay. Events are stored in memory (up to 25 per channel) and include headers + body.
3. Use **Clear** to wipe the inbox when needed.

You can also simulate manual ingestion via the “Retailer View (Simulated)” card by pasting any supplier JSON payload; this bypasses webhooks and runs the concept-mapping demo logic locally.

---

## 7. Optional LAN / second machine setup

- Run the API server (`npm run dev:api`) on a reachable machine.
- Replace `http://localhost:5175` with `http://<host-ip>:5175` in each instance’s Destination URL (and in the “Direct API” link if partners need to POST remotely).
- Ensure firewalls allow incoming connections on the API port (default 5175).

---

## 8. Production-ish tips

- Switch from `npm run dev` to `npm run build && npm run preview` for optimized builds.
- Add HTTPS termination (e.g., via a reverse proxy) before sharing endpoints outside your LAN.
- Persist webhook inboxes or forward events to a database/broker if you need durability beyond the in-memory demo.

Happy exchanging! Let the team know if you need MQTT/websocket extensions or VPS deployment instructions. 
