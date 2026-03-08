import type { BilXtraSearchRequest, BilXtraSearchResponse } from "./types";

export async function mockSearch(
  request: BilXtraSearchRequest,
): Promise<BilXtraSearchResponse> {
  await new Promise((resolve) => setTimeout(resolve, 300));

  const mockParts = [
    {
      partNumber:   "BP-123-F",
      name:         "Bromsbelägg fram",
      description:  "OE-kvalitet bromsbelägg för framaxeln",
      brand:        "Bosch",
      category:     "Bromsar",
      unit:         "set",
      priceExVat:   420,
      vatRate:      25,
      stockStatus:  "in_stock" as const,
      leadTimeDays: null,
      imageUrl:     null,
    },
    {
      partNumber:   "OF-5W30-5L",
      name:         "Motorolja 5W-30 5L",
      description:  "Helsyntetisk motorolja, ACEA C3",
      brand:        "Castrol",
      category:     "Olja",
      unit:         "liter",
      priceExVat:   349,
      vatRate:      25,
      stockStatus:  "in_stock" as const,
      leadTimeDays: null,
      imageUrl:     null,
    },
    {
      partNumber:   "AF-V70-15",
      name:         "Luftfilter",
      description:  "Luftfilter för Volvo V70 2007-2016",
      brand:        "Mann",
      category:     "Filter",
      unit:         "pcs",
      priceExVat:   185,
      vatRate:      25,
      stockStatus:  "low_stock" as const,
      leadTimeDays: 2,
      imageUrl:     null,
    },
  ];

  const q = request.query.toLowerCase();
  const filtered = mockParts.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.partNumber.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q),
  );

  return { success: true, results: filtered, total: filtered.length };
}
