import {coordinate} from '../model.mjs';
import {inspectEvening, nextWindow, utcOffset} from './model.mjs';

const $ = id => document.getElementById(id);
const formatAngle = value => value.toFixed(1).replace('-', '−') + '°';
const dateText = day => new Intl.DateTimeFormat('en-CA', {
  weekday:'short', month:'short', day:'numeric', year:'numeric', timeZone:'UTC'
}).format(new Date(day + 'T12:00Z'));
const todayAt = zone => {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:zone, year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(new Date());
  const part = type => parts.find(item => item.type === type).value;
  return [part('year'), part('month'), part('day')].join('-');
};
let data, gazetteerDate;
const craters = new Map();
const forecasts = new Map();
const forecastErrors = new Map();
const pending = new Set();
const span = range => range[0] + ' through ' + range[1];
const forecastSource = 'ECCC GEM via Open-Meteo';

function setDate(day) {
  $('date').value = day;
  render();
}

function render() {
  const feature = craters.get($('feature').value);
  const key = $('site').value, site = data.sites[key], day = $('date').value;
  const when = site.evenings[day];
  const inArchive = day >= data.archive[0] && day <= data.archive[1];
  const range = inArchive ? data.archive : data.current;
  const source = site.sources[inArchive ? 0 : 1];
  const search = new URLSearchParams({feature:feature.id, site:key, date:day});
  history.replaceState(null, '', '?' + search);
  $('share').href = '?' + search;
  $('gazetteer').href = '../#feature=' + feature.id;
  $('usgs').href = 'https://planetarynames.wr.usgs.gov/Feature/' + feature.id;
  $('source-query').href = source.url;
  $('coordinates').textContent = feature.name + ' · ' + coordinate(feature.lat, true) + ', ' + coordinate(feature.lon, false);
  $('marker').style.left = (feature.lon + 180) / 360 * 100 + '%';
  $('marker').style.top = (90 - feature.lat) / 180 * 100 + '%';
  $('coverage').textContent = 'Historical comparison: ' + span(data.archive) + '. Rolling ephemeris: ' + span(data.current) +
    '. Each city uses its civil time-zone rules. The numeric UTC offset shown comes from the snapshot.';
  $('source-times').textContent = 'Gazetteer centres retrieved ' + gazetteerDate + ' UTC. Horizons ' + source.ephemeris +
    ' response generated ' + source.generated + ' and retrieved ' + source.retrieved + '.';
  $('location').textContent = site.name + (day ? ' · ' + dateText(day) : '');
  $('headline').textContent = feature.name;
  $('next').replaceChildren();
  $('hours').replaceChildren();
  $('weather').hidden = true;
  $('weather-note').textContent = '';
  if (!when) {
    $('verdict').textContent = 'This date is outside the saved ephemeris. Choose a date from ' + span(data.current) + ' or open the March 2024 example.';
    $('clock').textContent = 'No hourly ephemeris for this date.';
    return;
  }
  const samples = inspectEvening(feature, when);
  const windows = samples.filter(row => row.good);
  if (windows.length) {
    const best = windows.reduce((a, b) => a.moon >= b.moon ? a : b);
    $('verdict').textContent = 'Low-angle light at ' + windows.map(row => row.time).join(', ') +
      '. At ' + best.time + ' the Moon is ' + formatAngle(best.moon) + ' up and the Sun is ' +
      formatAngle(best.sun) + ' above the crater horizon.';
  } else {
    const reasons = [...new Set(samples.map(row => row.reason.toLowerCase()))];
    $('verdict').textContent = 'No qualifying hour this evening. Conditions across the six samples: ' + reasons.join(' · ') + '.';
  }
  const tomorrow = new Date(Date.parse(day + 'T12:00Z') + 86400000).toISOString().slice(0, 10);
  const next = nextWindow(feature, site.evenings, tomorrow, range[1]);
  if (next) {
    const jump = document.createElement('button');
    jump.type = 'button';
    jump.textContent = 'View ' + dateText(next.day);
    jump.onclick = () => setDate(next.day);
    $('next').append('Next qualifying evening: ' + next.times[0].time + ' local on ' + dateText(next.day) + '.', jump);
  } else {
    $('next').textContent = 'No later qualifying sample in this period, which ends ' + range[1] + '.';
  }
  $('clock').textContent = site.name + ' · ' + site.zone + ' · ' + utcOffset(when.offset) +
    '. The first sample is ' + samples[0].utc.replace('T', ' ') + ' UTC.';
  const forecast = forecasts.get(key);
  for (const row of samples) {
    const tr = document.createElement('tr');
    if (row.good) tr.className = 'window';
    const th = document.createElement('th');
    th.scope = 'row'; th.textContent = row.time; th.title = row.utc + ' UTC'; tr.append(th);
    const cloud = forecast?.values.get(row.utc);
    for (const value of [formatAngle(row.sun), formatAngle(row.moon), formatAngle(row.earth),
      row.sky, row.reason, Number.isFinite(cloud) ? cloud + '%' : '—']) tr.insertCell().textContent = value;
    $('hours').append(tr);
  }
  const now = Date.now(), last = Date.parse(samples.at(-1).utc + 'Z'), first = Date.parse(samples[0].utc + 'Z');
  const canForecast = last > now && first < now + 7 * 86400000;
  $('weather').hidden = !canForecast;
  $('weather').disabled = pending.has(key);
  $('weather').textContent = pending.has(key) ? 'Loading forecast…' : forecast ? 'Refresh cloud forecast' : 'Check hourly cloud forecast';
  const hasValue = samples.some(row => Number.isFinite(forecast?.values.get(row.utc)));
  $('weather-note').textContent = canForecast ? forecastErrors.get(key) || (forecast
    ? forecastSource + ', retrieved ' + forecast.retrieved + '. ' + (hasValue ? 'Percent of the model sky covered by cloud.' : 'No forecast value for these hours.')
    : 'Cloud cover is optional. Check the forecast to see model estimates for this evening.') :
    'Cloud cover is available only within the short-range forecast. A dash means no estimate.';
}

async function loadWeather() {
  const key = $('site').value, site = data.sites[key];
  pending.add(key); forecastErrors.delete(key); render();
  try {
    const query = new URLSearchParams({latitude:site.lat, longitude:site.lon, hourly:'cloud_cover',
      models:'gem_seamless', timezone:'GMT', forecast_days:'7'});
    const response = await fetch('https://api.open-meteo.com/v1/forecast?' + query, {signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw Error();
    const values = new Map();
    const {hourly, hourly_units, utc_offset_seconds} = await response.json();
    if (utc_offset_seconds !== 0 || hourly_units.cloud_cover !== '%' || hourly.time.length !== hourly.cloud_cover.length) throw Error();
    hourly.time.forEach((time, index) => {
      const value = hourly.cloud_cover[index];
      if (Number.isFinite(value) && value >= 0 && value <= 100) values.set(time, value);
    });
    if (!values.size) throw Error();
    forecasts.set(key, {values, retrieved:new Date().toISOString()});
  } catch {
    forecastErrors.set(key, 'Cloud forecast unavailable. ' + (forecasts.has(key) ?
      'Showing the prior forecast retrieved ' + forecasts.get(key).retrieved + '.' : 'No cloud estimate for these hours.'));
  } finally {
    pending.delete(key); render();
  }
}

async function open() {
  const get = async url => {
    const response = await fetch(url);
    if (!response.ok) throw Error('Snapshot unavailable');
    return response.json();
  };
  const [gazetteer, ephemeris] = await Promise.all([get('../data/gazetteer.json'), get('../data/crater-light.json')]);
  data = ephemeris; gazetteerDate = gazetteer.retrieved;
  const params = new URLSearchParams(location.search);
  for (const feature of gazetteer.bodies.Moon.features) {
    if (feature.code !== 'AA' && feature.code !== 'SF') continue;
    craters.set(String(feature.id), feature);
    if (feature.code === 'AA' || params.get('feature') === String(feature.id))
      $('feature').add(new Option(feature.name, feature.id));
  }
  for (const [key, site] of Object.entries(data.sites)) $('site').add(new Option(site.name, key));
  $('feature').value = craters.has(params.get('feature')) ? params.get('feature') : '1296';
  $('site').value = Object.hasOwn(data.sites, params.get('site')) ? params.get('site') : 'langley';
  const day = params.get('date');
  $('date').value = /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : '';
  if (!$('date').value) $('date').value = todayAt(data.sites[$('site').value].zone);
  for (const control of ['feature', 'site', 'date']) $(control).onchange = render;
  $('today').onclick = () => setDate(todayAt(data.sites[$('site').value].zone));
  $('example').onclick = () => { $('feature').value = '1296'; setDate(data.archive[0]); };
  $('weather').onclick = loadWeather;
  $('loading').hidden = true; $('planner').hidden = false;
  render();
}
open().catch(() => { $('planner').hidden = true; $('loading').hidden = false;
  $('loading').textContent = 'The planner could not open the saved ephemeris or Gazetteer. Reload this page to try again.'; });
