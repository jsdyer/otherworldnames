import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {inspect, inspectEvening, nextWindow, utcOffset} from '../web/crater-light/model.mjs';

const snapshot = name => JSON.parse(gunzipSync(readFileSync(new URL('../web/data/' + name + '.json.gz', import.meta.url))));
const {sites, current} = snapshot('crater-light');
const records = snapshot('gazetteer').bodies.Moon.features;
const copernicus = records.find(row => row.id === 1296);
const far = records.find(row => row.id === 6108);

test('March 18 and 19 compare different illumination on each local evening', () => {
  for (const [site, sun, moon, utc] of [[sites.langley, 8.98, 62.70, '2024-03-20T04:00'],
                                       [sites.halifax, 6.98, 67.57, '2024-03-20T00:00']]) {
    const first = inspectEvening(copernicus, site.evenings['2024-03-18']);
    assert.ok(first.every(row => row.sun < 0 && !row.good));
    const match = nextWindow(copernicus, site.evenings, '2024-03-18', '2024-03-31');
    assert.equal(match.day, '2024-03-19');
    const row = match.times.find(row => row.time === '21:00');
    assert.ok(Math.abs(row.sun - sun) < .05);
    assert.ok(Math.abs(row.moon - moon) < .05);
    assert.equal(row.utc, utc);
    assert.ok(row.earth > 0);
  }
});

test('sub-observer geometry rejects hidden centres including the finite-distance limb', () => {
  const site = sites.langley;
  assert.equal(nextWindow(far, site.evenings, current[0], current[1]), null);
  const limb = inspect({lat:0, lon:89.9}, [50, 0, 0, 0, 0, 390000, '']);
  assert.ok(limb.sun > 0 && limb.earth < 0);
  assert.equal(limb.reason, 'Beyond the lunar limb');
});

test('dark sky, lunar altitude and low-elevation sunlight all gate a recommendation', () => {
  const feature = {lat:0, lon:0};
  assert.ok(inspect(feature, [40, 0, 0, 85, 0, 390000, 'N']).good);
  for (const row of [[10, 0, 0, 85, 0, 390000, 'A'], [40, 0, 0, 50, 0, 390000, ''],
                     [40, 0, 0, 85, 0, 390000, 'C'], [40, 0, 0, 95, 0, 390000, '']]) {
    assert.equal(inspect(feature, row).good, false);
  }
  assert.equal(utcOffset('-0300'), 'UTC−03:00');
});

test('each saved local evening has exactly six consecutive UTC hours and the correct offset', () => {
  for (const site of Object.values(sites)) {
    for (const [day, evening] of Object.entries(site.evenings)) {
      assert.equal(evening.samples.length, 6);
      const start = new Date(evening.utc);
      const offset = Number(evening.offset.slice(0, 3)) * 60;
      assert.equal(new Date(+start + offset * 60000).toISOString().slice(0, 16), day + 'T18:00');
    }
    assert.ok(site.evenings[current[0]] && site.evenings[current[1]]);
  }
});
