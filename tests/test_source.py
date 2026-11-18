from io import BytesIO
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from zipfile import ZipFile
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from refresh import parse

def archive(longitudes):
    rows = []
    for lon in longitudes:
        rows.append(f'''<Placemark><name>Bohar</name><ExtendedData><SchemaData>
          <SimpleData name="approval">Adopted by IAU</SimpleData>
          <SimpleData name="link">http://planetarynames.wr.usgs.gov/Feature/16054</SimpleData>
          <SimpleData name="type">Crater, craters</SimpleData><SimpleData name="code">AA</SimpleData>
          <SimpleData name="diameter">0.0</SimpleData></SchemaData></ExtendedData>
          <Point><coordinates>{lon},55.35</coordinates></Point></Placemark>''')
    data=BytesIO()
    with ZipFile(data,'w') as z:
        z.writestr('MARS_nomenclature_center_pts.kml','<kml xmlns="http://www.opengis.net/kml/2.2"><Document>'+''.join(rows)+'</Document></kml>')
    return data.getvalue()

class SourceTests(unittest.TestCase):
    @patch.dict('refresh.BODIES',Mars=1)
    def test_same_feature_twice_collapses_and_zero_diameter_is_missing(self):
        rows=parse('Mars',archive([-106.45,-106.45]))['features']
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]['lon'],-106.45)
        self.assertIsNone(rows[0]['km'])

    @patch.dict('refresh.BODIES',Mars=1)
    def test_conflicting_centres_stop_refresh(self):
        with self.assertRaisesRegex(ValueError,'Conflicting'):
            parse('Mars',archive([-106.45,-20]))
