-- ============================================================================
-- Social Media Extension Schema
-- Run AFTER the base schema.sql
-- ============================================================================

-- Social media posts (Instagram / LinkedIn content)
CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('instagram', 'linkedin')),
  content_type VARCHAR(50) NOT NULL DEFAULT 'post'
    CHECK (content_type IN ('post', 'carousel', 'reel_caption', 'story', 'article')),
  caption TEXT NOT NULL,
  hashtags TEXT[], -- array of hashtags
  image_prompt TEXT, -- AI image generation prompt or photo suggestion
  image_url TEXT, -- URL if image was generated/uploaded
  status VARCHAR(30) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'published', 'failed')),
  scheduled_for TIMESTAMP WITH TIME ZONE,
  published_at TIMESTAMP WITH TIME ZONE,
  engagement JSONB DEFAULT '{}', -- { likes, comments, shares, impressions, reach }
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Social DMs (Instagram / LinkedIn outreach messages)
CREATE TABLE IF NOT EXISTS social_dms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('instagram', 'linkedin')),
  direction VARCHAR(10) NOT NULL DEFAULT 'outbound'
    CHECK (direction IN ('inbound', 'outbound')),
  message TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'replied', 'failed')),
  metadata JSONB DEFAULT '{}', -- { profile_url, connection_type, etc. }
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Discovered prospects (Client-Finding Agent output)
CREATE TABLE IF NOT EXISTS prospects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  contact_role VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  website VARCHAR(500),
  instagram_handle VARCHAR(255),
  linkedin_url VARCHAR(500),
  industry VARCHAR(100),
  location VARCHAR(255),
  employee_count VARCHAR(50),
  notes TEXT,
  source VARCHAR(100), -- how they were found (google_maps, linkedin_search, etc.)
  score INTEGER CHECK (score >= 0 AND score <= 100), -- prospect quality score
  status VARCHAR(30) NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'approved', 'converted', 'rejected')),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL, -- linked after conversion
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Weekly reporting snapshots (extends analytics)
CREATE TABLE IF NOT EXISTS weekly_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,

  -- Social content metrics
  ig_posts_created INTEGER DEFAULT 0,
  ig_total_likes INTEGER DEFAULT 0,
  ig_total_comments INTEGER DEFAULT 0,
  ig_total_reach INTEGER DEFAULT 0,
  li_posts_created INTEGER DEFAULT 0,
  li_total_likes INTEGER DEFAULT 0,
  li_total_comments INTEGER DEFAULT 0,
  li_total_impressions INTEGER DEFAULT 0,

  -- DM metrics
  ig_dms_sent INTEGER DEFAULT 0,
  ig_dms_replied INTEGER DEFAULT 0,
  li_dms_sent INTEGER DEFAULT 0,
  li_dms_replied INTEGER DEFAULT 0,

  -- Email metrics (from existing system)
  emails_sent INTEGER DEFAULT 0,
  emails_replied INTEGER DEFAULT 0,
  leads_qualified INTEGER DEFAULT 0,
  meetings_scheduled INTEGER DEFAULT 0,

  -- Prospects
  prospects_found INTEGER DEFAULT 0,
  prospects_converted INTEGER DEFAULT 0,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(week_start)
);

-- Auto-update triggers for new tables
DROP TRIGGER IF EXISTS set_social_posts_updated_at ON social_posts;
CREATE TRIGGER set_social_posts_updated_at
  BEFORE UPDATE ON social_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_prospects_updated_at ON prospects;
CREATE TRIGGER set_prospects_updated_at
  BEFORE UPDATE ON prospects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_social_posts_platform ON social_posts(platform);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status);
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled ON social_posts(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_social_dms_lead_id ON social_dms(lead_id);
CREATE INDEX IF NOT EXISTS idx_social_dms_platform ON social_dms(platform);
CREATE INDEX IF NOT EXISTS idx_social_dms_status ON social_dms(status);
CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_industry ON prospects(industry);
CREATE INDEX IF NOT EXISTS idx_prospects_email ON prospects(email);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_week ON weekly_reports(week_start);

-- Extend events type check to include social events
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_type_check;
ALTER TABLE events ADD CONSTRAINT events_type_check
  CHECK (type IN (
    'new_lead', 'follow_up_due', 'lead_replied', 'meeting_booked',
    'lead_qualified', 'lead_disqualified',
    'content_generated', 'content_published',
    'dm_sent', 'dm_replied',
    'prospects_found', 'prospect_converted'
  ));

-- Extend messages type check to include DM types
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_type_check
  CHECK (type IN ('outreach', 'follow_up', 'reply', 'scheduling', 'system', 'dm_outreach', 'dm_reply'));
