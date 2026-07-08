# Requirements Document

## Introduction

Smart Market & Branch Search is an enhancement to the existing Cambodia Branch & Route Search web application. The feature enables users to search for markets (from routes.json) and external places, then automatically identifies and displays the nearest pickup branch/store (from PickupBranches.xlsx data) to the searched location. The system handles misspelled or approximate place names through fuzzy matching and external geocoding (OSM Nominatim), providing an intelligent "find nearest pickup point" experience.

## Glossary

- **Smart_Search_System**: The server-side search engine that resolves user queries to geographic coordinates and finds the nearest pickup branch
- **Market_Database**: The collection of ~200+ market/route locations stored in routes.json, each with coordinates, province, district, commune, village, and market names in English and Khmer
- **Pickup_Branch_Database**: The collection of ~597 pickup branch/store locations parsed from PickupBranches.xlsx, each with province (KH), district (EN/KH), delivery store code, and coordinates
- **Pickup_Branch**: A physical store/branch location where customers collect deliveries, identified by a code like "BANA001 - Chamnaom"
- **Haversine_Calculator**: The distance computation module that calculates great-circle distance between two geographic coordinate pairs
- **Fuzzy_Matcher**: The text matching module that handles misspellings, partial matches, and Unicode normalization for Khmer script
- **External_Geocoder**: The OSM Nominatim integration that resolves unknown place names to geographic coordinates
- **Frontend_UI**: The Leaflet-based map interface with sidebar search panel that displays search results and nearest branch information

## Requirements

### Requirement 1: Pickup Branch Data Loading

**User Story:** As a system administrator, I want the server to load and parse pickup branch data at startup, so that nearest-branch lookups can be performed without repeated file I/O.

#### Acceptance Criteria

1. WHEN the server starts, THE Smart_Search_System SHALL parse the pickup branch data file and load all valid branch records into memory
2. THE Smart_Search_System SHALL extract the following fields from each pickup branch record: province (Khmer), district (English), district (Khmer), delivery store code, latitude, and longitude
3. IF a pickup branch record has missing or invalid coordinates, THEN THE Smart_Search_System SHALL skip that record and log a warning
4. WHEN the pickup branch data is loaded, THE Smart_Search_System SHALL log the total number of valid branch records loaded

### Requirement 2: Market Search with Nearest Pickup Branch

**User Story:** As a delivery customer, I want to search for a market and see the nearest pickup branch to that market, so that I know where to collect my package.

#### Acceptance Criteria

1. WHEN a user submits a search query matching a market in the Market_Database, THE Smart_Search_System SHALL resolve the market's coordinates from the stored latitude and longitude
2. WHEN market coordinates are resolved, THE Haversine_Calculator SHALL compute the distance from those coordinates to every pickup branch in the Pickup_Branch_Database
3. WHEN distances are computed, THE Smart_Search_System SHALL return the single nearest pickup branch along with the distance in kilometers
4. THE Smart_Search_System SHALL include in the response: the matched market details, the nearest pickup branch details (store code, district, province, coordinates), and the distance between them
5. WHILE a maximum distance filter is specified, THE Smart_Search_System SHALL only return a nearest branch if it falls within the specified radius

### Requirement 3: Fuzzy Text Matching

**User Story:** As a user who may misspell place names, I want the search to handle approximate and misspelled queries, so that I can still find the correct location.

#### Acceptance Criteria

1. THE Fuzzy_Matcher SHALL normalize Khmer Unicode (NFC normalization, decomposed vowel merging, zero-width space removal) before comparing search terms
2. THE Fuzzy_Matcher SHALL perform case-insensitive matching for Latin script queries
3. WHEN an exact match is not found in the Market_Database, THE Fuzzy_Matcher SHALL attempt substring matching across market name, village, commune, district, and province fields in both English and Khmer
4. WHEN a user query contains minor spelling variations (1-2 character differences), THE Fuzzy_Matcher SHALL still match against the correct market using Levenshtein distance or similar edit-distance algorithm
5. THE Fuzzy_Matcher SHALL rank results by match quality, prioritizing exact matches over partial matches over fuzzy matches

### Requirement 4: External Geocoding for Unknown Places

**User Story:** As a user searching for a place not in the local database, I want the system to look up the place externally, so that I can still find the nearest pickup branch.

#### Acceptance Criteria

1. WHEN a search query does not match any record in the Market_Database, THE External_Geocoder SHALL query the OSM Nominatim API with the search term and a Cambodia country bounding box
2. WHEN the External_Geocoder receives a valid response with coordinates, THE Smart_Search_System SHALL use those coordinates to find the nearest pickup branch
3. WHEN external geocoding results are obtained, THE Smart_Search_System SHALL cache the result (query string mapped to coordinates and display name) to avoid repeated external API calls for the same query
4. IF the External_Geocoder returns no results or encounters a network error, THEN THE Smart_Search_System SHALL return a clear error message indicating the location could not be found
5. THE External_Geocoder SHALL respect OSM Nominatim rate limiting by waiting at least 1 second between consecutive API requests

### Requirement 5: Smart Find API Endpoint

**User Story:** As a frontend developer, I want a single API endpoint that handles the full smart search flow, so that I can integrate the feature with minimal client-side logic.

#### Acceptance Criteria

1. THE Smart_Search_System SHALL expose a GET /api/smart-find endpoint accepting query parameters: q (search text, required), max_dist (maximum distance in km, optional)
2. WHEN a request is received, THE Smart_Search_System SHALL attempt resolution in this order: (1) local Market_Database match, (2) geocoding cache lookup, (3) external OSM Nominatim geocoding
3. THE Smart_Search_System SHALL return a JSON response containing: the original query, resolved coordinates, coordinate source (market_db, cache, or nominatim), matched market details (if from local DB), nearest pickup branch details, and distance in km
4. IF the query parameter is empty or missing, THEN THE Smart_Search_System SHALL return HTTP 400 with an error message
5. IF no location can be resolved from any source, THEN THE Smart_Search_System SHALL return HTTP 404 with a descriptive error message

### Requirement 6: Frontend Smart Find Integration

**User Story:** As a user, I want to click the "Smart Find" button and see the nearest pickup branch displayed on the map with clear visual distinction, so that I can easily identify where to go.

#### Acceptance Criteria

1. WHEN the user clicks the Smart Find button with a non-empty search input, THE Frontend_UI SHALL call the /api/smart-find endpoint and display a loading state
2. WHEN a successful response is received, THE Frontend_UI SHALL display the nearest pickup branch as a red marker on the map and fly the map view to that location
3. WHEN a successful response includes resolved search coordinates different from the pickup branch coordinates, THE Frontend_UI SHALL display a blue marker at the search location to distinguish it from the pickup branch marker
4. WHEN a successful response is received, THE Frontend_UI SHALL display a result card in the sidebar showing: the pickup branch store code, district, province, distance from the searched location, and a link to open in Google Maps
5. IF the Smart Find request fails, THEN THE Frontend_UI SHALL display an error message indicating the location could not be found and suggest checking the spelling
6. THE Frontend_UI SHALL use the distance slider value as the max_dist parameter when calling the Smart Find endpoint

### Requirement 7: Pickup Branch Data Format Parsing

**User Story:** As a developer, I want the system to correctly parse the PickupBranches Excel format, so that all 597 branch locations are available for nearest-branch calculations.

#### Acceptance Criteria

1. THE Smart_Search_System SHALL parse delivery store entries in the format "CODE - Name" (e.g., "BANA001 - Chamnaom") and extract both the store code and store name as separate fields
2. THE Smart_Search_System SHALL parse latitude and longitude values from the coordinate columns and validate they fall within Cambodia's geographic bounds (latitude 9.5-14.7, longitude 102.3-107.7)
3. THE Smart_Search_System SHALL associate each pickup branch with its province (Khmer), district (English), and district (Khmer) fields
4. IF a delivery store entry does not match the expected "CODE - Name" format, THEN THE Smart_Search_System SHALL still attempt to use the raw value as the store identifier

