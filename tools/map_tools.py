import requests
from langchain_core.tools import tool, BaseTool
from typing import List, Literal, Type, Dict
import time
import os 
from pydantic import BaseModel, Field
from schemas.tool_structured_input import GeocodeInput
from dotenv import load_dotenv

load_dotenv()


GOOGLE_MAP_API_KEY = os.getenv("GOOGLE_MAP_API_KEY")
GOOGLE_MAPS_TIMEOUT = 10


# Geocoding Multiple Location 
class GoogleGeocodingTool(BaseTool):
    name: str = "google_geocoding_tool"
    description: str = """
    Uses this tool to fetch the exact latitude and longitude for the given list of addresses. The input parameter 'places' should be a list of string (address or location name).
    """
    args_schema: Type[BaseModel] = GeocodeInput

    def _run(self, places: List[str], explanation: str = None) -> List[Dict]:

        print(f"---TOOL CALL: google_geocoding_tool --- Query: {places}")
        if not GOOGLE_MAP_API_KEY:
            error_message = "Error: Google Maps API key is not configured."
            print(error_message)
            return {"error": error_message}
        
        op_response = [] # List to store coordinates of all the input places

        for place in places:            # Prepare the request URL
            url = "https://maps.googleapis.com/maps/api/geocode/json"
            params = {
                "address": place,
                "key": GOOGLE_MAP_API_KEY
            }
            
            try:
                print(f"---Geocoding: {place}---")
                response = requests.get(url, params=params, timeout=GOOGLE_MAPS_TIMEOUT)
                response.raise_for_status()
                
                data = response.json()
                if data.get("status") != "OK" or not data.get("results"):
                    error_message = f"Error: Could not find geolocation data for '{place}'."
                    print(error_message)
                    return error_message

                # Assuming we're interested in the first result
                result = data["results"][0]
                location = result["geometry"]["location"]
                latitude = location.get("lat")
                longitude = location.get("lng")
                message = f"Geolocation for '{place}': Latitude = {latitude}, Longitude = {longitude}"
                print(message)
                place_coord = {
                    "place": place,
                    "latitude": latitude,
                    "longitude": longitude
                }
                # Append the individual place coordinates to the list
                op_response.append(place_coord)
            
            except Exception as e:
                error_message = f"Error processing Google Maps API results for '{place}': {str(e)}"
                print(error_message)
                op_response.append({"place": place, "error": error_message})
            
        return op_response

google_geocoding_tool = GoogleGeocodingTool()
tool_list = [google_geocoding_tool]


# Geocoding Single Location Only
# class GoogleGeocodingTool(BaseTool):
#     name: str = "google_geocoding_tool"
#     description: str = """
#     Uses the Google Maps Geocoding API to fetch the exact latitude and longitude for a given place.
#     The provided 'place' is a string (address or location name) that is be obtained from input passage.
    
#     Returns:
#         A string message with the fetched latitude and longitude, or an error message if not found.
#     """
#     args_schema: Type[BaseModel] = GeocodeInput

#     def _run(self, place: str) -> str:

#         print(f"---TOOL CALL: google_geocoding_tool --- Query: {place}")
#         if not GOOGLE_MAP_API_KEY:
#             error_message = "Error: Google Maps API key is not configured."
#             print(error_message)
#             return error_message

#         # Prepare the request URL
#         url = "https://maps.googleapis.com/maps/api/geocode/json"
#         params = {
#             "address": place,
#             "key": GOOGLE_MAP_API_KEY
#         }
        
#         try:
#             print(f"---TOOL CALL: google_geocoding_tool --- Querying for place: {place}")
#             response = requests.get(url, params=params, timeout=GOOGLE_MAPS_TIMEOUT)
#             response.raise_for_status()
            
#             data = response.json()
#             if data.get("status") != "OK" or not data.get("results"):
#                 error_message = f"Error: Could not find geolocation data for '{place}'."
#                 print(error_message)
#                 return error_message

#             # Assuming we're interested in the first result
#             result = data["results"][0]
#             location = result["geometry"]["location"]
#             latitude = location.get("lat")
#             longitude = location.get("lng")
#             message = f"Geolocation for '{place}': Latitude = {latitude}, Longitude = {longitude}"
#             print(message)
#             return message

#         except requests.exceptions.Timeout:
#             error_message = f"Error: Google Maps API request timed out after {GOOGLE_MAPS_TIMEOUT} seconds."
#             print(error_message)
#             return error_message
#         except requests.exceptions.RequestException as e:
#             error_message = f"Error performing Google Maps API request for '{place}': {e}"
#             print(error_message)
#             return error_message
#         except Exception as e:
#             error_message = f"Error processing Google Maps API results for '{place}': {e}"
#             print(error_message)
#             return error_message