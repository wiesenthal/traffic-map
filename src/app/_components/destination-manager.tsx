"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

export interface Destination {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  weight: number;
}

interface DestinationManagerProps {
  destinations: Destination[];
  onDestinationsChange: (destinations: Destination[]) => void;
  isRoundTrip: boolean;
  setIsRoundTrip: (isRoundTrip: boolean) => void;
  loadAllData: () => Promise<void>;
  isLoading: boolean;
}

export function DestinationManager({
  destinations,
  onDestinationsChange,
  isRoundTrip,
  setIsRoundTrip,
  loadAllData,
  isLoading,
}: DestinationManagerProps) {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodingError, setGeocodingError] = useState<string | null>(null);
  const [newDestination, setNewDestination] = useState<Partial<Destination>>({
    name: "",
    address: "",
    weight: 1,
  });

  // Create tRPC utils for geocoding
  const utils = api.useUtils();

  const addDestination = async () => {
    if (!newDestination.name || !newDestination.address) return;

    setIsGeocoding(true);
    setGeocodingError(null);

    try {
      // Geocode the address to get coordinates
      const geocodeResult = await utils.traffic.geocodeAddress.fetch({
        address: newDestination.address,
      });

      const destination: Destination = {
        id: `dest-${Date.now()}`,
        name: newDestination.name,
        address: geocodeResult.formatted_address, // Use the formatted address from Google
        lat: geocodeResult.lat,
        lng: geocodeResult.lng,
        weight: newDestination.weight ?? 1,
      };

      onDestinationsChange([...destinations, destination]);
      setNewDestination({ name: "", address: "", weight: 1 });
      setIsAddingNew(false);
    } catch (error) {
      console.error("Geocoding error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to geocode address";
      setGeocodingError(errorMessage);
    } finally {
      setIsGeocoding(false);
    }
  };

  const updateDestination = async (
    id: string,
    updates: Partial<Destination>,
  ) => {
    // If the address is being updated, we need to geocode it
    if (
      updates.address &&
      updates.address !== destinations.find((d) => d.id === id)?.address
    ) {
      try {
        setIsGeocoding(true);
        const geocodeResult = await utils.traffic.geocodeAddress.fetch({
          address: updates.address,
        });

        updates.lat = geocodeResult.lat;
        updates.lng = geocodeResult.lng;
        updates.address = geocodeResult.formatted_address;
      } catch (error) {
        console.error("Geocoding error:", error);
        // Don't update if geocoding fails
        return;
      } finally {
        setIsGeocoding(false);
      }
    }

    onDestinationsChange(
      destinations.map((dest) =>
        dest.id === id ? { ...dest, ...updates } : dest,
      ),
    );
  };

  const removeDestination = (id: string) => {
    onDestinationsChange(destinations.filter((dest) => dest.id !== id));
  };

  const getTotalWeight = () => {
    return destinations.reduce((sum, dest) => sum + dest.weight, 0);
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col rounded-lg bg-white p-6 shadow-lg">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Destination Management
          </h2>
          <p className="mt-1 text-gray-600">
            Configure your weekly destinations and how often you visit them
          </p>
          {destinations.length > 0 && (
            <p className="mt-1 text-sm text-blue-600">
              Total weekly trips: {getTotalWeight()}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsAddingNew(true)}
            className="rounded-lg bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600"
          >
            Add Destination
          </button>

          <div className="flex flex-col items-end gap-4 sm:flex-row">
            <button
              onClick={() => void loadAllData()}
              disabled={isLoading || destinations.length === 0}
              className={`rounded-lg px-6 py-3 font-medium transition-colors ${
                isLoading || destinations.length === 0
                  ? "cursor-not-allowed bg-gray-400 text-gray-600"
                  : "bg-green-500 text-white hover:bg-green-600"
              }`}
            >
              {isLoading ? "Loading Traffic Data..." : "Load Traffic Data"}
            </button>
          </div>
        </div>
      </div>

      {/* Existing Destinations */}
      <div className="mb-6 space-y-4">
        {destinations.map((destination) => (
          <div
            key={destination.id}
            className="rounded-lg border border-gray-200 bg-gray-50 p-4"
          >
            <div className="flex items-start justify-between">
              <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Name
                  </label>
                  <input
                    type="text"
                    value={destination.name}
                    onChange={(e) =>
                      updateDestination(destination.id, {
                        name: e.target.value,
                      })
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Office, Client, etc."
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Address
                  </label>
                  <input
                    type="text"
                    value={destination.address}
                    onChange={(e) =>
                      updateDestination(destination.id, {
                        address: e.target.value,
                      })
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Full address..."
                    disabled={isGeocoding}
                  />
                  {destination.lat !== 0 && destination.lng !== 0 && (
                    <div className="mt-1 text-xs text-green-600">
                      ✓ Located at {destination.lat.toFixed(4)},{" "}
                      {destination.lng.toFixed(4)}
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Weekly Trips
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={destination.weight}
                    onChange={(e) =>
                      updateDestination(destination.id, {
                        weight: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                onClick={() => removeDestination(destination.id)}
                className="ml-4 rounded-lg p-2 text-red-600 transition-colors hover:bg-red-100 hover:text-red-800"
                title="Remove destination"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add New Destination Form */}
      {isAddingNew && (
        <div className="rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 p-4">
          <h3 className="mb-4 text-lg font-medium text-gray-900">
            Add New Destination
          </h3>

          {geocodingError && (
            <div className="mb-4 rounded-md border border-red-300 bg-red-100 p-3">
              <div className="text-sm text-red-700">
                <strong>Geocoding Error:</strong> {geocodingError}
              </div>
            </div>
          )}

          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Name
              </label>
              <input
                type="text"
                value={newDestination.name ?? ""}
                onChange={(e) =>
                  setNewDestination({ ...newDestination, name: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Office, Client, etc."
                disabled={isGeocoding}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Address
              </label>
              <input
                type="text"
                value={newDestination.address ?? ""}
                onChange={(e) =>
                  setNewDestination({
                    ...newDestination,
                    address: e.target.value,
                  })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Full address..."
                disabled={isGeocoding}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Weekly Trips
              </label>
              <input
                type="number"
                min="0"
                max="20"
                value={newDestination.weight ?? 1}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  setNewDestination({
                    ...newDestination,
                    weight: isNaN(value) ? 1 : value,
                  });
                }}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                disabled={isGeocoding}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => void addDestination()}
              disabled={
                !newDestination.name || !newDestination.address || isGeocoding
              }
              className="rounded-lg bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {isGeocoding ? "Finding Location..." : "Add Destination"}
            </button>
            <button
              onClick={() => {
                setIsAddingNew(false);
                setNewDestination({ name: "", address: "", weight: 1 });
                setGeocodingError(null);
              }}
              disabled={isGeocoding}
              className="rounded-lg bg-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-400 disabled:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {destinations.length === 0 && !isAddingNew && (
        <div className="py-8 text-center text-gray-500">
          <p className="mb-4">No destinations configured yet.</p>
          <button
            onClick={() => setIsAddingNew(true)}
            className="rounded-lg bg-blue-500 px-6 py-3 text-white transition-colors hover:bg-blue-600"
          >
            Add Your First Destination
          </button>
        </div>
      )}

      {isGeocoding && (
        <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
          <div className="rounded-lg bg-white p-6 shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-blue-500"></div>
              <span>Finding location...</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex w-full items-center gap-2">
        <div className="flex-1" />
        <input
          type="checkbox"
          checked={isRoundTrip}
          onChange={() => setIsRoundTrip(!isRoundTrip)}
          className="h-4 w-4 rounded border border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
        />
        <label className="text-sm font-medium text-gray-700">Round Trip</label>
      </div>
    </div>
  );
}
