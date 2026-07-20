# 🇰🇭 Metfone Express Grid & Cambodia Address Resolver v3.2

An interactive, high-performance web application and API engine for looking up Cambodia Metfone Express Post Office branches, commercial markets, administrative areas (Provinces → Districts → Communes → Villages), and logistics routes.

---

## 📦 1. Files to Hand Over to IT Team

Give your IT team the **entire project repository folder** containing the following essential files and directories:

```
genroute/
├── server.js                      # Main Node.js Backend Server & Address Resolver v3.2 Engine
├── package.json                   # Dependencies & Scripts
├── pickup_branch_lookup.csv       # 650 Metfone Post Office Branches lookup dataset
├── data/                          # 📁 Primary Local Search Datasets
│   ├── ncdd_hierarchy.json        # 16,457 Official NCDD Administrative Records (25 Provinces, 209 Districts, 1634 Communes, 14589 Villages)
│   ├── curated_landmarks.json     # 93 Curated National Landmarks (100% Priority Lock)
│   ├── famous_markets.json        # 664 Famous Markets, Malls, Boreys, Bus Stations
│   ├── pickup_branches.json       # JSON format of Post Office branches
│   ├── routes.json                # 894 Delivery Route records
│   ├── geocoding_cache.json       # 0ms Instant Cache File
│   └── learned_locations.json     # Auto-learning location memory
├── public/                        # 📁 Web Application Frontend (HTML, CSS, JS)
│   ├── index.html                 # Main Dashboard Web Page
│   ├── app.js                     # Frontend Map UI & Autocomplete Engine
│   ├── style.css                  # Metfone Express Glassmorphism Theme
│   ├── pastemaster.html           # Bulk Excel / Address Paste Master Tool
│   ├── pastemaster.js             # Bulk Geocoder Logic
│   └── manifest.json              # PWA App Manifest
└── tests/
    └── resolver-regression.js     # 41-Test Automated Address Resolver Test Suite
```

---

## 🚀 2. Quick IT Deployment Instructions

### Prerequisites
* **Node.js**: v16.x or higher
* **npm**: v8.x or higher

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Set Environment Variables (Optional)
Create a `.env` file in the root directory:
```env
PORT=3000
GEMINI_API_KEY=your_optional_gemini_api_key_here
```

### Step 3: Run the Server
```bash
# Start Server in Production Mode
node server.js

# Or run using PM2 for production process management:
pm2 start server.js --name "metfone-express-grid"
```

### Step 4: Access Application & Verify
* Web UI: [http://localhost:3000](http://localhost:3000)
* Bulk Paste Master: [http://localhost:3000/pastemaster](http://localhost:3000/pastemaster)
* Address Resolver API: `GET http://localhost:3000/api/smart-find?q=វត្តភ្នំ`
* Run Automated Regression Tests:
```bash
node tests/resolver-regression.js
```

---

## 🔍 3. Address Resolver Engine Features & Rules (v3.2)

1. **Exact Match Priority Lock (100% Confidence)**: Exact curated landmark and branch names lock immediately before executing fuzzy logic.
2. **Hierarchical Priority Ranking**:
   - Administrative Divisions (Province → District → Commune → Village)
   - Curated Landmarks (Wat, Monument, Bridge, Airport, Hospital, University)
   - Markets & Shopping Malls
   - Streets & Roads
   - Boreys & Residential Gated Communities
   - Nearby Businesses
3. **Numeric Token Rule**: Numeric tokens (e.g. `271`, `6A`, `2004`) and Khmer numerals (`២៧១`, `៦អា`) must match exactly and are never substituted.
4. **Generic Name Ambiguity**: Generic names without admin context (e.g. `វត្តថ្មី` or `ផ្សារថ្មី`) trigger ambiguous dropdown options rather than guessing.
5. **No Nearby Business Override**: Landmark queries will never be replaced by small nearby shops or businesses.
6. **Self-Learning Memory**: Auto-saves external geocoded coordinates to `data/learned_locations.json` for 0ms future lookups.

---

## 🌐 4. Production Hosting Options
* **Vercel / Render / AWS EC2 / DigitalOcean**:
  * Set **Build Command**: `npm install`
  * Set **Start Command**: `node server.js`
  * Port: `3000` (or `process.env.PORT`)
