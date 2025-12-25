-- ═══════════════════════════════════════════════════════════════════════════════
-- PRODUCTION DATABASE OPTIMIZATION - ADDITIONAL INDEXES
-- Run this after prisma migrate to add performance-optimized indexes
-- ═══════════════════════════════════════════════════════════════════════════════

-- Composite indexes for common query patterns

-- 1. Batch lookups by producer + status (dashboard queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_batches_producer_status
ON batches (producer_id, status);

-- 2. Batch lookups by producer + harvest date (date range filters)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_batches_producer_harvest
ON batches (producer_id, harvest_date DESC);

-- 3. Verification stages by batch + status (approval workflow)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_verification_stages_batch_status
ON verification_stages (batch_id, status);

-- 4. Quality certificates by batch + validity (active certificates)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quality_certificates_batch_valid
ON quality_certificates (batch_id, valid_from, valid_to);

-- 5. Transit sessions by batch + status (active tracking)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transit_sessions_batch_status
ON transit_sessions (batch_id, status);

-- 6. Transit sessions by driver + status (driver dashboard)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transit_sessions_driver_status
ON transit_sessions (driver_id, status);

-- 7. Transit locations by session + timestamp (location history)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transit_locations_session_time
ON transit_locations (session_id, timestamp DESC);

-- 8. Temperature readings by batch + timestamp (temperature history)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_temperature_readings_batch_time
ON temperature_readings (batch_id, timestamp DESC);

-- 9. Temperature readings by batch + out of range (alert queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_temperature_readings_batch_alert
ON temperature_readings (batch_id, is_out_of_range) WHERE is_out_of_range = true;

-- 10. NFC seal verifications by seal + time (verification history)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nfc_verifications_seal_time
ON nfc_seal_verifications (seal_id, verified_at DESC);

-- 11. Audit logs by user + action + time (user activity)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_action_time
ON audit_logs (user_id, action, created_at DESC);

-- 12. Audit logs by resource + time (resource history)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_resource_time
ON audit_logs (resource, resource_id, created_at DESC);

-- 13. Notifications by user + status (unread notifications)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_status_time
ON notifications (user_id, status, created_at DESC);

-- 14. Events by batch + type (event filtering)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_batch_type
ON traceability_events (batch_id, event_type);

-- 15. Producers by export company + whitelisted (company farmers list)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_producers_company_whitelisted
ON producers (export_company_id, is_whitelisted);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTIAL INDEXES FOR COMMON FILTERS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Active users only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active
ON users (id) WHERE is_active = true;

-- Active certifications only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_certifications_active
ON certifications (producer_id, expires_at) WHERE is_active = true;

-- Pending verification stages
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_verification_stages_pending
ON verification_stages (batch_id, stage_type) WHERE status = 'PENDING';

-- Active transit sessions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transit_sessions_active
ON transit_sessions (batch_id) WHERE status IN ('SCHEDULED', 'IN_TRANSIT', 'PAUSED', 'DELAYED');

-- ═══════════════════════════════════════════════════════════════════════════════
-- ANALYZE TABLES (Update statistics for query planner)
-- ═══════════════════════════════════════════════════════════════════════════════

ANALYZE users;
ANALYZE producers;
ANALYZE batches;
ANALYZE traceability_events;
ANALYZE verification_stages;
ANALYZE quality_certificates;
ANALYZE transit_sessions;
ANALYZE transit_locations;
ANALYZE temperature_readings;
ANALYZE nfc_seals;
ANALYZE nfc_seal_verifications;
ANALYZE audit_logs;
ANALYZE notifications;
