# Requirements Document

## Introduction

The Smart Market Pickup Search system helps delivery coordinators find the nearest pickup branch for any market in Cambodia. The user searches for a **market name**, the system resolves that market's geographic coordinates from routes.json (the market location database), then calculates and displays the nearest pickup branch from the PickupBranches dataset (the authoritative branch registry).

### Data Source Clarification

- **PickupBranches.xlsx (Authoritative Branch Registry):** Contains ~597 correct delivery store codes and locations. Each record has: Province (KH), District (EN), District KH, Delivery Store (format: "BANA001 - Chamnaom", "BANA002 - Paoy Paet", etc.), Latitude, Longitude. These are the ONLY valid branch identifiers to display to users.
- **routes.json (Market Location Database):** Contains ~600 market entries with coordinates, province/district info, and market names (English + Khmer). Used EXCLUSIVELY for resolving market names to geographic coordinates. The `branch_id` field in routes.json (e.g., "MON02", "SIE01", "KAN", "PNP05") is legacy/incorrect data and MUST NOT be displayed as a branch assignment.

### Market Mode Extension

In addition to the standard route/branch search, the application provides a Market_Mode toggle. When enabled, the results list and map switch to showing Market_Location records from routes.json instead of the generic route listing. Clicking or searching for a market in Market_Mode automatically resolves that market's coordinates and calculates a Nearby_Branch_List — every Pickup_Branch within a radius (30 kilometers by default) — rather than only the single nearest branch. The single nearest Pickup_Branch remains identified as the primary recommendation within that list. This extends the existing nearest-branch calculation and max_dist mechanism (Requirement 3, Requirement 8) rather than duplicating it.

## Glossary

- **Search_Engine**: The server-side component responsible for resolving market search queries into geographic coordinates using the routes.json market location database, with optional fallback to external geocoding
- **Pickup_Branch_Finder**: The server-side component that calculates the nearest pickup branch (from PickupBranches data) to a given market's coordinates using Haversine distance
- **Geocoding_Service**: The external service (Nominatim/OpenStreetMap) used to resolve market or location names to latitude/longitude coordinates when routes.json has no match
- **Pickup_Branch**: A delivery/pickup store from the PickupBranches dataset, identified by a Delivery Store code in the format "BANA001 - Chamnaom" with associated latitude, longitude, province, and district. This is the AUTHORITATIVE source of branch IDs.
- **Market_Location**: A market entry in routes.json containing coordinates, province, district, commune, village, and market names in English and Khmer. The `branch_id` field in this data is legacy/incorrect and must be ignored for display purposes.
- **Fuzzy_Matching**: A string similarity algorithm that finds approximate matches when the user query contains misspellings or partial text
- **Map_UI**: The Leaflet-based interactive map on the right side of the split-screen layout that displays markers for search results and pickup branches
- **Correct_Branch_ID**: The delivery store code from PickupBranches.xlsx in the format "XXXXX### - Name" (e.g., "BANA001 - Chamnaom"). This is the only branch identifier that should be shown to users.
- **Market_Mode**: A UI toggle state that, when enabled, switches the results list and Map_UI from the standard route/branch listing to a Market_Location-centric view, and triggers the Nearby_Branch_List workflow when a market is clicked or searched.
- **Nearby_Branch_List**: The sorted (nearest-first) list of every Pickup_Branch within max_dist (default 30 kilometers) of a resolved market's coordinates, produced by the Pickup_Branch_Finder. The first item in this list is always the nearest Pickup_Branch.
- **Nearest_Pickup_Branch**: The single Pickup_Branch with the smallest distance to a resolved market's coordinates, as calculated by the Pickup_Branch_Finder. Always the first/primary entry of the Nearby_Branch_List and visually distinguished from the rest of the list.

## Requirements

### Requirement 1: Pickup Branch Data Loading

**User Story:** As a system administrator, I want the application to load the authoritative PickupBranches dataset at startup, so that nearest-branch calculations use the correct branch IDs and locations.

#### Acceptance Criteria

1. WHEN the server starts, THE Search_Engine SHALL parse the PickupBranches dataset (PickupBranches.xlsx) and load all pickup branch records into memory
2. THE Search_Engine SHALL store each Pickup_Branch with its Delivery Store code (e.g., "BANA001 - Chamnaom"), province, district (English and Khmer), latitude, and longitude
3. IF the PickupBranches data file is missing or malformed, THEN THE Search_Engine SHALL log an error message and continue operating with an empty pickup branch list; if error logging or empty list initialization itself fails, THE Search_Engine SHALL allow the system to fail completely
4. THE Search_Engine SHALL treat PickupBranches data as the sole authoritative source of branch identifiers — branch_id values from routes.json SHALL NOT be used as branch assignments
5. WHEN the PickupBranches data file is valid but contains zero records, THE Search_Engine SHALL continue operating normally without logging an error, treating zero branches as valid data

### Requirement 2: Market Location Resolution

**User Story:** As a delivery coordinator, I want to search for a market by name and have the system find its geographic coordinates, so that the nearest pickup branch can be calculated.

#### Acceptance Criteria

1. WHEN a user submits a market name search query, THE Search_Engine SHALL search routes.json Market_Location records to find the matching market
2. WHEN a matching market is found in routes.json, THE Search_Engine SHALL return the market name, latitude, and longitude from the matched Market_Location record; IF any required field (market name, latitude, or longitude) is missing from the matched record, THEN THE Search_Engine SHALL fail the request with an error indicating incomplete market data
3. THE Search_Engine SHALL match against market name (English and Khmer), village, commune, and district fields in routes.json
4. WHEN no market match is found in routes.json, THE Search_Engine SHALL send a geocoding request to the Geocoding_Service with the query text and a Cambodia geographic bias
5. WHEN the Geocoding_Service returns a valid result, THE Search_Engine SHALL extract the latitude and longitude from the response and cache the result for future lookups
6. IF both routes.json and the Geocoding_Service fail to resolve the query, THEN THE Search_Engine SHALL return an error response indicating that the market could not be found
7. IF the Geocoding_Service is unreachable or returns a rate-limit error, THEN THE Search_Engine SHALL return an error response with a message suggesting the user retry later

### Requirement 3: Nearest Pickup Branch Calculation

**User Story:** As a delivery coordinator, I want to see the nearest pickup branch (with correct branch ID) to any searched market, so that I can assign the correct delivery store for that area.

#### Acceptance Criteria

1. WHEN geographic coordinates are resolved for a market search query, THE Pickup_Branch_Finder SHALL calculate the Haversine distance from those coordinates to every Pickup_Branch in the PickupBranches dataset
2. THE Pickup_Branch_Finder SHALL identify the single Pickup_Branch with the smallest distance to the resolved market coordinates as the Nearest_Pickup_Branch
3. THE Pickup_Branch_Finder SHALL include the Correct_Branch_ID (e.g., "BANA001 - Chamnaom") and the calculated distance in kilometers for the Nearest_Pickup_Branch in the response
4. THE Pickup_Branch_Finder SHALL NOT use or display branch_id values from routes.json — only Delivery Store codes from PickupBranches are valid branch identifiers
5. WHILE a maximum distance filter is set by the user, THE Pickup_Branch_Finder SHALL filter out Pickup_Branch records that exceed the specified distance threshold during the search process, preventing their selection as the Nearest_Pickup_Branch
6. IF no Pickup_Branch is found within the maximum distance threshold, THEN THE Pickup_Branch_Finder SHALL return an error response indicating no pickup branch exists within the specified range
7. THE Pickup_Branch_Finder SHALL serve as the underlying component used by the Nearby_Branch_List calculation (Requirement 11) to identify which Pickup_Branch is nearest within a full ranked list

### Requirement 4: Search Result Display

**User Story:** As a delivery coordinator, I want search results to clearly show the market name, the nearest pickup branch's correct ID, and the distance, so that I can quickly identify the delivery store assignment.

#### Acceptance Criteria

1. WHEN a smart search returns a result, THE Map_UI SHALL display: the searched market name, the nearest Pickup_Branch's Correct_Branch_ID (e.g., "BANA001 - Chamnaom"), and the distance in kilometers between the market and the pickup branch
2. THE Map_UI SHALL NOT display legacy branch_id values from routes.json (e.g., "MON02", "SIE01", "KAN") as branch assignments
3. THE Map_UI SHALL format the distance to two decimal places followed by "km" (e.g., "12.34 km")
4. WHEN a smart search returns a result, THE Map_UI SHALL display a result card containing: market name as the title, nearest Pickup_Branch Correct_Branch_ID prominently displayed, and distance clearly labeled

### Requirement 5: Fuzzy Search with Khmer Text Support

**User Story:** As a field agent, I want the search to handle Khmer text and tolerate misspellings, so that I can find markets even when I type imprecisely.

#### Acceptance Criteria

1. WHEN a user submits a query containing Khmer characters, THE Search_Engine SHALL normalize the text using NFC Unicode normalization and decomposed vowel correction before matching
2. WHEN a user submits a query that does not exactly match any market in routes.json, THE Search_Engine SHALL apply Fuzzy_Matching with a similarity threshold to find approximate matches
3. THE Search_Engine SHALL rank fuzzy match results by similarity score in descending order
4. WHEN multiple fuzzy matches exceed the similarity threshold, THE Search_Engine SHALL return the match with the highest similarity score as the resolved market location
5. THE Search_Engine SHALL support fuzzy matching across both English and Khmer text fields (market, village, commune, district, province)
6. WHEN no fuzzy matches exceed the similarity threshold, THE Search_Engine SHALL return no results and SHALL NOT fall back to the closest below-threshold match

### Requirement 6: Geocoding Result Caching

**User Story:** As a system administrator, I want geocoding results to be cached locally, so that repeated searches for the same market do not consume external API quota.

#### Acceptance Criteria

1. WHEN the Geocoding_Service returns a successful result, THE Search_Engine SHALL store the query text, resolved coordinates (including partial results where only latitude or only longitude was extracted), and display name in a local cache file
2. WHEN a user submits a query that exists in the cache, THE Search_Engine SHALL return the cached coordinates (which may be partial) without calling the Geocoding_Service; a cache miss SHALL lead to a geocoding fallback via the Geocoding_Service
3. THE Search_Engine SHALL load the geocoding cache from disk at startup and persist new entries to disk after each successful geocoding response
4. IF the cache file is missing or corrupted, THEN THE Search_Engine SHALL create a new empty cache and continue operating

### Requirement 7: Map Visualization of Search Results

**User Story:** As a delivery coordinator, I want to see both the searched market location and the nearest pickup branch on the map, so that I can visually confirm the proximity relationship.

#### Acceptance Criteria

1. WHEN a smart search returns a result, THE Map_UI SHALL display a blue marker at the resolved market location coordinates with a popup showing the market name
2. WHEN a smart search returns a result, THE Map_UI SHALL display a distinct red marker at the nearest Pickup_Branch location with a popup showing the Correct_Branch_ID
3. WHEN both markers are placed, THE Map_UI SHALL draw a dashed line between the market marker and the nearest Pickup_Branch marker
4. WHEN both markers are placed, THE Map_UI SHALL adjust the map viewport to fit both markers with appropriate padding
5. WHEN a user clicks the Pickup_Branch marker, THE Map_UI SHALL display a popup containing the Correct_Branch_ID (e.g., "BANA001 - Chamnaom"), province, district, and distance from the searched market

### Requirement 8: Smart Search API Endpoint

**User Story:** As a frontend developer, I want a single API endpoint that performs the full smart market search workflow, so that the client can trigger market resolution and nearest-branch lookup with one request.

#### Acceptance Criteria

1. THE Search_Engine SHALL expose a GET endpoint at /api/smart-find that accepts query parameters: q (market search text, required), max_dist (maximum distance in km, optional)
2. WHEN a valid request is received, THE Search_Engine SHALL execute the market location resolution (from routes.json) followed by nearest Pickup_Branch calculation (from PickupBranches data)
3. THE Search_Engine SHALL return a JSON response containing: the original query, resolved market name, resolved coordinates, coordinate source (local_db, cache, or geocoding), nearest Pickup_Branch Correct_Branch_ID (e.g., "BANA001 - Chamnaom"), nearest Pickup_Branch coordinates, and distance in kilometers; the coordinate source value SHALL accurately reflect the actual resolution method used (local_db if resolved from routes.json, cache if retrieved from cache, or geocoding if resolved via Geocoding_Service)
4. THE Search_Engine SHALL NOT include legacy branch_id values from routes.json in the API response as branch assignments
5. IF the q parameter is empty, whitespace-only, or missing, THEN THE Search_Engine SHALL return a 400 status with an error message
6. THE Search_Engine SHALL complete the smart-find request within 5 seconds for local database matches and within 10 seconds for geocoding-dependent matches

### Requirement 9: Pickup Branch Detail Display

**User Story:** As a delivery coordinator, I want to see detailed information about the nearest pickup branch in the sidebar, so that I can quickly confirm the delivery store assignment for the searched market.

#### Acceptance Criteria

1. WHEN a smart search returns a nearest Pickup_Branch, THE Map_UI SHALL display a detail card in the sidebar showing: the searched market name, the Correct_Branch_ID (e.g., "BANA001 - Chamnaom") prominently, province, district (English and Khmer), coordinates, and distance from the searched market
2. THE Map_UI SHALL clearly label the distance between the searched market and the nearest Pickup_Branch (e.g., "Distance: 12.34 km")
3. THE Map_UI SHALL provide an "Open in Google Maps" link for the nearest Pickup_Branch that opens the location in a new browser tab
4. WHEN the user clicks "Back to list", THE Map_UI SHALL return to the standard search results view
