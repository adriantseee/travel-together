import Together from "together-ai";
const {PlacesClient} = require('@googlemaps/places').v1;
// Initialize Together client with API key from environment variables
const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY || "tgp_v1_ab9-aj1HMGApkAIJn6kDYk-B1mC_Eza9UFIb2VVW7Ng";
const together = new Together({
  apiKey: TOGETHER_API_KEY
});

// Google Maps API key
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

export async function generateQueries(userInput, tripDetails) {
    console.log("generateQueries called with input:", { 
      userInput: userInput, 
      tripDetailsProvided: !!tripDetails 
    });

    // Extract the user's latest message
    const userMessage = userInput;
    const destinationCity = tripDetails?.city || '';
    const destinationCountry = tripDetails?.country || '';

    // Format trip details for inclusion in the prompt
    let tripInfoText = "No specific trip details available.";
    if (tripDetails) {
      const {
        city, country, startDate, endDate, latitude, longitude,
        travelers, budget = []
      } = tripDetails;

      tripInfoText = `Trip Information:
- Destination: ${city || 'Unknown'}, ${country || 'Unknown'}
- Dates: ${startDate ? new Date(startDate).toLocaleDateString() : 'Unknown'} to ${endDate ? new Date(endDate).toLocaleDateString() : 'Unknown'}
- Coordinates: ${latitude || 'Unknown'}, ${longitude || 'Unknown'}
- Number of travelers: ${travelers || 'Unknown'}
- Budget level: ${budget || 'Unknown'}`;
    }

    // Enhanced system message for query generation with stronger emphasis on location
    const querySystemMessage = {
        role: "system",
        content: `You are a travel planning assistant specializing in generating search queries for Google Maps Places API.

        ${tripInfoText}

        You are a travel planner, and are generating queries for Google searches specifically for ${destinationCity}${destinationCountry ? `, ${destinationCountry}` : ''}.

        Rules for generating queries:
        1. ALWAYS include "${destinationCity}" in EVERY query - this is CRITICAL
        2. Each query should be on a new line
        3. Don't include numbers or bullet points
        4. No additional text, just the queries
        5. Generate 3 to 5 queries that represent the client's interests
        6. Must not use descriptors, such as famous, unique, scenic, popular, etc.
        7. Focus ONLY on locations in ${destinationCity}${destinationCountry ? `, ${destinationCountry}` : ''}, not anywhere else
        `
    }

    try {
        const queryResponse = await together.chat.completions.create({
            model: "deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free",
            messages: [querySystemMessage, { role: "user", content: userMessage }],
            temperature: 0.3,
            stream: false,
        });

        const responseContent = queryResponse.choices[0].message.content;
        console.log("Raw LLM response:", responseContent);
        
        let queries = [];
        
        // Check if the response contains the </think> marker
        if (responseContent.includes("</think>")) {
            // Extract everything after the </think> tag
            const contentAfterThinking = responseContent.split("</think>")[1].trim();
            console.log("Content after thinking:", contentAfterThinking);
            
            // Split by newlines and clean up
            queries = contentAfterThinking.split('\n')
                .map(query => query.trim())
                .filter(query => query !== '');
        } else {
            // Fallback to the original parsing approach
            queries = responseContent.split('\n')
                .map(query => query.trim())
                .filter(query => query !== '' && !query.includes("<think>") && !query.includes("</think>"));
        }

        // Ensure each query includes the destination city if it's available
        if (destinationCity) {
            queries = queries.map(query => {
                if (!query.toLowerCase().includes(destinationCity.toLowerCase())) {
                    return `${query} in ${destinationCity}`;
                }
                return query;
            });
        }

        console.log("Generated queries with destination enforced:", queries);
        return queries;
    } catch (error) {
        console.error("Error generating queries:", error);
        // Return default queries based on the user's message as a fallback
        const city = tripDetails?.city || "this destination";
        return [
            `${city} attractions`,
            `${city} sightseeing`,
            `${city} museums`,
            `${city} landmarks`,
            `${city} restaurants`
        ];
    }
}

export async function getLocations(userInput, tripDetails) {
    const queries = await generateQueries(userInput, tripDetails);
    // Pass tripDetails to callSearchText to enable location biasing
    const placeList = await callSearchText(queries, tripDetails);
    
    // Generate curated content with AI reviews
    const curatedResults = await generateCuratedResults(placeList, userInput, tripDetails);
    
    // Return both raw place list and curated results
    return {
      rawPlaceList: placeList,
      curatedResults
    };
}

async function callSearchText(queries, tripDetails) {
  console.log("callSearchText called with queries:", queries);
    const apiKey = "AIzaSyDyTdbCPyvwEzpwnjuarkSmfQGnqAgAIn0";
    const placesClient = new PlacesClient({ apiKey });
    const placeList = {};
  
  // Extract trip coordinates for location biasing
  const locationBias = {};
  if (tripDetails) {
    if (tripDetails.latitude && tripDetails.longitude) {
      // Create a location bias for the trip destination
      locationBias.circle = {
        center: {
          latitude: Number(tripDetails.latitude),
          longitude: Number(tripDetails.longitude)
        },
        radius: 50000 // 50km radius around the destination
      };
      console.log("Using location bias for search:", locationBias);
    } else if (tripDetails.city) {
      // If no coordinates but we have a city, include city in each query explicitly
      console.log("No coordinates available, enforcing city in queries");
    }
  }
  
    for (const query of queries) {
    // Ensure each query includes the destination city if available
    let searchQuery = query;
    
    // Check if query already includes city name
    const hasCity = tripDetails?.city && 
      query.toLowerCase().includes(tripDetails.city.toLowerCase());
      
    // For very specific queries, we want to keep the specificity but still add location context
    // Only append "in City" if the city isn't already in the query
    if (tripDetails?.city && !hasCity) {
      searchQuery = `${query} in ${tripDetails.city}`;
      console.log(`Modified query to include city: "${searchQuery}"`);
    }
    
    const request = {
      textQuery: searchQuery,
      // Add the location bias if available
      ...(Object.keys(locationBias).length > 0 && { 
        locationBias,
        // Maximum number of results to return
        maxResultCount: 10
      })
    };

    try {
    const response = await placesClient.searchText(request, {
        otherArgs: {
          headers: {
            'X-Goog-FieldMask': '*',
          },
        },
      });
      
      const places = response[0].places || [];
      console.log(`Found ${places.length || 0} places for query: "${searchQuery}"`);
      
      // If we get no results with location bias, try again without it for this specific query
      if ((places.length < 2) && Object.keys(locationBias).length > 0) {
        console.log(`Few or no results with location bias, trying again without bias for: "${searchQuery}"`);
        
        // Try again without location bias, but keep the city in the query text
        const fallbackRequest = {
          textQuery: searchQuery,
          maxResultCount: 10
        };
        
        try {
          const fallbackResponse = await placesClient.searchText(fallbackRequest, {
            otherArgs: {
              headers: {
                'X-Goog-FieldMask': '*',
              },
            },
          });
          
          const fallbackPlaces = fallbackResponse[0].places || [];
          console.log(`Found ${fallbackPlaces.length || 0} places without location bias`);
          
          if (fallbackPlaces && fallbackPlaces.length > 0) {
            places.push(...fallbackPlaces);
          }
        } catch (fallbackError) {
          console.error("Error in fallback search:", fallbackError);
        }
      }
      
      // Remove duplicates from the results by ID
      const uniquePlaces = [];
      const seenIds = new Set();
      
      if (places && places.length > 0) {
        places.forEach(place => {
          if (place.id && !seenIds.has(place.id)) {
            seenIds.add(place.id);
            uniquePlaces.push(place);
          }
        });
        
        console.log(`After removing duplicates: ${uniquePlaces.length} unique places remain`);
        
        // Just return the complete place data without filtering fields
        placeList[query] = uniquePlaces.map(place => {
          // Only process reviews to ensure we get the best text content
          if (place.reviews && Array.isArray(place.reviews)) {
            place.processedReviews = place.reviews.map(review => ({
              text: review.originalText || review.text || "",
              rating: review.rating,
              // Keep any other review fields that might be useful
              ...review
            }));
          }
          
          // Return the complete place object
          return place;
        });
        } else {
        placeList[query] = [];
      }
    } catch (error) {
      console.error("Error fetching data for query:", query, error);
      placeList[query] = `Error fetching results: ${error.message}`;
        }
    }
  
  console.log("--------------------------------");
  return placeList;
}

// Add this helper function to find a place by ID or by name
function findPlaceInList(placeList, placeId, placeName) {
  // First try to find by ID (more reliable)
  for (const queryPlaces of Object.values(placeList)) {
    if (Array.isArray(queryPlaces)) {
      const foundPlace = queryPlaces.find(p => p.id === placeId);
      if (foundPlace) return foundPlace;
    }
  }
  
  // If not found by ID, try to find by name
  if (placeName) {
    for (const queryPlaces of Object.values(placeList)) {
      if (Array.isArray(queryPlaces)) {
        const foundPlace = queryPlaces.find(p => {
          const pName = p.displayName?.text || p.name;
          return pName && pName.toLowerCase() === placeName.toLowerCase();
        });
        if (foundPlace) return foundPlace;
      }
    }
  }
  
  return null;
}

// New function to generate AI reviews and curate places
async function generateCuratedResults(placeList, userInput, tripDetails) {
  // Flatten all places from different queries into a single array
  const allPlaces = [];
  const seenIds = new Set();
  
  Object.entries(placeList).forEach(([query, places]) => {
    if (Array.isArray(places)) {
      places.forEach(place => {
        if (place && place.id && !seenIds.has(place.id)) {
          seenIds.add(place.id);
          allPlaces.push({
            query,
            place
          });
        }
      });
    }
  });
  
  console.log(`Preparing to generate curated reviews for ${allPlaces.length} unique places`);
  
  // If no places found, return early
  if (allPlaces.length === 0) {
    return {
      editorialContent: "I couldn't find any relevant places for your request.",
      curatedPlaces: []
    };
  }
  
  // Prepare the context for the LLM
  const destinationCity = tripDetails?.city || 'the destination';
  const destinationCountry = tripDetails?.country || '';
  const destination = `${destinationCity}${destinationCountry ? `, ${destinationCountry}` : ''}`;
  
  // Format trip details for inclusion in the prompt
  let tripInfoText = "No specific trip details available.";
  if (tripDetails) {
    const {
      city, country, startDate, endDate, travelers, budget
    } = tripDetails;

    tripInfoText = `Trip Information:
- Destination: ${city || 'Unknown'}, ${country || 'Unknown'}
- Dates: ${startDate ? new Date(startDate).toLocaleDateString() : 'Unknown'} to ${endDate ? new Date(endDate).toLocaleDateString() : 'Unknown'}
- Number of travelers: ${travelers || 'Unknown'}
- Budget level: ${budget || 'Unknown'}`;
  }
  
  // Prepare place data for the LLM
  const placesData = allPlaces.map(({ query, place }, index) => {
    // Format reviews if available
    let reviewsText = 'No reviews available.';
    if (place.reviews && place.reviews.length > 0) {
      reviewsText = place.reviews
        .map(review => `"${review.originalText || review.text || 'No text'}"`)
        .join('\n');
    } else if (place.processedReviews && place.processedReviews.length > 0) {
      // Use processed reviews if available (from our updated function)
      reviewsText = place.processedReviews
        .map(review => `"${review.text || 'No text'}"`)
        .join('\n');
    }
    
    // Format place types
    const typesText = place.types 
      ? place.types.join(', ') 
      : 'No type information available';
    
    // Format price level
    let priceText = 'Price level unknown';
    if (place.priceLevel !== undefined) {
      const priceLabels = ['Free', 'Inexpensive', 'Moderate', 'Expensive', 'Very Expensive'];
      priceText = priceLabels[place.priceLevel] || `Price level: ${place.priceLevel}`;
    }
    
    // Format rating - handle both object and direct value formats
    let ratingText = 'No rating available';
    if (place.rating) {
      const ratingValue = place.rating.value || place.rating;
      const ratingCount = place.rating.userRatingCount 
        ? ` (${place.rating.userRatingCount} reviews)` 
        : '';
      ratingText = `${ratingValue} stars${ratingCount}`;
    }
    
    // Get the name - handle both formats (displayName object or direct name property)
    const placeName = place.displayName?.text || place.name || 'Unknown location';
    
    return `Place ${index + 1}: ${placeName}
Type: ${typesText}
Address: ${place.formattedAddress || 'Address not available'}
Rating: ${ratingText}
Price: ${priceText}
Related Query: "${query}"
Sample Reviews:
${reviewsText}
`;
  }).join('\n\n');
  
  // Create the prompt for the LLM
  const systemMessage = {
    role: "system",
    content: `You are a travel expert and local guide for ${destination}. 
    
${tripInfoText}

The user is looking for: "${userInput}"

Below are details about places that might match their request, including type, ratings, prices, and visitor reviews:

${placesData}

Based on this information, please:
1. Write a short (2-3 sentences) personalized editorial review for each relevant place. This should mainly be based on the reviews, but you should also refer to the place types, ratings, prices, and other information (if provided).
2. Select 8-10 places maximum that best match the user's request and the trip context
3. For each selected place, include your editorial review, and why it's a good match for their request
4. Format your response in a conversational, helpful way that highlights the best matches first
5. If there are fewer than 8 places available, include all of them
6. If a place doesn't seem relevant to the user's request, don't include it
7. If there is ANY missing information, or if anything is unclear, you can keep the place in the response, but don't include missing information.
8. IMPORTANT: All your reviews, descriptions and outputs MUST be in English, regardless of the language in the reviews or place information.
9. If you see anything that is repeated often in the reviews, be sure to take that into account when writing your reviews (ie. if the place is known for something, you should mention that)
10. IMPORTANT: If there are any outstanding awards or recognitions, be sure to mention them in the reviews (ie. for restaurants, if the place has won a michelin star or some other cooking award, you should mention that).

Your response should be formatted as a JSON object with two fields:
1. "editorialContent" - A conversational introduction and summary of your recommendations (2-3 paragraphs)
2. "curatedPlaces" - An array of objects, each with:
   - "id" - The original place ID
   - "name" - The place name
   - "editorial" - Your personalized 2-3 sentence review`
  };
  
  try {
    console.log("Requesting AI-generated editorial content...");
    const response = await together.chat.completions.create({
      //model: "deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free",
      model: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
      messages: [systemMessage, { role: "user", content: "Please provide AI-curated travel recommendations based on the place information above." }],
      temperature: 0.7,
      response_format: { type: "json_object" },
      stream: false,
    });
    
    const responseContent = response.choices[0].message.content;
    console.log("Received AI editorial content");
    
    try {
      // Parse the JSON response
      const curatedResults = JSON.parse(responseContent);
      
      // Ensure expected structure exists
      if (!curatedResults.editorialContent) {
        curatedResults.editorialContent = "Based on your request, I've found some interesting places you might enjoy.";
      }
      
      if (!curatedResults.curatedPlaces || !Array.isArray(curatedResults.curatedPlaces)) {
        curatedResults.curatedPlaces = [];
      }
      
      // Add original place data to curated results
      if (curatedResults.curatedPlaces && Array.isArray(curatedResults.curatedPlaces)) {
        console.log("Processing curated places with original data...");
        
        curatedResults.curatedPlaces = curatedResults.curatedPlaces.map((curatedPlace, index) => {
          // Ensure minimum required fields
          if (!curatedPlace.editorial) {
            curatedPlace.editorial = "A great place to visit during your trip.";
          }
          
          // Find the original place data
          const originalPlaceData = allPlaces.find(({ place }) => {
            // Match by ID, handling both formats (direct ID or place.id)
            const placeId = place.id;
            const curatedId = curatedPlace.id;
            return placeId === curatedId;
          });
          
          let placeData = null;
          
          if (originalPlaceData) {
            // Ensure place has a consistent name property
            const place = originalPlaceData.place;
            if (place.displayName && place.displayName.text && !place.name) {
              place.name = place.displayName.text;
            }
            
            placeData = place;
          } else {
            // Try to find the place in the raw placeList by ID or name
            placeData = findPlaceInList(placeList, curatedPlace.id, curatedPlace.name);
          }
          
          // Debug log every fifth place to avoid log flooding
          if (index % 5 === 0) {
            console.log(`Place ${index+1} (${curatedPlace.name}) - Found original data:`, !!placeData);
            if (placeData) {
              console.log("  - Has photos:", !!placeData.photos);
              console.log("  - Has location:", !!placeData.location);
              console.log("  - Has types:", !!placeData.types);
            }
          }
          
          return {
            ...curatedPlace,
            placeData: placeData || {} // Use found data or empty object as fallback
          };
        });
      }
      
      return curatedResults;
    } catch (parseError) {
      console.error("Error parsing AI response as JSON:", parseError);
      return {
        editorialContent: "I found some interesting places, but couldn't generate custom reviews at this time.",
        curatedPlaces: []
      };
    }
  } catch (error) {
    console.error("Error generating AI reviews:", error);
    return {
      editorialContent: "I found some places that might interest you, but couldn't generate custom reviews at this time.",
      curatedPlaces: []
    };
  }
}