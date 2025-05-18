/**
 * Utility functions for interacting with Google Places API
 */
const {PlacesClient} = require('@googlemaps/places').v1;

/**
 * Search for places using the Google Places API text search
 * @param {string} query - The search query
 * @param {string} apiKey - Google API key
 * @returns {Promise<Array>} - Array of place results
 */
export async function searchPlacesText(query, apiKey) {
  if (!query || !apiKey) {
    throw new Error('Query and API key are required');
  }

  try {
    // Create Places Client
    const placesClient = new PlacesClient({ apiKey });
    
    // Build the request
    const request = {
      textQuery: query,
    };

    // Make the request
    const response = await placesClient.searchText(request, {
      otherArgs: {
        headers: {
          'X-Goog-FieldMask': '*',
        },
      },
    });

    // Return places array or empty array if no results
    return response[0]?.places || [];
  } catch (error) {
    console.error('Error searching for places:', error);
    throw error;
  }
}

/**
 * Get a photo for a place
 * @param {string} photoName - The photo reference/name from Places API
 * @param {string} apiKey - Google API key
 * @param {number} maxWidth - Maximum width of the photo
 * @param {number} maxHeight - Maximum height of the photo
 * @returns {Promise<string|null>} - URL of the photo or null if unavailable
 */
export async function getPlacePhoto(photoName, apiKey, maxWidth = 400, maxHeight = 300) {
  if (!photoName || !apiKey) {
    return null;
  }

  try {
    // Create Places Client
    const placesClient = new PlacesClient({ apiKey });
    
    // Build the request
    const request = {
      name: photoName,
      maxWidth,
      maxHeight
    };

    // Make the request
    const response = await placesClient.getPhoto(request);
    
    // Return the photo URL if available
    if (response && response.data) {
      return `data:image/jpeg;base64,${response.data.toString('base64')}`;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting place photo:', error);
    return null;
  }
}

/**
 * Get details for a specific place
 * @param {string} placeId - The place ID
 * @param {string} apiKey - Google API key
 * @returns {Promise<Object|null>} - Place details or null if unavailable
 */
export async function getPlaceDetails(placeId, apiKey) {
  if (!placeId || !apiKey) {
    throw new Error('Place ID and API key are required');
  }

  try {
    // Create Places Client
    const placesClient = new PlacesClient({ apiKey });
    
    // Build the request
    const request = {
      name: `places/${placeId}`,
    };

    // Make the request
    const response = await placesClient.getPlace(request, {
      otherArgs: {
        headers: {
          'X-Goog-FieldMask': '*',
        },
      },
    });

    // Return the place details if available
    return response[0] || null;
  } catch (error) {
    console.error('Error getting place details:', error);
    return null;
  }
} 