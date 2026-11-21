import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}. Check backend/.env`);
  return value;
}

const jwtSecret = required("JWT_SECRET");
if (jwtSecret === "replace-this-with-a-long-random-string") {
  console.warn("[kaDUGO] JWT_SECRET is still the example value. Set a long random string in backend/.env before going live.");
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  // Comma-separated list of frontend addresses allowed to call this API.
  // The Vite dev server uses 5173 and moves to 5174, 5175... when a port is busy.
  corsOrigins: (process.env.CORS_ORIGIN ?? "http://localhost:5173,http://localhost:5174,http://localhost:5175")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
};
