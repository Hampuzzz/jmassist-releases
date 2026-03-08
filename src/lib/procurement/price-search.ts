import { db } from "@/lib/db";
import { partPriceSearches, parts } from "@/lib/db/schemas";
import { eq, desc } from "drizzle-orm";
import { generateMockPrices, type PriceResult } from "./mock-sources";

interface SearchResult {
  results:    PriceResult[];
  bestPrice:  PriceResult | null;
  bestMargin: PriceResult | null;
  savings:    number; // savings vs current sell price
  fromCache:  boolean;
}

/**
 * Search for part prices across multiple sources.
 * Uses cached results if available and less than 24h old.
 */
export async function searchPartPrices(
  partId: string,
  urgency: "today" | "this_week" | "no_rush" = "no_rush",
): Promise<SearchResult> {
  // Check cache (24h TTL)
  const cached = await db
    .select()
    .from(partPriceSearches)
    .where(eq(partPriceSearches.partId, partId))
    .orderBy(desc(partPriceSearches.searchedAt))
    .limit(1);

  if (cached.length > 0) {
    const age = Date.now() - new Date(cached[0].searchedAt).getTime();
    if (age < 24 * 60 * 60 * 1000) {
      const results = (cached[0].results as PriceResult[]) ?? [];
      return {
        results,
        bestPrice: findBest(results, "price"),
        bestMargin: findBest(results, "margin"),
        savings: 0,
        fromCache: true,
      };
    }
  }

  // Get part info for pricing
  const [part] = await db
    .select()
    .from(parts)
    .where(eq(parts.id, partId));

  if (!part) {
    return { results: [], bestPrice: null, bestMargin: null, savings: 0, fromCache: false };
  }

  const costPrice = parseFloat(part.costPrice) || 0;
  const sellPrice = parseFloat(part.sellPrice) || 0;

  // Generate mock prices (will be replaced with real API calls in v1.5)
  let results = generateMockPrices(part.partNumber, costPrice, urgency);

  // Sort by urgency preference
  if (urgency === "today") {
    results.sort((a, b) => a.deliveryDays - b.deliveryDays || a.price - b.price);
  } else {
    results.sort((a, b) => a.price - b.price);
  }

  const bestPrice = findBest(results, "price");
  const bestMarginResult = findBest(results, "margin", sellPrice);

  // Calculate savings vs current cost
  const savings = bestPrice ? Math.max(0, costPrice - bestPrice.price) : 0;

  // Cache results
  await db.insert(partPriceSearches).values({
    partId,
    searchQuery: part.partNumber,
    results: results as any,
    bestPrice: bestPrice?.price?.toString() ?? null,
    bestMargin: bestMarginResult ? (sellPrice - bestMarginResult.price).toString() : null,
  });

  return {
    results,
    bestPrice,
    bestMargin: bestMarginResult,
    savings,
    fromCache: false,
  };
}

function findBest(results: PriceResult[], by: "price" | "margin", sellPrice?: number): PriceResult | null {
  if (results.length === 0) return null;

  if (by === "price") {
    return results.reduce((best, r) => (r.price < best.price ? r : best), results[0]);
  }

  // Best margin = highest difference between sell price and purchase price
  if (sellPrice && sellPrice > 0) {
    return results.reduce(
      (best, r) => ((sellPrice - r.price) > (sellPrice - best.price) ? r : best),
      results[0],
    );
  }

  return results[0];
}
