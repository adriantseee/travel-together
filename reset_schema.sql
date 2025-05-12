-- Drop existing tables and policies if they exist
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "New users can insert their profile" ON public.user_profiles;

DROP POLICY IF EXISTS "Users can view trips they participate in" ON public.trips;
DROP POLICY IF EXISTS "Users can create trips" ON public.trips;
DROP POLICY IF EXISTS "Trip participants can update trips" ON public.trips;
DROP POLICY IF EXISTS "Trip participants can delete trips" ON public.trips;

DROP POLICY IF EXISTS "Users can see participants of their trips" ON public.trip_participants;
DROP POLICY IF EXISTS "Users can add participants to their trips" ON public.trip_participants;
DROP POLICY IF EXISTS "Trigger can add trip creator as owner" ON public.trip_participants;

DROP TRIGGER IF EXISTS add_trip_creator_trigger ON public.trips;
DROP FUNCTION IF EXISTS public.add_trip_creator_as_participant();

DROP TABLE IF EXISTS public.trip_participants;
DROP TABLE IF EXISTS public.trips;
DROP TABLE IF EXISTS public.user_profiles;

-- Create tables
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  age INTEGER,
  country TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.trip_participants (
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (trip_id, user_id)
);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_participants ENABLE ROW LEVEL SECURITY;

-- User profile policies
CREATE POLICY "Users can view their own profile" 
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "New users can insert their profile" 
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Simplified Trips policies to avoid recursion
CREATE POLICY "Users can view their own trips" 
  ON public.trips FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Users can create trips" 
  ON public.trips FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own trips" 
  ON public.trips FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own trips" 
  ON public.trips FOR DELETE
  USING (created_by = auth.uid());

-- Trip participants policies
CREATE POLICY "Users can see their own participations" 
  ON public.trip_participants FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Trip creators can see all participants" 
  ON public.trip_participants FOR SELECT
  USING (
    trip_id IN (
      SELECT id FROM public.trips
      WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Trip creators can add participants" 
  ON public.trip_participants FOR INSERT
  WITH CHECK (
    trip_id IN (
      SELECT id FROM public.trips
      WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Users can add themselves as participants"
  ON public.trip_participants FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
  );

-- Create trigger function to add creator as participant
CREATE OR REPLACE FUNCTION public.add_trip_creator_as_participant()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.trip_participants (trip_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER add_trip_creator_trigger
AFTER INSERT ON public.trips
FOR EACH ROW
EXECUTE FUNCTION public.add_trip_creator_as_participant(); 