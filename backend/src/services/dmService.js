const Anthropic = require('@anthropic-ai/sdk');
const { ANTHROPIC_API_KEY, ANTHROPIC_MODEL, NODE_ENV } = require('../config/env');
const logger = require('../config/logger');

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const DM_CONTEXT = `
You write Instagram and LinkedIn DMs on behalf of Revenue Pro Systems — a done-for-you
AI lead automation company in Utah helping local service businesses capture more leads.

DM rules:
- NEVER sound like spam or a cold pitch bot
- Keep DMs short: Instagram 2-4 sentences, LinkedIn 3-5 sentences
- Always personalize: reference the recipient's company, recent work, or mutual connections
- Open with genuine interest or compliment about their business
- Soft introduce what Revenue Pro does only if natural
- End with a question, not a pitch
- Use casual but professional tone — like texting a new business contact
- For LinkedIn: can be slightly more formal, mention professional context
- For Instagram: keep it conversational, reference their content if possible
`.trim();

async function callClaude(userPrompt, systemPrompt = DM_CONTEXT) {
  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content[0].text.trim();
  const jsonMatch = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/) || [null, text];
  return JSON.parse(jsonMatch[1]);
}

/**
 * Generate a personalized DM for a prospect/lead.
 * Returns { message, followup_hint }
 */
async function generateDM({ platform, prospect, context = {} }) {
  const companyInfo = prospect.company_name || prospect.company || 'their business';
  const contactName = prospect.contact_name || prospect.name || 'there';
  const industry = prospect.industry || 'local service';
  const achievements = context.achievements || '';
  const mutualConnections = context.mutual_connections || '';
  const recentActivity = context.recent_activity || '';

  const prompt = `
Write a personalized ${platform} DM to ${contactName} who runs ${companyInfo} (${industry} business).

${achievements ? `Their achievements/notable info: ${achievements}` : ''}
${mutualConnections ? `Mutual connections: ${mutualConnections}` : ''}
${recentActivity ? `Their recent social activity: ${recentActivity}` : ''}

This is a FIRST touch — we want to start a conversation, not sell.
${platform === 'instagram'
    ? 'Keep it to 2-3 sentences max. Casual, friendly.'
    : 'Keep it to 3-5 sentences. Professional but warm.'}

Return ONLY valid JSON:
{
  "message": "...",
  "followup_hint": "A note about what to follow up with if they respond"
}
`;

  const result = await callClaude(prompt);
  logger.debug('Generated DM', { platform, contact: contactName, company: companyInfo });
  return result;
}

/**
 * Generate a follow-up DM after engagement or no response.
 */
async function generateFollowUpDM({ platform, prospect, previousMessage, hasReplied }) {
  const contactName = prospect.contact_name || prospect.name || 'there';
  const companyInfo = prospect.company_name || prospect.company || 'their business';

  const scenario = hasReplied
    ? 'They responded positively. Continue the conversation and gently introduce Revenue Pro Systems.'
    : 'They haven\'t responded yet. Send a brief, non-pushy follow-up.';

  const prompt = `
Write a ${platform} follow-up DM to ${contactName} at ${companyInfo}.

Previous message we sent: "${previousMessage}"

Scenario: ${scenario}

Rules:
- If no reply: acknowledge they're busy, add value (share a stat or tip), ask one easy question
- If they replied: be conversational, share how Revenue Pro helps businesses like theirs, suggest a call only if the vibe is right
- Max 3 sentences for Instagram, 4 for LinkedIn

Return ONLY valid JSON:
{
  "message": "...",
  "next_action": "wait|schedule_call|send_info|close"
}
`;

  const result = await callClaude(prompt);
  logger.debug('Generated follow-up DM', { platform, contact: contactName });
  return result;
}

/**
 * Simulate sending a DM (actual API integration would go here).
 * In production, this would use Instagram Graph API or LinkedIn API.
 */
async function sendDM({ platform, recipientId, message }) {
  if (NODE_ENV === 'development') {
    logger.info(`[DEV] ${platform.toUpperCase()} DM (mocked)`, { recipientId, message: message.substring(0, 80) });
    return { messageId: `mock-dm-${Date.now()}`, status: 'sent' };
  }

  // TODO: Integrate with actual platform APIs
  // Instagram: Graph API - POST /{ig-user-id}/messages
  // LinkedIn: Messaging API - POST /messages
  logger.warn(`${platform} DM sending not yet integrated — message logged only`, { recipientId });
  return { messageId: `pending-${Date.now()}`, status: 'pending' };
}

module.exports = {
  generateDM,
  generateFollowUpDM,
  sendDM,
};
