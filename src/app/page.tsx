import HomeClient from "@/components/HomeClient";
import { getSamples } from "@/lib/samples";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Home() {
  const samples = getSamples();

  return <HomeClient samples={samples} />;
}
