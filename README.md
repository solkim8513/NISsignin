# SME Finder

## Quick start

1. `docker compose up --build`
2. Client: `http://localhost:5173`
3. API: `http://localhost:3001`
4. Seed login: `admin@smefinder.local` / `admin123`

## Stack
- React + Vite + Tailwind (`/client`)
- Node + Express + pg (`/server`)
- PostgreSQL 15 (`/db`)
- JWT auth with roles: viewer, proposal_manager, admin

## Included features
- SME CRUD + search/filter (skillset, clearance, availability, text search)
- SME request flow with tokenized accept/decline response
- CSV bulk SME import for admins
- Admin dashboard metrics and top-rated SME list
- Reassign suggestions based on topic/skill overlap
- API route tests with Jest + supertest
