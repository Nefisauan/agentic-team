const Anthropic = require('@anthropic-ai/sdk');
const { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } = require('../config/env');
const logger = require('../config/logger');

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ── Business identity injected into every prompt ──────────────────────────────
const BRAND_CONTEXT = `
You are writing on behalf of Revenue Pro Systems — a done-for-you lead automation company
based in Utah that serves local service businesses (HVAC, roofing, plumbing, electrical,
landscaping, concrete, cleaning, auto detailing, etc.).

Revenue Pro Systems sells AI-powered automation systems that:
- Capture and respond to every lead within 60 seconds (24/7, including nights/weekends)
- Send automated SMS + email follow-up sequences (5x more touchpoints than manual)
- Handle missed-call text-back, appointment booking, CRM pipeline, and review automation
- Replace what a part-time hire would do ($2,400/month) for $97–$397/month
- Are completely done-for-you — owner doesn't touch a single piece of tech

Key stats to use: 62% of calls go unanswered, 78% of customers go with whoever responds first,
businesses see 30–50% more jobs booked after implementation.

Tone: Direct, problem-focused, short sentences, data-driven, conversational but confident.
Never sound like a software vendor — sound like a growth partner who understands their industry.
Never use tech jargon. Speak to busy business owners who are skeptical of software.
`.trim();

/**
 * Helper — call Claude and parse a JSON response.
 */
async function callClaude(userPrompt, systemPrompt = BRAND_CONTEXT) {
  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content[0].text.trim();

  // Strip markdown code fences if Claude wraps the JSON
  const jsonMatch = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/) || [null, text];
  return JSON.parse(jsonMatch[1]);
}

// ── Detect the industry from company name / notes for personalization ─────────
function inferIndustry(lead) {
  const text = `${lead.company || ''} ${lead.notes || ''}`.toLowerCase();
  if (/hvac|heat|cool|air|furnace/.test(text)) return 'HVAC';
  if (/roof/.test(text)) return 'roofing';
  if (/plumb|pipe/.test(text)) return 'plumbing';
  if (/electr/.test(text)) return 'electrical';
  if (/lawn|landscape|landscap/.test(text)) return 'landscaping';
  if (/concrete|cement/.test(text)) return 'concrete';
  if (/clean/.test(text)) return 'cleaning';
  if (/detail/.test(text)) return 'auto detailing';
  return 'local service';
}

// ── Agents ────────────────────────────────────────────────────────────────────

/**
 * Generate a personalized cold outreach email for a local service business lead.
 * Returns { subject, body }
 */
async function generateOutreachEmail(lead) {
  const industry = inferIndustry(lead);
  const prompt = `
Write a short, punchy cold outreach email to ${lead.name}${lead.company ? ` who runs ${lead.company}` : ''},
a ${industry} business owner.

Use their industry pain points. For ${industry}, the #1 pain is usually:
- Missed calls that go to competitors
- Slow or no follow-up with online leads
- Spending hours manually texting/calling back leads

The email should:
1. Open with 1 sentence about a specific pain point they face in ${industry}
2. Briefly introduce Revenue Pro Systems as the solution (1–2 sentences, mention 60-second response)
3. Drop ONE compelling stat (e.g. "78% of customers go with whoever responds first")
4. End with a soft CTA — ask if they're open to a quick 20-min demo call (no pitch, no pressure)
5. Be under 120 words total
6. Sound human, NOT like a marketing email blast

Return ONLY valid JSON: { "subject": "...", "body": "..." }
`;

  const result = await callClaude(prompt);
  logger.debug('Generated outreach email', { leadId: lead.id, industry });
  return result;
}

/**
 * Generate a follow-up email. Gets more specific and adds urgency.
 * Returns { subject, body }
 */
async function generateFollowUpEmail(lead, previousMessageCount) {
  const industry = inferIndustry(lead);
  const followUpNumber = previousMessageCount + 1;

  const angles = [
    `Share a quick result: mention a ${industry} client who booked 3–4 extra jobs per week after setting up the system. Keep it real and brief.`,
    `Address skepticism: acknowledge they're probably busy or skeptical about "another software tool." Emphasize this is done-for-you — they don't touch anything.`,
    `Final nudge: keep the door open, mention you work with a limited number of ${industry} businesses per area and spots fill up. Soft urgency, not pushy.`,
  ];

  const angle = angles[Math.min(followUpNumber - 1, angles.length - 1)];

  const prompt = `
Write follow-up email #${followUpNumber} to ${lead.name}${lead.company ? ` at ${lead.company}` : ''}
(a ${industry} business) who hasn't replied to the first outreach from Revenue Pro Systems.

Angle for this follow-up: ${angle}

Rules:
- Under 90 words
- Don't be pushy or repeat exactly what was said before
- End with one simple question or soft CTA (e.g. "Worth a 20-min call?")
- Sound like a real person following up, not automated

Return ONLY valid JSON: { "subject": "...", "body": "..." }
`;

  const result = await callClaude(prompt);
  logger.debug('Generated follow-up email', { leadId: lead.id, followUpNumber, industry });
  return result;
}

/**
 * Qualify a reply from a local service business owner.
 * Returns { score, reasoning, intent }
 */
async function qualifyReply(replyText, leadName) {
  const prompt = `
You are reviewing a reply from ${leadName}, a local service business owner who received an outreach
email from Revenue Pro Systems about our lead automation system.

Reply: """
${replyText}
"""

Score their buying intent 0–100 based on Revenue Pro Systems' ICP:
- High value (70–100): Interested in automation, mentions missing calls/leads, asks about pricing/demo,
  running a real service business, open to learning more
- Medium (40–69): Lukewarm, curious but not urgent, says "maybe later" or asks basic questions
- Low (0–39): Not interested, already has a solution, wrong industry, rude/spam reply

Return ONLY valid JSON:
{
  "score": <integer 0-100>,
  "intent": "<not_interested|cold|lukewarm|interested|very_interested>",
  "reasoning": "<1-2 sentences explaining the score>"
}
`;

  const result = await callClaude(prompt);
  logger.debug('Qualified reply', { leadName, score: result.score, intent: result.intent });
  return result;
}

/**
 * Generate a scheduling email to book the free 20-min demo call.
 * Returns { subject, body }
 */
async function generateSchedulingEmail(lead, bookingLink) {
  const industry = inferIndustry(lead);
  const prompt = `
Write a short, warm email to ${lead.name}${lead.company ? ` at ${lead.company}` : ''}
(a ${industry} business owner) to book their free 20-minute demo call with Revenue Pro Systems.

The booking link or time info: ${bookingLink}

Rules:
- Thank them briefly for their interest (1 sentence)
- Reinforce what they'll see in the demo (quick peek at the automation system, no commitment)
- Make booking feel easy and low-pressure
- Under 80 words
- Mention "no pitch, no pressure" — just a demo

Return ONLY valid JSON: { "subject": "...", "body": "..." }
`;

  const result = await callClaude(prompt);
  logger.debug('Generated scheduling email', { leadId: lead.id, industry });
  return result;
}

module.exports = {
  generateOutreachEmail,
  generateFollowUpEmail,
  qualifyReply,
  generateSchedulingEmail,
};
