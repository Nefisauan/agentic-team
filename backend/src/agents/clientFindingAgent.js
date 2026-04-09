const { query } = require('../config/database');
const { researchProspects, enrichProspect } = require('../services/clientFindingService');
const { addOutreachJob, addDMJob } = require('../queues/index');
const logger = require('../config/logger');

/**
 * Client-Finding Agent — researches and identifies potential leads.
 *
 * Flow:
 * 1. Research prospects via Claude (simulating web scraping)
 * 2. Deduplicate against existing leads/prospects
 * 3. Save to prospects table
 * 4. Optionally enrich with personalization data
 * 5. Feed to Outreach Agent (email) and DM Agent (social)
 * 6. Create event records
 */
async function runClientFindingAgent({
  industries = ['HVAC', 'roofing', 'plumbing', 'electrical', 'landscaping', 'cleaning', 'auto detailing'],
  location = 'Utah',
  count = 20,
  autoConvert = true,
  autoDM = true,
}) {
  logger.info('Client-finding agent started', { industries, location, count });

  // 1. Research prospects
  const prospects = await researchProspects({ industries, location, count });

  const saved = [];
  const duplicates = [];

  for (const prospect of prospects) {
    // 2. Check for duplicates (by email or company name)
    if (prospect.email) {
      const existingLead = await query(
        'SELECT id FROM leads WHERE email = $1', [prospect.email]
      );
      if (existingLead.rowCount > 0) {
        duplicates.push({ ...prospect, reason: 'email_exists_in_leads' });
        continue;
      }

      const existingProspect = await query(
        'SELECT id FROM prospects WHERE email = $1', [prospect.email]
      );
      if (existingProspect.rowCount > 0) {
        duplicates.push({ ...prospect, reason: 'email_exists_in_prospects' });
        continue;
      }
    }

    // 3. Save prospect
    const result = await query(
      `INSERT INTO prospects
         (company_name, contact_name, contact_role, email, phone, website,
          instagram_handle, linkedin_url, industry, location, employee_count,
          notes, source, score, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'new')
       RETURNING *`,
      [
        prospect.company_name,
        prospect.contact_name,
        prospect.contact_role,
        prospect.email,
        prospect.phone,
        prospect.website,
        prospect.instagram_handle,
        prospect.linkedin_url,
        prospect.industry,
        prospect.location,
        prospect.employee_count,
        prospect.notes,
        prospect.source,
        prospect.score,
      ]
    );

    saved.push(result.rows[0]);

    // 4. Auto-convert high-scoring prospects to leads and trigger outreach
    if (autoConvert && prospect.score >= 70 && prospect.email) {
      await convertProspectToLead(result.rows[0].id);
    }

    // 5. Auto-DM if enabled
    if (autoDM && (prospect.instagram_handle || prospect.linkedin_url)) {
      const platform = prospect.instagram_handle ? 'instagram' : 'linkedin';
      try {
        await addDMJob({
          mode: 'outreach',
          prospectId: result.rows[0].id,
          platform,
        });
      } catch (err) {
        logger.warn('Failed to queue DM job', { prospectId: result.rows[0].id, error: err.message });
      }
    }
  }

  // 6. Create event
  await query(
    `INSERT INTO events (type, payload) VALUES ('prospects_found', $1)`,
    [JSON.stringify({
      found: saved.length,
      duplicates: duplicates.length,
      industries,
      location,
    })]
  );

  logger.info('Client-finding agent completed', {
    found: saved.length,
    duplicates: duplicates.length,
  });

  return {
    success: true,
    found: saved.length,
    duplicates: duplicates.length,
    prospects: saved,
  };
}

/**
 * Convert a prospect to a lead and trigger outreach.
 */
async function convertProspectToLead(prospectId) {
  const prospectResult = await query('SELECT * FROM prospects WHERE id = $1', [prospectId]);
  if (prospectResult.rowCount === 0) throw new Error(`Prospect ${prospectId} not found`);
  const prospect = prospectResult.rows[0];

  if (prospect.status === 'converted') {
    return { skipped: true, reason: 'already_converted' };
  }

  // Create lead
  const leadResult = await query(
    `INSERT INTO leads (name, email, phone, company, notes, status)
     VALUES ($1, $2, $3, $4, $5, 'new')
     RETURNING *`,
    [
      prospect.contact_name,
      prospect.email,
      prospect.phone,
      prospect.company_name,
      `Source: ${prospect.source}. ${prospect.notes || ''}`.trim(),
    ]
  );

  const lead = leadResult.rows[0];

  // Update prospect
  await query(
    `UPDATE prospects SET status = 'converted', lead_id = $1 WHERE id = $2`,
    [lead.id, prospectId]
  );

  // Queue outreach
  await addOutreachJob(lead.id);

  // Create event
  await query(
    `INSERT INTO events (type, lead_id, payload) VALUES ('prospect_converted', $1, $2)`,
    [lead.id, JSON.stringify({ prospectId, company: prospect.company_name })]
  );

  logger.info('Prospect converted to lead', { prospectId, leadId: lead.id });
  return { success: true, lead };
}

module.exports = { runClientFindingAgent, convertProspectToLead };
