# Otherworld Names

[Open the explorer](https://coolcode.ca/otherworldnames/) · [CoolCode catalogue](https://coolcode.ca/)

Explore IAU-approved place names on the Moon and Mars. Start with the Martian crater [Canso](https://coolcode.ca/otherworldnames/#feature=1006), named for a Nova Scotia town. Select mapped feature centres, search names and recorded origins, filter by feature type or the Gazetteer's country/cultural group, and share a direct link to any feature. Lettered lunar craters can be included with the satellite-features switch.

<!-- coolcode:guide -->
Open One name, two worlds and compare Balboa. The lunar crater honours Vasco Nuñez de Balboa, while its Martian namesake takes its name from a town in Panama. Try Copernicus or Adams, then locate either feature in the atlas. The November edition has 134 shared spellings after excluding lettered satellite features.
<!-- /coolcode:guide -->

## Crater Light

[Compare Copernicus on March 18 and 19, 2024](https://coolcode.ca/otherworldnames/crater-light/?feature=1296&site=langley&date=2024-03-18). At 21:00 in Langley, the Sun rose from −3.0° at the crater centre on March 18 to +9.0° one evening later, when the Moon stood 62.7° above the local horizon. In Halifax at 21:00 on March 19, the Sun stood 7.0° above the crater and the Moon 67.6° above the observer. Use the next qualifying evening button, change the city or choose a different crater. The atlas can also send any named lunar crater, including lettered satellites, to the planner. [Nightfinder](https://coolcode.ca/nightfinder/) links its Langley and Halifax observing plans to Copernicus.

Crater Light combines USGS/IAU centres with [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/manual.html) observer quantities 4, 14, 15 and 20 for the Moon. The response includes airless topocentric altitude, observer and solar subpoints (MOON_ME, east positive), observer range and a twilight flag. For crater unit vector **n** and subpoint unit vectors **s**, **o**, solar elevation equals asin(**n**·**s**). Local observer elevation equals atan2(**n**·**o** − R/d, sqrt(1 − (**n**·**o**)²)), with R = 1,737.4 km and d the observer distance to lunar centre. This finite-distance test rejects far-side centres and accounts for libration. Terrain and individual shadows are unresolved. A qualifying hourly sample has sunlight (0°, 15°], observer elevation above 0°, Moon altitude at least 20°, and nautical twilight or darker at the city.

Refresh with `python3 scripts/refresh_crater_light.py`. The monthly workflow validates both datasets before publishing. The fixed example covers March 18–31, 2024. Each refresh covers the previous seven days through 120 days ahead, with hourly local samples from 18:00 through 23:00. The archive stores UTC instants and UTC offsets using the IANA America/Vancouver and America/Halifax rules at generation. The methods panel links the actual Horizons query and reports its generation and retrieval times. `crater-light-status.json` publishes the retrieval date, span and count of site-evenings.

Cloud cover is an optional on-demand request to the [ECCC GEM forecast via Open-Meteo](https://open-meteo.com/en/docs/gem-api) ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)). The preset city coordinates leave the browser only when the visitor checks cloud cover. Forecast hours are matched in UTC and show retrieval time. Historical, missing or unreachable forecasts leave an explicit gap.

## Data

The [USGS/IAU Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/GIS_Downloads) publishes nightly centre-point KML files. The initial November 18, 2026 snapshot contains 9,087 unique Moon records and 2,054 unique Mars records. The Mars export contained two identical placements of Bohar with the same stable ID. Exact duplicate IDs are collapsed. Conflicting duplicate IDs stop the refresh. Only records marked “Adopted by IAU” are included.

The map uses equirectangular longitude from 180° west to 180° east, increasing eastward, with planetocentric latitude. It uses KML point geometry in the modern lunar LOLA 2011 and Martian MDIM 2.1 reference networks. The downloadable centre does not define a feature's boundary. The interface reports the source's approval **year** to avoid displaying placeholder January 1 dates as exact historical events. A zero or absent reported diameter is displayed as unreported.

The name origins and source country/cultural group labels come directly from the Gazetteer. The expandable naming themes summarize the IAU [surface feature categories](https://planetarynames.wr.usgs.gov/Page/Categories) and describe general naming practice. Every record links back to its official Gazetteer ID.

NASA Solar System Treks supplies the static map backdrops. The lunar atlas uses [LRO WAC imagery](https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/WMTSCapabilities.xml). The Mars atlas uses [MGS MOLA colour-shaded relief](https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/WMTSCapabilities.xml). Each JPEG combines the service's eight level-1 global tiles, in row-major order from the top left at 180° W, 90° N. See [Moon Trek](https://trek.nasa.gov/moon/) and [Mars Trek](https://trek.nasa.gov/mars/) for mission-level information.

## Run locally

Python 3 builds the site offline. The build expands the versioned gzip data into a static JSON file and generates a badge from the snapshot retrieval date. It includes no runtime CDN dependencies. Searches and filtering run in the browser. Atlas permalinks store the official feature ID. Planner permalinks also carry the preset city and local date.

```sh
node --test tests/*.test.mjs
python3 -m unittest discover -s tests -v
python3 scripts/build.py
python3 -m http.server 8000 --directory dist
```

For the Chromium checks, install the packages in `tests/browser-requirements.txt`, run `python3 -m playwright install chromium`, then run `python3 tests/browser_smoke.py`.

## Refresh and deployment

`python3 scripts/refresh.py` downloads both official current KMZs and validates identities, geometry and coverage before replacing the compressed snapshot. USGS export dates, the UTC retrieval date, and the site build date appear separately in the app.

The **Refresh planetary names** workflow runs monthly and can also be started in Actions. It validates the download, commits it, and dispatches the normal browser-check and Pages deployment workflow. A failing build leaves the last Pages release serving. The regular workflow publishes successful builds on main at the project subpath. GitHub Pages should use **GitHub Actions** as its source.

<!-- schedule-reliability -->
## Schedule reliability

Public GitHub repositories can have scheduled workflows disabled after 60 days of inactivity. A separate weekly [schedule guard](.github/workflows/schedule-guard.yml) calls GitHub's enable-workflow API for an explicit list of refresh workflows and itself. It can restore workflows disabled for inactivity, preserves manually disabled workflows, and runs independently of collection failures.

This is an interim mitigation, not a scheduling guarantee: GitHub does not document active-workflow renewal as a permanent exemption, and scheduled runs can be delayed or dropped. A scheduler on our own Linux server is the planned independent trigger. The guard does not collect data, create dummy commits, or change source/check timestamps; successful collection and published data freshness still need monitoring.
<!-- /schedule-reliability -->
