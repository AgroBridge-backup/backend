-- ============================================================================
-- COLLECTIONS SYSTEM DATABASE MIGRATION
-- Automated payment reminder and collections tracking
-- ============================================================================

-- Collection attempt stages
CREATE TYPE collection_stage AS ENUM (
  'FRIENDLY_REMINDER',
  'FINAL_NOTICE',
  'OVERDUE_1',
  'OVERDUE_3',
  'LATE_FEE_WARNING',
  'ACCOUNT_REVIEW',
  'COLLECTIONS_HANDOFF',
  'LEGAL_WARNING'
);

-- Collection channels
CREATE TYPE collection_channel AS ENUM (
  'WHATSAPP',
  'SMS',
  'EMAIL',
  'PUSH',
  'CALL'
);

-- Collection attempt status
CREATE TYPE collection_status AS ENUM (
  'PENDING',
  'SENT',
  'DELIVERED',
  'READ',
  'FAILED',
  'SKIPPED'
);

-- ============================================================================
-- COLLECTION ATTEMPTS TABLE
-- Tracks every reminder/collection attempt
-- ============================================================================

CREATE TABLE collection_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference to advance
  advance_id UUID NOT NULL REFERENCES advance_contracts(id) ON DELETE CASCADE,

  -- Attempt details
  stage collection_stage NOT NULL,
  channel collection_channel NOT NULL,
  status collection_status NOT NULL DEFAULT 'PENDING',

  -- Messaging provider tracking
  message_id VARCHAR(255),           -- WhatsApp/Twilio message ID
  provider_response JSONB,           -- Full provider response

  -- Timing
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,

  -- Response tracking
  user_response TEXT,                -- Any reply from user
  acknowledged_at TIMESTAMP WITH TIME ZONE,

  -- Error tracking
  error_message TEXT,
  retry_count INT DEFAULT 0,

  -- Attempt number for this stage
  attempt_number INT DEFAULT 1,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Indexes for common queries
  CONSTRAINT valid_attempt_number CHECK (attempt_number >= 1)
);

-- Indexes
CREATE INDEX idx_collection_attempts_advance ON collection_attempts(advance_id);
CREATE INDEX idx_collection_attempts_stage ON collection_attempts(stage);
CREATE INDEX idx_collection_attempts_status ON collection_attempts(status);
CREATE INDEX idx_collection_attempts_sent_at ON collection_attempts(sent_at DESC);
CREATE INDEX idx_collection_attempts_advance_stage ON collection_attempts(advance_id, stage);

-- ============================================================================
-- COLLECTION RULES TABLE
-- Configurable rules for each stage
-- ============================================================================

CREATE TABLE collection_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  stage collection_stage UNIQUE NOT NULL,

  -- Timing
  days_from_due INT NOT NULL,        -- Negative = before due, positive = after

  -- Channels (ordered by priority)
  channels collection_channel[] NOT NULL,

  -- Priority
  priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',

  -- Template reference
  template_key VARCHAR(100) NOT NULL,

  -- Behavior
  requires_acknowledgment BOOLEAN DEFAULT FALSE,
  escalate_after_hours INT DEFAULT 0,
  max_attempts INT DEFAULT 1,

  -- Active flag
  is_active BOOLEAN DEFAULT TRUE,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default rules
INSERT INTO collection_rules (stage, days_from_due, channels, priority, template_key, requires_acknowledgment, escalate_after_hours, max_attempts) VALUES
  ('FRIENDLY_REMINDER', -3, ARRAY['WHATSAPP', 'PUSH']::collection_channel[], 'NORMAL', 'reminderFriendly', FALSE, 0, 1),
  ('FINAL_NOTICE', 0, ARRAY['WHATSAPP', 'SMS', 'EMAIL']::collection_channel[], 'HIGH', 'reminderDueToday', FALSE, 0, 2),
  ('OVERDUE_1', 1, ARRAY['WHATSAPP', 'SMS']::collection_channel[], 'HIGH', 'reminderOverdue', FALSE, 24, 2),
  ('OVERDUE_3', 3, ARRAY['WHATSAPP', 'SMS', 'EMAIL']::collection_channel[], 'HIGH', 'reminderOverdue', TRUE, 48, 2),
  ('LATE_FEE_WARNING', 7, ARRAY['WHATSAPP', 'SMS', 'EMAIL', 'CALL']::collection_channel[], 'CRITICAL', 'reminderOverdue', TRUE, 24, 3),
  ('ACCOUNT_REVIEW', 14, ARRAY['WHATSAPP', 'SMS', 'EMAIL', 'CALL']::collection_channel[], 'CRITICAL', 'reminderOverdue', TRUE, 24, 3),
  ('COLLECTIONS_HANDOFF', 30, ARRAY['EMAIL', 'CALL']::collection_channel[], 'CRITICAL', 'collectionsHandoff', TRUE, 0, 1);

-- ============================================================================
-- LATE FEES TABLE
-- Track applied late fees
-- ============================================================================

CREATE TABLE late_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference
  advance_id UUID NOT NULL REFERENCES advance_contracts(id) ON DELETE CASCADE,

  -- Calculation
  original_amount DECIMAL(15, 2) NOT NULL,
  days_overdue INT NOT NULL,
  fee_percentage DECIMAL(5, 2) NOT NULL,
  fee_amount DECIMAL(15, 2) NOT NULL,
  total_due DECIMAL(15, 2) NOT NULL,

  -- Status
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  waived_at TIMESTAMP WITH TIME ZONE,
  waived_by UUID,                    -- Admin user ID
  waiver_reason TEXT,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_late_fees_advance ON late_fees(advance_id);
CREATE INDEX idx_late_fees_applied_at ON late_fees(applied_at DESC);

-- ============================================================================
-- OPT-OUT TRACKING TABLE
-- Legal requirement for Mexico (Ley Federal de Protección de Datos)
-- ============================================================================

CREATE TABLE collection_opt_outs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User reference
  user_id UUID NOT NULL,
  phone_number VARCHAR(20),

  -- Opt-out details
  channel collection_channel NOT NULL,
  opted_out_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reason TEXT,

  -- Re-opt-in
  opted_back_in_at TIMESTAMP WITH TIME ZONE,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, channel)
);

CREATE INDEX idx_opt_outs_user ON collection_opt_outs(user_id);
CREATE INDEX idx_opt_outs_phone ON collection_opt_outs(phone_number);

-- ============================================================================
-- COLLECTION SUMMARY TABLE
-- Daily summary for reporting
-- ============================================================================

CREATE TABLE collection_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Summary date
  summary_date DATE NOT NULL UNIQUE,

  -- Counts
  total_processed INT DEFAULT 0,
  total_sent INT DEFAULT 0,
  total_delivered INT DEFAULT 0,
  total_failed INT DEFAULT 0,
  total_skipped INT DEFAULT 0,

  -- Breakdown by stage (JSONB for flexibility)
  by_stage JSONB DEFAULT '{}',
  by_channel JSONB DEFAULT '{}',

  -- Performance
  duration_ms INT,
  errors JSONB DEFAULT '[]',

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_summaries_date ON collection_summaries(summary_date DESC);

-- ============================================================================
-- WHATSAPP SESSIONS TABLE
-- For WhatsApp bot conversation state
-- ============================================================================

CREATE TABLE whatsapp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Phone number (E.164 format)
  phone_number VARCHAR(20) NOT NULL UNIQUE,

  -- User reference (if identified)
  user_id UUID,
  producer_id UUID,

  -- Conversation state
  state VARCHAR(50) DEFAULT 'IDLE',
  context JSONB DEFAULT '{}',

  -- Language preference
  language VARCHAR(5) DEFAULT 'es',

  -- Metrics
  message_count INT DEFAULT 0,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Session lifecycle
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,

  -- Audit
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_wa_sessions_phone ON whatsapp_sessions(phone_number);
CREATE INDEX idx_wa_sessions_user ON whatsapp_sessions(user_id);
CREATE INDEX idx_wa_sessions_expires ON whatsapp_sessions(expires_at);

-- ============================================================================
-- TRIGGER: Update updated_at on collection_rules
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_collection_rules_updated_at
  BEFORE UPDATE ON collection_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_whatsapp_sessions_updated_at
  BEFORE UPDATE ON whatsapp_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
