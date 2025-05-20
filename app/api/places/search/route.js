'use server';

import { searchPlacesText, getPlacePhoto } from '../../../utils/googlePlaces';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('query');
    const city = url.searchParams.get('city') || '';
    
    if (!query) {
      return new Response(
        JSON.stringify({ error: "Missing query parameter" }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Format the search query to include the city if provided
    const searchQuery = city ? `${query} in ${city}` : query;
    
    // Get the API key from environment variables
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Google Maps API key not configured" }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Search for places
    const places = await searchPlacesText(searchQuery, apiKey);
    
    // Process photo URLs for each place
    const resultsWithPhotos = await Promise.all(places.map(async place => {
      // Try to get the first photo if available
      let photoUrl = null;
      if (place.photos && place.photos.length > 0) {
        photoUrl = await getPlacePhoto(place.photos[0].name, apiKey);
      }
      
      return {
        id: place.id || `place-${Math.random().toString(36).substring(2, 9)}`,
        name: place.displayName?.text || query,
        address: place.formattedAddress || '',
        location: {
          latitude: place.location?.latitude || 0,
          longitude: place.location?.longitude || 0
        },
        types: place.types || [],
        photoUrl: photoUrl
      };
    }));

    return new Response(
      JSON.stringify({ results: resultsWithPhotos }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in places search API:', error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to search for places" }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
} 