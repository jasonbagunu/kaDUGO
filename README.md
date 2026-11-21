# kaDUGO

Digital Blood Record Management, Traceability and Inventory Analytics System for the
Cagayan Valley Regional Blood Center (CVRBC).

```
kadugo/
├── frontend/   React 19 + Vite + Tailwind CSS + Recharts
└── backend/    Node + Express + Prisma + PostgreSQL (JWT login)
```

## What it does

Public sign-up link  →  pre-registration  →  attendance  →  donor record  →  donation
→  blood unit (created automatically)  →  screening tests  →  usability status
→  inventory  →  traceability, analytics and reports.

### Roles (only three; the public is not a user)

| Role | Can do |
|---|---|
| **Super Admin** | Dashboard (system figures only), Events, Pre-registrations, Users (creates Admins and MedTechs), Audit Logs, Settings and data backup export. **No** access to donors, donations, testing, blood units, inventory or analytics. |
| **Admin** (RBC Head) | Everything operational (events, pre-registrations, donors, donations, blood units, testing, traceability, inventory, analytics and reports) plus creating **MedTech** accounts. |
| **MedTech** | Day-to-day operations: events, pre-registrations, donors, donations, blood units, testing, traceability, inventory, analytics. No Users, Audit Logs or Settings. |
| **Public** | Not an account. Can only open an event's registration link `/register/<token>`. |

Roles are enforced on the server (every API route) and again in the frontend routes.

### Business rules built into the system

- Only a **Completed** donation creates a blood unit (status *Pending Testing*). Its expiry is set from the component: Whole Blood 35 days, Packed RBC 42, Fresh Frozen Plasma 365, Platelet Concentrate 5.
- All **5 screening tests** must be recorded together. The system, not the user, decides the result: all non-reactive → *Usable*; any reactive → *Quarantined / For Confirmation*; confirmatory negative → *Usable*; confirmatory positive → *Not Usable*.
- A unit can never be made Usable by hand. *Not Usable* and *Expired* are final. Units expire automatically after their expiration date.
- Donors with donation records cannot be deleted (traceability). Units cannot be created or deleted by hand.
- The audit log never stores donor names, test details or passwords.

## First-time setup

Requirements: Node 20+, PostgreSQL 14+.

```bash
npm install                      # from the kadugo/ root

cd backend
cp .env.example .env             # then edit it (see below)
npx prisma migrate dev --name init
npx prisma db seed               # creates the Super Admin account
```

`backend/.env`:

```
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/kadugo"
JWT_SECRET="<a long random string>"
PORT=4000
CORS_ORIGIN="http://localhost:5173,http://localhost:5174,http://localhost:5175"
```

Generate a secret with: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

Run (two terminals, from the root):

```bash
npm run dev:backend     # http://localhost:4000/api/health
npm run dev:frontend    # http://localhost:5173
```

Built-in account: `superadmin` / `admin123` (change the password under Settings after first login).
Create Admin accounts from **Users**; Admins then create MedTechs.

## Useful commands

| Task | Command (in `backend/`) |
|---|---|
| Browse the data | `npx prisma studio` |
| Wipe everything and start clean (**deletes all data**) | `npx prisma migrate reset` |
| Production build | `npm run build` (backend) and `npm run build` (frontend) |

## Project layout

- `backend/src/controllers` – one file per area (events, donors, donations, blood units, …)
- `backend/src/lib` – shared rules (screening, shelf life, IDs, labels, analytics)
- `backend/prisma/schema.prisma` – 11 tables
- `frontend/src/pages` – one file per screen
- `frontend/src/lib/api.ts` – the single function used to call the backend
