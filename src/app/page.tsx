import { TrafficHeatmap } from "~/app/_components/traffic-heatmap";
import { HydrateClient } from "~/trpc/server";

export default async function Home() {
  return (
    <HydrateClient>
      <main className="min-h-screen bg-gray-50">
        <TrafficHeatmap />
      </main>
    </HydrateClient>
  );
}
