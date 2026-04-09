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

// ── Sample social media posts ───────────────────────────────────────────────
const samplePosts = [
  {
    platform: 'instagram',
    content_type: 'post',
    caption: "62% of calls to service businesses go unanswered. That's not a marketing problem — it's a revenue leak.\n\nOur AI system picks up in 60 seconds. Every time. Even at 2am on a Saturday.\n\nStop losing $5K+ jobs to your competitor's voicemail.",
    hashtags: ['LeadAutomation', 'ServiceBusiness', 'HVAC', 'RoofingBusiness', 'UtahBusiness', 'AI', 'SmallBusiness'],
    image_prompt: 'Professional photo of an HVAC technician checking their phone with a satisfied expression, work van in background',
    status: 'published',
    engagement: { likes: 47, comments: 8, shares: 3, reach: 1250 },
  },
  {
    platform: 'instagram',
    content_type: 'carousel',
    caption: "3 leads walked into a plumber's inbox last Tuesday.\n\nLead 1: Got a text back in 45 seconds. Booked.\nLead 2: Got a follow-up email in 2 minutes. Booked.\nLead 3: Got an AI chat response instantly. Booked.\n\nAll 3 happened while the owner was under a sink.\n\nThat's automation working for you.",
    hashtags: ['Plumbing', 'LeadGen', 'BusinessAutomation', 'RevenueProSystems', 'UtahContractor'],
    image_prompt: 'Split carousel: 1) Phone showing text message 2) Email inbox 3) Chat widget 4) Happy plumber giving thumbs up',
    status: 'scheduled',
    engagement: {},
  },
  {
    platform: 'linkedin',
    content_type: 'post',
    caption: "I spent the last 6 months studying why local service businesses lose 30-50% of their potential revenue.\n\nThe answer isn't marketing. It's response time.\n\n78% of customers hire whoever responds first. Not the cheapest. Not the most experienced. The FASTEST.\n\nAt Revenue Pro Systems, we built a done-for-you system that responds to every lead in under 60 seconds — texts, emails, and chat. No apps to learn. No dashboards to check.\n\nOne HVAC contractor in Utah County went from missing half his leads to booking 3-4 extra jobs per week.\n\nIf you're running a service business and still manually following up with leads, you're leaving money on the table.\n\n#LeadAutomation #ServiceBusiness #B2B #SalesAutomation",
    hashtags: ['LeadAutomation', 'ServiceBusiness', 'B2B', 'SalesAutomation', 'GrowthPartner'],
    image_prompt: 'Professional headshot or branded graphic with stat: 78% go with whoever responds first',
    status: 'published',
    engagement: { likes: 23, comments: 5, shares: 2, impressions: 3400 },
  },
  {
    platform: 'linkedin',
    content_type: 'article',
    caption: "Why the best roofing companies in Utah are ditching call centers for AI.\n\nA $15/hour receptionist can handle 1 call at a time. Our system handles unlimited. 24/7.\n\nThe ROI isn't even close.\n\nFull breakdown in comments.",
    hashtags: ['Roofing', 'AI', 'BusinessGrowth', 'Utah', 'Automation'],
    image_prompt: 'Branded infographic comparing receptionist cost vs. automation cost with ROI numbers',
    status: 'draft',
    engagement: {},
  },
];

// ── Sample prospects (from client-finding agent) ────────────────────────────
const sampleProspects = [
  {
    company_name: 'Summit HVAC Solutions',
    contact_name: 'Derek Larsen',
    contact_role: 'Owner',
    email: 'derek@summithvac.com',
    phone: '+1-801-555-0201',
    website: 'https://summithvac.com',
    instagram_handle: '@summithvacutah',
    linkedin_url: 'https://linkedin.com/in/dereklarsen-hvac',
    industry: 'HVAC',
    location: 'Orem, UT',
    employee_count: '5-15',
    notes: 'Growing HVAC company, 4.8 stars on Google with 200+ reviews. Website has no live chat or instant response. High volume of missed call complaints in reviews.',
    source: 'google_maps',
    score: 88,
    status: 'approved',
  },
  {
    company_name: 'Wasatch Roofing Co',
    contact_name: 'Trevor Kim',
    contact_role: 'Operations Manager',
    email: 'trevor@wasatchroofing.net',
    phone: '+1-385-555-0202',
    website: 'https://wasatchroofing.net',
    instagram_handle: '@wasatchroofingco',
    linkedin_url: 'https://linkedin.com/in/trevorkim-roofing',
    industry: 'roofing',
    location: 'Sandy, UT',
    employee_count: '15-30',
    notes: 'Large roofing operation, runs Facebook ads but no automated follow-up. Competitors are outpacing on response time.',
    source: 'linkedin_search',
    score: 75,
    status: 'new',
  },
  {
    company_name: "Jensen's Lawn Care",
    contact_name: 'Matt Jensen',
    contact_role: 'Owner',
    email: 'matt@jensenslawncare.com',
    phone: '+1-801-555-0203',
    website: 'https://jensenslawncare.com',
    instagram_handle: '@jensenslawncare',
    linkedin_url: '',
    industry: 'landscaping',
    location: 'Provo, UT',
    employee_count: '1-5',
    notes: 'Solo operator expanding to 3-person crew. Mentioned on Facebook group that he loses jobs because he can\'t answer calls while mowing.',
    source: 'facebook_group',
    score: 92,
    status: 'new',
  },
];

async function seed() {
  logger.info('Starting Revenue Pro Systems seed (with social media)...');

  // Clear existing data (including new tables)
  await query('TRUNCATE TABLE weekly_reports, social_dms, social_posts, prospects, job_logs, analytics_snapshots, events, messages, leads CASCADE');
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

  // ── Social media posts ────────────────────────────────────────────────────
  for (const post of samplePosts) {
    const scheduledFor = post.status === 'scheduled'
      ? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 days from now
      : null;
    const publishedAt = post.status === 'published'
      ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) // random in last week
      : null;

    await query(
      `INSERT INTO social_posts (platform, content_type, caption, hashtags, image_prompt, status, engagement, scheduled_for, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        post.platform,
        post.content_type,
        post.caption,
        post.hashtags,
        post.image_prompt,
        post.status,
        JSON.stringify(post.engagement),
        scheduledFor,
        publishedAt,
      ]
    );
    logger.info('Social post seeded', { platform: post.platform, status: post.status });
  }

  // ── Prospects ──────────────────────────────────────────────────────────────
  for (const prospect of sampleProspects) {
    await query(
      `INSERT INTO prospects (company_name, contact_name, contact_role, email, phone, website,
        instagram_handle, linkedin_url, industry, location, employee_count, notes, source, score, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        prospect.company_name, prospect.contact_name, prospect.contact_role,
        prospect.email, prospect.phone, prospect.website,
        prospect.instagram_handle, prospect.linkedin_url,
        prospect.industry, prospect.location, prospect.employee_count,
        prospect.notes, prospect.source, prospect.score, prospect.status,
      ]
    );
    logger.info('Prospect seeded', { name: prospect.contact_name, company: prospect.company_name });
  }

  // ── Sample DMs ──────────────────────────────────────────────────────────────
  await query(
    `INSERT INTO social_dms (platform, direction, message, status, metadata, sent_at)
     VALUES ('instagram', 'outbound', $1, 'delivered', $2, NOW() - INTERVAL '2 days')`,
    [
      "Hey Derek! Saw Summit HVAC is crushing it with those Google reviews. Quick question — are you capturing all the leads coming in from those searches? We help HVAC companies make sure no call goes unanswered. Curious if that's something you've thought about.",
      JSON.stringify({ recipient: '@summithvacutah' }),
    ]
  );

  // ── Snapshot analytics ──────────────────────────────────────────────────────
  const { runAnalyticsAgent } = require('./agents/analyticsAgent');
  await runAnalyticsAgent();

  logger.info('\n✓ Seed complete!');
  logger.info(`  New leads (will trigger outreach): ${newLeads.length}`);
  logger.info(`  Pipeline leads (for dashboard demo): ${stagedLeads.length}`);
  logger.info(`  Social posts: ${samplePosts.length}`);
  logger.info(`  Prospects: ${sampleProspects.length}`);
  logger.info('\n  Next steps:');
  logger.info('  1. Run `npm run dev` in one terminal (API)');
  logger.info('  2. Run `npm run workers` in another terminal (agents)');
  logger.info('  3. Watch outreach emails get generated by Claude for each new lead');
  logger.info('  4. Visit /social and /prospects pages to see social media content');
  process.exit(0);
}

seed().catch((err) => {
  logger.error('Seed failed', { error: err.message, stack: err.stack });
  process.exit(1);
});
