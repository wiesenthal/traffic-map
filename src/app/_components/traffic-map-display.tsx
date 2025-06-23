"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default markers in Leaflet
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

interface TrafficMapDisplayProps {
  data: TravelTimeData[];
  destination: { lat: number; lng: number };
  getColorIntensity: (duration: number) => { color: string; intensity: number };
  selectedTime: "rush" | "offpeak";
}

interface GeocodeResult {
  address: string;
  lat: number;
  lng: number;
}

export default function TrafficMapDisplay({
  data,
  destination,
  getColorIntensity,
  selectedTime,
}: TrafficMapDisplayProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const destinationMarkerRef = useRef<L.Marker | null>(null);
  const [geocodedData, setGeocodedData] = useState<GeocodeResult[]>([]);

  // Simple geocoding cache for SF addresses (approximate coordinates)
  const SF_GEOCODE_CACHE: Record<string, {lat: number, lng: number}> = {
    // Major intersections and landmarks
    "Market St & Montgomery St, San Francisco, CA": { lat: 37.7944, lng: -122.4019 },
    "Union Square, San Francisco, CA": { lat: 37.7879, lng: -122.4075 },
    "Chinatown, San Francisco, CA": { lat: 37.7901, lng: -122.4046 },
    "North Beach, San Francisco, CA": { lat: 37.8006, lng: -122.4103 },
    "Fisherman's Wharf, San Francisco, CA": { lat: 37.8084, lng: -122.4089 },
    
    // SOMA and Mission Bay
    "SOMA, San Francisco, CA": { lat: 37.7749, lng: -122.4194 },
    "Mission Bay, San Francisco, CA": { lat: 37.7685, lng: -122.3901 },
    "Potrero Hill, San Francisco, CA": { lat: 37.7659, lng: -122.4077 },
    
    // Mission District
    "Mission District, San Francisco, CA": { lat: 37.7599, lng: -122.4148 },
    "16th Street Mission BART, San Francisco, CA": { lat: 37.7647, lng: -122.4194 },
    "24th Street Mission BART, San Francisco, CA": { lat: 37.7521, lng: -122.4186 },
    "Bernal Heights, San Francisco, CA": { lat: 37.7414, lng: -122.4161 },
    
    // Castro and Noe Valley
    "Castro District, San Francisco, CA": { lat: 37.7609, lng: -122.4350 },
    "Noe Valley, San Francisco, CA": { lat: 37.7503, lng: -122.4336 },
    "Glen Park, San Francisco, CA": { lat: 37.7339, lng: -122.4342 },
    
    // Hayes Valley and Haight
    "Hayes Valley, San Francisco, CA": { lat: 37.7760, lng: -122.4236 },
    "Haight Ashbury, San Francisco, CA": { lat: 37.7692, lng: -122.4481 },
    "Lower Haight, San Francisco, CA": { lat: 37.7718, lng: -122.4313 },
    "Cole Valley, San Francisco, CA": { lat: 37.7658, lng: -122.4507 },
    
    // Richmond District
    "Richmond District, San Francisco, CA": { lat: 37.7800, lng: -122.4647 },
    "Inner Richmond, San Francisco, CA": { lat: 37.7800, lng: -122.4647 },
    "Outer Richmond, San Francisco, CA": { lat: 37.7756, lng: -122.4944 },
    "Geary Blvd & 38th Ave, San Francisco, CA": { lat: 37.7816, lng: -122.4964 },
    
    // Sunset District
    "Sunset District, San Francisco, CA": { lat: 37.7599, lng: -122.4661 },
    "Inner Sunset, San Francisco, CA": { lat: 37.7644, lng: -122.4751 },
    "Outer Sunset, San Francisco, CA": { lat: 37.7534, lng: -122.4984 },
    "Ocean Beach, San Francisco, CA": { lat: 37.7756, lng: -122.5144 },
    
    // Pacific Heights and Marina
    "Pacific Heights, San Francisco, CA": { lat: 37.7956, lng: -122.4339 },
    "Marina District, San Francisco, CA": { lat: 37.8021, lng: -122.4378 },
    "Cow Hollow, San Francisco, CA": { lat: 37.7990, lng: -122.4339 },
    "Russian Hill, San Francisco, CA": { lat: 37.8014, lng: -122.4189 },
    "Nob Hill, San Francisco, CA": { lat: 37.7918, lng: -122.4156 },
    
    // Western Addition and Fillmore
    "Western Addition, San Francisco, CA": { lat: 37.7844, lng: -122.4394 },
    "Fillmore District, San Francisco, CA": { lat: 37.7844, lng: -122.4331 },
    "Japantown, San Francisco, CA": { lat: 37.7856, lng: -122.4297 },
    "Alamo Square, San Francisco, CA": { lat: 37.7756, lng: -122.4339 },
    
    // Presidio Area
    "Presidio, San Francisco, CA": { lat: 37.8021, lng: -122.4647 },
    "Presidio Heights, San Francisco, CA": { lat: 37.7889, lng: -122.4594 },
    "Laurel Heights, San Francisco, CA": { lat: 37.7889, lng: -122.4581 },
    
    // Southern SF
    "Dogpatch, San Francisco, CA": { lat: 37.7575, lng: -122.3886 },
    "Bayview, San Francisco, CA": { lat: 37.7349, lng: -122.3952 },
    "Hunters Point, San Francisco, CA": { lat: 37.7217, lng: -122.3708 },
    "Excelsior, San Francisco, CA": { lat: 37.7241, lng: -122.4286 },
    "Visitacion Valley, San Francisco, CA": { lat: 37.7175, lng: -122.4039 },
    
    // Central Areas
    "West Portal, San Francisco, CA": { lat: 37.7394, lng: -122.4661 },
    "Forest Hill, San Francisco, CA": { lat: 37.7575, lng: -122.4661 },
    "Twin Peaks, San Francisco, CA": { lat: 37.7544, lng: -122.4478 },
    "Diamond Heights, San Francisco, CA": { lat: 37.7487, lng: -122.4531 },
    
    // BART Stations
    "Powell Street BART, San Francisco, CA": { lat: 37.7844, lng: -122.4078 },
    "Montgomery Street BART, San Francisco, CA": { lat: 37.7889, lng: -122.4019 },
    "Civic Center BART, San Francisco, CA": { lat: 37.7794, lng: -122.4131 },
    
    // Universities and landmarks
    "UCSF Parnassus, San Francisco, CA": { lat: 37.7629, lng: -122.4583 },
    "USF, San Francisco, CA": { lat: 37.7766, lng: -122.4491 },
    "Golden Gate Park, San Francisco, CA": { lat: 37.7694, lng: -122.4862 },
    
    // Additional major streets
    "Van Ness Ave & Geary St, San Francisco, CA": { lat: 37.7870, lng: -122.4208 },
    "Market St & Castro St, San Francisco, CA": { lat: 37.7626, lng: -122.4348 },
    "Irving St & 19th Ave, San Francisco, CA": { lat: 37.7644, lng: -122.4751 },
    "Taraval St & 19th Ave, San Francisco, CA": { lat: 37.7424, lng: -122.4751 },
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

  // Add destination marker
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove existing destination marker
    if (destinationMarkerRef.current) {
      mapRef.current.removeLayer(destinationMarkerRef.current);
    }

    // Add destination marker
    const destinationIcon = L.divIcon({
      html: `<div style="background-color: #8B5CF6; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>`,
      className: "custom-marker",
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });

    const marker = L.marker([destination.lat, destination.lng], { icon: destinationIcon })
      .addTo(mapRef.current)
      .bindPopup(`
        <div style="font-family: sans-serif;">
          <strong style="color: #8B5CF6;">Destination</strong><br/>
          2140 Mandela Pkwy<br/>
          Oakland, CA 94607
        </div>
      `);

    destinationMarkerRef.current = marker;
  }, [destination]);

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

    // Add new markers for each valid data point
    validData.forEach((point, index) => {
      const coords = SF_GEOCODE_CACHE[point.origin];
      if (!coords) {
        console.log(`No coordinates found for address: ${point.origin}`);
        return;
      }

      const { color, intensity } = getColorIntensity(point.duration);
      const minutes = Math.round(point.duration / 60);

      const marker = L.circleMarker([coords.lat, coords.lng], {
        radius: 8 + intensity * 12, // Size based on travel time
        fillColor: color,
        color: "#ffffff",
        weight: 2,
        opacity: 0.8,
        fillOpacity: 0.6,
      })
        .addTo(mapRef.current!)
        .bindPopup(`
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
        `)
        .bindTooltip(point.neighborhood, {
          permanent: false,
          direction: 'top',
          offset: [0, -10]
        });

      markersRef.current.push(marker);
    });

    console.log(`Successfully rendered ${markersRef.current.length} markers`);

    // Fit map to show all points
    if (markersRef.current.length > 0) {
      const group = new L.FeatureGroup(markersRef.current);
      if (destinationMarkerRef.current) {
        group.addLayer(destinationMarkerRef.current);
      }
      mapRef.current.fitBounds(group.getBounds().pad(0.1));
    }
  }, [data, getColorIntensity, selectedTime]);

  return (
    <div
      ref={mapContainerRef}
      className="h-full w-full"
      style={{ minHeight: "400px" }}
    />
  );
} 