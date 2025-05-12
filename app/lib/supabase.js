import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://ofobfrdjurcwmesowslm.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mb2JmcmRqdXJjd21lc293c2xtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNTE3ODksImV4cCI6MjA2MjYyNzc4OX0.QBGKzglKyHa6lbiZiwaFqnYMys27mcqleqVpE-3MSe8"

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
}

// Create Supabase client with realtime subscriptions enabled
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
}); 