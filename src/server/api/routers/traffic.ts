import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { env } from "~/env";

// Routes API response types
interface Location {
  latLng: {
    latitude: number;
    longitude: number;
  };
}

interface RouteMatrixElement {
  status: {
    code: number;
    message?: string;
  };
  duration?: string;
  distanceMeters?: number;
  staticDuration?: string;
}

interface RouteMatrixResponse {
  originIndex?: number;
  destinationIndex?: number;
  status?: {
    code?: number;
    message?: string;
  };
  duration?: string;
  distanceMeters?: number;
  staticDuration?: string;
  condition?: string;
}

// Real San Francisco addresses for accurate routing (optimized for East Bay commutes)
const SF_ADDRESSES = [
  // Major intersections and landmarks
  { address: "Market St & Montgomery St, San Francisco, CA", name: "Financial District" },
  { address: "Union Square, San Francisco, CA", name: "Union Square" },
  { address: "Chinatown, San Francisco, CA", name: "Chinatown" },
  { address: "North Beach, San Francisco, CA", name: "North Beach" },
  { address: "Fisherman's Wharf, San Francisco, CA", name: "Fisherman's Wharf" },
  
  // SOMA and Mission Bay (close to Bay Bridge)
  { address: "SOMA, San Francisco, CA", name: "SOMA" },
  { address: "Mission Bay, San Francisco, CA", name: "Mission Bay" },
  { address: "Potrero Hill, San Francisco, CA", name: "Potrero Hill" },
  
  // Mission District (central)
  { address: "Mission District, San Francisco, CA", name: "Mission District" },
  { address: "16th Street Mission BART, San Francisco, CA", name: "16th St Mission" },
  { address: "24th Street Mission BART, San Francisco, CA", name: "24th St Mission" },
  
  // Castro and Noe Valley
  { address: "Castro District, San Francisco, CA", name: "Castro" },
  { address: "Noe Valley, San Francisco, CA", name: "Noe Valley" },
  
  // Hayes Valley and Haight
  { address: "Hayes Valley, San Francisco, CA", name: "Hayes Valley" },
  { address: "Haight Ashbury, San Francisco, CA", name: "Haight-Ashbury" },
  
  // Richmond District (key locations)
  { address: "Inner Richmond, San Francisco, CA", name: "Inner Richmond" },
  { address: "Outer Richmond, San Francisco, CA", name: "Outer Richmond" },
  { address: "Geary Blvd & 19th Ave, San Francisco, CA", name: "Richmond (Geary)" },
  
  // Sunset District (key locations)
  { address: "Inner Sunset, San Francisco, CA", name: "Inner Sunset" },
  { address: "Outer Sunset, San Francisco, CA", name: "Outer Sunset" },
  
  // Pacific Heights and Marina
  { address: "Pacific Heights, San Francisco, CA", name: "Pacific Heights" },
  { address: "Marina District, San Francisco, CA", name: "Marina District" },
  { address: "Russian Hill, San Francisco, CA", name: "Russian Hill" },
  { address: "Nob Hill, San Francisco, CA", name: "Nob Hill" },
  
  // Additional North Beach and Marina points
  { address: "Columbus Ave & Broadway, San Francisco, CA", name: "North Beach (Broadway)" },
  { address: "Chestnut St & Fillmore St, San Francisco, CA", name: "Marina (Chestnut)" },
  { address: "Palace of Fine Arts, San Francisco, CA", name: "Palace of Fine Arts" },
  
  // Additional Pacific Heights points
  { address: "Fillmore St & California St, San Francisco, CA", name: "Pac Heights (Fillmore)" },
  { address: "Divisadero St & California St, San Francisco, CA", name: "Pac Heights (Divisadero)" },
  
  // Additional Richmond District points
  { address: "Clement St & 6th Ave, San Francisco, CA", name: "Inner Richmond (Clement)" },
  { address: "Clement St & 19th Ave, San Francisco, CA", name: "Mid Richmond (Clement)" },
  
  // Western Addition and Fillmore
  { address: "Western Addition, San Francisco, CA", name: "Western Addition" },
  { address: "Fillmore District, San Francisco, CA", name: "Fillmore" },
  { address: "Japantown, San Francisco, CA", name: "Japantown" },
  { address: "Alamo Square, San Francisco, CA", name: "Alamo Square" },
  
  // Presidio Area
  { address: "Presidio, San Francisco, CA", name: "Presidio" },
  { address: "Presidio Heights, San Francisco, CA", name: "Presidio Heights" },
  
  // Central Areas
  { address: "West Portal, San Francisco, CA", name: "West Portal" },
  { address: "Twin Peaks, San Francisco, CA", name: "Twin Peaks" },
  
  // BART Stations (crucial for East Bay commutes)
  { address: "Powell Street BART, San Francisco, CA", name: "Powell BART" },
  { address: "Montgomery Street BART, San Francisco, CA", name: "Montgomery BART" },
  { address: "Civic Center BART, San Francisco, CA", name: "Civic Center BART" },
  
  // Universities and landmarks
  { address: "UCSF Parnassus, San Francisco, CA", name: "UCSF Parnassus" },
  { address: "USF, San Francisco, CA", name: "University of San Francisco" },
  { address: "Golden Gate Park, San Francisco, CA", name: "Golden Gate Park" },
  
  // Additional key streets and areas
  { address: "Van Ness Ave & Geary St, San Francisco, CA", name: "Van Ness Corridor" },
  { address: "Market St & Castro St, San Francisco, CA", name: "Castro Station" },
  { address: "Irving St & 19th Ave, San Francisco, CA", name: "Inner Sunset (Irving)" },
  
  // Southern Mission (close to East Bay)
  { address: "Bernal Heights, San Francisco, CA", name: "Bernal Heights" },
  { address: "Dogpatch, San Francisco, CA", name: "Dogpatch" },
];

export const trafficRouter = createTRPCRouter({
  getTravelTimes: publicProcedure
    .input(
      z.object({
        origins: z.array(z.string()),
        destination: z.object({
          lat: z.number(),
          lng: z.number(),
        }),
        departureTime: z.enum(["rush", "offpeak"]),
      })
    )
    .query(async ({ input }) => {
      const { origins, destination, departureTime } = input;
      
      // Calculate departure time for the next occurrence
      const now = new Date();
      const targetHour = departureTime === "rush" ? 17 : 3; // 5PM or 3AM
      const targetDate = new Date(now);
      targetDate.setHours(targetHour, 0, 0, 0);
      
      // If target time has passed today, set for tomorrow
      if (targetDate <= now) {
        targetDate.setDate(targetDate.getDate() + 1);
      }

      console.log(`Routes API: Processing ${origins.length} origins to destination`);
      
      // Build Routes API request body according to official docs
      const requestBody = {
        origins: origins.map(address => ({
          waypoint: {
            address: address
          }
        })),
        destinations: [{
          waypoint: {
            location: {
              latLng: {
                latitude: destination.lat,
                longitude: destination.lng
              }
            }
          }
        }],
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        departureTime: targetDate.toISOString()
      };

      console.log(`Routes API request body:`, JSON.stringify(requestBody, null, 2));
      
      try {
        const response = await fetch(
          'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY,
              'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,status,condition'
            },
            body: JSON.stringify(requestBody)
          }
        );

        console.log(`Routes API response status: ${response.status}`);
        console.log(`Routes API response headers:`, response.headers);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Routes API error response:`, errorText);
          throw new Error(`Routes API error: ${response.status} - ${errorText}`);
        }

        const responseText = await response.text();
        console.log(`Routes API raw response:`, responseText);
        
        if (!responseText.trim()) {
          throw new Error('Empty response from Routes API');
        }

        const data: unknown = JSON.parse(responseText);
        console.log(`Routes API parsed response:`, JSON.stringify(data, null, 2));

        // Parse Routes API response - according to docs, it returns an array directly
        const routeMatrix = Array.isArray(data) ? data as RouteMatrixResponse[] : [data as RouteMatrixResponse];
        
        const results = routeMatrix.map((element) => {
          const originIndex = element.originIndex ?? 0;
          const originAddress = origins[originIndex] ?? "Unknown";
          const neighborhood = SF_ADDRESSES.find(addr => addr.address === originAddress);
          
          // Parse duration from ISO 8601 format (e.g., "1234s" -> 1234)
          const durationSeconds = element.duration ? 
            parseFloat(element.duration.replace('s', '')) : 0;
          
          // Check status - according to docs, empty status object means success
          const isSuccess = !element.status || Object.keys(element.status).length === 0;
          const status = isSuccess ? 'OK' : 'FAILED';
          
          console.log(`Origin ${originIndex}: "${originAddress}" -> Status: ${status}, Duration: ${durationSeconds}s, Condition: ${element.condition ?? 'unknown'}`);
          
          return {
            origin: originAddress,
            neighborhood: neighborhood?.name ?? "Unknown Location",
            duration: durationSeconds,
            distance: element.distanceMeters ?? 0,
            status: status,
          };
        });

        console.log(`Routes API valid results: ${results.filter(r => r.status === 'OK').length}/${results.length}`);
        
        return {
          results,
          departureTime: departureTime,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        console.error('Routes API error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to fetch traffic data: ${errorMessage}`);
      }
    }),

  getTravelTimesMultiDestination: publicProcedure
    .input(
      z.object({
        origins: z.array(z.string()),
        destinations: z.array(z.object({
          id: z.string(),
          name: z.string(),
          address: z.string(),
          lat: z.number(),
          lng: z.number(),
          weight: z.number().default(1),
        })),
        departureTime: z.enum(["rush", "offpeak"]),
      })
    )
    .query(async ({ input }) => {
      const { origins, destinations, departureTime } = input;
      
      // Calculate departure time for the next occurrence
      const now = new Date();
      const targetHour = departureTime === "rush" ? 17 : 3; // 5PM or 3AM
      const targetDate = new Date(now);
      targetDate.setHours(targetHour, 0, 0, 0);
      
      // If target time has passed today, set for tomorrow
      if (targetDate <= now) {
        targetDate.setDate(targetDate.getDate() + 1);
      }

      console.log(`Routes API Multi-Destination: Processing ${origins.length} origins to ${destinations.length} destinations`);
      
      const allResults: Array<{
        destinationId: string;
        destinationName: string;
        destinationAddress: string;
        results: Array<{
          origin: string;
          neighborhood: string;
          duration: number;
          distance: number;
          status: string;
        }>;
      }> = [];

      // Process each destination separately
      for (const destination of destinations) {
        try {
          const requestBody = {
            origins: origins.map(address => ({
              waypoint: {
                address: address
              }
            })),
            destinations: [{
              waypoint: {
                location: {
                  latLng: {
                    latitude: destination.lat,
                    longitude: destination.lng
                  }
                }
              }
            }],
            travelMode: "DRIVE",
            routingPreference: "TRAFFIC_AWARE",
            departureTime: targetDate.toISOString()
          };

          const response = await fetch(
            'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY,
                'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,status,condition'
              },
              body: JSON.stringify(requestBody)
            }
          );

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Routes API error for destination ${destination.name}:`, errorText);
            continue;
          }

          const responseText = await response.text();
          if (!responseText.trim()) {
            console.error(`Empty response for destination ${destination.name}`);
            continue;
          }

          const data: unknown = JSON.parse(responseText);
          const routeMatrix = Array.isArray(data) ? data as RouteMatrixResponse[] : [data as RouteMatrixResponse];
          
          const results = routeMatrix.map((element) => {
            const originIndex = element.originIndex ?? 0;
            const originAddress = origins[originIndex] ?? "Unknown";
            const neighborhood = SF_ADDRESSES.find(addr => addr.address === originAddress);
            
            const durationSeconds = element.duration ? 
              parseFloat(element.duration.replace('s', '')) : 0;
            
            const isSuccess = !element.status || Object.keys(element.status).length === 0;
            const status = isSuccess ? 'OK' : 'FAILED';
            
            return {
              origin: originAddress,
              neighborhood: neighborhood?.name ?? "Unknown Location",
              duration: durationSeconds,
              distance: element.distanceMeters ?? 0,
              status: status,
            };
          });

          allResults.push({
            destinationId: destination.id,
            destinationName: destination.name,
            destinationAddress: destination.address,
            results
          });

          // Add delay between destinations to respect API limits
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          console.error(`Error processing destination ${destination.name}:`, error);
        }
      }
      
      return {
        destinations: allResults,
        departureTime: departureTime,
        timestamp: new Date().toISOString(),
      };
    }),

  geocodeAddress: publicProcedure
    .input(z.object({
      address: z.string(),
    }))
    .query(async ({ input }) => {
      const { address } = input;
      
      try {
        console.log(`Geocoding address: ${address}`);
        
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${env.GOOGLE_MAPS_API_KEY}`
        );

        if (!response.ok) {
          throw new Error(`Geocoding API error: ${response.status}`);
        }

        const data = await response.json() as {
          status: string;
          results: Array<{
            geometry: {
              location: {
                lat: number;
                lng: number;
              };
            };
            formatted_address: string;
          }>;
        };

        if (data.status !== 'OK' || data.results.length === 0) {
          throw new Error(`Geocoding failed: ${data.status}`);
        }

        const result = data.results[0]!;
        console.log(`Geocoded "${address}" to:`, result.geometry.location);

        return {
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng,
          formatted_address: result.formatted_address,
        };
      } catch (error) {
        console.error('Geocoding error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to geocode address: ${errorMessage}`);
      }
    }),

  getSanFranciscoGrid: publicProcedure
    .query(async () => {
      return SF_ADDRESSES.map(addr => addr.address);
    }),

  getDefaultDestinations: publicProcedure
    .query(async () => {
      return [
        {
          id: "oakland-mandela",
          name: "Oakland Office",
          address: "2140 Mandela Pkwy, Oakland, CA 94607",
          lat: 37.8199,
          lng: -122.2946,
          weight: 5, // 5 times per week
        },
        {
          id: "palo-alto",
          name: "Palo Alto Office", 
          address: "University Ave, Palo Alto, CA 94301",
          lat: 37.4419,
          lng: -122.1430,
          weight: 2, // 2 times per week
        },
        {
          id: "san-jose",
          name: "San Jose Client",
          address: "Downtown San Jose, CA 95113",
          lat: 37.3382,
          lng: -121.8863,
          weight: 1, // 1 time per week
        }
      ];
    }),
}); 