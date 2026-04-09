const Anthropic = require('@anthropic-ai/sdk');
const { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } = require('../config/env');
const logger = require('../config/logger');

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

/**
 * Use Claude to research and generate a list of potential leads.
 * In production, you'd supplement this with actual web scraping / API calls
 * (Google Maps API, LinkedIn Sales Navigator, etc.)
 *
 * Returns array of prospect objects.
 */
async function researchProspects({ industries, location, count = 15 }) {
  const prompt = `
You are a B2B lead researcher for Revenue Pro Systems, a done-for-you AI lead automation company
in Utah that helps local service businesses.

Research and generate a list of ${count} realistic potential prospects that Revenue Pro Systems
should reach out to.

Target industries: ${industries.join(', ')}
Target location: ${location || 'Utah (Salt Lake City, Provo, Orem, Ogden, St. George)'}

For each prospect, provide:
1. company_name — realistic business name
2. contact_name — owner/manager name
3. contact_role — their title (Owner, Operations Manager, etc.)
4. email — realistic business email (name@company.com format)
5. phone — Utah area code (801, 385, 435)
6. website — plausible website URL
7. instagram_handle — if they'd likely have one (most small businesses do)
8. linkedin_url — plausible LinkedIn profile URL
9. industry — specific industry
10. location — city, state
11. employee_count — realistic estimate ("1-5", "5-15", "15-30")
12. notes — 1-2 sentences about why they're a good prospect (pain points, missing tech, growth signals)
13. source — how this lead would be found (google_maps, yelp_scrape, linkedin_search, referral, facebook_group)
14. score — quality score 0-100 based on fit with Revenue Pro's ICP

Scoring guide:
- 80-100: Owner-operated service business, no CRM/automation, growing, 2-15 employees
- 60-79: Service business, some tech but gaps, could benefit from automation
- 40-59: Might be interested but not ideal ICP (too large, different industry, etc.)
- Below 40: Poor fit

Return ONLY valid JSON array:
[
  {
    "company_name": "...",
    "contact_name": "...",
    "contact_role": "...",
    "email": "...",
    "phone": "...",
    "website": "...",
    "instagram_handle": "...",
    "linkedin_url": "...",
    "industry": "...",
    "location": "...",
    "employee_count": "...",
    "notes": "...",
    "source": "...",
    "score": 0
  }
]
`;

  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text.trim();
  const jsonMatch = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/) || [null, text];
  const prospects = JSON.parse(jsonMatch[1]);

  logger.info('Client-finding research completed', { count: prospects.length, location });
  return prospects;
}

/**
 * Enrich a prospect with additional context for DM/email personalization.
 */
async function enrichProspect(prospect) {
  const prompt = `
Given this business prospect, generate personalization context for outreach:

Company: ${prospect.company_name}
Contact: ${prospect.contact_name} (${prospect.contact_role})
Industry: ${prospect.industry}
Location: ${prospect.location}
Notes: ${prospect.notes || 'None'}

Generate:
1. achievements — 1-2 plausible achievements or recent activities to reference
2. pain_points — 2-3 specific pain points they likely face related to lead capture/follow-up
3. conversation_starters — 2-3 natural conversation openers for DMs
4. email_angle — the best angle for a cold email to this person

Return ONLY valid JSON:
{
  "achievements": "...",
  "pain_points": ["...", "..."],
  "conversation_starters": ["...", "..."],
  "email_angle": "..."
}
`;

  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text.trim();
  const jsonMatch = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/) || [null, text];
  return JSON.parse(jsonMatch[1]);
}

module.exports = {
  researchProspects,
  enrichProspect,
};
