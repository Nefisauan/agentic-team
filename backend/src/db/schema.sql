-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(50),
  company VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'replied', 'qualified', 'booked', 'disqualified')),
  score INTEGER CHECK (score >= 0 AND score <= 100),
  notes TEXT,
  last_contacted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL
    CHECK (type IN ('outreach', 'follow_up', 'reply', 'scheduling', 'system')),
  direction VARCHAR(10) NOT NULL DEFAULT 'outbound'
    CHECK (direction IN ('inbound', 'outbound')),
  subject VARCHAR(500),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(100) NOT NULL
    CHECK (type IN ('new_lead', 'follow_up_due', 'lead_replied', 'meeting_booked', 'lead_qualified', 'lead_disqualified')),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  payload JSONB DEFAULT '{}',
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Job log table (supervisor)
CREATE TABLE IF NOT EXISTS job_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  queue VARCHAR(100) NOT NULL,
  job_id VARCHAR(255),
  job_name VARCHAR(255),
  status VARCHAR(50) NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'retried')),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  error TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics snapshots table
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_leads INTEGER DEFAULT 0,
  contacted INTEGER DEFAULT 0,
  replied INTEGER DEFAULT 0,
  qualified INTEGER DEFAULT 0,
  booked INTEGER DEFAULT 0,
  response_rate NUMERIC(5,2) DEFAULT 0,
  qualification_rate NUMERIC(5,2) DEFAULT 0,
  booking_rate NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(snapshot_date)
);

-- Auto-update updated_at on leads
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_leads_updated_at ON leads;
CREATE TRIGGER set_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_messages_lead_id ON messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type);
CREATE INDEX IF NOT EXISTS idx_events_lead_id ON events(lead_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_processed ON events(processed);
CREATE INDEX IF NOT EXISTS idx_job_logs_queue ON job_logs(queue);
CREATE INDEX IF NOT EXISTS idx_job_logs_status ON job_logs(status);
