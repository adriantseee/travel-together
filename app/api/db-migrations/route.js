import { supabase } from '../../lib/supabase';
import fs from 'fs';
import path from 'path';

// This is an admin-only API endpoint to run database migrations
export async function POST(request) {
  try {
    // You would normally add authentication checks here to ensure only admins can run this

    // Get the migration file
    const migrationPath = path.join(process.cwd(), 'migrations', 'create_trip_events_table.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Execute the SQL migration
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('Migration error:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Migration executed successfully' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Migration failed:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 