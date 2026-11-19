"""Save verified JPL Horizons hourly Moon geometry for two observing sites."""
import csv
from datetime import date, datetime, time, timedelta, timezone
import gzip
import io
import json
import math
from pathlib import Path
import re
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
API = "https://ssd.jpl.nasa.gov/api/horizons.api"
SITES = {
    "langley": ("Langley, BC", 49.105, -122.658, "America/Vancouver"),
    "halifax": ("Halifax, NS", 44.649, -63.575, "America/Halifax"),
}
HOURS = range(18, 24)
UTC = timezone.utc
AU_KM = 149597870.7


def query(site, start, end):
    name, lat, lon, zone_name = SITES[site]
    zone = ZoneInfo(zone_name)
    first = datetime.combine(start, time(18), zone).astimezone(UTC)
    last = datetime.combine(end, time(23), zone).astimezone(UTC)
    params = dict(format="json", COMMAND="'301'", CENTER="'coord@399'", COORD_TYPE="'GEODETIC'",
                  SITE_COORD=f"'{lon},{lat},0'", QUANTITIES="'4,14,15,20'", OBJ_DATA="NO",
                  CSV_FORMAT="YES", APPARENT="AIRLESS", STEP_SIZE="'1 h'",
                  START_TIME=first.strftime("'%Y-%m-%d %H:%M'"), STOP_TIME=last.strftime("'%Y-%m-%d %H:%M'"))
    url = API + "?" + urlencode(params)
    with urlopen(Request(url, headers={"User-Agent": "CoolCode Crater Light (otherworldnames)"}), timeout=90) as response:
        payload = json.load(response)
    result = payload["result"]
    header, contents = result.split("$$SOE", 1)
    if not all(value in header for value in ("Moon (301)", "MOON_ME", "{East-longitude positive}",
                                            "ObsSub-LON", "SunSub-LON", "delta", "Elev_(a-app)")):
        raise ValueError("Unexpected Horizons frame, target or columns")
    days = {}
    for fields in csv.reader(io.StringIO(contents.split("$$EOE")[0].strip())):
        stamp = datetime.strptime(fields[0].strip(), "%Y-%b-%d %H:%M").replace(tzinfo=UTC)
        local = stamp.astimezone(zone)
        if local.hour not in HOURS or not start <= local.date() <= end:
            continue
        alt, earth_lon, earth_lat, sun_lon, sun_lat, distance = map(float, fields[4:10])
        angles = (alt, earth_lat, sun_lat)
        if not all(math.isfinite(v) and abs(v) <= 90 for v in angles) or not all(abs(v) <= 360 for v in (earth_lon, sun_lon)):
            raise ValueError("Invalid Horizons angles")
        if not 300000 < distance * AU_KM < 460000 or fields[1].strip() not in ("*", "C", "N", "A", ""):
            raise ValueError("Invalid distance or solar-presence marker")
        # Each evening has six ordered records. Its first UTC instant anchors every sample.
        key = local.date().isoformat()
        day = days.setdefault(key, {"utc": stamp.strftime("%Y-%m-%dT%H:%MZ"),
                                    "offset": local.strftime("%z"), "samples": []})
        expected = datetime.strptime(day["utc"], "%Y-%m-%dT%H:%MZ").replace(tzinfo=UTC) + timedelta(hours=len(day["samples"]))
        if local.hour != 18 + len(day["samples"]) or expected != stamp:
            raise ValueError(f"Missing or repeated evening sample at {stamp}")
        day["samples"].append([round(v, 4) for v in (alt, earth_lon, earth_lat, sun_lon, sun_lat)]
                              + [round(distance * AU_KM), fields[1].strip()])
    if len(days) != (end - start).days + 1 or any(len(day["samples"]) != len(HOURS) for day in days.values()):
        raise ValueError("Incomplete local evenings")
    return days, {
        "start": start.isoformat(), "end": end.isoformat(), "url": url,
        "generated": re.search(r"Ephemeris / API_USER\s+(.+?)\s+ / Horizons", header).group(1).strip(),
        "ephemeris": re.search(r"Target body name:.*?\{source: ([^}]+)", header).group(1),
        "retrieved": datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z"),
    }


def main():
    today = datetime.now(UTC).date()
    current = (today - timedelta(days=7), today + timedelta(days=120))
    example = (date(2024, 3, 18), date(2024, 3, 31))
    output = {"archive": list(map(str, example)), "current": list(map(str, current)), "sites": {}}
    for key, (name, lat, lon, zone) in SITES.items():
        evenings, sources = {}, []
        for start, end in (example, current):
            rows, source = query(key, start, end)
            evenings.update(rows)
            sources.append(source)
            print(f"{name} {start} to {end}: {len(rows)} evenings", flush=True)
        output["sites"][key] = dict(name=name, lat=lat, lon=lon, zone=zone, evenings=evenings, sources=sources)
    output["retrieved"] = datetime.now(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")
    destination = ROOT / "web/data/crater-light.json.gz"
    temporary = destination.with_suffix(".tmp")
    temporary.write_bytes(gzip.compress(json.dumps(output, separators=(",", ":")).encode(), mtime=0))
    temporary.replace(destination)


if __name__ == "__main__":
    main()
