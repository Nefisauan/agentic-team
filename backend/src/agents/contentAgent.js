const { query } = require('../config/database');
const { generateWeeklyContent, generateTargetedPost } = require('../services/socialContentService');
const logger = require('../config/logger');

/**
 * Content Agent — generates Instagram/LinkedIn posts.
 *
 * Modes:
 * - weekly_batch: Generate 3-5 posts for the upcoming week
 * - targeted: Generate a single post for a specific topic/platform
 *
 * Flow:
 * 1. Generate content via Claude
 * 2. Save posts to social_posts table as 'draft' or 'scheduled'
 * 3. Create event records
 */
async function runContentAgent({ mode = 'weekly_batch', options = {} }) {
  logger.info('Content agent started', { mode, options });

  if (mode === 'weekly_batch') {
    return await generateWeeklyBatch(options);
  } else if (mode === 'targeted') {
    return await generateTargetedContent(options);
  }

  throw new Error(`Unknown content agent mode: ${mode}`);
}

async function generateWeeklyBatch(options) {
  const {
    postsPerWeek = 4,
    platforms = ['instagram', 'linkedin'],
    topics = [],
  } = options;

  // Generate content via Claude
  const posts = await generateWeeklyContent({ postsPerWeek, platforms, topics });

  const savedPosts = [];
  const now = new Date();

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];

    // Schedule posts across the week (Mon, Tue, Thu, Fri at 10am UTC)
    const scheduleDays = [1, 2, 4, 5]; // Mon, Tue, Thu, Fri
    const dayOffset = scheduleDays[i % scheduleDays.length];
    const scheduledFor = new Date(now);
    scheduledFor.setDate(scheduledFor.getDate() + ((dayOffset - scheduledFor.getDay() + 7) % 7 || 7));
    scheduledFor.setHours(10, 0, 0, 0);

    const result = await query(
      `INSERT INTO social_posts (platform, content_type, caption, hashtags, image_prompt, status, scheduled_for)
       VALUES ($1, $2, $3, $4, $5, 'scheduled', $6)
       RETURNING *`,
      [
        post.platform,
        post.content_type || 'post',
        post.caption,
        post.hashtags || [],
        post.image_prompt || null,
        scheduledFor,
      ]
    );

    savedPosts.push(result.rows[0]);
  }

  // Create event
  await query(
    `INSERT INTO events (type, payload) VALUES ('content_generated', $1)`,
    [JSON.stringify({ count: savedPosts.length, platforms, mode: 'weekly_batch' })]
  );

  logger.info('Content agent completed weekly batch', { postsGenerated: savedPosts.length });
  return { success: true, postsGenerated: savedPosts.length, posts: savedPosts };
}

async function generateTargetedContent(options) {
  const { platform, topic, targetAudience } = options;

  if (!platform || !topic) {
    throw new Error('Targeted content requires platform and topic');
  }

  const post = await generateTargetedPost({ platform, topic, targetAudience });

  const result = await query(
    `INSERT INTO social_posts (platform, content_type, caption, hashtags, image_prompt, status)
     VALUES ($1, $2, $3, $4, $5, 'draft')
     RETURNING *`,
    [
      post.platform,
      post.content_type || 'post',
      post.caption,
      post.hashtags || [],
      post.image_prompt || null,
    ]
  );

  await query(
    `INSERT INTO events (type, payload) VALUES ('content_generated', $1)`,
    [JSON.stringify({ platform, topic, mode: 'targeted' })]
  );

  logger.info('Content agent generated targeted post', { platform, topic });
  return { success: true, post: result.rows[0] };
}

module.exports = { runContentAgent };
