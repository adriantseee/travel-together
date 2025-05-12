-- Function to execute SQL as a database admin
-- This needs to be created by a superuser or someone with the right permissions
CREATE OR REPLACE FUNCTION exec_sql(sql_query TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER -- This means the function executes with the privileges of the function creator
AS $$
BEGIN
  -- Execute the SQL query
  EXECUTE sql_query;
END;
$$; 