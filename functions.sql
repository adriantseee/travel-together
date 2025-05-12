-- Function to check if a user exists by email
CREATE OR REPLACE FUNCTION public.check_user_exists_by_email(check_email TEXT)
RETURNS TABLE (user_exists BOOLEAN)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT COUNT(*) > 0 as user_exists
  FROM auth.users
  WHERE email = check_email;
END;
$$ LANGUAGE plpgsql;

-- Function to get user ID by email
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(check_email TEXT)
RETURNS TABLE (user_id UUID)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT id as user_id
  FROM auth.users
  WHERE email = check_email
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions on these functions
GRANT EXECUTE ON FUNCTION public.check_user_exists_by_email TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email TO authenticated; 