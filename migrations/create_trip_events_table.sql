-- Create the trip_events table for real-time collaboration
CREATE TABLE IF NOT EXISTS trip_events (
  id TEXT PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_index INTEGER NOT NULL,
  activity TEXT NOT NULL,
  time TEXT NOT NULL, -- 24-hour format HH:MM
  end_time TEXT NOT NULL, -- 24-hour format HH:MM
  created_by_user_id UUID NOT NULL REFERENCES user_profiles(id),
  created_by_name TEXT NOT NULL,
  created_by_avatar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS trip_events_trip_id_idx ON trip_events(trip_id);
CREATE INDEX IF NOT EXISTS trip_events_day_index_idx ON trip_events(day_index);
CREATE INDEX IF NOT EXISTS trip_events_created_by_user_id_idx ON trip_events(created_by_user_id);

-- Add Row Level Security (RLS) policies
ALTER TABLE trip_events ENABLE ROW LEVEL SECURITY;

-- Create policy for users to read events for trips they participate in
CREATE POLICY "Users can read trip events for trips they participate in" ON trip_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trip_participants 
      WHERE trip_participants.trip_id = trip_events.trip_id 
      AND trip_participants.user_id = auth.uid()
    )
  );

-- Create policy for users to create events for trips they participate in
CREATE POLICY "Users can insert events for trips they participate in" ON trip_events
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip_participants 
      WHERE trip_participants.trip_id = trip_events.trip_id 
      AND trip_participants.user_id = auth.uid()
    )
  );

-- Create policy for users to update their own events
CREATE POLICY "Users can update their own events" ON trip_events
  FOR UPDATE
  USING (created_by_user_id = auth.uid())
  WITH CHECK (created_by_user_id = auth.uid());

-- Create policy for owners of a trip to update any event in that trip
CREATE POLICY "Trip owners can update any event in their trip" ON trip_events
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM trip_participants 
      WHERE trip_participants.trip_id = trip_events.trip_id 
      AND trip_participants.user_id = auth.uid()
      AND trip_participants.role = 'owner'
    )
  );

-- Create policy for users to delete their own events
CREATE POLICY "Users can delete their own events" ON trip_events
  FOR DELETE
  USING (created_by_user_id = auth.uid());

-- Create policy for owners to delete any event in their trip
CREATE POLICY "Trip owners can delete any event in their trip" ON trip_events
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trip_participants 
      WHERE trip_participants.trip_id = trip_events.trip_id 
      AND trip_participants.user_id = auth.uid()
      AND trip_participants.role = 'owner'
    )
  );

-- Enable real-time subscriptions for this table
ALTER PUBLICATION supabase_realtime ADD TABLE trip_events; 