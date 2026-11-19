const RAD = Math.PI / 180;
const MOON_RADIUS_KM = 1737.4;

function zenithCosine(lat, lon, subLon, subLat) {
  const a = lat * RAD, b = subLat * RAD;
  return Math.max(-1, Math.min(1, Math.sin(a) * Math.sin(b) +
    Math.cos(a) * Math.cos(b) * Math.cos((lon - subLon) * RAD)));
}

export function inspect(feature, sample) {
  const [moon, earthLon, earthLat, sunLon, sunLat, distance, twilight] = sample;
  const sun = Math.asin(zenithCosine(feature.lat, feature.lon, sunLon, sunLat)) / RAD;
  const cosine = zenithCosine(feature.lat, feature.lon, earthLon, earthLat);
  const earth = Math.atan2(cosine - MOON_RADIUS_KM / distance, Math.sqrt(1 - cosine ** 2)) / RAD;
  const sky = {'*':'Daylight', C:'Civil twilight', N:'Nautical twilight', A:'Astronomical twilight', '':'Night'}[twilight];
  let reason = 'Low-angle window';
  if (earth <= 0) reason = 'Beyond the lunar limb';
  else if (sun <= 0) reason = 'Crater in darkness';
  else if (sun > 15) reason = 'High Sun at crater';
  else if (moon < 20) reason = moon <= 0 ? 'Moon below horizon' : 'Moon below 20°';
  else if (twilight === '*' || twilight === 'C') reason = 'Local sky too bright';
  return {sun, moon, earth, sky, reason, good: reason === 'Low-angle window'};
}

export function inspectEvening(feature, evening) {
  return evening.samples.map((sample, index) => ({
    ...inspect(feature, sample), time: (18 + index) + ':00',
    utc: new Date(Date.parse(evening.utc) + index * 3600000).toISOString().slice(0, 16)
  }));
}

export function nextWindow(feature, evenings, start, end) {
  for (const day of Object.keys(evenings).sort()) {
    if (day < start || day > end) continue;
    const times = inspectEvening(feature, evenings[day]).filter(row => row.good);
    if (times.length) return {day, times};
  }
  return null;
}

export function utcOffset(offset) {
  return 'UTC' + (offset[0] === '-' ? '−' : '+') + offset.slice(1, 3) + ':' + offset.slice(3);
}
