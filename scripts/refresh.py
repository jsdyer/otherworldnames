"""Update the vetted Gazetteer snapshot from the current Moon and Mars point exports."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import gzip
from io import BytesIO
import json
from math import isfinite
from pathlib import Path
import re
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / 'web' / 'data' / 'gazetteer.json.gz'
SOURCE = 'https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/'
BODIES = {'Moon': 8000, 'Mars': 1600}
LINK = re.compile(r'https?://planetarynames\.wr\.usgs\.gov/Feature/(\d+)/?$')


def parse(body, raw):
    filename = body.upper() + '_nomenclature_center_pts.kml'
    with ZipFile(BytesIO(raw)) as archive:
        info = archive.getinfo(filename)
        if info.file_size > 80_000_000:
            raise ValueError('Unexpected size of KML export')
        generated = '%04d-%02d-%02d' % info.date_time[:3]
        document = ET.fromstring(archive.read(info))
    rows = []
    for point in document.findall('.//{*}Placemark'):
        f = {tag.attrib['name']: (tag.text or '').strip() for tag in point.findall('.//{*}SimpleData')}
        if f['approval'] != 'Adopted by IAU':
            continue
        feature = LINK.fullmatch(f['link'])
        name = (point.findtext('{*}name') or '').strip()
        if not feature or not name or not f['type']:
            raise ValueError('Missing feature identity in ' + body)
        # KML Point geometries are explicitly east-positive, planetocentric.
        lon, lat = (float(v) for v in point.findtext('{*}Point/{*}coordinates').split(',')[:2])
        diameter = float(f['diameter']) if f.get('diameter') else None
        if not (-180 <= lon <= 180 and -90 <= lat <= 90) or (diameter is not None and not isfinite(diameter)):
            raise ValueError('Invalid feature measurement for ' + name)
        rows.append(dict(id=int(feature.group(1)), name=name, type=f['type'], code=f['code'],
                         origin=f.get('origin',''), group=f.get('ethnicity',''), year=f.get('approvaldt','')[:4],
                         km=diameter if diameter and diameter > 0 else None,
                         lon=round(lon, 6), lat=round(lat, 6)))
    by_id = {}
    for row in rows:
        if row['id'] in by_id and by_id[row['id']] != row:
            raise ValueError('Conflicting values for feature '+str(row['id']))
        by_id[row['id']] = row
    rows = list(by_id.values())
    if len(rows) < BODIES[body]:
        raise ValueError('Incomplete records in ' + body)
    rows.sort(key=lambda r: (r['name'].casefold(), r['id']))
    return {'generated': generated, 'features': rows}


def fetch(body):
    url = SOURCE + body.upper() + '_nomenclature_center_pts.kmz'
    req = Request(url,headers={'User-Agent':'Otherworld Names (coolcode.ca/otherworldnames/)'})
    with urlopen(req,timeout=60) as response:
        return body,parse(body,response.read())


def save(bodies):
    ids = [r['id'] for part in bodies.values() for r in part['features']]
    if len(ids) != len(set(ids)):
        raise ValueError('Duplicate IDs across bodies')
    if SNAPSHOT.exists():
        with gzip.open(SNAPSHOT,'rt') as f:
            old = json.load(f)
        for body, part in bodies.items():
            if len(part['features']) < 0.95 * len(old['bodies'][body]['features']):
                raise ValueError('Review unexpected coverage drop in '+body)
    data = {'retrieved': datetime.now(timezone.utc).date().isoformat(), 'bodies': bodies}
    SNAPSHOT.parent.mkdir(exist_ok=True)
    stage = SNAPSHOT.with_suffix('.tmp')
    stage.write_bytes(gzip.compress(json.dumps(data,ensure_ascii=False,separators=(',',':')).encode(),mtime=0))
    stage.replace(SNAPSHOT)
    for body, part in bodies.items():
        print(body,len(part['features']),part['generated'])


if __name__ == '__main__':
    with ThreadPoolExecutor(max_workers=2) as pool:
        save(dict(pool.map(fetch,BODIES)))
