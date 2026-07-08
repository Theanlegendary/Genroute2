# GENRoute - Cambodia Smart-Route & Metfone Express Locator

An interactive, high-performance web application designed for looking up Cambodia Metfone Express Post Office branches, commercial markets, and routing paths. Includes dynamic province filters, alphanumeric code search, satellite mapping modes, and optimized marker clustering.

## 🚀 Features

* **Smart Alphanumeric Search:** Direct lookup for post office codes (e.g., `pnpp014`, `bat01`, `sie02`) that instantly zooms to coordinates and opens details popup window.
* **Lag-Free Rendering:** Powered by **Leaflet MarkerCluster** which groups 600+ locations, keeping the map fast and responsive on mobile and desktop.
* **Google Maps Autocomplete & Geocoding:** Custom backend proxying client autocomplete search suggestions and resolving Khmer/English queries dynamically with spelling corrections.
* **Map Style Layer Switcher:** Switch between Google-style Map, Hybrid (Satellite + Labels), Dark Mode, and Positron Gray standard views.
* **Province Dropdown Filter:** Narrows local search and autocomplete queries strictly to one of Cambodia's 25 provinces.
* **Minimalist Glassmorphism UI:** Asymmetric sidebar dashboard with a clean visual grid and responsive design.

---

## 🛠️ Architecture

* **Frontend:** Vanilla HTML5, CSS3 Variables, Leaflet Map API, and Client JS.
* **Backend:** Node.js Express server (`server.js`) providing proxy endpoints.
* **Local Database:** Static JSON files (`data/routes.json` for markets/localities, `data/pickup_branches.json` for post office branches) so **no external database server is required**.

---

## 💻 Local Setup

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Run Development Server (with nodemon hot-reload):**
   ```bash
   npm run dev
   ```

3. **Open in Browser:**
   Go to [http://localhost:3000](http://localhost:3000)

---

## 🌐 Production Hosting & Custom Domain

All configuration and data folders are self-contained in this repository. 

To host it under your own domain (e.g. `yourdomain.com`) on **Render.com**:
1. Connect this repository to your Render account.
2. Set Build Command: `npm install`
3. Set Start Command: `node server.js`
4. Bind your domain in Render settings under **Custom Domains** and configure the CNAME / A records at your registrar.
