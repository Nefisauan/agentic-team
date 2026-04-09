const { query } = require('../config/database');
const { generateDM, generateFollowUpDM, sendDM } = require('../services/dmService');
const logger = require('../config/logger');

/**
 * DM Agent — sends personalized Instagram/LinkedIn DMs.
 *
 * Modes:
 * - outreach: Send initial DM to a prospect/lead
 * - followup: Follow up on a previous DM
 * - batch: Process multiple prospects from client-finding agent
 *
 * Flow:
 * 1. Look up prospect/lead info
 * 2. Generate personalized DM via Claude
 * 3. Send DM (or mock in dev)
 * 4. Save DM record
 * 5. Create event
 */
async function runDMAgent({ mode = 'outreach', leadId, prospectId, platform, context = {} }) {
  logger.info('DM agent started', { mode, leadId, prospectId, platform });

  if (mode === 'outreach') {
    return await sendOutreachDM({ leadId, prospectId, platform, context });
  } else if (mode === 'followup') {
    return await sendFollowUpDMHandler({ leadId, prospectId, platform });
  } else if (mode === 'batch') {
    return await processBatchDMs({ platform, context });
  }

  throw new Error(`Unknown DM agent mode: ${mode}`);
}

async function sendOutreachDM({ leadId, prospectId, platform, context }) {
  let prospect;

  // Get prospect info from either leads or prospects table
  if (prospectId) {
    const result = await query('SELECT * FROM prospects WHERE id = $1', [prospectId]);
    if (result.rowCount === 0) throw new Error(`Prospect ${prospectId} not found`);
    prospect = result.rows[0];
  } else if (leadId) {
    const result = await query('SELECT * FROM leads WHERE id = $1', [leadId]);
    if (result.rowCount === 0) throw new Error(`Lead ${leadId} not found`);
    const lead = result.rows[0];
    prospect = {
      contact_name: lead.name,
      company_name: lead.company,
      industry: 'local service',
      ...lead,
    };
  } else {
    throw new Error('Either leadId or prospectId is required');
  }

  // Check for recent DM to prevent duplicates
  const recentDM = await query(
    `SELECT id FROM social_dms
     WHERE lead_id = $1 AND platform = $2 AND direction = 'outbound'
     AND created_at > NOW() - INTERVAL '24 hours'
     LIMIT 1`,
    [leadId || prospect.lead_id, platform]
  );

  if (recentDM.rowCount > 0) {
    logger.info('DM skipped — recent DM exists', { leadId, platform });
    return { skipped: true, reason: 'recent_dm_exists' };
  }

  // Generate personalized DM
  const dm = await generateDM({ platform, prospect, context });

  // Send DM
  const recipientId = platform === 'instagram'
    ? prospect.instagram_handle
    : prospect.linkedin_url;

  const sendResult = await sendDM({
    platform,
    recipientId: recipientId || prospect.email,
    message: dm.message,
  });

  // Save DM record
  await query(
    `INSERT INTO social_dms (lead_id, platform, direction, message, status, metadata, sent_at)
     VALUES ($1, $2, 'outbound', $3, $4, $5, NOW())`,
    [
      leadId || prospect.lead_id || null,
      platform,
      dm.message,
      sendResult.status,
      JSON.stringify({
        followup_hint: dm.followup_hint,
        recipient: recipientId,
        prospect_id: prospectId,
      }),
    ]
  );

  // Create event
  await query(
    `INSERT INTO events (type, lead_id, payload) VALUES ('dm_sent', $1, $2)`,
    [
      leadId || prospect.lead_id || null,
      JSON.stringify({ platform, prospect_name: prospect.contact_name || prospect.name }),
    ]
  );

  logger.info('DM agent sent outreach', {
    platform,
    recipient: prospect.contact_name || prospect.name,
  });

  return { success: true, platform, message: dm.message, sendResult };
}

async function sendFollowUpDMHandler({ leadId, prospectId, platform }) {
  // Find the last outbound DM
  const lastDM = await query(
    `SELECT * FROM social_dms
     WHERE (lead_id = $1 OR metadata->>'prospect_id' = $2)
     AND platform = $3 AND direction = 'outbound'
     ORDER BY created_at DESC LIMIT 1`,
    [leadId, prospectId, platform]
  );

  if (lastDM.rowCount === 0) {
    throw new Error('No previous DM found to follow up on');
  }

  // Check if they replied
  const reply = await query(
    `SELECT id FROM social_dms
     WHERE (lead_id = $1 OR metadata->>'prospect_id' = $2)
     AND platform = $3 AND direction = 'inbound'
     AND created_at > $4
     LIMIT 1`,
    [leadId, prospectId, platform, lastDM.rows[0].created_at]
  );

  const hasReplied = reply.rowCount > 0;

  // Get prospect/lead info
  let prospect;
  if (prospectId) {
    const result = await query('SELECT * FROM prospects WHERE id = $1', [prospectId]);
    prospect = result.rows[0];
  } else if (leadId) {
    const result = await query('SELECT * FROM leads WHERE id = $1', [leadId]);
    const lead = result.rows[0];
    prospect = { contact_name: lead.name, company_name: lead.company, ...lead };
  }

  const followUp = await generateFollowUpDM({
    platform,
    prospect,
    previousMessage: lastDM.rows[0].message,
    hasReplied,
  });

  const sendResult = await sendDM({
    platform,
    recipientId: prospect.instagram_handle || prospect.linkedin_url || prospect.email,
    message: followUp.message,
  });

  await query(
    `INSERT INTO social_dms (lead_id, platform, direction, message, status, metadata, sent_at)
     VALUES ($1, $2, 'outbound', $3, $4, $5, NOW())`,
    [
      leadId || prospect.lead_id || null,
      platform,
      followUp.message,
      sendResult.status,
      JSON.stringify({ type: 'followup', next_action: followUp.next_action, prospect_id: prospectId }),
    ]
  );

  logger.info('DM agent sent follow-up', { platform, hasReplied, nextAction: followUp.next_action });
  return { success: true, platform, followUp, sendResult };
}

async function processBatchDMs({ platform, context }) {
  // Get approved prospects that haven't been DM'd yet on this platform
  const prospects = await query(
    `SELECT p.* FROM prospects p
     WHERE p.status IN ('new', 'approved')
     AND NOT EXISTS (
       SELECT 1 FROM social_dms sd
       WHERE sd.metadata->>'prospect_id' = p.id::text
       AND sd.platform = $1
     )
     ORDER BY p.score DESC
     LIMIT 20`,
    [platform]
  );

  const results = [];
  for (const prospect of prospects.rows) {
    try {
      const result = await sendOutreachDM({
        prospectId: prospect.id,
        platform,
        context,
      });
      results.push({ prospectId: prospect.id, ...result });
    } catch (err) {
      logger.error('Batch DM failed for prospect', { prospectId: prospect.id, error: err.message });
      results.push({ prospectId: prospect.id, error: err.message });
    }
  }

  logger.info('Batch DM processing complete', { platform, processed: results.length });
  return { success: true, processed: results.length, results };
}

module.exports = { runDMAgent };
