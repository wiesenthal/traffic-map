"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default markers in Leaflet
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface TravelTimeData {
  origin: string; // Address string
  neighborhood: string;
  duration: number;
  distance: number;
  status: string;
}

interface Destination {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  weight: number;
}

type ViewMode = "individual" | "weighted" | "comparison";

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

interface TrafficMapDisplayProps {
  data: TravelTimeData[];
  destinations: Destination[];
  travelData: MultiDestinationData;
  getColorIntensity: (duration: number, minDuration: number, maxDuration: number) => { color: string; intensity: number };
  selectedTime: "rush" | "offpeak";
  viewMode: ViewMode;
}

interface GeocodeResult {
  address: string;
  lat: number;
  lng: number;
}

export default function TrafficMapDisplay({
  data,
  destinations,
  travelData,
  getColorIntensity,
  selectedTime,
  viewMode,
}: TrafficMapDisplayProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const destinationMarkersRef = useRef<L.Marker[]>([]);
  const [geocodedData, setGeocodedData] = useState<GeocodeResult[]>([]);

  // Calculate weekly statistics for a specific origin location
  const getLocationWeeklyStats = (origin: string) => {
    if (travelData.rush.length === 0 || travelData.offpeak.length === 0) {
      return { weeklyMinutes: 0, trafficDelay: 0, totalTrips: 0, rushMinutes: 0, offPeakMinutes: 0 };
    }

    let totalWeeklyMinutes = 0;
    let totalTrafficDelay = 0;
    let totalTrips = 0;
    let totalRushMinutes = 0;
    let totalOffPeakMinutes = 0;

    // Calculate for rush hour
    travelData.rush.forEach(destData => {
      const destination = destinations.find(d => d.id === destData.destinationId);
      if (!destination) return;

      const result = destData.results.find(r => r.origin === origin && r.status === "OK");
      if (result) {
        const rushMinutes = result.duration / 60;
        totalRushMinutes += rushMinutes * destination.weight;
        totalWeeklyMinutes += rushMinutes * destination.weight;
        totalTrips += destination.weight;
      }
    });

    // Calculate for off-peak and traffic delay
    travelData.offpeak.forEach(destData => {
      const destination = destinations.find(d => d.id === destData.destinationId);
      if (!destination) return;

      const result = destData.results.find(r => r.origin === origin && r.status === "OK");
      const rushResult = travelData.rush
        .find(rd => rd.destinationId === destData.destinationId)?.results
        .find(r => r.origin === origin && r.status === "OK");

      if (result && rushResult) {
        const offpeakMinutes = result.duration / 60;
        const rushMinutes = rushResult.duration / 60;
        
        totalOffPeakMinutes += offpeakMinutes * destination.weight;
        totalWeeklyMinutes += offpeakMinutes * destination.weight;
        totalTrafficDelay += (rushMinutes - offpeakMinutes) * destination.weight;
      }
    });

    return {
      weeklyMinutes: Math.round(totalWeeklyMinutes),
      trafficDelay: Math.round(Math.max(0, totalTrafficDelay)),
      totalTrips: totalTrips,
      rushMinutes: Math.round(totalRushMinutes),
      offPeakMinutes: Math.round(totalOffPeakMinutes),
    };
  };

  // Simple geocoding cache for SF addresses (optimized for East Bay commutes)
  const SF_GEOCODE_CACHE: Record<string, {lat: number, lng: number}> = {
    // Major intersections and landmarks
    "Market St & Montgomery St, San Francisco, CA": { lat: 37.7944, lng: -122.4019 },
    "Union Square, San Francisco, CA": { lat: 37.7879, lng: -122.4075 },
    "Chinatown, San Francisco, CA": { lat: 37.7901, lng: -122.4046 },
    "North Beach, San Francisco, CA": { lat: 37.8006, lng: -122.4103 },
    "Fisherman's Wharf, San Francisco, CA": { lat: 37.8084, lng: -122.4089 },
    
    // SOMA and Mission Bay (close to Bay Bridge)
    "SOMA, San Francisco, CA": { lat: 37.7749, lng: -122.4194 },
    "Mission Bay, San Francisco, CA": { lat: 37.7685, lng: -122.3901 },
    "Potrero Hill, San Francisco, CA": { lat: 37.7659, lng: -122.4077 },
    
    // Mission District (central)
    "Mission District, San Francisco, CA": { lat: 37.7599, lng: -122.4148 },
    "16th Street Mission BART, San Francisco, CA": { lat: 37.7647, lng: -122.4194 },
    "24th Street Mission BART, San Francisco, CA": { lat: 37.7521, lng: -122.4186 },
    
    // Castro and Noe Valley
    "Castro District, San Francisco, CA": { lat: 37.7609, lng: -122.4350 },
    "Noe Valley, San Francisco, CA": { lat: 37.7503, lng: -122.4336 },
    
    // Hayes Valley and Haight
    "Hayes Valley, San Francisco, CA": { lat: 37.7760, lng: -122.4236 },
    "Haight Ashbury, San Francisco, CA": { lat: 37.7692, lng: -122.4481 },
    
    // Richmond District (key locations)
    "Inner Richmond, San Francisco, CA": { lat: 37.7800, lng: -122.4647 },
    "Outer Richmond, San Francisco, CA": { lat: 37.7756, lng: -122.4944 },
    "Geary Blvd & 19th Ave, San Francisco, CA": { lat: 37.7816, lng: -122.4751 },
    
    // Sunset District (key locations)
    "Inner Sunset, San Francisco, CA": { lat: 37.7644, lng: -122.4751 },
    "Outer Sunset, San Francisco, CA": { lat: 37.7534, lng: -122.4984 },
    
    // Pacific Heights and Marina
    "Pacific Heights, San Francisco, CA": { lat: 37.7956, lng: -122.4339 },
    "Marina District, San Francisco, CA": { lat: 37.8021, lng: -122.4378 },
    "Russian Hill, San Francisco, CA": { lat: 37.8014, lng: -122.4189 },
    "Nob Hill, San Francisco, CA": { lat: 37.7918, lng: -122.4156 },
    
    // Additional North Beach and Marina points
    "Columbus Ave & Broadway, San Francisco, CA": { lat: 37.7983, lng: -122.4067 },
    "Chestnut St & Fillmore St, San Francisco, CA": { lat: 37.8003, lng: -122.4325 },
    "Palace of Fine Arts, San Francisco, CA": { lat: 37.8023, lng: -122.4486 },
    
    // Additional Pacific Heights points
    "Fillmore St & California St, San Francisco, CA": { lat: 37.7889, lng: -122.4331 },
    "Divisadero St & California St, San Francisco, CA": { lat: 37.7889, lng: -122.4378 },
    
    // Additional Richmond District points
    "Clement St & 6th Ave, San Francisco, CA": { lat: 37.7828, lng: -122.4631 },
    "Clement St & 19th Ave, San Francisco, CA": { lat: 37.7828, lng: -122.4751 },
    
    // Western Addition and Fillmore
    "Western Addition, San Francisco, CA": { lat: 37.7844, lng: -122.4394 },
    "Fillmore District, San Francisco, CA": { lat: 37.7844, lng: -122.4331 },
    "Japantown, San Francisco, CA": { lat: 37.7856, lng: -122.4297 },
    "Alamo Square, San Francisco, CA": { lat: 37.7756, lng: -122.4339 },
    
    // Presidio Area
    "Presidio, San Francisco, CA": { lat: 37.8021, lng: -122.4647 },
    "Presidio Heights, San Francisco, CA": { lat: 37.7889, lng: -122.4594 },
    
    // Central Areas
    "West Portal, San Francisco, CA": { lat: 37.7394, lng: -122.4661 },
    "Twin Peaks, San Francisco, CA": { lat: 37.7544, lng: -122.4478 },
    
    // BART Stations (crucial for East Bay commutes)
    "Powell Street BART, San Francisco, CA": { lat: 37.7844, lng: -122.4078 },
    "Montgomery Street BART, San Francisco, CA": { lat: 37.7889, lng: -122.4019 },
    "Civic Center BART, San Francisco, CA": { lat: 37.7794, lng: -122.4131 },
    
    // Universities and landmarks
    "UCSF Parnassus, San Francisco, CA": { lat: 37.7629, lng: -122.4583 },
    "USF, San Francisco, CA": { lat: 37.7766, lng: -122.4491 },
    "Golden Gate Park, San Francisco, CA": { lat: 37.7694, lng: -122.4862 },
    
    // Additional key streets and areas
    "Van Ness Ave & Geary St, San Francisco, CA": { lat: 37.7870, lng: -122.4208 },
    "Market St & Castro St, San Francisco, CA": { lat: 37.7626, lng: -122.4348 },
    "Irving St & 19th Ave, San Francisco, CA": { lat: 37.7644, lng: -122.4751 },
    
    // Southern Mission (close to East Bay)
    "Bernal Heights, San Francisco, CA": { lat: 37.7414, lng: -122.4161 },
    "Dogpatch, San Francisco, CA": { lat: 37.7575, lng: -122.3886 },
  };

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // San Francisco center coordinates
    const map = L.map(mapContainerRef.current).setView([37.7749, -122.4194], 12);

    // Add OpenStreetMap tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Add destination markers
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove existing destination markers
    destinationMarkersRef.current.forEach(marker => {
      mapRef.current!.removeLayer(marker);
    });
    destinationMarkersRef.current = [];

    // Add destination markers for each destination
    destinations.forEach((destination, index) => {
      const colors = ["#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", "#EF4444"];
      const color = colors[index % colors.length] ?? "#8B5CF6";
      
      const destinationIcon = L.divIcon({
        html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">${index + 1}</div>`,
        className: "custom-marker",
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      const marker = L.marker([destination.lat, destination.lng], { icon: destinationIcon })
        .addTo(mapRef.current!)
        .bindPopup(`
          <div style="font-family: sans-serif;">
            <strong style="color: ${color};">${destination.name}</strong><br/>
            ${destination.address}<br/>
            <small style="color: #6B7280;">Weekly trips: ${destination.weight}</small>
          </div>
        `);

      destinationMarkersRef.current.push(marker);
    });
  }, [destinations]);

  // Update heatmap points
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => {
      mapRef.current!.removeLayer(marker);
    });
    markersRef.current = [];

    const validData = data.filter(point => point.status === "OK" && point.duration > 0);
    console.log(`Rendering ${validData.length} valid data points on map`);

    // Calculate min and max durations for dynamic color scaling
    const durations = validData.map(point => point.duration);
    const minDuration = durations.length > 0 ? Math.min(...durations) : 0;
    const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;

    // Add new markers for each valid data point
    validData.forEach((point, index) => {
      const coords = SF_GEOCODE_CACHE[point.origin];
      if (!coords) {
        console.log(`No coordinates found for address: ${point.origin}`);
        return;
      }

      const { color, intensity } = getColorIntensity(point.duration, minDuration, maxDuration);
      const minutes = Math.round(point.duration / 60);

      // Get weekly statistics for this location
      const weeklyStats = getLocationWeeklyStats(point.origin);

      // Create popup content based on view mode
      let popupContent = "";
      if (viewMode === "comparison") {
        popupContent = `
          <div style="font-family: sans-serif; min-width: 200px;">
            <strong style="color: #1F2937; font-size: 16px;">${point.neighborhood}</strong><br/>
            <div style="margin: 8px 0;">
              <span style="font-size: 18px; font-weight: bold; color: ${minutes > 20 ? '#DC2626' : minutes > 10 ? '#D97706' : '#059669'};">
                +${minutes} minutes
              </span>
            </div>
            <small style="color: #6B7280;">
              <strong>Traffic Delay:</strong> Rush hour vs Off-peak<br/>
              <strong>Address:</strong> ${point.origin}
            </small>
          </div>
        `;
      } else if (viewMode === "weighted") {
        popupContent = `
          <div style="font-family: sans-serif; min-width: 200px;">
            <strong style="color: #1F2937; font-size: 16px;">${point.neighborhood}</strong><br/>
            <div style="margin: 8px 0;">
              <span style="font-size: 18px; font-weight: bold; color: ${minutes > 40 ? '#DC2626' : minutes > 20 ? '#D97706' : '#059669'};">
                ${minutes} minutes
              </span>
            </div>
            <small style="color: #6B7280;">
              <strong>Weighted Average:</strong> All destinations<br/>
              <strong>Time:</strong> ${selectedTime === "rush" ? "5:00 PM" : "3:00 AM"}<br/>
              <strong>Address:</strong> ${point.origin}
            </small>
          </div>
        `;
      } else {
        popupContent = `
          <div style="font-family: sans-serif; min-width: 200px;">
            <strong style="color: #1F2937; font-size: 16px;">${point.neighborhood}</strong><br/>
            <div style="margin: 8px 0;">
              <span style="font-size: 18px; font-weight: bold; color: ${minutes > 40 ? '#DC2626' : minutes > 20 ? '#D97706' : '#059669'};">
                ${minutes} minutes
              </span>
            </div>
            <small style="color: #6B7280;">
              <strong>Time:</strong> ${selectedTime === "rush" ? "5:00 PM" : "3:00 AM"}<br/>
              <strong>Distance:</strong> ${(point.distance / 1000).toFixed(1)} km<br/>
              <strong>Address:</strong> ${point.origin}
            </small>
          </div>
        `;
      }

      const marker = L.circleMarker([coords.lat, coords.lng], {
        radius: 8 + intensity * 12, // Size based on travel time
        fillColor: color,
        color: "#ffffff",
        weight: 0,
        opacity: 0.8,
        fillOpacity: 0.6,
      })
        .addTo(mapRef.current!)
        .bindPopup(popupContent)
        .bindTooltip(`
          <div style="font-family: sans-serif; text-align: center; min-width: 240px;">
            <div style="font-weight: bold; color: #1F2937; margin-bottom: 4px;">
              ${point.neighborhood}
            </div>
            <div style="font-size: 14px; color: ${minutes > 40 ? '#DC2626' : minutes > 20 ? '#D97706' : '#059669'}; font-weight: bold;">
              ${viewMode === "comparison" ? `+${minutes}` : minutes} minutes
            </div>
            <div style="font-size: 11px; color: #6B7280; margin-top: 6px; border-top: 1px solid #E5E7EB; padding-top: 4px;">
              <div style="margin-bottom: 2px;"><strong>Weekly Stats:</strong></div>
              ${weeklyStats.totalTrips > 0 ? `
                <div>🚗 ${weeklyStats.totalTrips} trips/week</div>
                <div>⏱️ ${Math.floor(weeklyStats.rushMinutes / 60)}h ${weeklyStats.rushMinutes % 60}m rush hour</div>
                <div>⏱️ ${Math.floor(weeklyStats.offPeakMinutes / 60)}h ${weeklyStats.offPeakMinutes % 60}m off-peak</div>
                ${weeklyStats.trafficDelay > 0 ? `<div>🚦 +${weeklyStats.trafficDelay}m traffic delay</div>` : ''}
              ` : '<div>No trip data available</div>'}
            </div>
            <div style="font-size: 10px; color: #9CA3AF; margin-top: 4px; line-height: 1.2;">
              ${point.origin.replace(', San Francisco, CA', '')}
            </div>
          </div>
        `, {
          permanent: false,
          direction: 'top',
          offset: [0, -15],
          className: 'custom-tooltip'
        });

      markersRef.current.push(marker);
    });

    console.log(`Successfully rendered ${markersRef.current.length} markers`);

    // Fit map to show all points
    if (markersRef.current.length > 0 || destinationMarkersRef.current.length > 0) {
      const allMarkers = [...markersRef.current, ...destinationMarkersRef.current];
      if (allMarkers.length > 0) {
        const group = new L.FeatureGroup(allMarkers);
        mapRef.current.fitBounds(group.getBounds().pad(0.1));
      }
    }
  }, [data, getColorIntensity, selectedTime, viewMode]);

  return (
    <div
      ref={mapContainerRef}
      className="h-full w-full"
      style={{ minHeight: "400px" }}
    />
  );
} 