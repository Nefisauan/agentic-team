const { query } = require('../config/database');
const {
  researchAgencies,
  generatePartnershipEmail,
  generateAgencyDM,
  generateAgencyFollowUp,
} = require('../services/agencyPartnerService');
const { sendEmail } = require('../services/emailService');
const { sendDM } = require('../services/dmService');
const logger = require('../config/logger');

/**
 * Agency Partnership Agent — finds, pitches, and follows up with agencies.
 *
 * Modes:
 * - research: Find new agencies to partner with
 * - pitch_email: Send partnership pitch email
 * - pitch_dm: Send partnership DM (Instagram/LinkedIn)
 * - followup: Follow up on unanswered pitches
 * - batch_pitch: Research + pitch all in one run
 */
async function runAgencyPartnerAgent({ mode = 'batch_pitch', options = {} }) {
  logger.info('Agency partner agent started', { mode });

  switch (mode) {
    case 'research':
      return await researchNewAgencies(options);
    case 'pitch_email':
      return await pitchAgencyByEmail(options);
    case 'pitch_dm':
      return await pitchAgencyByDM(options);
    case 'followup':
      return await followUpAgencies(options);
    case 'batch_pitch':
      return await batchResearchAndPitch(options);
    default:
      throw new Error(`Unknown agency agent mode: ${mode}`);
  }
}

/**
 * Research new agencies and save them.
 */
async function researchNewAgencies(options) {
  const {
    agencyTypes = [
      'ad_agency', 'marketing_agency', 'digital_agency',
      'seo_agency', 'social_media_agency', 'web_design',
    ],
    location = 'Utah and nationwide',
    count = 15,
  } = options;

  const agencies = await researchAgencies({ agencyTypes, location, count });

  const saved = [];
  const duplicates = [];

  for (const agency of agencies) {
    // Check for duplicates by email
    if (agency.email) {
      const existing = await query(
        'SELECT id FROM agency_partners WHERE email = $1',
        [agency.email]
      );
      if (existing.rowCount > 0) {
        duplicates.push(agency);
        continue;
      }
    }

    const result = await query(
      `INSERT INTO agency_partners
        (agency_name, contact_name, contact_role, email, phone, website,
         instagram_handle, linkedin_url, agency_type, services_offered,
         client_industries, location, employee_count, notes, source, score, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'researched')
       RETURNING *`,
      [
        agency.agency_name, agency.contact_name, agency.contact_role,
        agency.email, agency.phone, agency.website,
        agency.instagram_handle, agency.linkedin_url,
        agency.agency_type, agency.services_offered || [],
        agency.client_industries || [], agency.location,
        agency.employee_count, agency.notes, agency.source, agency.score,
      ]
    );
    saved.push(result.rows[0]);
  }

  await query(
    `INSERT INTO events (type, payload) VALUES ('agency_found', $1)`,
    [JSON.stringify({ found: saved.length, duplicates: duplicates.length })]
  );

  logger.info('Agency research completed', { found: saved.length, duplicates: duplicates.length });
  return { success: true, found: saved.length, duplicates: duplicates.length, agencies: saved };
}

/**
 * Send a partnership pitch email to a specific agency.
 */
async function pitchAgencyByEmail({ agencyId }) {
  if (!agencyId) throw new Error('agencyId is required');

  const agencyResult = await query('SELECT * FROM agency_partners WHERE id = $1', [agencyId]);
  if (agencyResult.rowCount === 0) throw new Error(`Agency ${agencyId} not found`);
  const agency = agencyResult.rows[0];

  if (!agency.email) throw new Error(`Agency ${agencyId} has no email`);

  // Check for recent outreach
  const recent = await query(
    `SELECT id FROM agency_messages
     WHERE agency_id = $1 AND channel = 'email' AND direction = 'outbound'
     AND created_at > NOW() - INTERVAL '7 days' LIMIT 1`,
    [agencyId]
  );
  if (recent.rowCount > 0) {
    return { skipped: true, reason: 'recently_pitched' };
  }

  const email = await generatePartnershipEmail(agency);

  await sendEmail({
    to: agency.email,
    subject: email.subject,
    text: email.body,
  });

  // Save message
  await query(
    `INSERT INTO agency_messages (agency_id, channel, direction, subject, content, status, sent_at)
     VALUES ($1, 'email', 'outbound', $2, $3, 'sent', NOW())`,
    [agencyId, email.subject, email.body]
  );

  // Update agency
  await query(
    `UPDATE agency_partners SET status = 'pitched', partnership_pitch = $1, last_contacted_at = NOW() WHERE id = $2`,
    [email.body, agencyId]
  );

  await query(
    `INSERT INTO events (type, payload) VALUES ('agency_pitched', $1)`,
    [JSON.stringify({ agencyId, agency_name: agency.agency_name, channel: 'email' })]
  );

  logger.info('Agency pitched via email', { agency: agency.agency_name });
  return { success: true, agency: agency.agency_name, email };
}

/**
 * Send a partnership DM to a specific agency.
 */
async function pitchAgencyByDM({ agencyId, platform }) {
  if (!agencyId) throw new Error('agencyId is required');
  if (!platform) throw new Error('platform is required');

  const agencyResult = await query('SELECT * FROM agency_partners WHERE id = $1', [agencyId]);
  if (agencyResult.rowCount === 0) throw new Error(`Agency ${agencyId} not found`);
  const agency = agencyResult.rows[0];

  const recipientId = platform === 'instagram'
    ? agency.instagram_handle
    : agency.linkedin_url;

  if (!recipientId) {
    return { skipped: true, reason: `no_${platform}_handle` };
  }

  const dm = await generateAgencyDM({ platform, agency });

  await sendDM({ platform, recipientId, message: dm.message });

  await query(
    `INSERT INTO agency_messages (agency_id, channel, direction, content, status, metadata, sent_at)
     VALUES ($1, $2, 'outbound', $3, 'sent', $4, NOW())`,
    [agencyId, platform, dm.message, JSON.stringify({ followup_hint: dm.followup_hint })]
  );

  if (agency.status === 'new' || agency.status === 'researched') {
    await query(
      `UPDATE agency_partners SET status = 'pitched', last_contacted_at = NOW() WHERE id = $1`,
      [agencyId]
    );
  }

  await query(
    `INSERT INTO events (type, payload) VALUES ('agency_pitched', $1)`,
    [JSON.stringify({ agencyId, agency_name: agency.agency_name, channel: platform })]
  );

  logger.info('Agency pitched via DM', { agency: agency.agency_name, platform });
  return { success: true, platform, message: dm.message };
}

/**
 * Follow up on agencies that haven't responded.
 */
async function followUpAgencies(options) {
  const { maxFollowUps = 3 } = options;

  // Find agencies that were pitched but haven't responded, and haven't been contacted in 3+ days
  const agencies = await query(
    `SELECT ap.*, COUNT(am.id) as message_count
     FROM agency_partners ap
     LEFT JOIN agency_messages am ON am.agency_id = ap.id AND am.direction = 'outbound'
     WHERE ap.status = 'pitched'
     AND ap.last_contacted_at < NOW() - INTERVAL '3 days'
     GROUP BY ap.id
     HAVING COUNT(am.id) < $1
     ORDER BY ap.score DESC
     LIMIT 10`,
    [maxFollowUps + 1] // +1 because initial pitch counts
  );

  const results = [];

  for (const agency of agencies.rows) {
    const attemptNumber = parseInt(agency.message_count);

    try {
      if (agency.email) {
        const followUp = await generateAgencyFollowUp(agency, attemptNumber);

        await sendEmail({
          to: agency.email,
          subject: followUp.subject,
          text: followUp.body,
        });

        await query(
          `INSERT INTO agency_messages (agency_id, channel, direction, subject, content, status, sent_at)
           VALUES ($1, 'email', 'outbound', $2, $3, 'sent', NOW())`,
          [agency.id, followUp.subject, followUp.body]
        );

        await query(
          `UPDATE agency_partners SET last_contacted_at = NOW() WHERE id = $1`,
          [agency.id]
        );

        results.push({ agencyId: agency.id, name: agency.agency_name, attempt: attemptNumber, sent: true });
      }
    } catch (err) {
      logger.error('Agency follow-up failed', { agencyId: agency.id, error: err.message });
      results.push({ agencyId: agency.id, error: err.message });
    }
  }

  // Disqualify agencies that have maxed out follow-ups
  await query(
    `UPDATE agency_partners SET status = 'declined'
     WHERE status = 'pitched'
     AND last_contacted_at < NOW() - INTERVAL '3 days'
     AND id IN (
       SELECT agency_id FROM agency_messages
       WHERE direction = 'outbound'
       GROUP BY agency_id
       HAVING COUNT(*) >= $1
     )`,
    [maxFollowUps + 1]
  );

  logger.info('Agency follow-ups completed', { processed: results.length });
  return { success: true, results };
}

/**
 * Full pipeline: research agencies + pitch them all via email + DM.
 */
async function batchResearchAndPitch(options) {
  const {
    count = 15,
    agencyTypes = [
      'ad_agency', 'marketing_agency', 'digital_agency',
      'seo_agency', 'social_media_agency', 'web_design',
    ],
    location = 'Utah and nationwide',
    pitchEmail = true,
    pitchDM = true,
  } = options;

  // 1. Research
  const research = await researchNewAgencies({ agencyTypes, location, count });

  const pitchResults = [];

  // 2. Pitch each new agency
  for (const agency of research.agencies) {
    // Email pitch
    if (pitchEmail && agency.email) {
      try {
        const emailResult = await pitchAgencyByEmail({ agencyId: agency.id });
        pitchResults.push({ agencyId: agency.id, channel: 'email', ...emailResult });
      } catch (err) {
        pitchResults.push({ agencyId: agency.id, channel: 'email', error: err.message });
      }
    }

    // DM pitch (Instagram first, then LinkedIn)
    if (pitchDM) {
      if (agency.instagram_handle) {
        try {
          const dmResult = await pitchAgencyByDM({ agencyId: agency.id, platform: 'instagram' });
          pitchResults.push({ agencyId: agency.id, channel: 'instagram', ...dmResult });
        } catch (err) {
          pitchResults.push({ agencyId: agency.id, channel: 'instagram', error: err.message });
        }
      }
      if (agency.linkedin_url) {
        try {
          const dmResult = await pitchAgencyByDM({ agencyId: agency.id, platform: 'linkedin' });
          pitchResults.push({ agencyId: agency.id, channel: 'linkedin', ...dmResult });
        } catch (err) {
          pitchResults.push({ agencyId: agency.id, channel: 'linkedin', error: err.message });
        }
      }
    }
  }

  // 3. Also follow up on existing unpitched agencies
  const followUps = await followUpAgencies({ maxFollowUps: 3 });

  logger.info('Batch agency pipeline completed', {
    researched: research.found,
    pitched: pitchResults.length,
    followedUp: followUps.results?.length || 0,
  });

  return {
    success: true,
    researched: research.found,
    pitched: pitchResults.length,
    followedUp: followUps.results?.length || 0,
    details: { research, pitchResults, followUps },
  };
}

module.exports = { runAgencyPartnerAgent };
