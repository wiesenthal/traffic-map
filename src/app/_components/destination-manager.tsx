"use client";

import { useState, useEffect } from "react";
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
  isLoading?: boolean;
}

export function DestinationManager({ 
  destinations, 
  onDestinationsChange, 
  isLoading = false 
}: DestinationManagerProps) {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodingError, setGeocodingError] = useState<string | null>(null);
  const [newDestination, setNewDestination] = useState<Partial<Destination>>({
    name: "",
    address: "",
    weight: 1,
  });

  // Load default destinations
  const { data: defaultDestinations } = api.traffic.getDefaultDestinations.useQuery();
  
  // Create tRPC utils for geocoding
  const utils = api.useUtils();

  // Initialize with default destinations if empty
  useEffect(() => {
    if (destinations.length === 0 && defaultDestinations?.length) {
      onDestinationsChange(defaultDestinations);
    }
  }, [defaultDestinations, destinations.length, onDestinationsChange]);

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
      console.error('Geocoding error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to geocode address';
      setGeocodingError(errorMessage);
    } finally {
      setIsGeocoding(false);
    }
  };

  const updateDestination = async (id: string, updates: Partial<Destination>) => {
    // If the address is being updated, we need to geocode it
    if (updates.address && updates.address !== destinations.find(d => d.id === id)?.address) {
      try {
        setIsGeocoding(true);
        const geocodeResult = await utils.traffic.geocodeAddress.fetch({
          address: updates.address,
        });
        
        updates.lat = geocodeResult.lat;
        updates.lng = geocodeResult.lng;
        updates.address = geocodeResult.formatted_address;
      } catch (error) {
        console.error('Geocoding error:', error);
        // Don't update if geocoding fails
        return;
      } finally {
        setIsGeocoding(false);
      }
    }
    
    onDestinationsChange(
      destinations.map(dest => 
        dest.id === id ? { ...dest, ...updates } : dest
      )
    );
  };

  const removeDestination = (id: string) => {
    onDestinationsChange(destinations.filter(dest => dest.id !== id));
  };

  const loadDefaults = () => {
    if (defaultDestinations) {
      onDestinationsChange(defaultDestinations);
    }
  };

  const getTotalWeight = () => {
    return destinations.reduce((sum, dest) => sum + dest.weight, 0);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Destination Management</h2>
          <p className="text-gray-600 mt-1">
            Configure your weekly destinations and how often you visit them
          </p>
          {destinations.length > 0 && (
            <p className="text-sm text-blue-600 mt-1">
              Total weekly trips: {getTotalWeight()}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadDefaults}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Load Defaults
          </button>
          <button
            onClick={() => setIsAddingNew(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Add Destination
          </button>
        </div>
      </div>

      {/* Existing Destinations */}
      <div className="space-y-4 mb-6">
        {destinations.map((destination) => (
          <div
            key={destination.id}
            className="p-4 border border-gray-200 rounded-lg bg-gray-50"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={destination.name}
                    onChange={(e) => updateDestination(destination.id, { name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Office, Client, etc."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    value={destination.address}
                    onChange={(e) => updateDestination(destination.id, { address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Full address..."
                    disabled={isGeocoding}
                  />
                  {destination.lat !== 0 && destination.lng !== 0 && (
                    <div className="text-xs text-green-600 mt-1">
                      ✓ Located at {destination.lat.toFixed(4)}, {destination.lng.toFixed(4)}
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Weekly Trips
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={destination.weight}
                    onChange={(e) => updateDestination(destination.id, { weight: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <button
                onClick={() => removeDestination(destination.id)}
                className="ml-4 p-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-lg transition-colors"
                title="Remove destination"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add New Destination Form */}
      {isAddingNew && (
        <div className="p-4 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Destination</h3>
          
          {geocodingError && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-md">
              <div className="text-red-700 text-sm">
                <strong>Geocoding Error:</strong> {geocodingError}
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={newDestination.name ?? ""}
                onChange={(e) => setNewDestination({ ...newDestination, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Office, Client, etc."
                disabled={isGeocoding}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <input
                type="text"
                value={newDestination.address ?? ""}
                onChange={(e) => setNewDestination({ ...newDestination, address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Full address..."
                disabled={isGeocoding}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Weekly Trips
              </label>
              <input
                type="number"
                min="0"
                max="20"
                value={newDestination.weight ?? 1}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  setNewDestination({ ...newDestination, weight: isNaN(value) ? 1 : value });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isGeocoding}
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => void addDestination()}
              disabled={!newDestination.name || !newDestination.address || isGeocoding}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
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
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 disabled:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {destinations.length === 0 && !isAddingNew && (
        <div className="text-center py-8 text-gray-500">
          <p className="mb-4">No destinations configured yet.</p>
          <button
            onClick={() => setIsAddingNew(true)}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Add Your First Destination
          </button>
        </div>
      )}

      {isGeocoding && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
              <span>Finding location...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 