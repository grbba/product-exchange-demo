# Product Exchange Demo – Server Quickstart

Short steps for running the Express API/webhook relay in `server/`.

1) From the project root (`product-exchange-demo`), install deps once:  
   ```bash
   npm install
   ```
2) Set env vars if you want live Amadeus lookups (optional):  
   - `AMADEUS_CLIENT_ID`  
   - `AMADEUS_CLIENT_SECRET`  
   - `AMADEUS_BASE` (optional; defaults to `https://test.api.amadeus.com`)  
   You can also override the port with `API_PORT` (defaults to `5175`).
   To load the repo’s `.env` values into your current terminal session, run:  
   ```bash
   set -a && source .env && set +a   # bash/zsh
   ```
   Verify they’re present with `env | grep AMADEUS`.
3) Start the server (TSX watch mode):  
   ```bash
   npm run dev:api
   ```
4) The service listens on `http://localhost:<API_PORT>` and exposes routes like `/api/webhooks/dispatch` and `/webhooks/:channelId` for the UI demo.

Keep this process running alongside any Vite frontends you launch.
