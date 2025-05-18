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

    // Enhanced system message for query generation
    const querySystemMessage = {
        role: "system",
        content: `You are a travel planning assistant specializing in generating search queries for Google Maps Places API.

        ${tripInfoText}

        You are a travel planner, and are generating queries for Google searches. you must include the city/location name in the queries.

        Rules for generating queries:
        Each query should be on a new line
        Don't include numbers or bullet points
        No additional text, just the queries.
        Queries must be vague but must represent the client's interests
        Generate 3 to 5 queries.
        Must not use descriptors, such as famous, unique, scenic, popular, etc.
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

        console.log("Generated queries:", queries);
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
            `${city} restaurants`,
            `${city} parks`,
            `${city} shopping`
        ];
    }
}

async function callSearchText(userInput) {
    console.log("callSearchText called with input:", userInput);
    const apiKey = "AIzaSyDyTdbCPyvwEzpwnjuarkSmfQGnqAgAIn0";
    const placesClient = new PlacesClient({ apiKey });
    const queries = userInput;
    const placeList = {};
    for (const query of queries) {
    const request = {
        textQuery: query,
    };

    const response = await placesClient.searchText(request, {
        otherArgs: {
          headers: {
            'X-Goog-FieldMask': '*',
          },
        },
      });
    const places = response[0].places;
    console.log("places: ", places);
    if (places.length > 0) {
      for (const place of places) {
          console.log("place: ", place.displayName.text);
          if (!placeList[query]) {
              placeList[query] = place.displayName.text;
          } else {
              placeList[query] += ", " + place.displayName.text;
          }
      }
    }
  }
  console.log("--------------------------------")
  console.log(placeList);
  return placeList;
}

export async function getLocations(userInput, tripDetails) {
    const queries = await generateQueries(userInput, tripDetails);
    const placeList = await callSearchText(queries);
    return placeList;
}