import { supabase } from '../../lib/supabase';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const url = new URL(request.url);
  const tripId = url.searchParams.get('id');
  
  if (!tripId) {
    return NextResponse.json({ error: 'Missing trip ID' }, { status: 400 });
  }
  
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    
    // Check if user is owner or participant
    const isParticipantQuery = await supabase.rpc('is_trip_participant', { 
      check_trip_id: tripId,
      check_user_id: user.id
    });
    
    if (isParticipantQuery.error) {
      console.error('Error checking participation:', isParticipantQuery.error);
      return NextResponse.json({ error: 'Failed to verify access' }, { status: 500 });
    }
    
    const isParticipant = isParticipantQuery.data;
    
    if (!isParticipant) {
      return NextResponse.json({ error: 'You do not have access to this trip' }, { status: 403 });
    }
    
    // Using SECURITY DEFINER function to bypass RLS
    const { data: trip, error: tripError } = await supabase.rpc('get_trip_by_id', { 
      trip_id: tripId 
    });
    
    if (tripError) {
      console.error('Error fetching trip:', tripError);
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }
    
    return NextResponse.json({ trip });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 