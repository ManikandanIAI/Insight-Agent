// Functions for loading and processing map data

import { MapPoint } from './types';
import { NextResponse } from 'next/server';



// API endpoint to serve map data
// This simulates fetching data from a database


// Sample data for the Icon Layer
const iconLayerData: MapPoint[] = [
  {
    layer: 'IconLayer',
    latitude: 51.1657,
    longitude: 10.4515,
    location_name: "Germany",
    description: "Germany's economy grew 0.4% in Q1 2025 according to Destatis, and in April 2025 the Bundestag passed a digital sovereignty bill to boost home-grown tech."
  },
  {
    layer: 'IconLayer',
    latitude: -25.2744,
    longitude: 133.7751,
    location_name: "Australia",
    description: "Australia recorded its hottest February on record in 2025, sparking national climate debates, and in March 2025 the RBA held interest rates steady at 4.35%."
  },
  {
    layer: 'IconLayer',
    latitude: 56.1304,
    longitude: -106.3468,
    location_name: "Canada",
    description: "Canada unveiled its 2025 federal budget in April, allocating CAD 20 billion to green infrastructure, while unemployment fell to 5.4% in March 2025."
  },
  {
    layer: 'IconLayer',
    latitude: -14.2350,
    longitude: -51.9253,
    location_name: "Brazil",
    description: "Brazil saw inflation drop to 3.2% in March 2025 per IBGE data, and in February 2025 the government launched an Amazon reforestation initiative."
  },
  {
    layer: 'IconLayer',
    latitude: -1.2864,
    longitude: 36.8172,
    location_name: "Kenya",
    description: "Kenya issued its first sovereign green bond in January 2025 raising $300 million, and Nairobi hosted the African Climate Summit in March 2025."
  },
  {
    layer: 'IconLayer',
    latitude: 55.3781,
    longitude: -3.4360,
    location_name: "United Kingdom",
    description: "UK inflation eased to 2.1% in April 2025, and in March 2025 local elections were held across England and Scotland."
  },
  {
    layer: 'IconLayer',
    latitude: 36.2048,
    longitude: 138.2529,
    location_name: "Japan",
    description: "Japan's unemployment rate fell to 2.4% in February 2025 according to JILPT, and Tokyo rolled out a new EV subsidy scheme in March 2025."
  },
  {
    layer: 'IconLayer',
    latitude: 37.5665,
    longitude: 126.9780,
    location_name: "South Korea",
    description: "South Korea's exports grew 5% year-on-year in March 2025 as per KITA, and Seoul unveiled its 2050 carbon-neutrality roadmap in April 2025."
  },
  {
    layer: 'IconLayer',
    latitude: 48.8566,
    longitude: 2.3522,
    location_name: "France",
    description: "France reported 1.5% GDP growth in Q1 2025 (INSEE), and Paris hosted the UNESCO cultural summit in early April 2025."
  },
  {
    layer: 'IconLayer',
    latitude: 37.0902,
    longitude: -95.7129,
    location_name: "United States",
    description: "The U.S. economy expanded at an annualized rate of 1.8% in Q1 2025 (BEA), and in April 2025 the Fed kept benchmark rates in the 5.25–5.50% range."
  }
];

// Sample data for the Hexagon Layer
const hexagonLayerData: MapPoint[] = [
  { 
    layer: 'HexagonLayer', 
    latitude: 20.5937, 
    longitude: 78.9629, 
    location_name: "India",
    datetime_info: "2020-01-01T00:00:00.000Z", 
    numerical_data: 2.87, 
    numerical_data_unit: "trillion USD" 
  },
  { 
    layer: 'HexagonLayer', 
    latitude: 20.5937, 
    longitude: 78.9629, 
    location_name: "India",
    datetime_info: "2021-01-01T00:00:00.000Z", 
    numerical_data: 3.17, 
    numerical_data_unit: "trillion USD" 
  },
  { 
    layer: 'HexagonLayer', 
    latitude: 51.1657, 
    longitude: 10.4515, 
    location_name: "Germany",
    datetime_info: "2017-01-01T00:00:00.000Z", 
    numerical_data: 538,  
    numerical_data_unit: "TWh" 
  },
  { 
    layer: 'HexagonLayer', 
    latitude: 51.1657, 
    longitude: 10.4515, 
    location_name: "Germany",
    datetime_info: "2018-01-01T00:00:00.000Z", 
    numerical_data: 595,  
    numerical_data_unit: "TWh" 
  },
  { 
    layer: 'HexagonLayer', 
    latitude: 55.3781, 
    longitude: -3.4360, 
    location_name: "United Kingdom", 
    datetime_info: "2019-01-01T00:00:00.000Z", 
    numerical_data: 33.1, 
    numerical_data_unit: "%" 
  },
  { 
    layer: 'HexagonLayer', 
    latitude: 55.3781, 
    longitude: -3.4360, 
    location_name: "United Kingdom", 
    datetime_info: "2020-01-01T00:00:00.000Z", 
    numerical_data: 43.1, 
    numerical_data_unit: "%" 
  },
  { 
    layer: 'HexagonLayer', 
    latitude: 40.4637, 
    longitude: -3.7492, 
    location_name: "Spain", 
    datetime_info: "2018-01-01T00:00:00.000Z", 
    numerical_data: 15.3, 
    numerical_data_unit: "%" 
  },
  { 
    layer: 'HexagonLayer', 
    latitude: 40.4637, 
    longitude: -3.7492, 
    location_name: "Spain", 
    datetime_info: "2019-01-01T00:00:00.000Z", 
    numerical_data: 14.1, 
    numerical_data_unit: "%" 
  },
  { 
    layer: 'HexagonLayer', 
    latitude: 36.2048, 
    longitude: 138.2529,
    location_name: "Japan", 
    datetime_info: "2020-01-01T00:00:00.000Z", 
    numerical_data: 82.2, 
    numerical_data_unit: "%" 
  },
  { 
    layer: 'HexagonLayer', 
    latitude: 36.2048, 
    longitude: 138.2529,
    location_name: "Japan", 
    datetime_info: "2021-01-01T00:00:00.000Z", 
    numerical_data: 83.6, 
    numerical_data_unit: "%" 
  }
];


export async function loadIconLayerData(): Promise<MapPoint[]> {
    // In a real-world scenario, we would fetch this from an API
    // For this demo, we'll use the data from the configuration file
    try {
      return iconLayerData;
    } catch (error) {
      console.error('Error loading icon layer data:', error);
      return [];
    }
  }
  


  
  export async function loadHexagonLayerData(): Promise<MapPoint[]> {
    // In a real-world scenario, we would fetch this from an API
    // For this demo, we'll use the data from the configuration file
    try {
      return hexagonLayerData;
    } catch (error) {
      console.error('Error loading hexagon layer data:', error);
      return [];
    }
  }

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const layer = searchParams.get('layer');
  
  // Sleep to simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));

  if (layer === 'icon') {
    return NextResponse.json(iconLayerData);
  } else if (layer === 'hexagon') {
    return NextResponse.json(hexagonLayerData);
  } else {
    // Return both if no specific layer is requested
    return NextResponse.json([...iconLayerData, ...hexagonLayerData]);
  }
}