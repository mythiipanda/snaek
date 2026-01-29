import { SkinsClient } from "@/app/skins/SkinsClient";
import { loadItems } from "@/lib/items";

export default async function SkinsPage() {
  const items = await loadItems();
  return <SkinsClient items={items} />;
}

