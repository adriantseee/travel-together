-- Function to check if a user is a participant in a trip (including if they're the creator)
CREATE OR REPLACE FUNCTION public.is_trip_participant(check_trip_id UUID, check_user_id UUID) 
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_creator BOOLEAN;
  is_participant BOOLEAN;
BEGIN
  -- Check if user is the creator
  SELECT (created_by = check_user_id) INTO is_creator
  FROM public.trips
  WHERE id = check_trip_id;
  
  -- Check if user is a participant
  SELECT EXISTS (
    SELECT 1 FROM public.trip_participants
    WHERE trip_id = check_trip_id AND user_id = check_user_id
  ) INTO is_participant;
  
  -- Return true if either condition is true
  RETURN COALESCE(is_creator, FALSE) OR COALESCE(is_participant, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Function to get a trip by ID, bypassing RLS
CREATE OR REPLACE FUNCTION public.get_trip_by_id(trip_id UUID) 
RETURNS SETOF public.trips 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.trips WHERE id = trip_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.is_trip_participant TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trip_by_id TO authenticated; 