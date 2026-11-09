# RouteScan

Scan delivery QR codes (Google Maps links), get an automatically optimized stop order, open it in Google Maps.

## Run it free (Cloudflare Pages, about 5 minutes)
1. Put this folder in a GitHub repo (or use `npx wrangler pages deploy .` from this folder).
2. Cloudflare dashboard > Workers & Pages > Create > Pages > connect the repo.
   Build command: none. Output directory: `/` (project root). The `functions/` folder is picked up automatically.
3. Open the `https://<project>.pages.dev` link on your Android phone in Chrome (HTTPS is required for the camera).
4. Chrome menu > Add to Home screen / Install app.

## How it works
- Scan: html5-qrcode reads codes continuously; duplicates are ignored.
- Resolve: coordinates are read from the link. Short links go through `/api/resolve`, which follows the redirects.
  Fallback: place name geocoded via OpenStreetMap Nominatim.
- Optimize: OSRM public demo server `/trip` (free, no key), starting from your GPS position, ending at the best last stop.
  It re-runs automatically after every scan, or when you mark a stop done.
- Navigate: "Start route" starts a 40-minute clock and opens Google Maps with up to 10 stops (9 waypoints + destination). Each stop shows its predicted arrival time and minutes spare (late stops turn red). Assumes 2 min per stop (STOP_MS in index.html). Re-plans every 2 minutes from live GPS.

## Limits to know
- The OSRM demo server is for light use and has no live traffic. For heavier use, self-host OSRM or switch to a keyed
  service (Mapbox Optimization, OpenRouteService, Google Route Optimization). Only `optimize()` in index.html needs to change.
- Nominatim fallback is for occasional use (1 request/second policy).
