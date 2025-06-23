# San Francisco to Oakland Traffic Heatmap

This Next.js application shows a traffic heatmap of San Francisco, displaying travel times from various points in SF to Oakland (specifically 2140 Mandela Pkwy, Oakland, CA 94607) across the Bay Bridge.

## Features

- **Interactive Map**: Click on points to see detailed travel time information
- **Two Time Periods**: Toggle between rush hour (5 PM) and off-peak (3 AM) traffic conditions
- **Color-Coded Visualization**: 
  - Green: Fast travel times (< 20 minutes)
  - Yellow: Medium travel times (20-40 minutes)  
  - Red: Slow travel times (> 40 minutes)
- **Real-time Data**: Uses Google Maps Distance Matrix API for accurate traffic-aware travel times

## Setup

### 1. Get a Google Maps API Key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **Distance Matrix API**
4. Create credentials (API Key)
5. Optionally restrict the API key to your domain/IP for security

### 2. Configure Environment Variables

1. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Add your Google Maps API key to the `.env` file:
   ```
   GOOGLE_MAPS_API_KEY="your_actual_api_key_here"
   ```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run the Application

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## How to Use

1. **Load Traffic Data**: Click the "Load Traffic Data" button to fetch current traffic information
2. **Switch Time Periods**: Use the "Rush Hour" and "Off-Peak" buttons to toggle between different traffic conditions
3. **Explore the Map**: Click on any colored circle to see detailed travel time and distance information
4. **View Statistics**: Check the stats panel below the map for average travel times and data point counts

## Technical Details

- **Frontend**: Next.js 15 with TypeScript and Tailwind CSS
- **Maps**: Leaflet with OpenStreetMap tiles
- **API**: tRPC for type-safe API calls
- **Data Source**: Google Maps Distance Matrix API
- **Grid**: 10x10 sampling grid across San Francisco (121 data points)

## API Usage Notes

- The application processes data in batches of 25 points to respect Google Maps API rate limits
- Travel times are calculated for the next occurrence of the selected time (5 PM for rush hour, 3 AM for off-peak)
- The API provides traffic-aware routing when available

## Development

This project was built with [create-t3-app](https://create.t3.gg/). It includes:

- **TypeScript** for type safety
- **tRPC** for end-to-end type safety
- **Tailwind CSS** for styling
- **React Query** for data fetching

To add more features or modify the grid sampling, check the `/src/server/api/routers/traffic.ts` file.
