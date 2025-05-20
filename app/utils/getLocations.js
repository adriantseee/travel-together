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
    return placeList;
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
        
        // Process each place to include full details including reviews
        const processedPlaces = await Promise.all(uniquePlaces.map(async place => {
          // Try to fetch detailed place information including reviews

          
          // Extract and structure meaningful data
          let reviews = []
          for (const review of place.reviews) {
            reviews.push({
              text: review.text,
              originalText: review.originalText,
            })
          }
          console.log("processed places:", place)
          return {
            id: place.id,
            name: place.displayName?.text || 'Unknown location',
            formattedAddress: place.formattedAddress,
            location: place.location,
            rating: place.rating,
            reviews: reviews,
            websiteUri: place.websiteUri,
            internationalPhoneNumber: place.internationalPhoneNumber,
            nationalPhoneNumber: place.nationalPhoneNumber,
            priceLevel: place.priceLevel,
            businessStatus: place.businessStatus,
            types: place.types,
            photos: place.photos,
          };
        }));
        
        // Store processed places in the results
        placeList[query] = processedPlaces;
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