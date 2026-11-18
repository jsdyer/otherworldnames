# Otherworld Names

[Open the explorer](https://coolcode.ca/otherworldnames/) · [CoolCode catalogue](https://coolcode.ca/)

Explore IAU-approved place names on the Moon and Mars. Start with the Martian crater [Canso](https://coolcode.ca/otherworldnames/#feature=1006), named for a Nova Scotia town. Select mapped feature centres, search names and recorded origins, filter by feature type or the Gazetteer's country/cultural group, and share a direct link to any feature. Lettered lunar craters can be included with the satellite-features switch.

## Data

The [USGS/IAU Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/GIS_Downloads) publishes nightly centre-point KML files. The initial November 18, 2026 snapshot contains 9,087 unique Moon records and 2,054 unique Mars records. The Mars export contained two identical placements of Bohar with the same stable ID. Exact duplicate IDs are collapsed. Conflicting duplicate IDs stop the refresh. Only records marked “Adopted by IAU” are included.

The map uses equirectangular longitude from 180° west to 180° east, increasing eastward, with planetocentric latitude. It uses KML point geometry in the modern lunar LOLA 2011 and Martian MDIM 2.1 reference networks. The downloadable centre does not define a feature's boundary. The interface reports the source's approval **year** to avoid displaying placeholder January 1 dates as exact historical events. A zero or absent reported diameter is displayed as unreported.

The name origins and source country/cultural group labels come directly from the Gazetteer. The expandable naming themes summarize the IAU [surface feature categories](https://planetarynames.wr.usgs.gov/Page/Categories) and describe general naming practice. Every record links back to its official Gazetteer ID.

NASA Solar System Treks supplies the static map backdrops. The lunar atlas uses [LRO WAC imagery](https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/WMTSCapabilities.xml). The Mars atlas uses [MGS MOLA colour-shaded relief](https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/WMTSCapabilities.xml). Each JPEG combines the service's eight level-1 global tiles, in row-major order from the top left at 180° W, 90° N. See [Moon Trek](https://trek.nasa.gov/moon/) and [Mars Trek](https://trek.nasa.gov/mars/) for mission-level information.

## Run locally

Python 3 builds the site offline. The build expands the versioned gzip data into a static JSON file and generates a badge from the snapshot retrieval date. It includes no runtime CDN dependencies. Searches and filtering run in the browser. Permalinks store only the official feature ID.

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
