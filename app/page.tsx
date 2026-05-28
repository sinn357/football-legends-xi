import { LegendBuilder } from "@/components/LegendBuilder";
import { loadLegendData } from "@/lib/legend-data";

export default function Home() {
  const data = loadLegendData();

  return <LegendBuilder data={data} />;
}
