import { supabase } from '../../lib/supabase';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const url = new URL(request.url);
  const tripId = url.searchParams.get('tripId');
  const userId = url.searchParams.get('userId');
  
  if (!tripId || !userId) {
    return NextResponse.json({ error: 'Missing tripId or userId parameters' }, { status: 400 });
  }
  
  try {
    // Check trip_participants table
    const { data: participantData, error: participantError } = await supabase
      .from('trip_participants')
      .select('*')
      .eq('trip_id', tripId)
      .eq('user_id', userId);
      
    // Check if the trip exists
    const { data: tripData, error: tripError } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId);
      
    // Try the RLS policy condition manually
    const { data: rls, error: rlsError } = await supabase.rpc(
      'debug_rls', 
      { check_trip_id: tripId, check_user_id: userId }
    );
      
    return NextResponse.json({
      tripId,
      userId,
      participantData,
      participantError,
      tripData,
      tripError,
      rls,
      rlsError
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 