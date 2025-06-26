"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import dynamic from "next/dynamic";
import { DestinationManager, type Destination } from "./destination-manager";

// Dynamically import the map component to avoid SSR issues
const TrafficMapDisplay = dynamic(() => import("./traffic-map-display"), {
  ssr: false,
});

interface TravelTimeData {
  origin: string;
  neighborhood: string;
  duration: number;
  distance: number;
  status: string;
}

interface DestinationData {
  destinationId: string;
  destinationName: string;
  destinationAddress: string;
  results: TravelTimeData[];
}

interface MultiDestinationData {
  rush: DestinationData[];
  offpeak: DestinationData[];
}

type ViewMode = "individual" | "comparison";
type TimePeriod = "rush" | "offpeak" | "combined";
type DisplayMode = "weekly" | "per-trip";

export function TrafficHeatmap() {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [selectedTime, setSelectedTime] = useState<TimePeriod>("combined");
  const [selectedDestination, setSelectedDestination] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("individual");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("weekly");
  const [isLoading, setIsLoading] = useState(false);

  const [travelData, setTravelData] = useState<MultiDestinationData>({
    rush: [],
    offpeak: [],
  });

  // Get SF addresses
  const { data: addresses } = api.traffic.getSanFranciscoGrid.useQuery();

  // Create tRPC utils for imperative calls
  const utils = api.useUtils();

  // Fetch travel times for multiple destinations
  const fetchTravelTimes = async (timeType: "rush" | "offpeak") => {
    if (!addresses?.length || destinations.length === 0) return;

    setIsLoading(true);

    try {
      console.log(
        `Starting ${timeType} data fetch for ${destinations.length} destinations`,
      );

      const response = await utils.traffic.getTravelTimesMultiDestination.fetch(
        {
          origins: addresses,
          destinations: destinations,
          departureTime: timeType,
        },
      );

      console.log(`${timeType} data fetch completed:`, response);

      setTravelData((prev) => ({
        ...prev,
        [timeType]: response.destinations,
      }));
    } catch (error) {
      console.error(`Error fetching ${timeType} travel times:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAllData = async () => {
    if (destinations.length === 0) {
      alert("Please add at least one destination before loading data.");
      return;
    }
    await fetchTravelTimes("rush");
    await fetchTravelTimes("offpeak");
  };

  // Get combined data based on weighted average of rush and offpeak trips
  const getCombinedData = (): TravelTimeData[] => {
    const rushData = travelData.rush;
    const offpeakData = travelData.offpeak;

    if (rushData.length === 0 || offpeakData.length === 0) return [];

    if (selectedDestination === "all") {
      // Calculate weighted averages across all destinations
      const originMap = new Map<
        string,
        {
          totalTime: number;
          totalTrips: number;
        }
      >();

      // Calculate weighted averages for both rush and off-peak
      [rushData, offpeakData].forEach((timeData, timeIndex) => {
        const isRush = timeIndex === 0;

        timeData.forEach((destData) => {
          const destination = destinations.find(
            (d) => d.id === destData.destinationId,
          );
          if (!destination) return;

          const tripCount = isRush ? destination.rushTrips : destination.offpeakTrips;

          destData.results.forEach((result) => {
            if (result.status !== "OK") return;

            const existing = originMap.get(result.origin);
            if (existing) {
              existing.totalTime += result.duration * tripCount;
              existing.totalTrips += tripCount;
            } else {
              originMap.set(result.origin, {
                totalTime: result.duration * tripCount,
                totalTrips: tripCount,
              });
            }
          });
        });
      });

      // Convert back to TravelTimeData format with weighted averages
      const combinedResults: TravelTimeData[] = [];
      originMap.forEach((data, origin) => {
        if (data.totalTrips === 0) return;
        
        const avgDuration = data.totalTime / data.totalTrips;
        const firstResult = rushData[0]?.results.find(
          (r) => r.origin === origin,
        );
        if (firstResult) {
          combinedResults.push({
            ...firstResult,
            duration: avgDuration,
          });
        }
      });

      return combinedResults;
    } else {
      // Handle specific destination
      const rushDestData = rushData.find(
        (dest) => dest.destinationId === selectedDestination,
      );
      const offpeakDestData = offpeakData.find(
        (dest) => dest.destinationId === selectedDestination,
      );

      if (!rushDestData || !offpeakDestData) return [];

      const destination = destinations.find(d => d.id === selectedDestination);
      if (!destination) return [];

      const originMap = new Map<string, { totalTime: number; totalTrips: number }>();

      // Add rush hour data
      rushDestData.results.forEach((result) => {
        if (result.status !== "OK") return;
        
        const existing = originMap.get(result.origin);
        if (existing) {
          existing.totalTime += result.duration * destination.rushTrips;
          existing.totalTrips += destination.rushTrips;
        } else {
          originMap.set(result.origin, {
            totalTime: result.duration * destination.rushTrips,
            totalTrips: destination.rushTrips,
          });
        }
      });

      // Add off-peak data
      offpeakDestData.results.forEach((result) => {
        if (result.status !== "OK") return;
        
        const existing = originMap.get(result.origin);
        if (existing) {
          existing.totalTime += result.duration * destination.offpeakTrips;
          existing.totalTrips += destination.offpeakTrips;
        } else {
          originMap.set(result.origin, {
            totalTime: result.duration * destination.offpeakTrips,
            totalTrips: destination.offpeakTrips,
          });
        }
      });

      // Convert to TravelTimeData format
      const combinedResults: TravelTimeData[] = [];
      originMap.forEach((data, origin) => {
        if (data.totalTrips === 0) return;
        
        const avgDuration = data.totalTime / data.totalTrips;
        const firstResult = rushDestData.results.find(
          (r) => r.origin === origin,
        );
        if (firstResult) {
          combinedResults.push({
            ...firstResult,
            duration: avgDuration,
          });
        }
      });

      return combinedResults;
    }
  };

  // Get current data based on view mode and selected destination
  const getCurrentData = (): TravelTimeData[] => {
    // Handle combined time period
    if (selectedTime === "combined") {
      return getCombinedData();
    }
    
    const currentTimeData = travelData[selectedTime];

    if (viewMode === "individual") {
      if (selectedDestination === "all") {
        // Show weighted average for all destinations
        const originMap = new Map<
          string,
          { totalTime: number; totalWeight: number }
        >();

        currentTimeData.forEach((destData) => {
          const destination = destinations.find(
            (d) => d.id === destData.destinationId,
          );
          if (!destination) return;

          // Use appropriate trip count based on selected time
          const tripCount = selectedTime === "rush" ? destination.rushTrips : destination.offpeakTrips;

          destData.results.forEach((result) => {
            if (result.status !== "OK") return;

            const existing = originMap.get(result.origin);
            if (existing) {
              existing.totalTime += result.duration * tripCount;
              existing.totalWeight += tripCount;
            } else {
              originMap.set(result.origin, {
                totalTime: result.duration * tripCount,
                totalWeight: tripCount,
              });
            }
          });
        });

        // Convert back to TravelTimeData format with weighted averages
        const weightedResults: TravelTimeData[] = [];
        originMap.forEach((data, origin) => {
          const avgDuration = data.totalTime / data.totalWeight;
          const firstResult = currentTimeData[0]?.results.find(
            (r) => r.origin === origin,
          );
          if (firstResult) {
            weightedResults.push({
              ...firstResult,
              duration: avgDuration,
            });
          }
        });

        return weightedResults;
      }
      // Show specific destination
      const destData = currentTimeData.find(
        (dest) => dest.destinationId === selectedDestination,
      );
      return destData?.results ?? [];
    }

    if (viewMode === "comparison") {
      // Show difference between rush and off-peak (traffic delay)
      const rushData = travelData.rush;
      const offpeakData = travelData.offpeak;

      if (rushData.length === 0 || offpeakData.length === 0) return [];

      if (selectedDestination === "all") {
        // Calculate simple averages across all destinations to get per-trip traffic delay
        const originMap = new Map<
          string,
          {
            rushTimes: number[];
            offpeakTimes: number[];
          }
        >();

        // Collect all times for averaging
        [rushData, offpeakData].forEach((timeData, timeIndex) => {
          const isRush = timeIndex === 0;

          timeData.forEach((destData) => {
            const destination = destinations.find(
              (d) => d.id === destData.destinationId,
            );
            if (!destination) return;

            destData.results.forEach((result) => {
              if (result.status !== "OK") return;

              const existing = originMap.get(result.origin);
              if (existing) {
                if (isRush) {
                  existing.rushTimes.push(result.duration);
                } else {
                  existing.offpeakTimes.push(result.duration);
                }
              } else {
                originMap.set(result.origin, {
                  rushTimes: isRush ? [result.duration] : [],
                  offpeakTimes: isRush ? [] : [result.duration],
                });
              }
            });
          });
        });

        // Calculate traffic delay (difference between average rush and off-peak times)
        const comparisonResults: TravelTimeData[] = [];
        originMap.forEach((data, origin) => {
          if (data.rushTimes.length === 0 || data.offpeakTimes.length === 0) return;

          const avgRushTime = data.rushTimes.reduce((sum, time) => sum + time, 0) / data.rushTimes.length;
          const avgOffpeakTime = data.offpeakTimes.reduce((sum, time) => sum + time, 0) / data.offpeakTimes.length;
          
          const trafficDelayPerTrip = avgRushTime - avgOffpeakTime;

          const firstResult = rushData[0]?.results.find(
            (r) => r.origin === origin,
          );
          if (firstResult && trafficDelayPerTrip > 0) {
            comparisonResults.push({
              ...firstResult,
              duration: trafficDelayPerTrip, // This is now per-trip traffic delay
            });
          }
        });

        return comparisonResults;
      } else {
        // Show traffic delay for specific destination
        const rushDestData = rushData.find(
          (dest) => dest.destinationId === selectedDestination,
        );
        const offpeakDestData = offpeakData.find(
          (dest) => dest.destinationId === selectedDestination,
        );

        if (!rushDestData || !offpeakDestData) return [];

        const destination = destinations.find(d => d.id === selectedDestination);
        if (!destination || destination.rushTrips === 0) return []; // No rush hour trips

        const comparisonResults: TravelTimeData[] = [];

        // For each origin, calculate the difference between rush and off-peak
        rushDestData.results.forEach((rushResult) => {
          if (rushResult.status !== "OK") return;

          const offpeakResult = offpeakDestData.results.find(
            (r) => r.origin === rushResult.origin && r.status === "OK",
          );

          if (offpeakResult) {
            const trafficDelay = rushResult.duration - offpeakResult.duration;

            if (trafficDelay > 0) {
              comparisonResults.push({
                ...rushResult,
                duration: trafficDelay,
              });
            }
          }
        });

        return comparisonResults;
      }
    }

    return [];
  };

  const getColorIntensity = (
    duration: number,
    minDuration: number,
    maxDuration: number,
  ) => {
    // Convert seconds to minutes
    const minutes = duration / 60;
    const minMinutes = minDuration / 60;
    const maxMinutes = maxDuration / 60;

    // Normalize the duration to a 0-1 scale based on actual data range
    const normalizedValue =
      maxMinutes > minMinutes
        ? (minutes - minMinutes) / (maxMinutes - minMinutes)
        : 0;

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
      intensity: 0.3 + intensity * 0.7, // Size range from 0.3 to 1.0
    };
  };

  const currentData = getCurrentData();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-6">
      <div className="text-center">
        <h1 className="mb-2 text-4xl font-bold text-gray-900">
          SF Traffic Map
        </h1>
        <p className="text-lg text-gray-600">
          Analyze your commute patterns with weighted travel times and traffic
          comparisons
        </p>
      </div>

      {/* Destination Management */}
      <DestinationManager
        destinations={destinations}
        onDestinationsChange={setDestinations}
      />

      {/* Controls */}
      <div className="rounded-lg bg-white p-6 shadow-lg">
        <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
          <div className="flex flex-col gap-4 sm:flex-row">
            {/* View Mode */}
            <div className="flex flex-col">
              <label className="mb-2 text-sm font-medium text-gray-700">
                View Mode
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode("individual")}
                  className={`rounded-lg px-4 py-2 font-medium transition-colors ${
                    viewMode === "individual"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Time Driving
                </button>
                <button
                  onClick={() => setViewMode("comparison")}
                  className={`rounded-lg px-4 py-2 font-medium transition-colors ${
                    viewMode === "comparison"
                      ? "bg-orange-500 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Time Sitting in Traffic
                </button>
              </div>
            </div>

            {/* Time Selection (only for individual mode) */}
            {viewMode === "individual" && (
              <div className="flex flex-col">
                <label className="mb-2 text-sm font-medium text-gray-700">
                  Time Period
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedTime("rush")}
                    className={`rounded-lg px-4 py-2 font-medium transition-colors ${
                      selectedTime === "rush"
                        ? "bg-red-500 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    Rush Hour
                  </button>
                  <button
                    onClick={() => setSelectedTime("offpeak")}
                    className={`rounded-lg px-4 py-2 font-medium transition-colors ${
                      selectedTime === "offpeak"
                        ? "bg-green-500 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    Off-Peak
                  </button>
                  <button
                    onClick={() => setSelectedTime("combined")}
                    className={`rounded-lg px-4 py-2 font-medium transition-colors ${
                      selectedTime === "combined"
                        ? "bg-purple-500 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    Combined
                  </button>
                </div>
              </div>
            )}

            {/* Display Mode Selector */}
            <div className="flex flex-col">
              <label className="mb-2 text-sm font-medium text-gray-700">
                Display
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setDisplayMode("per-trip")}
                  className={`rounded-lg px-4 py-2 font-medium transition-colors ${
                    displayMode === "per-trip"
                      ? "bg-indigo-500 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Per Trip
                </button>
                <button
                  onClick={() => setDisplayMode("weekly")}
                  className={`rounded-lg px-4 py-2 font-medium transition-colors ${
                    displayMode === "weekly"
                      ? "bg-indigo-500 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  Weekly
                </button>
              </div>
            </div>

            {/* Destination Selection (for individual and comparison modes) */}
            {(viewMode === "individual" || viewMode === "comparison") &&
              destinations.length > 1 && (
                <div className="flex flex-col">
                  <label className="mb-2 text-sm font-medium text-gray-700">
                    Destination
                  </label>
                  <select
                    value={selectedDestination}
                    onChange={(e) => setSelectedDestination(e.target.value)}
                    className="rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="all">All Destinations (Weighted Avg)</option>
                    {destinations.map((dest) => (
                      <option key={dest.id} value={dest.id}>
                        {dest.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
          </div>
        </div>
      </div>

      {/* Dynamic Legend */}
      {(() => {
        const validData = currentData.filter(
          (d) => d.status === "OK" && d.duration > 0,
        );

                
        if (validData.length === 0) {
          return (
            <div className="rounded-lg bg-white p-4 shadow-lg">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-lg font-semibold text-gray-900 flex-1">
                  Traffic Legend
                </span>
                <button
                  onClick={() => void loadAllData()}
                  disabled={isLoading || destinations.length === 0}
                  className={`rounded-lg px-4 py-2 font-medium transition-colors flex-1 ${
                    isLoading || destinations.length === 0
                      ? "cursor-not-allowed bg-gray-400 text-gray-600"
                      : "bg-violet-600 text-white hover:bg-violet-700 cursor-pointer"
                  }`}
                >
                  {isLoading ? "Loading..." : "Load Traffic Data"}
                </button>
                <div className="flex-1" />
              </div>
              <div className="flex items-center justify-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded bg-green-400"></div>
                  <span className="text-sm">Fast</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded bg-yellow-400"></div>
                  <span className="text-sm">Medium</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded bg-red-400"></div>
                  <span className="text-sm">Slow</span>
                </div>
              </div>
            </div>
          );
        }

        const durations = validData.map((d) => d.duration);
        let minMinutes = Math.round(Math.min(...durations) / 60);
        let maxMinutes = Math.round(Math.max(...durations) / 60);
        let avgMinutes = Math.round(
          durations.reduce((sum, d) => sum + d, 0) / durations.length / 60,
        );

        // Apply weekly multiplier if in weekly display mode
        if (displayMode === "weekly") {
          const destinationsForCalc = selectedDestination === "all" 
            ? destinations 
            : destinations.filter(d => d.id === selectedDestination);
          
          const totalTripMultiplier = destinationsForCalc.length > 0 
            ? destinationsForCalc.reduce((sum, dest) => {
                if (viewMode === "comparison") {
                  return sum + dest.rushTrips; // Traffic delay only applies to rush trips
                } else if (selectedTime === "rush") {
                  return sum + dest.rushTrips;
                } else if (selectedTime === "offpeak") {
                  return sum + dest.offpeakTrips;
                } else { // combined
                  return sum + dest.rushTrips + dest.offpeakTrips;
                }
              }, 0)
            : 1;
          
          minMinutes = Math.round(minMinutes * totalTripMultiplier);
          maxMinutes = Math.round(maxMinutes * totalTripMultiplier);
          avgMinutes = Math.round(avgMinutes * totalTripMultiplier);
        }

        const getTimePeriodLabel = () => {
          if (selectedTime === "rush") return "Rush Hour";
          if (selectedTime === "offpeak") return "Off-Peak";
          return "Combined";
        };

        const legendTitle =
          viewMode === "comparison"
            ? "Traffic Delay (Rush - Off-Peak)"
            : selectedDestination === "all"
              ? "Weighted Average Travel Time"
              : `Travel Time (${getTimePeriodLabel()})`;

        return (
          <div className="rounded-lg bg-white p-4 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-lg font-semibold text-gray-900 flex-1">
                {legendTitle}
              </span>
              <button
                onClick={() => void loadAllData()}
                disabled={isLoading || destinations.length === 0}
                className={`rounded-lg px-4 py-2 font-medium transition-colors flex-1 ${
                  isLoading || destinations.length === 0
                    ? "cursor-not-allowed bg-gray-400 text-gray-600"
                    : "bg-violet-600 text-white hover:bg-violet-700 cursor-pointer"
                }`}
              >
                {isLoading ? "Loading..." : "Load Traffic Data"}
              </button>
              <div className="flex-1" />
            </div>
            <div className="flex items-center justify-center gap-6">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-green-500"></div>
                <span className="text-sm font-medium">
                  Fast: {minMinutes}{displayMode === "weekly" ? " min/week" : " min/trip"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-yellow-500"></div>
                <span className="text-sm font-medium">
                  Avg: {avgMinutes}{displayMode === "weekly" ? " min/week" : " min/trip"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-red-500"></div>
                <span className="text-sm font-medium">
                  Slow: {maxMinutes}{displayMode === "weekly" ? " min/week" : " min/trip"}
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Map */}
      <div className="h-[700px] w-full overflow-hidden rounded-lg border shadow-lg">
        <TrafficMapDisplay
          data={currentData}
          destinations={destinations}
          travelData={travelData}
          getColorIntensity={getColorIntensity}
          selectedTime={selectedTime}
          viewMode={viewMode}
          selectedDestination={selectedDestination}
          displayMode={displayMode}
        />
      </div>
    </div>
  );
}
