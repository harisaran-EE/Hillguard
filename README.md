# Hillguard — terrain safety prototype

A mobile-first, offline-ready PWA prototype for landslide and road hazard
awareness in Northeast India. The app uses plain HTML, CSS, and JavaScript with
no build step or external dependencies.

## Run locally

Serve the repository over localhost or HTTPS. For example:

```sh
python -m http.server 8000
```

Then open `http://localhost:8000`. GPS and service-worker features require
localhost or HTTPS. On mobile, deploy to HTTPS to install the PWA.

## Prototype features

- Online/offline connectivity indicator and a service-worker-cached app shell.
- Offline safety guide and direct `tel:112` link.
- Hazard report form with category, required photo, GPS/time capture, and an
  explicitly labeled sample-location option.
- Local reports saved in IndexedDB and a 2 km / 1 hour community-confidence
  threshold. Demo-threshold reports exercise the Scout / Sentinel / Guardian
  points display.
- Adjustable deterministic rainfall + slope + history score, capped at 10.
- Sample-only proximity alert, filters, and illustrative route preview.

## Important limitations

All map markers, hazard reports, risk inputs, route options, and proximity
alerts are illustrative demo data. The risk score is not a forecast or
geological assessment. Browser geolocation is used only after explicit user
action. Reports and attached photos are stored locally in the browser; this
prototype has no server, accounts, moderation, automatic sync, dispatch, or
official data feed. The local cluster rule is not official verification.

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