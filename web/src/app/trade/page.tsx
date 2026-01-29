import { TradeClient } from "@/app/trade/TradeClient";
import { loadItems } from "@/lib/items";

export const dynamic = "force-dynamic";

export default async function TradePage() {
  const items = await loadItems();
  return <TradeClient items={items} />;
}

