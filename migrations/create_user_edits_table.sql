-- Create a single table for all users' personal edits
CREATE TABLE IF NOT EXISTS user_edits (
  id TEXT PRIMARY KEY,
  trip_id UUID NOT NULL,
  user_id UUID NOT NULL,
  day_index INTEGER NOT NULL,
  activity TEXT NOT NULL,
  time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  created_by_user_id UUID NOT NULL,
  created_by_name TEXT NOT NULL,
  created_by_avatar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_user_edits_trip_user ON user_edits(trip_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_edits_day ON user_edits(day_index); 