-- Add status column to trip_events table
ALTER TABLE trip_events ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved';

-- Update any existing records to have approved status
UPDATE trip_events SET status = 'approved' WHERE status IS NULL; 