# NIS Sign-In App

Digital visitor sign-in system for NIS reception.

## What it does
- Public mobile-friendly sign-in form (iPad kiosk + QR scan on personal phones)
- Captures: date (auto-today), full name, company, appointment with, clearance level, US citizen, ID type, time in/out, badge number
- Internal kiosk page to view daily sign-ins
- Admin can clear a selected day to keep a clean daily sheet
- Email alert on each sign-in (default recipient: `rebecca.bunch@nw-its.com`)
- Proposal/Admin can email daily visitor PDF report to Rebecca from the kiosk page

## Quick start
1. `docker compose up --build`
2. App: `http://localhost:5173`
3. API health: `http://localhost:3001/health`
4. Admin login: `admin@nis.local` / `admin123`

## Main URLs
- Public sign-in page: `http://localhost:5173/visitor-signin`
- Internal kiosk page: `http://localhost:5173/visitor-kiosk`

## Share with colleagues on local network
- Do not share `localhost` links. `localhost` always points to each person's own device.
- Share `http://<your-computer-ip>:5173/visitor-signin` instead.
- Example on this machine: `http://30.30.30.57:5173/visitor-signin`
- Your colleague must be on the same network/VPN and Windows Firewall must allow inbound access to port `5173`.

## Tech stack
- Frontend: React + Vite + Tailwind (`/client`)
- Backend: Node.js + Express (`/server`)
- Database: PostgreSQL 15 (`/db`)
- Containerized with Docker Compose

## Email alert setup (required for real sending)
Create `server/.env` (based on `server/.env.example`) and set:
- `NOTIFY_FROM_EMAIL` (default `nissignin@nw-its.com`)
- `VISITOR_ALERT_TO` (default `rebecca.bunch@nw-its.com`)
- `SMTP_HOST`
- `SMTP_PORT` (usually `587`)
- `SMTP_SECURE` (`true` for SMTPS, usually `false` on 587)
- `SMTP_USER`
- `SMTP_PASS`

If SMTP is not configured, sign-in still succeeds and email is skipped safely with reason `SMTP is not configured`.

## Daily auto report schedule
- `DAILY_REPORT_ENABLED` (`true` or `false`)
- `DAILY_REPORT_TIME` (`HH:MM`, 24-hour, default `17:00`)
- `REPORT_TIMEZONE` (default `America/New_York`)
- `DAILY_REPORT_CHECK_INTERVAL_MS` (default `60000`)

When enabled, server sends one automatic daily PDF report to `VISITOR_ALERT_TO` after the scheduled time and logs it to `daily_report_runs`.
