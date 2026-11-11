# Elevated

A live 3D map of Chicago transit: CTA L trains and buses, Metra, Amtrak, the South Shore Line and the
water taxi, on a MapLibre map with three.js models. The look and feel are inspired by
[Rail Island](https://railisland.tw/), the animated map of Taiwan's railways. All code here is original.

## How it is built

| Folder | What it holds |
|---|---|
| `site/` | The finished page, `index.html`, a single file. This is what Cloudflare Pages serves. |
| `functions/api/` | Live data for the hosted site (Cloudflare Pages Functions). API keys stay in Cloudflare. |
| `src/` | The page's source (`js/`, `app.html`) and `build.py`, which assembles `site/index.html`. |
| `data/` | Timetables, routes, ridership and city data baked into the page. |
| `vendor/` | MapLibre GL JS 4.7.1 and three.js r149 (their own licenses). |
| `tools/` | The home server (`server.py`) and the timetable builders. |

Rebuild the page after changing anything in `src/` or `data/`:

```
python3 src/build.py
```

## Hosting (Cloudflare Pages)

- Build command: none. Build output directory: `site`.
- Settings → Variables and Secrets, as encrypted secrets: `CTA_TRAIN_KEY`, `CTA_BUS_KEY`.
- The functions cache every answer at Cloudflare's edge, so all visitors share one set of calls to CTA.
  The whole bus fleet is refreshed every 4 minutes (about 4,700 of Bus Tracker's 10,000 daily requests).
- Not on the hosted site: live ships on the lake (they need an always-open connection) and the delay history.

## At home

`tools/server.py` runs the same map on a Mac with keys in `keys.env` (see `tools/keys.env.example`).
Add `--phone` to open it from a phone on the same Wi-Fi.

## Data

CTA Train Tracker, Bus Tracker and Customer Alerts; CTA, Metra, Amtrak and South Shore Line GTFS;
Amtraker; Open-Meteo; OpenStreetMap and OpenMapTiles; City of Chicago data portal.
