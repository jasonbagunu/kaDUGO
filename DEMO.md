# kaDUGO — Defense demo script (about 10 minutes)

Start from a clean database (see CHECKLIST.md). Use two browser windows: a normal one
(staff) and a private one (the public).

## 1. Roles and login (1 min)
1. Open the system → landing/login page. Sign in as `superadmin` / `admin123`.
2. Point out: sidebar shows only Dashboard, Events, Pre-registrations, Users, Audit Logs, Settings. Dashboard shows **system figures only**.
3. Try to open `/donors` in the address bar → **Access Denied** (not just a hidden link).

## 2. Accounts (1 min)
1. Users → Add User → create an **Admin** (e.g. `rbchead`, with a password).
2. Sign out, sign in as that Admin. Users → create a **MedTech** (`medtech1`). Note the Admin can only create MedTechs.

## 3. Event and public link (2 min)
1. As Admin: Events → Create Event ("Blood Drive – USL", a future date).
2. On the event page copy the **public link** (or show the QR code).
3. In the private window open the link (not signed in). Fill the form as a donor and submit → a **reference number** appears.
4. Try `/donors` in the private window → redirected to login: the public sees nothing internal.

## 4. Attendance → donor → donation (2 min)
1. Back as Admin: event → Pre-Registrations tab → the new sign-up is listed.
2. Update Status → **Arrived**. Click **Register Donor** (blood type asked if unknown).
3. Click **Record Donation** → form is pre-filled (donor, event) → choose the donation type → Save.
4. Message shows the **blood unit ID created automatically**, status Pending Testing.

## 5. Testing and traceability (2 min)
1. Sign in as MedTech → Testing → Record Result on the new unit, all Non-Reactive → unit becomes **Usable**.
2. Record a second donation, mark one test **Reactive** → unit goes to **Quarantined / For Confirmation**; Confirm Result with a reactive result → **Not Usable**.
3. Open a unit → **Traceability** timeline: collection → testing → processing → storage → status, plus the full activity history. Link back to donor, donation and event.

## 6. Inventory, analytics, reports (1 min)
1. Inventory: usable units per blood type, low-stock and expiring-soon flags.
2. Analytics: change the date range → charts update. Click **Generate Report**, **Export PDF**, **Export Excel**.
3. Top bar: quick search (donor / unit / donation / event) and the notification bell (quarantined units, units expiring, events starting soon).

## 7. Accountability (1 min)
1. Sign in as `superadmin` → **Audit Logs**: every login, user change and record action, with who and when (no patient data in the log).
2. Settings → data backup export.

## Likely questions
- *Why can't the Super Admin see donors?* They are the system maintainers, not medical staff; patient data is outside their role.
- *Can a unit be marked usable without testing?* No — the server rejects it.
- *What if a user is deactivated while logged in?* Their next request is refused and they are signed out.
- *How are passwords stored?* bcrypt hashes; the API never returns them.
