import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import authRoutes from "./routes/auth.routes";
import usersRoutes from "./routes/users.routes";
import auditLogsRoutes from "./routes/auditLogs.routes";
import eventsRoutes from "./routes/events.routes";
import preRegistrationsRoutes from "./routes/preRegistrations.routes";
import donorsRoutes from "./routes/donors.routes";
import donationsRoutes from "./routes/donations.routes";
import bloodUnitsRoutes from "./routes/bloodUnits.routes";
import testRecordsRoutes from "./routes/testRecords.routes";
import inventoryRoutes from "./routes/inventory.routes";
import analyticsRoutes from "./routes/analytics.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import backupRoutes from "./routes/backup.routes";
import publicRoutes from "./routes/public.routes";
import { errorHandler, notFound } from "./middleware/errorHandler";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "kadugo-backend" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/audit-logs", auditLogsRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/pre-registrations", preRegistrationsRoutes);
app.use("/api/donors", donorsRoutes);
app.use("/api/donations", donationsRoutes);
app.use("/api/blood-units", bloodUnitsRoutes);
app.use("/api/test-records", testRecordsRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/backup", backupRoutes);
// No login required: the public registration link used by potential donors.
app.use("/api/public", publicRoutes);

// Anything not matched above, then every error ends up here.
app.use("/api", notFound);
app.use(errorHandler);

export default app;
