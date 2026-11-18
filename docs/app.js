const campus = [43.250041, 76.859990];
const storageKey = 'atu-parking-demo-v1';

// Each demo bay follows a mapped road segment, with a signed offset from its centreline.
const roadsideGroups = [
  { prefix: 'A', road: 'Фурқат көшесі', way: 23994018, segment: 3, fractions: [0.22, 0.31, 0.40, 0.49], offset: 6, occupied: [2] },
  { prefix: 'B', road: 'Корпустың оңтүстігіндегі жол', way: 51969503, segment: 1, fractions: [0.24, 0.43, 0.62, 0.81], offset: 5, occupied: [1, 3] },
];

function roadsideSpots(group) {
  const points = campusMapData.roads.find(([id]) => id === group.way)[2];
  const [start, end] = points.slice(group.segment, group.segment + 2);
  const northScale = 111132;
  const eastScale = 111320 * Math.cos(start[0] * Math.PI / 180);
  const north = (end[0] - start[0]) * northScale;
  const east = (end[1] - start[1]) * eastScale;
  const length = Math.hypot(north, east);
  const along = [north / length, east / length];
  const across = [along[1], -along[0]];

  return group.fractions.map((fraction, index) => {
    const point = (alongOffset, acrossOffset) => [
      start[0] + north * fraction / northScale + (along[0] * alongOffset + across[0] * acrossOffset) / northScale,
      start[1] + east * fraction / eastScale + (along[1] * alongOffset + across[1] * acrossOffset) / eastScale,
    ];
    return {
      id: group.prefix + '0' + (index + 1),
      road: group.road,
      coordinates: point(0, group.offset),
      outline: [[-3, -1.25], [3, -1.25], [3, 1.25], [-3, 1.25]].map(([x, y]) => point(x, group.offset + y)),
      occupied: group.occupied.includes(index + 1),
    };
  });
}

const spots = roadsideGroups.flatMap(roadsideSpots);
const bayOutlines = new Map();

const element = (id) => document.getElementById(id);
const filterButtons = [...document.querySelectorAll('[data-filter]')];
const markers = new Map();
let overrides = {};
let filter = 'all';
let selected = null;
let map;
let parkingRole = null;
let showCampus;

function restoreParking() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    overrides = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  } catch {
    // Keep the current state in memory when storage is unavailable.
  }
}

restoreParking();
window.addEventListener('storage', event => {
  if (event.key === storageKey || event.key === null) {
    restoreParking();
    render();
  }
});

function occupied(spot) {
  const value = overrides[spot.id];
  return typeof value === 'boolean' ? value : spot.occupied;
}

function status(spot) {
  return occupied(spot) ? 'Бос емес' : 'Бос';
}

function classify(spot) {
  return occupied(spot) ? 'busy' : 'free';
}

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(overrides));
  } catch {
    // Keep the current state in memory for this page.
  }
}

function choose(spot, moveMap) {
  if (parkingRole === 'user') {
    restoreParking();
    if (!occupied(spot) && !overrides.reservedSpot) {
      overrides[spot.id] = true;
      overrides.reservedSpot = spot.id;
      if (filter === 'free') filter = 'all';
      save();
      element('announcement').textContent = spot.id + ' орны сізге белгіленді.';
    }
  }
  selected = spot;
  if (moveMap && map) map.panTo(spot.coordinates);
  render();
}

function render() {
  const busy = spots.filter(occupied).length;
  element('total').textContent = spots.length;
  element('free').textContent = spots.length - busy;
  element('busy').textContent = busy;

  for (const button of filterButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
  }

  const reservedSpot = overrides.reservedSpot;
  const canReserve = parkingRole === 'user' && !reservedSpot;
  element('find-free').hidden = !canReserve;
  const list = element('spots');
  const focusedSpot = list.contains(document.activeElement) ? document.activeElement.dataset.spot : null;
  list.replaceChildren();
  for (const spot of spots) {
    const visible = filter === 'all' || filter === classify(spot);
    const active = spot === selected;
    const marker = markers.get(spot.id);
    const outline = bayOutlines.get(spot.id);
    if (outline) {
      if (visible) {
        if (!map.hasLayer(outline)) outline.addTo(map);
        outline.setStyle({ color: occupied(spot) ? '#b7433c' : '#147957', weight: active ? 3 : 2 });
      } else {
        outline.remove();
      }
    }
    if (marker) {
      if (visible) {
        if (!map.hasLayer(marker)) marker.addTo(map);
        const node = marker.getElement();
        node.classList.toggle('busy', occupied(spot));
        node.classList.toggle('free', !occupied(spot));
        node.classList.toggle('selected', active);
        node.setAttribute('aria-label', spot.id + ' · ' + status(spot));
      } else {
        marker.remove();
      }
    }
    if (!visible) continue;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'spot';
    button.dataset.spot = spot.id;
    button.setAttribute('aria-pressed', String(active));
    button.innerHTML = '<i class="dot ' + classify(spot) + '"></i>' + spot.id + '<small>' + status(spot) + '</small>';
    if (canReserve && !occupied(spot)) {
      const action = document.createElement('span');
      action.className = 'spot-action';
      action.textContent = 'Таңдау';
      button.append(action);
    }
    button.addEventListener('click', () => choose(spot, true));
    list.append(button);
    if (spot.id === focusedSpot) button.focus({ preventScroll: true });
  }
  if (!list.children.length) list.textContent = 'Бұл күйде орын жоқ.';

  element('detail').hidden = !selected;
  const reservation = element('reservation');
  reservation.hidden = parkingRole !== 'user';
  reservation.textContent = reservedSpot
    ? 'Сізге белгіленген орын: ' + reservedSpot
    : 'Бос орынның «Таңдау» батырмасын басыңыз.';
  if (selected) {
    element('choice').textContent = selected.id + ' · Демо орын';
    element('chosen-status').textContent = status(selected);
    element('chosen-road').textContent = selected.road;
    element('toggle').textContent = occupied(selected) ? 'Бос деп белгілеу' : 'Бос емес деп белгілеу';
  }
}

for (const button of filterButtons) {
  button.addEventListener('click', () => {
    filter = button.dataset.filter;
    if (selected && filter !== 'all' && classify(selected) !== filter) selected = null;
    render();
  });
}

element('find-free').addEventListener('click', () => {
  filter = 'free';
  if (selected && occupied(selected)) selected = null;
  render();
  const firstSpot = element('spots').querySelector('button');
  const focusTarget = firstSpot || filterButtons.find(button => button.dataset.filter === 'free');
  focusTarget.focus();
  focusTarget.scrollIntoView({ block: 'center' });
});

element('toggle').addEventListener('click', () => {
  if (parkingRole !== 'admin' || !selected) return;
  restoreParking();
  overrides[selected.id] = !occupied(selected);
  if (!occupied(selected) && overrides.reservedSpot === selected.id) {
    delete overrides.reservedSpot;
  }
  if (filter !== 'all') filter = classify(selected);
  save();
  render();
  element('announcement').textContent = selected.id + ' · ' + status(selected);
});

element('reset').addEventListener('click', () => {
  if (parkingRole !== 'admin') return;
  overrides = {};
  selected = null;
  filter = 'all';
  save();
  render();
  element('announcement').textContent = 'Бастапқы күйлер қалпына келтірілді.';
});

if (window.L) {
  map = L.map('map', {
    scrollWheelZoom: false,
    minZoom: 17,
    maxZoom: 21,
    maxBounds: campusMapData.bounds,
    maxBoundsViscosity: 1,
  });
  const campusAndBays = L.latLngBounds([campus, ...spots.map(spot => spot.coordinates)]);
  showCampus = () => map.fitBounds(campusAndBays, { padding: [38, 42], maxZoom: 19 });
  showCampus();

  map.attributionControl.addAttribution('Карта дерегі © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> (ODbL)');
  for (const building of campusMapData.buildings) {
    L.polygon(building, {
      interactive: false, color: '#bbc8d0', weight: 1, fillColor: '#d6dfe5', fillOpacity: 1,
    }).addTo(map);
  }

  const roadWidth = type => ({
    primary: 15, secondary: 12, tertiary: 9, residential: 7, service: 4,
  })[type] || 2;
  const roadLayers = campusMapData.roads.map(([, type, points]) => {
    const casing = L.polyline(points, { interactive: false, color: '#aab8c3' }).addTo(map);
    return { casing, points, width: roadWidth(type) };
  });
  for (const road of roadLayers) {
    road.surface = L.polyline(road.points, { interactive: false, color: '#fffdf7' }).addTo(map);
  }

  function scaleRoads() {
    const metersPerPixel = 156543.03 * Math.cos(campus[0] * Math.PI / 180) / (2 ** map.getZoom());
    for (const { casing, surface, width } of roadLayers) {
      const pixels = Math.max(1, width / metersPerPixel);
      casing.setStyle({ weight: pixels + 2 });
      surface.setStyle({ weight: pixels });
    }
  }
  map.on('zoomend', scaleRoads);
  scaleRoads();

  for (const [name, point] of campusMapData.labels) {
    L.marker(point, {
      interactive: false, keyboard: false, zIndexOffset: -200,
      icon: L.divIcon({ className: 'road-label', html: name, iconSize: [130, 18], iconAnchor: [65, 9] }),
    }).addTo(map);
  }

  L.marker(campus, {
    icon: L.divIcon({ className: 'marker total', html: 'АТУ', iconSize: [40, 33] }),
    title: 'АТУ Сайран кампусы',
  }).addTo(map).bindTooltip('АТУ · №2 корпус', { direction: 'left', className: 'marker-label' })
    .bindPopup('<strong>АТУ · Сайран кампусы</strong><br>Фурқат көшесі, 348/4<br><a href="https://yandex.kz/maps/?pt=76.859990,43.250041&amp;z=17" target="_blank" rel="noopener">Яндекс Картада ашу ↗</a>');

  for (const spot of spots) {
    const outline = L.polygon(spot.outline, { fillOpacity: 0.55 });
    outline.on('click', () => choose(spot, false));
    bayOutlines.set(spot.id, outline);
    const marker = L.marker(spot.coordinates, {
      icon: L.divIcon({ className: 'marker bay-marker', html: spot.id, iconSize: [24, 16] }),
      title: spot.id,
    });
    marker.on('click', () => choose(spot, false));
    markers.set(spot.id, marker);
  }
  element('recenter').addEventListener('click', showCampus);
} else {
  element('map-warning').textContent = 'Интерактивті карта жүктелмеді.';
  element('map-warning').hidden = false;
  element('recenter').disabled = true;
}

render();

if (location.protocol === 'file:') {
  element('offline-download').hidden = true;
  element('offline-state').textContent = 'Офлайн нұсқа';
} else if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(() => {
    element('offline-state').textContent = 'Офлайн режимге дайын';
  }).catch(() => {
    // The downloadable HTML also works when service workers are unavailable.
  });
}

function setParkingRole(role) {
  parkingRole = role;
  element('toggle').hidden = role !== 'admin';
  element('reset').hidden = role !== 'admin';
  selected = null;
  filter = 'all';
  render();
  if (role && map) {
    map.invalidateSize();
    showCampus();
  }
}
