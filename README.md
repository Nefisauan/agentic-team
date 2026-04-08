# Business Automation — Multi-Agent Outreach System

A production-ready, event-driven multi-agent system for automating B2B lead outreach, follow-ups, reply detection, qualification, and meeting scheduling.

---

## Architecture Overview

```
Lead Added
    │
    ▼
[outreachQueue] ──► Outreach Agent
    │               • OpenAI generates personalized email
    │               • SendGrid sends it
    │               • Schedules follow-up (3 days)
    │
    ▼ (after delay)
[followupQueue] ──► Follow-up Agent
    │               • Checks if lead replied
    │               • If not: sends follow-up (up to 3x)
    │
    ▼ (SendGrid inbound webhook)
Reply Detected ──► [qualificationQueue] ──► Qualification Agent
    │               • OpenAI scores reply (0–100)
    │               • ≥ threshold → qualified
    │
    ▼
[schedulingQueue] ──► Scheduling Agent
                    • Sends Calendly link or Google Calendar slots
                    • Status → booked via webhook
```

All agents communicate via **BullMQ queues + PostgreSQL only** — no direct agent-to-agent calls.

---

## Project Structure

```
business-automation/
├── backend/
│   ├── src/
│   │   ├── agents/          # Business logic per agent
│   │   ├── config/          # DB, Redis, logger, env
│   │   ├── db/              # schema.sql
│   │   ├── middleware/       # Supervisor + error handler
│   │   ├── queues/          # BullMQ queue definitions + producers
│   │   ├── routes/          # Express API routes
│   │   ├── services/        # Email, OpenAI, Calendar, SMS
│   │   ├── workers/         # BullMQ worker processors
│   │   ├── app.js           # Express server
│   │   └── seed.js          # Mock data seed
│   └── package.json
└── frontend/
    ├── src/
    │   ├── app/             # Next.js app router pages
    │   │   ├── page.tsx         Dashboard
    │   │   ├── leads/page.tsx   Leads table + add/manage
    │   │   ├── activity/page.tsx Job activity log
    │   │   └── metrics/page.tsx Analytics charts
    │   ├── components/      # Sidebar, Providers
    │   └── lib/api.ts       # Type-safe API client
    └── package.json
```

---

## Prerequisites

- Node.js 18+
- PostgreSQL (via Supabase — free tier works)
- Redis (via Upstash — free tier works)
- SendGrid account (free tier — 100 emails/day)
- OpenAI API key

---

## Setup

### 1. Clone and install

```bash
cd business-automation

# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configure backend environment

```bash
cd backend
cp .env.example .env
```

Edit `.env` and fill in:
- `DATABASE_URL` — from Supabase project settings
- `REDIS_URL` — from Upstash dashboard (use the `ioredis` connection string)
- `OPENAI_API_KEY`
- `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL`

Optional (for full scheduling):
- `GOOGLE_*` variables OR `CALENDLY_LINK`
- `TWILIO_*` for SMS

### 3. Configure frontend environment

```bash
cd frontend
cp .env.example .env.local
```

Set `NEXT_PUBLIC_API_URL=http://localhost:3001`

### 4. Create database schema

Run `backend/src/db/schema.sql` in your Supabase SQL editor (or via psql):

```bash
psql $DATABASE_URL -f backend/src/db/schema.sql
```

### 5. Seed with mock data

```bash
cd backend
npm run seed
```

This creates 9 mock leads across all pipeline stages and queues outreach jobs.

---

## Running Locally

You need **three terminals**:

**Terminal 1 — API Server:**
```bash
cd backend
npm run dev
# → API running on http://localhost:3001
```

**Terminal 2 — Workers:**
```bash
cd backend
npm run workers
# → All 5 agent workers listening for jobs
```

**Terminal 3 — Frontend:**
```bash
cd frontend
npm run dev
# → Dashboard at http://localhost:3000
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/leads` | Add lead + trigger outreach |
| `GET` | `/leads` | List leads (filter by status, search) |
| `GET` | `/leads/:id` | Lead detail + messages |
| `PATCH` | `/leads/:id` | Update status/notes/score |
| `DELETE` | `/leads/:id` | Remove lead |
| `GET` | `/events` | List event history |
| `POST` | `/events` | Manually trigger any event |
| `GET` | `/metrics` | Analytics snapshots + funnel |
| `POST` | `/metrics/refresh` | Run analytics agent now |
| `GET` | `/metrics/activity` | Job execution log |
| `POST` | `/webhooks/sendgrid/inbound` | SendGrid reply webhook |
| `POST` | `/webhooks/calendly` | Calendly booking webhook |
| `GET` | `/health` | DB + Redis health check |

---

## Testing the Full Flow

Use the `/events` endpoint to simulate each stage:

```bash
# 1. Add a lead (triggers outreach automatically)
curl -X POST http://localhost:3001/leads \
  -H 'Content-Type: application/json' \
  -d '{"name": "Test User", "email": "test@example.com", "company": "ACME"}'

# 2. Manually trigger follow-up (skip the 3-day delay)
curl -X POST http://localhost:3001/events \
  -H 'Content-Type: application/json' \
  -d '{"type": "follow_up_due", "lead_id": "<LEAD_ID>"}'

# 3. Simulate a reply (triggers qualification)
curl -X POST http://localhost:3001/events \
  -H 'Content-Type: application/json' \
  -d '{"type": "lead_replied", "lead_id": "<LEAD_ID>"}'

# 4. Force scheduling (if you want to skip qualification scoring)
curl -X POST http://localhost:3001/events \
  -H 'Content-Type: application/json' \
  -d '{"type": "lead_qualified", "lead_id": "<LEAD_ID>"}'
```

From the **Leads page** in the dashboard, you can also click "Manual Triggers" buttons to run any step.

---

## SendGrid Inbound Email Setup

1. In SendGrid, go to **Settings → Inbound Parse**
2. Add your domain and set the webhook URL to:
   `https://your-api.railway.app/webhooks/sendgrid/inbound`
3. Replies sent to your from-address will be automatically parsed, matched to leads, and trigger the qualification pipeline.

---

## Deployment

### Backend (Railway / Render)

1. Push `backend/` to a Git repo
2. Set all environment variables from `.env.example`
3. Build command: `npm install`
4. Start command: `npm start`
5. Deploy a second service for workers: `npm run workers`

### Frontend (Vercel)

1. Push `frontend/` to a Git repo
2. Import into Vercel
3. Set `NEXT_PUBLIC_API_URL` to your Railway/Render API URL
4. Deploy

### Redis (Upstash)
- Create a Redis database at upstash.com
- Copy the `ioredis` compatible URL into `REDIS_URL`

### Database (Supabase)
- Create a project at supabase.com
- Run `schema.sql` in the SQL editor
- Copy the connection string into `DATABASE_URL`

---

## Environment Variables

See `backend/.env.example` for the full list. Required:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `OPENAI_API_KEY` | OpenAI API key |
| `SENDGRID_API_KEY` | SendGrid API key |
| `SENDGRID_FROM_EMAIL` | Sender email address |

---

## Agent Configuration

Tune behavior via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `QUALIFICATION_SCORE_THRESHOLD` | `60` | Min score to qualify a lead |
| `FOLLOWUP_DELAY_DAYS` | `3` | Days between follow-ups |
| `ANALYTICS_CRON_SCHEDULE` | `0 8 * * *` | When to snapshot analytics |
