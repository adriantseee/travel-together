-- Function to debug RLS policies for trips
CREATE OR REPLACE FUNCTION public.debug_rls(check_trip_id UUID, check_user_id UUID)
RETURNS TABLE (
  trip_id UUID,
  user_id UUID,
  participant_exists BOOLEAN,
  trip_exists BOOLEAN
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    check_trip_id AS trip_id,
    check_user_id AS user_id,
    EXISTS (
      SELECT 1 FROM public.trip_participants 
      WHERE trip_id = check_trip_id AND user_id = check_user_id
    ) AS participant_exists,
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE id = check_trip_id
    ) AS trip_exists;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions on this function
GRANT EXECUTE ON FUNCTION public.debug_rls TO authenticated;

-- Make sure the RLS policy allows participants to see trips
DROP POLICY IF EXISTS "Users can view trips they participate in" ON public.trips;

CREATE POLICY "Users can view trips they participate in" 
  ON public.trips FOR SELECT
  USING (
    created_by = auth.uid() OR
    id IN (
      SELECT trip_id FROM public.trip_participants 
      WHERE user_id = auth.uid()
    )
  ); 