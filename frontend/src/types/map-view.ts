type LayerType = "HexagonLayer"; // Extend if there are other layer types
type DataUnit = "people"; // Extend if there are other units

export interface IMapDataPoint {
  COORDINATES: [number, number]; // [latitude, longitude]
  LOCATION_NAME: string;
  DATETIME: string; // ISO 8601 datetime string
  NUMERICAL_DATA: number; // population count
  NUMERICAL_DATA_UNIT: string; // e.g., "people"
  DESCRIPTION: string;
}
