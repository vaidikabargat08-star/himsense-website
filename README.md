# HimSense full-stack starter

Includes your existing frontend plus a beginner-friendly Express backend for email/password signup and login, profile updates, saved trips, booking requests, and an admin overview.

## 1. Requirements
- Node.js 22 LTS recommended (Node.js 20+ supported)
- VS Code

## 2. Install
1. Extract the ZIP.
2. Open the extracted `himsense_full_backend` folder in VS Code (the folder containing `server.js` and `package.json`).
3. Terminal → New Terminal.
4. Run `npm.cmd install` on Windows PowerShell.

## 3. Configure
1. Copy `.env.example` to a new file named `.env` in the same folder.
2. Change `SESSION_SECRET` to a long random secret (at least 32 characters).
3. Set `ADMIN_EMAIL` to the email you will use for the admin account.
4. Save the file. Never upload `.env` or share its secrets.

## 4. Run
Run `npm.cmd start` in the terminal and keep it open. Visit http://localhost:3000. Health check: http://localhost:3000/api/health.

## 5. Test
- Create an account with the email in `ADMIN_EMAIL` to test admin access.
- Sign out and sign in again.
- Save a trip and create a booking request. A booking request is NOT a confirmed reservation.
- User and trip data are stored in `data/himsense-data.json`.

## Important limitations
- This is a local/demo starter, not production-ready hosting. The JSON file and Express's default in-memory session store are for local testing only; they are not suitable for multiple server instances or reliable public deployment.
- For public deployment, replace JSON storage with a managed database (for example PostgreSQL/Supabase), use a persistent session store, enable HTTPS, configure secrets in the host, and test authentication/security before real users rely on it.
- Google sign-in is not configured in this starter; the frontend button shows an explanatory message. Real Google OAuth requires OAuth credentials and a configured strategy/callback.
- The frontend's other visual features may still be static mockups; this backend does not create live AI, map, hotel inventory, payments, emergency services, or real-time data integrations.
