export const PAGE_SIZE = 20;
export const START = {Mars: 1006, Moon: 3691};

function normalize(text) {
  return String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
}

export function indexFeatures(features) {
  return features.map(feature => ({
    ...feature,
    search: normalize([feature.name, feature.origin, feature.type, feature.group].join(' '))
  }));
}

export function matching(features, {query = '', type = '', group = '', satellites = false} = {}) {
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  return features.filter(feature => (satellites || feature.code !== 'SF')
    && (!type || feature.type === type)
    && (!group || feature.group === group)
    && words.every(word => feature.search.includes(word)));
}

export function project(feature, width, height) {
  return [(feature.lon + 180) / 360 * width, (90 - feature.lat) / 180 * height];
}

export function nearest(features, x, y, width, height, tolerance = 12) {
  let result;
  let best = tolerance * tolerance;
  for (const feature of features) {
    const [px, py] = project(feature, width, height);
    const distance = (px - x) ** 2 + (py - y) ** 2;
    if (distance <= best) {
      result = feature;
      best = distance;
    }
  }
  return result;
}

export function coordinate(value, latitude) {
  if (!value) return '0°';
  const hemisphere = latitude ? (value > 0 ? 'N' : 'S') : (value > 0 ? 'E' : 'W');
  return Math.abs(value).toFixed(2) + '° ' + hemisphere;
}

export function namingTheme(body, code) {
  if (body === 'Mars') {
    if (code === 'AA') return 'Small Martian craters draw many names from towns and villages on Earth. Large craters draw names from scientists and people associated with Mars in literature and culture. The Gazetteer treats the size boundary of about 50 km as approximate.';
    if (code === 'VA') return 'Martian valleys may take the names of rivers on Earth or words for Mars or “star” in different languages.';
    if (code === 'AL') return 'Traditional Martian albedo features use names from early maps and classical mythology.';
    return 'Many Martian landforms take a name from a nearby albedo feature or crater. See the categories for exceptions.';
  }
  const themes = {
    SF:'A satellite crater takes a letter alongside the name of a nearby prominent lunar crater.',
    AA:'Lunar craters often honour scientists, engineers and explorers. Small craters of special interest may receive first names.',
    MO:'Lunar mountains may take names from mountain ranges on Earth, nearby craters or scientists.',
    DO:'Lunar ridges may be named for geoscientists.',
    RI:'Lunar rilles often draw their names from nearby craters.',
    CA:'Lunar crater chains often draw their names from nearby craters.'
  };
  if (['ME','LC','PA','SI','OC'].includes(code)) return 'These lunar plains and bays draw on Latin terms for weather or abstract concepts.';
  return themes[code] || 'The Gazetteer groups proposed names by body and landform. Its categories describe naming practices and historical exceptions.';
}
