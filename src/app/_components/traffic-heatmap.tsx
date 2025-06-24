"use client";

import { useEffect, useState, useRef } from "react";
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

export function TrafficHeatmap() {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [selectedTime, setSelectedTime] = useState<"rush" | "offpeak">("rush");
  const [selectedDestination, setSelectedDestination] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("individual");
  const [isLoading, setIsLoading] = useState(false);
  const [isRoundTrip, setIsRoundTrip] = useState(false);
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

  // Get current data based on view mode and selected destination
  const getCurrentData = (): TravelTimeData[] => {
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

          destData.results.forEach((result) => {
            if (result.status !== "OK") return;

            const existing = originMap.get(result.origin);
            if (existing) {
              existing.totalTime += result.duration * destination.weight;
              existing.totalWeight += destination.weight;
            } else {
              originMap.set(result.origin, {
                totalTime: result.duration * destination.weight,
                totalWeight: destination.weight,
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
        // Calculate weighted averages across all destinations
        const originMap = new Map<
          string,
          {
            rushTime: number;
            offpeakTime: number;
            rushWeight: number;
            offpeakWeight: number;
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

            destData.results.forEach((result) => {
              if (result.status !== "OK") return;

              const existing = originMap.get(result.origin);
              if (existing) {
                if (isRush) {
                  existing.rushTime += result.duration * destination.weight;
                  existing.rushWeight += destination.weight;
                } else {
                  existing.offpeakTime += result.duration * destination.weight;
                  existing.offpeakWeight += destination.weight;
                }
              } else {
                originMap.set(result.origin, {
                  rushTime: isRush ? result.duration * destination.weight : 0,
                  offpeakTime: isRush
                    ? 0
                    : result.duration * destination.weight,
                  rushWeight: isRush ? destination.weight : 0,
                  offpeakWeight: isRush ? 0 : destination.weight,
                });
              }
            });
          });
        });

        // Calculate traffic delay (difference between rush and off-peak)
        const comparisonResults: TravelTimeData[] = [];
        originMap.forEach((data, origin) => {
          if (data.rushWeight === 0 || data.offpeakWeight === 0) return;

          const avgRushTime = data.rushTime / data.rushWeight;
          const avgOffpeakTime = data.offpeakTime / data.offpeakWeight;
          const trafficDelay = avgRushTime - avgOffpeakTime;

          const firstResult = rushData[0]?.results.find(
            (r) => r.origin === origin,
          );
          if (firstResult && trafficDelay > 0) {
            comparisonResults.push({
              ...firstResult,
              duration: trafficDelay,
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
          Multi-Destination Traffic Analysis
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
        isRoundTrip={isRoundTrip}
        setIsRoundTrip={setIsRoundTrip}
        loadAllData={loadAllData}
        isLoading={isLoading}
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
                </div>
              </div>
            )}

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
        const minMinutes = Math.round(Math.min(...durations) / 60);
        const maxMinutes = Math.round(Math.max(...durations) / 60);
        const avgMinutes = Math.round(
          durations.reduce((sum, d) => sum + d, 0) / durations.length / 60,
        );

        const legendTitle =
          viewMode === "comparison"
            ? "Traffic Delay (Rush - Off-Peak)"
            : selectedDestination === "all"
              ? "Weighted Average Travel Time"
              : `Travel Time (${selectedTime === "rush" ? "Rush Hour" : "Off-Peak"})`;

        return (
          <div className="rounded-lg bg-white p-4 shadow-lg">
            <div className="mb-2 text-center">
              <span className="text-lg font-semibold text-gray-900">
                {legendTitle}
              </span>
            </div>
            <div className="flex items-center justify-center gap-6">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-green-500"></div>
                <span className="text-sm font-medium">
                  Fast: {minMinutes * (isRoundTrip ? 2 : 1)} min
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-yellow-500"></div>
                <span className="text-sm font-medium">
                  Avg: {avgMinutes * (isRoundTrip ? 2 : 1)} min
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-red-500"></div>
                <span className="text-sm font-medium">
                  Slow: {maxMinutes * (isRoundTrip ? 2 : 1)} min
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
          isRoundTrip={isRoundTrip}
          selectedDestination={selectedDestination}
        />
      </div>
    </div>
  );
}
