import { env } from "./config/env";
import app from "./app";
import { startExpirySweeper } from "./lib/expiry";

app.listen(env.port, () => {
  console.log(`kadugo-backend listening on http://localhost:${env.port}`);
  console.log(`Health check: http://localhost:${env.port}/api/health`);
  startExpirySweeper();
});
