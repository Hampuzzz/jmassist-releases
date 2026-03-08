export interface BilXtraPartResult {
  partNumber:   string;
  name:         string;
  description:  string;
  brand:        string;
  category:     string;
  unit:         string;
  priceExVat:   number;
  vatRate:      number;
  stockStatus:  "in_stock" | "low_stock" | "out_of_stock";
  leadTimeDays: number | null;
  imageUrl:     string | null;
}

export interface BilXtraSearchRequest {
  query:      string;
  vehicleReg?: string;
  category?:  string;
  limit?:     number;
}

export interface BilXtraSearchResponse {
  success: boolean;
  results: BilXtraPartResult[];
  total:   number;
}
