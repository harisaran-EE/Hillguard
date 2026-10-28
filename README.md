# Hillguard — terrain safety prototype

A mobile-first PWA prototype for landslide and road hazard awareness in
Northeast India. The app uses plain HTML, CSS, and JavaScript with no build
step.

## Run locally

Serve the repository over localhost or HTTPS. For example:

```sh
python -m http.server 8000
```

Then open `http://localhost:8000`. GPS and service-worker features require
localhost or HTTPS. On mobile, deploy to HTTPS to install the PWA.

## Prototype features

- Online/offline connectivity indicator and a service-worker-cached app shell.
- Bright and dark themes with a saved browser preference.
- Interactive OpenStreetMap basemap with approximate rainfall spots from a
  3 × 3 Open-Meteo sample grid around the selected location or sample Guwahati
  area. Drizzle is green, moderate rain yellow, rain orange, and heavy rain
  red. A hazard icon marks model-indicated thunderstorms.
- Open-Meteo rainfall-model estimate for the sample Guwahati area or a location
  the user explicitly shares. The display shows plain-language rainfall
  intensity and precipitation amount; sample-location readings can be cached
  for offline viewing.
- Offline safety guide and direct `tel:112` link.
- Hazard report form limited to landslides and road blocks, with required
  photo, GPS/time capture, and an explicitly labeled sample-location option.
- Local reports saved in IndexedDB and a 2 km / 1 hour community-confidence
  threshold. Demo-threshold reports exercise the Scout / Sentinel / Guardian
  points display.
- Sample-only proximity alert, filters, and illustrative route preview.

The rain-intensity display uses the rain and shower amount from the weather
model's latest interval, converts it to an hourly-equivalent rate, and assigns
an internal score from 0 to 10 (one point per 2 mm/h, capped at 10) to derive
the user-facing intensity label. The numeric score is not displayed and is not
a landslide-risk score. It is not currently combined with seismic data. The
map categories are based on hourly-equivalent model rates: drizzle up to
2.5 mm/h, moderate up to 7.5 mm/h, rain up to 15 mm/h, and heavy above that.
The storm icon indicates a thunderstorm weather code from the model; it does
not mean a disastrous storm was confirmed. These are not official
meteorological or landslide-warning thresholds. Model estimates can differ
from local conditions. Sample-location readings and map points are cached on
this device for up to 30 minutes; GPS weather is not persisted.

## Important limitations

Rainfall spots are approximate forecast-model values at a small set of points,
not a continuous radar image, rain-gauge observation, official alert, or
landslide-risk assessment. The OpenStreetMap base map and Leaflet library
require an internet connection and are not available offline. Sample hazard
reports, route options, and proximity alerts remain illustrative demo data.
The internal rainfall score is not a forecast or geological assessment and
does not use seismic data. Open-Meteo is a third-party forecast model, not an
on-site rain gauge; it has no free-tier uptime guarantee. The free API is for
non-commercial use and requires
[CC BY 4.0 attribution](https://open-meteo.com/en/licence). Browser geolocation
is requested only after explicit user action; the selected center and nearby
grid coordinates are sent to Open-Meteo, and map tiles are requested from
OpenStreetMap. GPS weather is not saved as weather cache data. Reports and
attached photos are stored locally in the browser; this prototype has no
server, accounts, moderation, automatic sync, dispatch, or official hazard
feed.

The safety guide is general information, not a substitute for emergency
services. In India, call 112 for emergencies and follow instructions from
authorities. **Do not rely on this prototype for real-time safety decisions or
navigation.**

Before real-world use, integrate authoritative regional feeds, verify emergency
contacts and evacuation guidance with local authorities, add a secure backend
and report moderation, and independently validate the risk model.

## Deploying a prototype on Vercel

Import the repository into Vercel and use the repository root. No framework
preset, build command, or output directory is required. Vercel HTTPS enables
PWA installation and offline app-shell caching.