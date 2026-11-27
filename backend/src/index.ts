import { env } from "./config/env";
import app from "./app";
import { startExpirySweeper } from "./lib/expiry";
import { attachRealtime } from "./realtime";

const server = app.listen(env.port, () => {
  console.log(`kadugo-backend listening on http://localhost:${env.port}`);
  console.log(`Health check: http://localhost:${env.port}/api/health`);
  startExpirySweeper();
});
attachRealtime(server); // WebSocket endpoint /ws for live updates
