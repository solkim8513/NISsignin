# NIS Sign-In App

Digital visitor sign-in system for NIS reception.

## What it does
- Public mobile-friendly sign-in form (iPad kiosk + QR scan on personal phones)
- Captures: full name, company, email, phone, purpose of visit
- Internal kiosk page to view daily sign-ins
- Admin can clear a selected day to keep a clean daily sheet
- Email alert on each sign-in (default recipient: `rebecca.bunch@nw-its.com`)

## Quick start
1. `docker compose up --build`
2. App: `http://localhost:5173`
3. API health: `http://localhost:3001/health`
4. Admin login: `admin@smefinder.local` / `admin123`

## Main URLs
- Public sign-in page: `http://localhost:5173/visitor-signin`
- Internal kiosk page: `http://localhost:5173/visitor-kiosk`

## Tech stack
- Frontend: React + Vite + Tailwind (`/client`)
- Backend: Node.js + Express (`/server`)
- Database: PostgreSQL 15 (`/db`)
- Containerized with Docker Compose

## Email alert setup (required for real sending)
Set these in `server/.env` or Docker environment:
- `NOTIFY_FROM_EMAIL` (default `smefinder@nw-its.com`)
- `VISITOR_ALERT_TO` (default `rebecca.bunch@nw-its.com`)
- `SMTP_HOST`
- `SMTP_PORT` (usually `587`)
- `SMTP_SECURE` (`true` for SMTPS, usually `false` on 587)
- `SMTP_USER`
- `SMTP_PASS`

If SMTP is not configured, sign-in still succeeds and email is skipped safely.
