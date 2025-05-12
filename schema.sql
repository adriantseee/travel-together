-- Create a table for user profiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  age INTEGER,
  country TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create a table for trips
CREATE TABLE IF NOT EXISTS public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create a junction table for users and trips (for collaboration)
CREATE TABLE IF NOT EXISTS public.trip_participants (
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'owner', 'member', etc.
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (trip_id, user_id)
);

-- Set up RLS (Row Level Security) for the tables
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

-- Trips policies
CREATE POLICY "Users can view trips they participate in" 
  ON public.trips FOR SELECT
  USING (
    id IN (
      SELECT trip_id FROM public.trip_participants 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create trips" 
  ON public.trips FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Trip participants can update trips" 
  ON public.trips FOR UPDATE
  USING (
    id IN (
      SELECT trip_id FROM public.trip_participants 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Trip participants can delete trips" 
  ON public.trips FOR DELETE
  USING (
    id IN (
      SELECT trip_id FROM public.trip_participants 
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Trip participants policies
CREATE POLICY "Users can see participants of their trips" 
  ON public.trip_participants FOR SELECT
  USING (
    user_id = auth.uid() OR 
    trip_id IN (
      SELECT trips.id FROM public.trips
      INNER JOIN public.trip_participants ON trips.id = trip_participants.trip_id
      WHERE trip_participants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add participants to their trips" 
  ON public.trip_participants FOR INSERT
  WITH CHECK (
    trip_id IN (
      SELECT trips.id FROM public.trips
      INNER JOIN public.trip_participants ON trips.id = trip_participants.trip_id
      WHERE trip_participants.user_id = auth.uid() AND trip_participants.role = 'owner'
    )
  );

-- Allow the trigger function to add the creator as owner
CREATE POLICY "Trigger can add trip creator as owner" 
  ON public.trip_participants FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE id = trip_id AND created_by = auth.uid()
    )
  );

-- Create trigger to automatically add trip creator as an owner participant
CREATE OR REPLACE FUNCTION public.add_trip_creator_as_participant()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.trip_participants (trip_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER add_trip_creator_trigger
AFTER INSERT ON public.trips
FOR EACH ROW
EXECUTE FUNCTION public.add_trip_creator_as_participant(); 