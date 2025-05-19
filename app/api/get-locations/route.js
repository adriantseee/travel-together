import { NextResponse } from 'next/server';
import { getLocations } from '../../utils/getLocations';
import { supabase } from '../../lib/supabase';

export async function POST(request) {
  try {
    // Parse the request body
    const { message, tripDetails: providedTripDetails, tripId } = await request.json();
    
    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }
    
    // If tripDetails is provided directly, use it
    // Otherwise, if tripId is provided, fetch details from Supabase
    let tripDetails = providedTripDetails;
    
    if (!tripDetails && tripId) {
      console.log(`Fetching trip details for ID: ${tripId}`);
      
      // Fetch trip details from Supabase
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();
        
      if (error) {
        console.error('Error fetching trip details:', error);
        return NextResponse.json(
          { error: "Failed to fetch trip details" },
          { status: 500 }
        );
      }
      
      if (data) {
        tripDetails = {
          id: data.id,
          city: data.city,
          country: data.country,
          startDate: data.start_date,
          endDate: data.end_date,
          latitude: data.latitude,
          longitude: data.longitude,
          travelers: data.travelers,
          budget: data.budget
        };
      }
    }
    
    // Generate queries using the imported function
    // Note: generateQueries expects userInput, not message
    const queries = await getLocations(message, tripDetails);
    
    // Return the response - now possibly includes rawPlaceList and curatedResults
    return NextResponse.json({ queries });
  } catch (error) {
    console.error('Error in get-locations route:', error);
    return NextResponse.json({ error: 'Failed to generate queries' }, { status: 500 });
  }
}