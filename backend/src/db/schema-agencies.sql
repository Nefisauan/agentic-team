-- ============================================================================
-- Agency Partnership Extension Schema
-- Run AFTER schema.sql and schema-social.sql
-- ============================================================================

-- Agency partners table
CREATE TABLE IF NOT EXISTS agency_partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  contact_role VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  website VARCHAR(500),
  instagram_handle VARCHAR(255),
  linkedin_url VARCHAR(500),
  agency_type VARCHAR(100), -- ad_agency, marketing_agency, digital_agency, seo_agency, social_media_agency, web_design, branding
  services_offered TEXT[], -- what they do: ['ppc', 'seo', 'social_media', 'web_design', 'branding', 'email_marketing']
  client_industries TEXT[], -- what industries they serve
  location VARCHAR(255),
  employee_count VARCHAR(50),
  notes TEXT,
  source VARCHAR(100), -- how they were found
  partnership_pitch TEXT, -- the pitch we sent them
  partnership_type VARCHAR(50) DEFAULT 'referral'
    CHECK (partnership_type IN ('referral', 'white_label', 'reseller', 'co_sell', 'affiliate')),
  score INTEGER CHECK (score >= 0 AND score <= 100),
  status VARCHAR(30) NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'researched', 'pitched', 'interested', 'negotiating', 'partner', 'declined')),
  last_contacted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agency outreach messages (emails + DMs sent to agencies)
CREATE TABLE IF NOT EXISTS agency_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id UUID NOT NULL REFERENCES agency_partners(id) ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'instagram', 'linkedin')),
  direction VARCHAR(10) NOT NULL DEFAULT 'outbound'
    CHECK (direction IN ('inbound', 'outbound')),
  subject VARCHAR(500),
  content TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'sent'
    CHECK (status IN ('draft', 'sent', 'delivered', 'read', 'replied', 'failed')),
  metadata JSONB DEFAULT '{}',
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Auto-update trigger
DROP TRIGGER IF EXISTS set_agency_partners_updated_at ON agency_partners;
CREATE TRIGGER set_agency_partners_updated_at
  BEFORE UPDATE ON agency_partners
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agency_partners_status ON agency_partners(status);
CREATE INDEX IF NOT EXISTS idx_agency_partners_type ON agency_partners(agency_type);
CREATE INDEX IF NOT EXISTS idx_agency_partners_email ON agency_partners(email);
CREATE INDEX IF NOT EXISTS idx_agency_messages_agency_id ON agency_messages(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_messages_channel ON agency_messages(channel);

-- Extend events to include agency events
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_type_check;
ALTER TABLE events ADD CONSTRAINT events_type_check
  CHECK (type IN (
    'new_lead', 'follow_up_due', 'lead_replied', 'meeting_booked',
    'lead_qualified', 'lead_disqualified',
    'content_generated', 'content_published',
    'dm_sent', 'dm_replied',
    'prospects_found', 'prospect_converted',
    'agency_found', 'agency_pitched', 'agency_replied', 'agency_partnered'
  ));
