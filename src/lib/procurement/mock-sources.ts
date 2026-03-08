/**
 * Mock price sources for part procurement comparison.
 * Generates realistic prices based on the part's current cost price.
 * In v1.5 these will be replaced with real API/scraper integrations.
 */

export interface PriceResult {
  source:       string;
  sourceName:   string;
  price:        number;
  deliveryDays: number;
  inStock:      boolean;
  url?:         string;
}

interface MockSourceConfig {
  source:       string;
  sourceName:   string;
  priceRange:   [number, number]; // min/max multiplier vs cost price
  deliveryDays: [number, number]; // min/max days
  stockChance:  number;           // 0-1 probability of being in stock
  baseUrl:      string;
}

const SOURCES: MockSourceConfig[] = [
  {
    source: "trodo",
    sourceName: "Trodo",
    priceRange: [0.75, 0.85],
    deliveryDays: [1, 3],
    stockChance: 0.9,
    baseUrl: "https://www.trodo.se/search?q=",
  },
  {
    source: "autodoc",
    sourceName: "Autodoc",
    priceRange: [0.80, 0.90],
    deliveryDays: [2, 5],
    stockChance: 0.85,
    baseUrl: "https://www.autodoc.se/search?q=",
  },
  {
    source: "bilxtra_pro",
    sourceName: "BilXtra Pro",
    priceRange: [1.05, 1.15],
    deliveryDays: [0, 1],
    stockChance: 0.7,
    baseUrl: "https://pro.bilxtra.se/INTERSHOP/web/WFS/Mekonomen-BilxtraB2BSE-Site/sv_SE/-/SEK/ViewParametricSearch-SimpleOfferSearch?SearchTerm=",
  },
  {
    source: "local",
    sourceName: "Lokal märkeshandlare",
    priceRange: [1.00, 1.10],
    deliveryDays: [0, 1],
    stockChance: 0.6,
    baseUrl: "",
  },
];

/**
 * Deterministic "random" based on string hash — same input always gives same output.
 */
function hashSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function pseudoRandom(seed: number, index: number): number {
  const x = Math.sin(seed + index * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

/**
 * Generate mock price results for a part.
 * Results are deterministic per partNumber — same part always gets same prices.
 */
export function generateMockPrices(
  partNumber: string,
  costPrice: number,
  _urgency: "today" | "this_week" | "no_rush" = "no_rush",
): PriceResult[] {
  const seed = hashSeed(partNumber);

  return SOURCES.map((src, idx) => {
    const r = pseudoRandom(seed, idx);
    const [minMult, maxMult] = src.priceRange;
    const priceMult = minMult + r * (maxMult - minMult);
    const price = Math.round(costPrice * priceMult * 100) / 100;

    const [minDays, maxDays] = src.deliveryDays;
    const deliveryDays = minDays + Math.floor(pseudoRandom(seed, idx + 10) * (maxDays - minDays + 1));

    const inStock = pseudoRandom(seed, idx + 20) < src.stockChance;

    return {
      source: src.source,
      sourceName: src.sourceName,
      price: Math.max(price, 1), // never zero
      deliveryDays: inStock ? deliveryDays : deliveryDays + 3,
      inStock,
      url: src.baseUrl ? `${src.baseUrl}${encodeURIComponent(partNumber)}` : undefined,
    };
  });
}
