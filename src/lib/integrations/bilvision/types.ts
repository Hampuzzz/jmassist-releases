export interface BilvisionVehicleData {
  regNr:               string;
  vin:                 string | null;
  brand:               string;
  model:               string;
  modelYear:           number;
  color:               string | null;
  colorCode:           string | null;
  fuelType:            "bensin" | "diesel" | "el" | "hybrid" | "laddhybrid" | "etanol" | "gas" | "okänd";
  engineSizeCC:        number | null;
  powerKw:             number | null;
  transmission:        "manuell" | "automat" | null;
  driveType:           "framhjulsdrift" | "bakhjulsdrift" | "fyrhjulsdrift" | null;
  firstRegisteredAt:   string | null;
  taxClass:            string | null;
  inspectionValidUntil: string | null;
  currentOwnerSince:   string | null;
  insuranceCompany:    string | null;
  _rawResponse:        Record<string, unknown>;
}

export interface BilvisionApiResponse {
  success: boolean;
  data:    BilvisionVehicleData | null;
  error?: {
    code:    string;
    message: string;
  };
}

// Mapped to our internal vehicle schema shape
export interface MappedVehicleData {
  regNr:            string;
  vin?:             string;
  brand:            string;
  model:            string;
  modelYear?:       number;
  color?:           string;
  fuelType?:        string;
  engineSizeCc?:    number;
  powerKw?:         number;
  transmission?:    string;
  driveType?:       string;
  externalData:     Record<string, unknown>;
  externalFetchedAt: Date;
}
