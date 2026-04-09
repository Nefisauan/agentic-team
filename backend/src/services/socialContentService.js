const Anthropic = require('@anthropic-ai/sdk');
const { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } = require('../config/env');
const logger = require('../config/logger');

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const BRAND_VOICE = `
You are the social media voice of Revenue Pro Systems — a done-for-you AI lead automation company
based in Utah that helps local service businesses (HVAC, roofing, plumbing, electrical,
landscaping, concrete, cleaning, auto detailing) capture more leads and book more jobs.

Brand personality:
- Professional but approachable — think "smart friend who knows business automation"
- Results-focused: always tie back to revenue, booked jobs, or time saved
- Target audience: BYU athletes and business owners, local service business owners in Utah
- Use real stats: 62% of calls go unanswered, 78% go with whoever responds first
- Never sound corporate or salesy — sound like a growth partner
- Short, punchy sentences. Data over fluff.
- Occasionally reference Utah/local business culture

Visual brand: Dark navy/cyan tech-forward aesthetic. Professional photos of service businesses at work.
`.trim();

async function callClaude(userPrompt, systemPrompt = BRAND_VOICE) {
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
 * Generate a batch of social media posts for the week.
 * Returns array of { platform, content_type, caption, hashtags, image_prompt }
 */
async function generateWeeklyContent({ postsPerWeek = 4, platforms = ['instagram', 'linkedin'], topics = [] }) {
  const topicHint = topics.length > 0
    ? `Focus on these themes this week: ${topics.join(', ')}`
    : 'Mix of: client success stories, industry pain points, automation tips, behind-the-scenes, and calls to action';

  const prompt = `
Generate ${postsPerWeek} social media posts for Revenue Pro Systems for this week.
Split between platforms: ${platforms.join(' and ')}.

${topicHint}

For each post, provide:
1. Platform (instagram or linkedin)
2. Content type (post, carousel, or article for LinkedIn)
3. Caption — engaging, on-brand, value-driven. Instagram: 150-300 chars. LinkedIn: 200-500 chars.
4. Hashtags — 5-10 relevant hashtags per post
5. Image prompt — a description of what the accompanying photo/graphic should show. Suggest professional photos of real service businesses at work when possible.

Rules:
- Each post should stand alone but build a cohesive weekly narrative
- Include 1 post with a clear CTA (book a demo, visit website)
- Include 1 educational/value post (tip, stat, or industry insight)
- Include 1 social proof / results post (even hypothetical case study style)
- LinkedIn posts should be more detailed and professional
- Instagram posts should be visual-first with punchy captions
- Never use generic motivational quotes — always tie to lead automation or service businesses
- Reference BYU athletes & businesses where natural

Return ONLY valid JSON array:
[
  {
    "platform": "instagram|linkedin",
    "content_type": "post|carousel|article",
    "caption": "...",
    "hashtags": ["tag1", "tag2", ...],
    "image_prompt": "..."
  }
]
`;

  const result = await callClaude(prompt);
  logger.debug('Generated weekly content batch', { count: result.length });
  return result;
}

/**
 * Generate a single targeted post (e.g., when engagement is high on a topic).
 */
async function generateTargetedPost({ platform, topic, targetAudience }) {
  const prompt = `
Generate a single ${platform} post for Revenue Pro Systems.

Topic: ${topic}
Target audience: ${targetAudience || 'Local service business owners in Utah'}

Return ONLY valid JSON:
{
  "platform": "${platform}",
  "content_type": "post",
  "caption": "...",
  "hashtags": ["tag1", "tag2", ...],
  "image_prompt": "..."
}
`;

  const result = await callClaude(prompt);
  logger.debug('Generated targeted post', { platform, topic });
  return result;
}

module.exports = {
  generateWeeklyContent,
  generateTargetedPost,
};
