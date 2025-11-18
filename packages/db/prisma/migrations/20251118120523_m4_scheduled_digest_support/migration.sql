-- M4: Add scheduled digest support
ALTER TABLE report_subscriptions ADD COLUMN last_run_at TIMESTAMP;
