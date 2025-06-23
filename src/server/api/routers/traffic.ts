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

// Real San Francisco addresses for accurate routing
const SF_ADDRESSES = [
  // Major intersections and landmarks
  { address: "Market St & Montgomery St, San Francisco, CA", name: "Financial District" },
  { address: "Union Square, San Francisco, CA", name: "Union Square" },
  { address: "Chinatown, San Francisco, CA", name: "Chinatown" },
  { address: "North Beach, San Francisco, CA", name: "North Beach" },
  { address: "Fisherman's Wharf, San Francisco, CA", name: "Fisherman's Wharf" },
  
  // SOMA and Mission Bay
  { address: "SOMA, San Francisco, CA", name: "SOMA" },
  { address: "Mission Bay, San Francisco, CA", name: "Mission Bay" },
  { address: "Potrero Hill, San Francisco, CA", name: "Potrero Hill" },
  
  // Mission District
  { address: "Mission District, San Francisco, CA", name: "Mission District" },
  { address: "16th Street Mission BART, San Francisco, CA", name: "16th St Mission" },
  { address: "24th Street Mission BART, San Francisco, CA", name: "24th St Mission" },
  { address: "Bernal Heights, San Francisco, CA", name: "Bernal Heights" },
  
  // Castro and Noe Valley
  { address: "Castro District, San Francisco, CA", name: "Castro" },
  { address: "Noe Valley, San Francisco, CA", name: "Noe Valley" },
  { address: "Glen Park, San Francisco, CA", name: "Glen Park" },
  
  // Hayes Valley and Haight
  { address: "Hayes Valley, San Francisco, CA", name: "Hayes Valley" },
  { address: "Haight Ashbury, San Francisco, CA", name: "Haight-Ashbury" },
  { address: "Lower Haight, San Francisco, CA", name: "Lower Haight" },
  { address: "Cole Valley, San Francisco, CA", name: "Cole Valley" },
  
  // Richmond District
  { address: "Richmond District, San Francisco, CA", name: "Richmond District" },
  { address: "Inner Richmond, San Francisco, CA", name: "Inner Richmond" },
  { address: "Outer Richmond, San Francisco, CA", name: "Outer Richmond" },
  { address: "Geary Blvd & 38th Ave, San Francisco, CA", name: "Richmond (Geary)" },
  
  // Sunset District
  { address: "Sunset District, San Francisco, CA", name: "Sunset District" },
  { address: "Inner Sunset, San Francisco, CA", name: "Inner Sunset" },
  { address: "Outer Sunset, San Francisco, CA", name: "Outer Sunset" },
  { address: "Ocean Beach, San Francisco, CA", name: "Ocean Beach" },
  
  // Pacific Heights and Marina - Enhanced Coverage
  { address: "Pacific Heights, San Francisco, CA", name: "Pacific Heights" },
  { address: "Marina District, San Francisco, CA", name: "Marina District" },
  { address: "Cow Hollow, San Francisco, CA", name: "Cow Hollow" },
  { address: "Russian Hill, San Francisco, CA", name: "Russian Hill" },
  { address: "Nob Hill, San Francisco, CA", name: "Nob Hill" },
  
  // Additional North Beach points
  { address: "Washington Square Park, San Francisco, CA", name: "Washington Square" },
  { address: "Columbus Ave & Broadway, San Francisco, CA", name: "North Beach (Broadway)" },
  { address: "Columbus Ave & Union St, San Francisco, CA", name: "North Beach (Union)" },
  { address: "Lombard St & Hyde St, San Francisco, CA", name: "Russian Hill (Lombard)" },
  { address: "Hyde St & Greenwich St, San Francisco, CA", name: "Russian Hill (Hyde)" },
  
  // Additional Marina District points
  { address: "Chestnut St & Fillmore St, San Francisco, CA", name: "Marina (Chestnut)" },
  { address: "Marina Blvd & Webster St, San Francisco, CA", name: "Marina Waterfront" },
  { address: "Palace of Fine Arts, San Francisco, CA", name: "Palace of Fine Arts" },
  { address: "Crissy Field, San Francisco, CA", name: "Crissy Field" },
  
  // Additional Pacific Heights points
  { address: "Fillmore St & California St, San Francisco, CA", name: "Pac Heights (Fillmore)" },
  { address: "Divisadero St & California St, San Francisco, CA", name: "Pac Heights (Divisadero)" },
  { address: "Sacramento St & Presidio Ave, San Francisco, CA", name: "Pac Heights (Sacramento)" },
  { address: "Jackson St & Webster St, San Francisco, CA", name: "Pac Heights (Jackson)" },
  
  // Additional Richmond District points
  { address: "Clement St & 6th Ave, San Francisco, CA", name: "Inner Richmond (Clement)" },
  { address: "Clement St & 19th Ave, San Francisco, CA", name: "Mid Richmond (Clement)" },
  { address: "Clement St & 33rd Ave, San Francisco, CA", name: "Outer Richmond (Clement)" },
  { address: "Geary Blvd & 19th Ave, San Francisco, CA", name: "Richmond (Geary/19th)" },
  { address: "Geary Blvd & 25th Ave, San Francisco, CA", name: "Richmond (Geary/25th)" },
  { address: "Balboa St & 19th Ave, San Francisco, CA", name: "Richmond (Balboa)" },
  { address: "California St & 19th Ave, San Francisco, CA", name: "Richmond (California)" },
  
  // Western Addition and Fillmore
  { address: "Western Addition, San Francisco, CA", name: "Western Addition" },
  { address: "Fillmore District, San Francisco, CA", name: "Fillmore" },
  { address: "Japantown, San Francisco, CA", name: "Japantown" },
  { address: "Alamo Square, San Francisco, CA", name: "Alamo Square" },
  
  // Presidio Area
  { address: "Presidio, San Francisco, CA", name: "Presidio" },
  { address: "Presidio Heights, San Francisco, CA", name: "Presidio Heights" },
  { address: "Laurel Heights, San Francisco, CA", name: "Laurel Heights" },
  
  // Southern SF
  { address: "Dogpatch, San Francisco, CA", name: "Dogpatch" },
  { address: "Bayview, San Francisco, CA", name: "Bayview" },
  { address: "Hunters Point, San Francisco, CA", name: "Hunters Point" },
  { address: "Excelsior, San Francisco, CA", name: "Excelsior" },
  { address: "Visitacion Valley, San Francisco, CA", name: "Visitacion Valley" },
  
  // Central Areas
  { address: "West Portal, San Francisco, CA", name: "West Portal" },
  { address: "Forest Hill, San Francisco, CA", name: "Forest Hill" },
  { address: "Twin Peaks, San Francisco, CA", name: "Twin Peaks" },
  { address: "Diamond Heights, San Francisco, CA", name: "Diamond Heights" },
  
  // BART Stations
  { address: "Powell Street BART, San Francisco, CA", name: "Powell BART" },
  { address: "Montgomery Street BART, San Francisco, CA", name: "Montgomery BART" },
  { address: "Civic Center BART, San Francisco, CA", name: "Civic Center BART" },
  
  // Universities and landmarks
  { address: "UCSF Parnassus, San Francisco, CA", name: "UCSF Parnassus" },
  { address: "USF, San Francisco, CA", name: "University of San Francisco" },
  { address: "Golden Gate Park, San Francisco, CA", name: "Golden Gate Park" },
  
  // Additional major streets
  { address: "Van Ness Ave & Geary St, San Francisco, CA", name: "Van Ness Corridor" },
  { address: "Market St & Castro St, San Francisco, CA", name: "Castro Station" },
  { address: "Irving St & 19th Ave, San Francisco, CA", name: "Inner Sunset (Irving)" },
  { address: "Taraval St & 19th Ave, San Francisco, CA", name: "Sunset (Taraval)" },
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

  getSanFranciscoGrid: publicProcedure
    .query(async () => {
      return SF_ADDRESSES.map(addr => addr.address);
    }),
}); 