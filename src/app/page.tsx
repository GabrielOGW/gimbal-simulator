import { Simulator } from "@/components/simulator/Simulator";
import { getCatalog } from "@/lib/equipment/catalog";

export default async function Page() {
  // Catálogo carregado no servidor: trocar a fonte (JSON → Postgres) não afeta a UI.
  const catalog = await getCatalog();
  return <Simulator catalog={catalog} />;
}
