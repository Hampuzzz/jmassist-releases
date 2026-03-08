import type { BilXtraSearchRequest, BilXtraSearchResponse } from "./types";

const BILXTRA_API_URL = process.env.BILXTRA_API_URL ?? "https://api.bilxtra.se/v2";
const BILXTRA_API_KEY = process.env.BILXTRA_API_KEY;
const BILXTRA_CUSTOMER_ID = process.env.BILXTRA_CUSTOMER_ID;

/**
 * Searches the BilXtra parts catalog.
 * Falls back to mock data in development.
 *
 * PLACEHOLDER: BilXtra API endpoint and auth mechanism must be
 * confirmed with BilXtra/LKQ before production use.
 */
export async function searchBilXtraParts(
  request: BilXtraSearchRequest,
): Promise<BilXtraSearchResponse> {
  if (!BILXTRA_API_KEY || process.env.NODE_ENV === "development") {
    const { mockSearch } = await import("./mock");
    return mockSearch(request);
  }

  const response = await fetch(`${BILXTRA_API_URL}/parts/search`, {
    method: "POST",
    headers: {
      Authorization:    `Bearer ${BILXTRA_API_KEY}`,
      "X-Customer-Id":  BILXTRA_CUSTOMER_ID ?? "",
      Accept:           "application/json",
      "Content-Type":   "application/json",
    },
    body: JSON.stringify({
      q:          request.query,
      reg_nr:     request.vehicleReg,
      category:   request.category,
      limit:      request.limit ?? 20,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`BilXtra API ${response.status}`);
  }

  return response.json();
}
