/**
 * Seed script — Revenue Pro Systems mock leads.
 * Simulates a realistic prospect list of local service business owners.
 * Run with: npm run seed
 */
require('./config/env').validateEnv();

const { query } = require('./config/database');
const { addOutreachJob } = require('./queues/index');
const logger = require('./config/logger');
const { v4: uuidv4 } = require('uuid');

// ── Realistic prospect list for Revenue Pro Systems ───────────────────────────
const newLeads = [
  {
    name: 'Mike Torres',
    email: 'mike@torresroofing.com',
    company: 'Torres Roofing LLC',
    phone: '+1-801-555-0101',
    notes: 'Local roofing company in Salt Lake City. 3 crews. Found via Google Maps scrape.',
  },
  {
    name: 'Dave Christensen',
    email: 'dave@christensenhvac.com',
    company: 'Christensen HVAC & Cooling',
    phone: '+1-801-555-0102',
    notes: 'HVAC contractor, Utah County. Active on Facebook. Website has no live chat.',
  },
  {
    name: 'Jason Webb',
    email: 'jason@webbplumbing.net',
    company: 'Webb Plumbing Services',
    phone: '+1-385-555-0103',
    notes: 'Plumber, Provo area. Lots of Google reviews but mentions slow response times.',
  },
  {
    name: 'Carlos Mendez',
    email: 'carlos@mendezlawn.com',
    company: 'Mendez Lawn & Landscaping',
    phone: '+1-801-555-0104',
    notes: 'Landscaping business, 5 employees. Seasonally overwhelmed with calls.',
  },
  {
    name: 'Tyler Benson',
    email: 'tyler@bensonelectric.com',
    company: 'Benson Electrical Services',
    phone: '+1-801-555-0105',
    notes: 'Electrician, solo operator growing to team. No CRM currently.',
  },
];

// ── Leads already in the pipeline (for dashboard demo) ───────────────────────
const stagedLeads = [
  {
    name: 'Ryan Olsen',
    email: 'ryan@olsenconcrete.com',
    company: 'Olsen Concrete & Flatwork',
    status: 'contacted',
    score: null,
    outreachSubject: 'Quick question about your missed calls',
    outreachBody:
      "Hey Ryan,\n\nMost concrete contractors miss 60%+ of calls during busy season — and those jobs go straight to a competitor.\n\nRevenue Pro Systems sets up a done-for-you system that responds to every lead in 60 seconds, 24/7 — no extra staff needed.\n\nWe helped an HVAC contractor in Utah book 3–4 extra jobs/week with it.\n\nWould a quick 20-min demo call make sense? No pitch, no pressure.\n\n— Revenue Pro Systems",
  },
  {
    name: 'Amanda Hill',
    email: 'amanda@hillcleaningco.com',
    company: 'Hill Cleaning Co',
    status: 'replied',
    score: 72,
    outreachSubject: "Cleaning businesses are leaving money on the table",
    outreachBody:
      "Hi Amanda,\n\n78% of customers hire whoever responds first. For cleaning businesses, that window is often under an hour.\n\nRevenue Pro Systems automates your follow-up so no lead slips through — texts, emails, booking. All done for you.\n\nOpen to a 20-min call to see if it's a fit?\n\n— Revenue Pro",
    replyContent:
      "Hi! This is interesting. We do lose leads sometimes when we're out on jobs. How much does it cost and how does it work exactly?",
  },
  {
    name: 'Brandon Cox',
    email: 'brandon@coxautodetail.com',
    company: "Cox's Auto Detailing",
    status: 'qualified',
    score: 84,
    outreachSubject: 'Auto detailers are losing jobs to faster competitors',
    outreachBody:
      "Hey Brandon,\n\nAuto detail shops live and die by speed of response. If you're not texting leads back in under 5 minutes, you're losing them.\n\nRevenue Pro Systems builds you a system that responds in 60 seconds, books appointments, and follows up automatically — you don't manage any of it.\n\nWorth a 20-min demo?\n\n— Revenue Pro",
    replyContent:
      "Yes! I've been wanting something like this for a while. My biggest problem is I'm under the hood all day and miss DMs and calls constantly. When can we chat?",
  },
  {
    name: 'Scott Garner',
    email: 'scott@garnerroofing.com',
    company: 'Garner Roofing & Repair',
    status: 'booked',
    score: 91,
    outreachSubject: 'Roofers: every missed call is a $5k job walking away',
    outreachBody:
      "Hey Scott,\n\nA roofing estimate is worth $5,000–$15,000. Every missed call or slow follow-up is real money to a competitor.\n\nRevenue Pro Systems sets up a fully automated system — missed call text-back, instant email follow-up, AI chatbot — done for you in under a week.\n\n20-min demo to see how it works for roofing companies?\n\n— Revenue Pro",
    replyContent:
      "Definitely interested. We lose a ton of jobs just because we're on roofs all day and can't answer calls. This sounds exactly like what we need. Let's talk.",
  },
];

async function seed() {
  logger.info('Starting Revenue Pro Systems seed...');

  // Clear existing data
  await query('TRUNCATE TABLE job_logs, analytics_snapshots, events, messages, leads CASCADE');
  logger.info('Tables cleared');

  // ── New leads → queue outreach ──────────────────────────────────────────────
  for (const lead of newLeads) {
    const id = uuidv4();
    await query(
      `INSERT INTO leads (id, name, email, phone, company, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'new')`,
      [id, lead.name, lead.email, lead.phone, lead.company, lead.notes]
    );
    await query(
      `INSERT INTO events (type, lead_id, payload) VALUES ('new_lead', $1, $2)`,
      [id, JSON.stringify({ source: 'seed' })]
    );
    await addOutreachJob(id);
    logger.info('New lead queued for outreach', { name: lead.name, company: lead.company });
  }

  // ── Pipeline leads (already worked) ────────────────────────────────────────
  for (const lead of stagedLeads) {
    const id = uuidv4();
    const now = new Date();
    const contactedAt = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);

    await query(
      `INSERT INTO leads (id, name, email, company, status, score, last_contacted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, lead.name, lead.email, lead.company, lead.status, lead.score || null, contactedAt]
    );

    // Save outreach message
    await query(
      `INSERT INTO messages (lead_id, type, direction, subject, content, sent_at)
       VALUES ($1, 'outreach', 'outbound', $2, $3, $4)`,
      [id, lead.outreachSubject, lead.outreachBody, contactedAt]
    );

    // Save reply if lead has replied
    if (lead.replyContent) {
      const repliedAt = new Date(contactedAt.getTime() + 28 * 60 * 60 * 1000); // ~28hrs later
      await query(
        `INSERT INTO messages (lead_id, type, direction, subject, content, sent_at)
         VALUES ($1, 'reply', 'inbound', $2, $3, $4)`,
        [id, `Re: ${lead.outreachSubject}`, lead.replyContent, repliedAt]
      );
    }

    logger.info('Pipeline lead seeded', { name: lead.name, status: lead.status });
  }

  // ── Snapshot analytics ──────────────────────────────────────────────────────
  const { runAnalyticsAgent } = require('./agents/analyticsAgent');
  await runAnalyticsAgent();

  logger.info('\n✓ Seed complete!');
  logger.info(`  New leads (will trigger outreach): ${newLeads.length}`);
  logger.info(`  Pipeline leads (for dashboard demo): ${stagedLeads.length}`);
  logger.info('\n  Next steps:');
  logger.info('  1. Run `npm run dev` in one terminal (API)');
  logger.info('  2. Run `npm run workers` in another terminal (agents)');
  logger.info('  3. Watch outreach emails get generated by Claude for each new lead');
  process.exit(0);
}

seed().catch((err) => {
  logger.error('Seed failed', { error: err.message, stack: err.stack });
  process.exit(1);
});
