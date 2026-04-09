# Business Automation — Multi-Agent Outreach System v2.0

A production-ready, event-driven multi-agent system for automating B2B lead outreach across **email, Instagram, and LinkedIn** — with AI-powered content creation, prospect discovery, DM outreach, qualification, and meeting scheduling.

Built for **Revenue Pro Systems** — a done-for-you AI lead automation company serving local service businesses in Utah.

---

## Architecture Overview

```
                        ┌─────────────────────┐
                        │  Client-Finding Agent │
                        │  • Researches 10-20   │
                        │    prospects/week      │
                        │  • Scores & dedupes    │
                        └──────┬───────┬────────┘
                               │       │
                    ┌──────────┘       └──────────┐
                    ▼                              ▼
        ┌──────────────────┐          ┌──────────────────┐
        │  Outreach Agent   │          │    DM Agent       │
        │  • Personalized   │          │  • Instagram DMs  │
        │    cold emails    │          │  • LinkedIn DMs   │
        │  • SendGrid       │          │  • Personalized   │
        │  • Follow-ups 3x  │          │  • Batch sends    │
        └────────┬─────────┘          └──────────────────┘
                 │
                 ▼
        ┌──────────────────┐          ┌──────────────────┐
        │ Qualification     │          │  Content Agent    │
        │  • Score 0-100    │          │  • IG/LI posts    │
        │  • Claude AI      │          │  • 3-5 per week   │
        │  • Auto-route     │          │  • Hashtags       │
        └────────┬─────────┘          │  • Photo prompts  │
                 │                     └──────────────────┘
                 ▼
        ┌──────────────────┐
        │ Scheduling Agent  │
        │  • Calendly link  │
        │  • Google Cal     │
        │  • Booking email  │
        └──────────────────┘
```

All agents communicate via **BullMQ queues + PostgreSQL** — no direct agent-to-agent calls.

---

## What's New in v2.0

| Feature | Description |
|---------|-------------|
| **Content Agent** | Generates 3-5 Instagram/LinkedIn posts per week with captions, hashtags, and AI image prompts |
| **DM Agent** | Sends personalized DMs on Instagram and LinkedIn to prospects and leads |
| **Client-Finding Agent** | Researches and identifies 10-20 potential leads per week with scoring |
| **Prospects Pipeline** | New prospect table with approval workflow, conversion to leads, and social outreach |
| **Weekly Reports** | Cross-channel reporting: social posts, DMs, emails, qualified leads, meetings |
| **Social Dashboard** | Full frontend for managing content, prospects, and viewing reports |

---

## Project Structure

```
business-automation/
├── backend/
│   ├── src/
│   │   ├── agents/
│   │   │   ├── outreachAgent.js      Email outreach
│   │   │   ├── followupAgent.js      Follow-up emails
│   │   │   ├── qualificationAgent.js Reply scoring
│   │   │   ├── schedulingAgent.js    Meeting booking
│   │   │   ├── analyticsAgent.js     Daily analytics
│   │   │   ├── contentAgent.js       IG/LI content generation [NEW]
│   │   │   ├── dmAgent.js            Social DM outreach [NEW]
│   │   │   └── clientFindingAgent.js Prospect research [NEW]
│   │   ├── services/
│   │   │   ├── claudeService.js      Claude AI for emails
│   │   │   ├── emailService.js       SendGrid integration
│   │   │   ├── calendarService.js    Google Cal / Calendly
│   │   │   ├── smsService.js         Twilio SMS
│   │   │   ├── socialContentService.js  AI content generation [NEW]
│   │   │   ├── dmService.js          AI DM generation [NEW]
│   │   │   └── clientFindingService.js  AI prospect research [NEW]
│   │   ├── workers/
│   │   │   ├── contentWorker.js      [NEW]
│   │   │   ├── dmWorker.js           [NEW]
│   │   │   └── clientFindingWorker.js [NEW]
│   │   ├── routes/
│   │   │   ├── social.js             Posts, DMs, metrics [NEW]
│   │   │   ├── prospects.js          Prospect CRUD + research [NEW]
│   │   │   └── reports.js            Weekly reporting [NEW]
│   │   ├── db/
│   │   │   ├── schema.sql            Base tables
│   │   │   └── schema-social.sql     Social extension tables [NEW]
│   │   └── ...
│   └── package.json
└── frontend/
    ├── src/app/
    │   ├── page.tsx                   Dashboard (updated with social stats)
    │   ├── leads/page.tsx             Lead management
    │   ├── social/page.tsx            Social content & DMs [NEW]
    │   ├── prospects/page.tsx         Prospect pipeline [NEW]
    │   ├── reports/page.tsx           Weekly reports [NEW]
    │   ├── activity/page.tsx          Job activity log (updated)
    │   └── metrics/page.tsx           Analytics charts
    └── package.json
```

---

## Prerequisites

- Node.js 18+
- PostgreSQL (Supabase free tier)
- Redis (Upstash free tier)
- SendGrid account (free tier)
- Anthropic API key (Claude)

Optional:
- Instagram Business API access (for live DMs)
- LinkedIn API access (for live DMs/posts)

---

## Setup

### 1. Clone and install

```bash
cd business-automation

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 2. Configure environment

```bash
# Backend
cd backend && cp .env.example .env
# Fill in DATABASE_URL, REDIS_URL, ANTHROPIC_API_KEY, SENDGRID_API_KEY, SENDGRID_FROM_EMAIL

# Frontend
cd ../frontend && cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Create database schema

Run both SQL files in your Supabase SQL editor:

```bash
psql $DATABASE_URL -f backend/src/db/schema.sql
psql $DATABASE_URL -f backend/src/db/schema-social.sql
```

### 4. Seed with demo data

```bash
cd backend && npm run seed
```

Creates 9 leads, 4 social posts, 3 prospects, and sample DMs.

---

## Running Locally

Three terminals:

```bash
# Terminal 1 — API Server
cd backend && npm run dev          # → http://localhost:3001

# Terminal 2 — Workers (all 8 agents)
cd backend && npm run workers

# Terminal 3 — Frontend
cd frontend && npm run dev         # → http://localhost:3000
```

---

## API Reference

### Existing Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/leads` | Add lead + trigger outreach |
| `GET` | `/leads` | List leads (filter, search) |
| `GET` | `/leads/:id` | Lead detail + messages |
| `PATCH` | `/leads/:id` | Update status/notes/score |
| `DELETE` | `/leads/:id` | Remove lead |
| `POST/GET` | `/events` | Trigger/list events |
| `GET` | `/metrics` | Analytics snapshots |
| `POST` | `/metrics/refresh` | Run analytics now |
| `GET` | `/metrics/activity` | Job execution log |
| `POST` | `/webhooks/sendgrid/inbound` | Email reply webhook |
| `POST` | `/webhooks/calendly` | Booking webhook |
| `GET` | `/health` | Health check |

### New Social Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/social/posts` | List social posts (filter by platform, status) |
| `GET` | `/social/posts/:id` | Single post detail |
| `PATCH` | `/social/posts/:id` | Update post (caption, status, engagement) |
| `DELETE` | `/social/posts/:id` | Delete post |
| `POST` | `/social/generate` | Trigger content generation (weekly_batch or targeted) |
| `GET` | `/social/dms` | List DMs (filter by platform) |
| `POST` | `/social/dm` | Send a DM to a lead/prospect |
| `POST` | `/social/dm/batch` | Batch DMs to all approved prospects |
| `GET` | `/social/metrics` | Social performance metrics |

### New Prospect Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/prospects` | List prospects (filter, search) |
| `GET` | `/prospects/:id` | Prospect detail + DMs |
| `PATCH` | `/prospects/:id` | Update (approve, reject, edit) |
| `POST` | `/prospects/:id/convert` | Convert prospect to lead + trigger outreach |
| `POST` | `/prospects/:id/dm` | Send DM to prospect |
| `DELETE` | `/prospects/:id` | Delete prospect |
| `POST` | `/prospects/research` | Trigger client-finding agent |

### New Report Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/reports/weekly` | Weekly performance reports |
| `POST` | `/reports/weekly/generate` | Generate current week snapshot |
| `GET` | `/reports/dashboard` | Aggregated dashboard data |

---

## Agent Workflows

### Content Agent (NEW)
```
Weekly Cron → [contentQueue] → Content Agent
  • Claude generates 3-5 posts
  • Mix of IG + LinkedIn
  • Scheduled across Mon/Tue/Thu/Fri
  • Saved as drafts or scheduled
```

### DM Agent (NEW)
```
Prospect approved / Lead added → [dmQueue] → DM Agent
  • Looks up prospect/lead info
  • Claude generates personalized DM
  • Sends via platform API (or mocks in dev)
  • Tracks in social_dms table
```

### Client-Finding Agent (NEW)
```
Weekly Cron / Manual → [clientFindingQueue] → Client-Finding Agent
  • Claude researches prospects
  • Deduplicates against leads + prospects
  • Saves with quality score (0-100)
  • Auto-converts high-scoring prospects (optional)
  • Auto-sends DMs (optional)
```

### Full Pipeline
```
Client-Finding → Prospects → [Approve] → Convert to Lead → Outreach Email
                                       → IG/LI DM

Content Agent → Posts → Engagement → DM Agent targets engagers

Reply (Email/DM) → Qualification → Score ≥ 60 → Scheduling → Booked
```

---

## Environment Variables

See `backend/.env.example` for the full list.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection |
| `REDIS_URL` | Yes | Redis connection |
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `SENDGRID_API_KEY` | Yes | Email sending |
| `SENDGRID_FROM_EMAIL` | Yes | Sender address |
| `INSTAGRAM_ACCESS_TOKEN` | No | Instagram Business API |
| `LINKEDIN_ACCESS_TOKEN` | No | LinkedIn API |
| `CONTENT_POSTS_PER_WEEK` | No | Default: 4 |
| `CONTENT_CRON_SCHEDULE` | No | Default: Mondays 9am |
| `CLIENT_FINDING_CRON_SCHEDULE` | No | Default: Mondays 10am |

---

## What You Need To Do

1. **Run the SQL schemas** in Supabase (`schema.sql` then `schema-social.sql`)
2. **Set your `.env` variables** (API keys)
3. **`npm install`** in both backend/ and frontend/
4. **`npm run seed`** to populate demo data
5. **Start all 3 servers** and test the dashboard
6. Set up Instagram Business API and LinkedIn API when ready for live DMs
7. Configure SendGrid inbound parse for reply detection

---

## Brand & Tone

All AI-generated content follows Revenue Pro Systems brand voice:
- **Direct, results-focused** — stats over fluff
- **Blue-collar friendly** — no jargon, no corporate speak
- **Problem-first** — lead with pain points (missed calls, lost jobs)
- **Target**: Local service businesses (HVAC, roofing, plumbing, electrical, landscaping)
- **Geography**: Utah (Salt Lake City, Provo, Orem, Ogden)
- **Target audience**: BYU athletes and business owners

---

## Deployment

### Backend (Railway / Render)
- API: `npm start`
- Workers: `npm run workers` (separate service)

### Frontend (Vercel)
- Set `NEXT_PUBLIC_API_URL` to your API URL

### Infrastructure
- **Redis**: Upstash (free tier)
- **Database**: Supabase (free tier)
