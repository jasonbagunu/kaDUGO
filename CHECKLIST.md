# kaDUGO — Clean start & pre-demo checklist

## A. Start from empty data (before the defense)
- [ ] Stop both servers.
- [ ] `cd backend && npx prisma migrate reset` → type `y`. This **deletes all rows** and re-creates the Super Admin (`superadmin` / `admin123`).
- [ ] In pgAdmin: every table is empty except `users` (1 row) and `counters` (1 row, `user`).
- [ ] Start backend, then frontend. Open `http://localhost:5173`.

## B. Security
- [ ] `backend/.env` → `JWT_SECRET` is a long random string (not the example text).
- [ ] `.env` is **not** committed or sent to anyone (it contains your DB password).
- [ ] Change the Super Admin password in Settings (or tell the panel it is a demo password).

## C. Smoke test (3 minutes)
- [ ] `http://localhost:4000/api/health` shows `{"status":"ok"}`.
- [ ] Login works; wrong password shows an error.
- [ ] Super Admin cannot open `/donors`, `/donations`, `/blood-units`, `/testing`, `/inventory`, `/analytics`.
- [ ] Admin can create a MedTech; MedTech cannot open `/users`.
- [ ] Public link works in a private window and cannot reach internal pages.
- [ ] Full flow: event → sign-up → arrived → donor → donation → unit → test → Usable → inventory shows it.
- [ ] Analytics date range changes the charts; PDF and Excel download.

## D. Day-of
- [ ] Laptop plugged in; PostgreSQL service running; both terminals open.
- [ ] Browser zoom 100%; a normal and a private window ready.
- [ ] Printed or open copy of DEMO.md.
- [ ] Backup: take a Settings → export before the demo so you have a copy of the data.

## E. Known limits (say these honestly if asked)
- Restore from backup, release/transfer of units to hospitals, and profile photo upload are not built yet.
- Password reset by email is not built; Super Admin resets passwords from Users.
