# San Francisco Traffic Heatmap for Location Planning

This Next.js application helps you choose where to live in San Francisco by analyzing travel times from various SF locations to your regular destinations. The interactive heatmap shows how much time you'll spend driving and sitting in traffic based on your weekly travel patterns, helping you minimize commute time and time spent in traffic.

## Features

- **Location Planning Tool**: Find the optimal SF neighborhood based on your regular destinations and travel frequency
- **Custom Destinations**: Add any destinations you visit regularly (work, family, activities, etc.)
- **Dual View Modes**:
  - **Time Driving**: Total travel time including traffic
  - **Time Sitting in Traffic**: Extra time spent due to traffic (rush hour time minus off-peak time)
- **Trip Frequency Configuration**: Specify how many trips per week you make during rush hour vs off-peak times for each destination
- **Multiple Time Period Views**:
  - **Rush Hour**: Filter to only rush hour trips
  - **Off-Peak**: Filter to only off-peak trips  
  - **Combined**: Weighted average based on your specified trip frequencies
- **Display Options**: View data as weekly totals or per-trip averages
- **Interactive Map**: Click on points to see detailed travel time information for each destination
- **Color-Coded Visualization**: 
  - Green: Fast travel times/low traffic impact
  - Yellow: Medium travel times/moderate traffic impact
  - Red: Slow travel times/high traffic impact
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

1. **Add Destinations**: Use the destination manager to add places you visit regularly (work, gym, family, etc.)
2. **Configure Trip Frequencies**: For each destination, specify how many trips per week you make during rush hour and off-peak times
3. **Load Traffic Data**: Click "Load Traffic Data" to fetch current traffic information
   - **Important**: Make sure to press "Load Traffic Data" whenever you add a new destination
4. **Choose Your View**:
   - **Time Driving** vs **Time Sitting in Traffic**: Toggle between total travel time or just the extra time due to traffic
   - **Time Periods**: Select Rush Hour, Off-Peak, or Combined (weighted by your trip frequencies)
   - **Display**: Choose between weekly totals or per-trip averages
5. **Explore the Map**: Click on any colored circle to see detailed travel time breakdown for all destinations
6. **Find Your Ideal Location**: Use the color coding to identify SF areas that minimize your total travel time or traffic stress

## Technical Details

- **Frontend**: Next.js 15 with TypeScript and Tailwind CSS
- **Maps**: Leaflet with OpenStreetMap tiles
- **API**: tRPC for type-safe API calls
- **Data Source**: Google Maps Distance Matrix API
- **Grid**: 10x10 sampling grid across San Francisco (121 data points)
- **Destination Management**: Dynamic destination system with customizable trip frequencies
- **Traffic Analysis**: Calculates both total travel time and traffic-only time (rush hour - off-peak)

## API Usage Notes

- The application processes data in batches of 25 points to respect Google Maps API rate limits
- Travel times are calculated for the next occurrence of the selected time (5 PM for rush hour, 3 AM for off-peak)
- The API provides traffic-aware routing when available
- Each destination is analyzed separately, allowing for personalized commute planning
- Remember to reload traffic data when adding new destinations to ensure all calculations are current

## Development

This project was built with [create-t3-app](https://create.t3.gg/). It includes:

- **TypeScript** for type safety
- **tRPC** for end-to-end type safety
- **Tailwind CSS** for styling
- **React Query** for data fetching

To add more features, modify the destination management system, or adjust the grid sampling, check the `/src/server/api/routers/traffic.ts` file and the destination manager component.
