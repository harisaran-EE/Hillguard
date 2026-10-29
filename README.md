# HillSafe — terrain safety

HillSafe is a mobile-first PWA for landslide and road hazard awareness in
Northeast India. It uses plain HTML, CSS, and JavaScript with no build step.
The responsive dashboard brings map activity, local weather estimates,
community reports, public contacts, offline guidance, and emergency calling
into one interface.

## Run locally

Serve the repository over localhost or HTTPS. For example:

```sh
python -m http.server 8000
```

Then open `http://localhost:8000`. GPS and service-worker features require
localhost or HTTPS. On mobile, deploy to HTTPS to install the PWA.

## Features

- Online/offline connectivity indicator and a service-worker-cached app shell.
- Bright and dark themes with a saved browser preference.
- Interactive OpenStreetMap basemap with approximate rainfall spots from a
  3 × 3 Open-Meteo sample grid around the selected location or Guwahati reference
  area. Drizzle is green, moderate rain yellow, rain orange, and heavy rain
  red. A hazard icon marks model-indicated thunderstorms.
- Recent hazard-activity overlays: USGS earthquake catalog events for
  Northeast India and GPS landslide reports saved on this device, each counted
  over a rolling 365-day window in approximate 10 × 11 km map cells. One or
  two events are yellow, three to five orange, and six or more red. Earthquake
  markers animate a ground crack; landslide reports animate falling rocks.
  Nearby current model-estimated rain adds a blue droplet to a landslide
  marker, without changing its incident-count tier.
- Open-Meteo rainfall-model estimate for the sample Guwahati area or a location
  the user explicitly shares. The display shows plain-language rainfall
  intensity and precipitation amount; sample-location readings can be cached
  for offline viewing.
- Offline safety guide and direct `tel:112` link.
- State and district contact lookup for all eight Northeast states. Officially
  published fire-station contact numbers are shown under their named stations
  and districts. Meghalaya's station contacts are mapped to their listed
  districts, with a separate Eastern Range control-room card for the seven
  Khasi-Jaintia districts it serves. Assam's headquarters control-room lines
  are labeled as state-level contacts, not district stations. For other
  districts without a verified local or state fire contact, the directory
  directs users to nationwide emergency response at 112. Official fire-service
  station listings may name stations without publishing their contact numbers.
- Hazard report form limited to landslides and road blocks, with required
  photo, GPS/time capture, and an explicitly labeled sample-location option.
- Reports and original photos saved in browser IndexedDB on this device.
- Optional, unchecked-by-default Gemini image triage. With consent, a resized
  photo, category, and description are sent to the Vercel API; GPS coordinates
  are not sent. Triage returns a cautious visual suggestion, not a verification.
- Optional Gemini conditions summary. With consent, only the displayed
  rainfall estimate and aggregate regional USGS earthquake count are sent;
  coordinates and locally stored community reports are not included. The
  generated text is not an alert, forecast, or safety assessment.
- Reputation counts only human-approved reports with captured GPS, with
  Guardian at 5 and Saviour at 20. Reference-location reports do not count.
  Human moderation and shared report storage are not configured, so new report
  approvals and badge progression are not currently available.
- Filters and a reference proximity preview. Route options are illustrative;
  no directions provider or live road-closure feed is connected.

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

## Data scope and operational gaps

Rainfall spots are approximate forecast-model values at a small set of points,
not a continuous radar image, rain-gauge observation, official alert, or
landslide-risk assessment. The OpenStreetMap base map and Leaflet library
require an internet connection and are not available offline. Example hazard
reports, route options, and proximity previews are illustrative, not live
incident data. Optional AI photo triage is only a visual
suggestion: it cannot confirm the event, its time, location, or severity. It
does not determine whether a report is true or false. Reports remain pending
human review, and AI suggestions must not be used to judge real-world
credibility.
The internal rainfall score is not a forecast or geological assessment and
does not use seismic data. The separate earthquake layer counts USGS catalog
events; it is not an earthquake susceptibility map, prediction, or official
warning. Landslide counts come only from GPS reports saved on this browser.
Those reports are unverified, private to this device, and may be incomplete.
The USGS query uses a fixed rectangle spanning Northeast India and nearby
border regions, grouped into 0.1° cells (approximately 10 × 11 km);
the colors summarize event counts, not risk. The NRSC/ISRO Landslide Atlas is
provided as historical reference for mapped landslides from 1998–2022, but is
not used for live or rolling-year counts. A current, map-ready NRSC incident
feed and shared report database are not connected. Nearby rain is a separate
Open-Meteo estimate and does not increase a hazard tier. Open-Meteo is a
third-party forecast model, not an
on-site rain gauge; it has no free-tier uptime guarantee. The free API is for
non-commercial use and requires
[CC BY 4.0 attribution](https://open-meteo.com/en/licence). Browser geolocation
is requested only after explicit user action; the selected center and nearby
grid coordinates are sent to Open-Meteo, the map requests earthquake data for
the fixed Northeast India and nearby-border rectangle from the USGS GeoJSON
service, and map tiles are requested from OpenStreetMap. The earthquake catalog is cached in this
browser and refreshed every 15 minutes while online. GPS weather is not saved
as weather cache data. Reports and original photos are stored locally in the
browser. Accounts, shared report storage, human moderation, automatic sync,
dispatch, and official incident feeds are not connected. The optional Gemini
endpoint performs visual triage only when it is configured and the user opts in.

The safety guide is general information, not a substitute for emergency
services. In India, call 112 for emergencies and follow instructions from
authorities. HillSafe does not provide authoritative alerts or navigable
rerouting; use official advisories and local instructions for travel decisions.

## Official contact sources

The contact directory's phone numbers are transcribed from these public
government listings, checked 29 October 2026:

- India emergency response: [Emergency Response Support System](https://112.gov.in/),
  Government of India.
- Assam fire service: [Fire and Emergency Services Assam contact page](https://fireandemergencyservices.assam.gov.in/contact-us).
  It publishes the headquarters control-room numbers `101`, `0361-2737680`,
  `0361-2735933`, `0361-2735935`, `0361-2801900`, and `0361-2734191`.
- Meghalaya fire service: [Fire Control Room](https://megfireservice.gov.in/firecontrolroom.html)
  publishes the Eastern Range control-room numbers `9436721546`,
  `8575205486`, `0364-2520400`, `0364-2520004`, and `0364-2215777`; the
  page identifies the room at Shillong Fire Station as serving the Khasi-
  Jaintia region. The official [fire-station contacts](https://megfireservice.gov.in/keycontacts.html)
  page publishes 32 station entries with contact numbers; the directory maps
  those numbers to the stations and districts shown there. The separate
  [station directory](https://megfireservice.gov.in/fire_stations.html)
  lists additional stations by district but does not publish their direct
  phone numbers. The [headquarters contact page](https://megfireservice.gov.in/contact_us.html)
  lists `9485178896` for office hours only, not as an emergency dispatch line.
- Meteorology: [IMD Regional Meteorological Centre Guwahati contacts](https://mausam.imd.gov.in/guwahati/contactus.php).
  The Weather Section listing is `0361-2968241`; consult the [IMD Guwahati portal](https://mausam.imd.gov.in/guwahati/)
  for current forecasts and warnings.
- Seismic monitoring: [National Centre for Seismology contacts](https://seismo.gov.in/contact-us).
  Its published 24×7 Earthquake Monitoring Centre numbers are
  `+91-11-24344484` and `+91-11-24344547` (New Delhi).

These are not district fire-station numbers or local seismic offices. Phone
availability and service coverage may change; open the linked official source
to confirm.

## Deploying on Vercel

Import the repository into Vercel and use the repository root. No framework
preset, build command, or output directory is required. Vercel HTTPS enables
PWA installation and offline app-shell caching. The `/api/review-report` and
`/api/summarize-conditions` functions are available on Vercel deployments;
serving the files with `python -m http.server` does not run those APIs.

To enable optional AI features, add `GEMINI_API_KEY` as a Vercel project
environment variable and redeploy. Create the key in Google AI Studio; never
put it in client-side files or commit it to the repository. The function uses
`gemini-3.1-flash-lite` by default. `GEMINI_MODEL` may optionally override the
model name. Without a configured key, reports still save locally and AI
features are unavailable.

The report form's AI consent checkbox is unchecked by default. Only after a
user opts in does the app send the resized image, category, and description to
Google Gemini; it never sends the captured GPS coordinates. Resizing to JPEG
also removes image metadata. Google's free-tier terms may allow submitted
content to be used to improve products and reviewed by people, so users should
not submit sensitive images or personal information. See the [Gemini API
terms](https://ai.google.dev/gemini-api/terms). A small in-memory per-instance
rate limit is included per function instance and is not durable abuse prevention.

The AI result is strictly triage (likely match, uncertain, or likely mismatch)
with a short explanation of visible evidence. It cannot authenticate the
report, image date, location, or danger level. An authenticated human
moderation system and shared database are not implemented; therefore reports
stay pending and Guardian/Saviour counts do not advance.

The conditions-summary checkbox is also unchecked by default. After consent,
the app sends the current weather estimate and regional USGS earthquake count
to the `/api/summarize-conditions` function. It never sends precise coordinates
or locally stored reports for this summary. The model is instructed to describe
only the supplied observations; its output can still be wrong and must not be
used as an official warning or travel/safety advice.