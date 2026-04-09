const Anthropic = require('@anthropic-ai/sdk');
const { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } = require('../config/env');
const logger = require('../config/logger');

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const PARTNERSHIP_CONTEXT = `
You represent Revenue Pro Systems — a done-for-you AI lead automation company based in Utah.
You are reaching out to advertising agencies, marketing agencies, digital agencies, SEO firms,
social media agencies, and web design shops to propose a PARTNERSHIP.

The partnership offer:
- Revenue Pro Systems handles the lead automation backend (AI chatbots, missed-call text-back,
  SMS/email follow-up sequences, appointment booking, CRM pipeline) for the agency's clients
- The agency can white-label or resell Revenue Pro's system under their own brand
- OR the agency refers their clients who need lead automation, and earns a recurring referral fee
- This is NOT a pitch to buy our product — it's a B2B partnership to expand their service offering

Why agencies should partner:
- Their clients (service businesses) already need lead automation — agencies just can't build it
- Adding lead automation as a service increases client retention and monthly recurring revenue
- Done-for-you: Revenue Pro handles all the tech, the agency just sells and manages relationships
- White-label option: the agency's clients never know Revenue Pro exists
- Referral option: agency earns 20-30% recurring commission on every referred client

Key stats to use:
- 62% of calls to service businesses go unanswered
- 78% of customers hire whoever responds first
- Agencies that add automation services see 40% higher client retention
- Average client LTV increases $2,400+/year with lead automation upsell

Tone: Peer-to-peer, professional, collaborative. You're talking to a fellow business owner
or agency director — not selling to them. Frame it as a mutual growth opportunity.
Never be pushy. Never sound like a vendor pitch. Sound like a strategic partner.
`.trim();

async function callClaude(userPrompt, systemPrompt = PARTNERSHIP_CONTEXT) {
  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content[0].text.trim();
  const jsonMatch = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/) || [null, text];
  return JSON.parse(jsonMatch[1]);
}

/**
 * Research and generate a list of potential agency partners.
 */
async function researchAgencies({ agencyTypes, location, count = 15 }) {
  const prompt = `
Research and generate a list of ${count} realistic advertising/marketing agencies that
Revenue Pro Systems should reach out to for a partnership.

Target agency types: ${agencyTypes.join(', ')}
Target location: ${location || 'Utah and surrounding states, plus nationwide remote agencies'}

For each agency, provide:
1. agency_name — realistic agency name
2. contact_name — owner, founder, or director name
3. contact_role — their title
4. email — realistic business email
5. phone — realistic phone number
6. website — plausible URL
7. instagram_handle — if they'd have one
8. linkedin_url — plausible LinkedIn URL
9. agency_type — specific type (ad_agency, marketing_agency, digital_agency, seo_agency, social_media_agency, web_design, branding)
10. services_offered — array of their services ["ppc", "seo", "social_media", "web_design", "branding", "email_marketing", "content_marketing"]
11. client_industries — what industries their clients are in ["home_services", "healthcare", "restaurants", "ecommerce", "real_estate", "legal", "local_services"]
12. location — city, state
13. employee_count — realistic estimate
14. notes — 2-3 sentences on why they'd be a great partner (do they serve service businesses? do they lack automation? growing agency?)
15. source — how found (linkedin_search, google_search, clutch_directory, agency_directory, instagram)
16. score — partnership fit score 0-100

Scoring guide:
- 80-100: Agency serves local service businesses, doesn't offer automation, growing, 5-50 employees
- 60-79: General marketing agency, some overlap, could benefit from adding automation
- 40-59: Large agency or different niche, possible but not ideal
- Below 40: Poor fit (enterprise only, no service business clients)

Return ONLY valid JSON array:
[
  {
    "agency_name": "...",
    "contact_name": "...",
    "contact_role": "...",
    "email": "...",
    "phone": "...",
    "website": "...",
    "instagram_handle": "...",
    "linkedin_url": "...",
    "agency_type": "...",
    "services_offered": ["..."],
    "client_industries": ["..."],
    "location": "...",
    "employee_count": "...",
    "notes": "...",
    "source": "...",
    "score": 0
  }
]
`;

  const agencies = await callClaude(prompt);
  logger.info('Agency research completed', { count: agencies.length, location });
  return agencies;
}

/**
 * Generate a personalized partnership pitch email for an agency.
 */
async function generatePartnershipEmail(agency) {
  const prompt = `
Write a partnership outreach email to ${agency.contact_name} (${agency.contact_role}) at ${agency.agency_name}.

Agency info:
- Type: ${agency.agency_type}
- Services: ${(agency.services_offered || []).join(', ')}
- Client industries: ${(agency.client_industries || []).join(', ')}
- Location: ${agency.location}
- Size: ${agency.employee_count} employees
- Notes: ${agency.notes || 'None'}

The email should:
1. Open with a genuine compliment about their agency or work (1 sentence)
2. Identify the gap: their clients (service businesses) need lead automation but the agency probably doesn't offer it (1-2 sentences)
3. Propose the partnership: Revenue Pro handles the automation backend, they sell/resell it (2-3 sentences)
4. Mention ONE compelling stat about why their clients need this
5. End with a casual CTA — "Worth a 20-min call to explore this?"
6. Under 150 words total
7. Sound like one business owner talking to another — NOT a sales email

Return ONLY valid JSON: { "subject": "...", "body": "..." }
`;

  const result = await callClaude(prompt);
  logger.debug('Generated partnership email', { agency: agency.agency_name });
  return result;
}

/**
 * Generate a personalized DM for an agency (Instagram or LinkedIn).
 */
async function generateAgencyDM({ platform, agency }) {
  const prompt = `
Write a ${platform} DM to ${agency.contact_name} at ${agency.agency_name} (${agency.agency_type}).

They offer: ${(agency.services_offered || []).join(', ')}
Their clients are in: ${(agency.client_industries || []).join(', ')}

This is a FIRST touch to explore a partnership where Revenue Pro Systems provides
done-for-you lead automation that they can white-label or refer to their clients.

${platform === 'instagram'
    ? 'Keep it to 2-3 sentences. Casual, peer-to-peer.'
    : 'Keep it to 3-4 sentences. Professional but warm.'}

Do NOT pitch. Just open a conversation about how you could help each other grow.

Return ONLY valid JSON:
{
  "message": "...",
  "followup_hint": "What to say next if they respond"
}
`;

  const result = await callClaude(prompt);
  logger.debug('Generated agency DM', { platform, agency: agency.agency_name });
  return result;
}

/**
 * Generate a follow-up email for an agency that hasn't responded.
 */
async function generateAgencyFollowUp(agency, attemptNumber) {
  const angles = [
    'Share a specific example: mention a scenario where an agency partner earned $X/month in referral commissions by recommending lead automation to 5 clients.',
    'Address the concern they might have: "I know agencies get pitched constantly — this isn\'t another SaaS tool to learn. We handle everything. Your team doesn\'t touch the tech."',
    'Final soft touch: keep the door open, mention you only partner with a few agencies per market. No pressure, just leaving the option open.',
  ];

  const angle = angles[Math.min(attemptNumber - 1, angles.length - 1)];

  const prompt = `
Write follow-up email #${attemptNumber} to ${agency.contact_name} at ${agency.agency_name}
who hasn't replied to our partnership outreach.

Angle: ${angle}

Rules:
- Under 100 words
- Don't repeat the original pitch
- Sound like a peer, not a salesperson
- End with one easy question
- This is about PARTNERSHIP, not selling them a product

Return ONLY valid JSON: { "subject": "...", "body": "..." }
`;

  const result = await callClaude(prompt);
  logger.debug('Generated agency follow-up', { agency: agency.agency_name, attempt: attemptNumber });
  return result;
}

module.exports = {
  researchAgencies,
  generatePartnershipEmail,
  generateAgencyDM,
  generateAgencyFollowUp,
};
