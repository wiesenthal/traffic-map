"use client";

import { useEffect, useState, useRef } from "react";
import { api } from "~/trpc/react";
import dynamic from "next/dynamic";

// Dynamically import the map component to avoid SSR issues
const TrafficMapDisplay = dynamic(() => import("./traffic-map-display"), {
  ssr: false,
  loading: () => (
    <div className="flex h-96 w-full items-center justify-center bg-gray-100">
      <div className="text-lg">Loading map...</div>
    </div>
  ),
});

interface TravelTimeData {
  origin: string; // Now using address string
  neighborhood: string;
  duration: number;
  distance: number;
  status: string;
}

export function TrafficHeatmap() {
  const [selectedTime, setSelectedTime] = useState<"rush" | "offpeak">("rush");
  const [isLoading, setIsLoading] = useState(false);
  const [travelData, setTravelData] = useState<{
    rush: TravelTimeData[];
    offpeak: TravelTimeData[];
  }>({
    rush: [],
    offpeak: [],
  });

  // Oakland destination coordinates (2140 Mandela Pkwy, Oakland, CA 94607)
  const destination = { lat: 37.8199, lng: -122.2946 };

  // Get SF addresses
  const { data: addresses } = api.traffic.getSanFranciscoGrid.useQuery();

  // Create tRPC utils for imperative calls
  const utils = api.useUtils();

  // Fetch travel times for both rush and off-peak
  const fetchTravelTimes = async (timeType: "rush" | "offpeak") => {
    if (!addresses?.length) return;

    setIsLoading(true);
    
    try {
      console.log(`Starting ${timeType} data fetch for ${addresses.length} addresses`);
      
      // Split addresses into smaller batches (Google Maps API has limits)
      const batchSize = 25; // Process 25 addresses at a time
      const batches = [];
      
      for (let i = 0; i < addresses.length; i += batchSize) {
        batches.push(addresses.slice(i, i + batchSize));
      }

      console.log(`Processing ${batches.length} batches for ${timeType}`);
      const allResults: TravelTimeData[] = [];

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex]!;
        try {
          console.log(`Fetching batch ${batchIndex + 1}/${batches.length} with ${batch.length} addresses`);
          
          const response = await utils.traffic.getTravelTimes.fetch({
            origins: batch,
            destination,
            departureTime: timeType,
          });
          
          console.log(`Batch ${batchIndex + 1} returned ${response.results.length} results`);
          console.log(`Results status breakdown:`, response.results.map(r => r.status));
          
          allResults.push(...response.results);
          
          // Add a small delay between batches to respect API rate limits
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.error(`Error fetching batch ${batchIndex + 1} for ${timeType}:`, error);
          // Continue with other batches even if one fails
        }
      }

      console.log(`Total results for ${timeType}: ${allResults.length}`);
      console.log(`Valid results (status OK):`, allResults.filter(r => r.status === 'OK').length);
      
      setTravelData(prev => ({
        ...prev,
        [timeType]: allResults,
      }));
    } catch (error) {
      console.error(`Error fetching ${timeType} travel times:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAllData = async () => {
    await fetchTravelTimes("rush");
    await fetchTravelTimes("offpeak");
  };

  const getCurrentData = () => {
    return travelData[selectedTime];
  };

  const getColorIntensity = (duration: number, minDuration: number, maxDuration: number) => {
    // Convert seconds to minutes
    const minutes = duration / 60;
    const minMinutes = minDuration / 60;
    const maxMinutes = maxDuration / 60;
    
    // Normalize the duration to a 0-1 scale based on actual data range
    const normalizedValue = maxMinutes > minMinutes ? 
      (minutes - minMinutes) / (maxMinutes - minMinutes) : 0;
    
    // Create a smooth color gradient from green (fast) to red (slow)
    const intensity = Math.max(0, Math.min(1, normalizedValue));
    
    // Green to Yellow to Red gradient
    let red, green, blue;
    if (intensity <= 0.5) {
      // Green to Yellow (first half)
      red = Math.floor(255 * intensity * 2); // 0 to 255
      green = 255; // stay at 255
      blue = 0;
    } else {
      // Yellow to Red (second half)
      red = 255; // stay at 255
      green = Math.floor(255 * (1 - (intensity - 0.5) * 2)); // 255 to 0
      blue = 0;
    }
    
    return { 
      color: `rgb(${red}, ${green}, ${blue})`, 
      intensity: 0.3 + intensity * 0.7 // Size range from 0.3 to 1.0
    };
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6">
      <div className="mb-2">
        <h1 className="text-3xl font-bold text-center mb-2">
          San Francisco to Oakland Traffic Heatmap
        </h1>
        <p className="text-center text-gray-600 mb-2">
          Travel times from various San Francisco locations to 2140 Mandela Pkwy, Oakland, CA
        </p>
        
        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-2">
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedTime("rush")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedTime === "rush"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              Rush Hour (5 PM)
            </button>
            <button
              onClick={() => setSelectedTime("offpeak")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedTime === "offpeak"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              Off-Peak (3 AM)
            </button>
          </div>
          
          <button
            onClick={() => void loadAllData()}
            disabled={isLoading}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              isLoading
                ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                : "bg-green-500 text-white hover:bg-green-600"
            }`}
          >
            {isLoading ? "Loading Traffic Data..." : "Load Traffic Data"}
          </button>
        </div>

        {/* Dynamic Legend */}
        {(() => {
          const validData = getCurrentData().filter(d => d.status === 'OK' && d.duration > 0);
          if (validData.length === 0) {
            return (
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-400 rounded"></div>
                  <span className="text-sm">Fast</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-400 rounded"></div>
                  <span className="text-sm">Medium</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-400 rounded"></div>
                  <span className="text-sm">Slow</span>
                </div>
              </div>
            );
          }

          const durations = validData.map(d => d.duration);
          const minMinutes = Math.round(Math.min(...durations) / 60);
          const maxMinutes = Math.round(Math.max(...durations) / 60);
          const avgMinutes = Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length / 60);

          return (
            <div className="flex items-center justify-center gap-6 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span className="text-sm font-medium">Fast: {minMinutes} min</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                <span className="text-sm font-medium">Avg: {avgMinutes} min</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span className="text-sm font-medium">Slow: {maxMinutes} min</span>
              </div>
            </div>
          );
        })()}

      </div>

      {/* Map */}
      <div className="md:h-[700px] w-full border rounded-lg overflow-hidden shadow-lg">
        <TrafficMapDisplay
          data={getCurrentData()}
          destination={destination}
          getColorIntensity={getColorIntensity}
          selectedTime={selectedTime}
        />
      </div>

    </div>
  );
} 