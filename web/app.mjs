import {PAGE_SIZE, START, coordinate, indexFeatures, matching, namingTheme, nearest, project} from './model.mjs';

const byId = id => document.getElementById(id);
const base = location.pathname + location.search;
const canvas = byId('map');
const ctx = canvas.getContext('2d');
const worlds = {};
const images = {};
const allRecords = new Map();
let body = 'Mars';
let selected;
let visible = [];
let page = 0;
let siteDate = byId('dates').textContent;
const format = number => number.toLocaleString('en-CA');
const field = (element, value) => { byId(element).textContent = value; };

function options(id, label, values) {
  const select = byId(id);
  select.replaceChildren(new Option(label,''));
  for (const value of [...new Set(values.filter(Boolean))].sort((a,b) => a.localeCompare(b))) {
    select.add(new Option(value, value));
  }
}

function permalink(id) { return base + '#feature=' + id; }

function saveLink(feature) {
  const hash = feature ? permalink(feature.id) : base;
  history.replaceState(null, '', hash);
}

function draw() {
  if (!worlds[body]) return;
  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width) return;
  const width = bounds.width, height = bounds.height;
  const ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.fillStyle = '#162930'; ctx.fillRect(0,0,width,height);
  const image = images[body];
  if (image?.complete && image.naturalWidth) {
    ctx.drawImage(image,0,0,width,height);
    ctx.fillStyle = 'rgba(8,19,26,.31)'; ctx.fillRect(0,0,width,height);
  }
  ctx.beginPath();
  for (let i=1; i<8; i++) {ctx.moveTo(width*i/8,0); ctx.lineTo(width*i/8,height);}
  for (let i=1; i<4; i++) {ctx.moveTo(0,height*i/4); ctx.lineTo(width,height*i/4);}
  ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth=.7; ctx.stroke();
  ctx.fillStyle = visible.length < 100 ? '#c5f3e5' : 'rgba(204,251,239,.68)';
  const radius = visible.length < 100 ? 2.8 : 1.2;
  ctx.beginPath();
  for (const feature of visible) {
    const [x,y] = project(feature,width,height);
    ctx.moveTo(x+radius,y); ctx.arc(x,y,radius,0,Math.PI*2);
  }
  ctx.fill();
  if (selected) {
    const [x,y] = project(selected,width,height);
    ctx.beginPath(); ctx.arc(x,y,7,0,Math.PI*2); ctx.lineWidth=3; ctx.strokeStyle='#0c181a';ctx.stroke();
    ctx.lineWidth=1.8;ctx.strokeStyle='#ffe7a7';ctx.stroke();
    ctx.fillStyle='#ffe7a7';ctx.fillRect(x-2,y-2,4,4);
    const text = selected.name;
    ctx.font='bold 12px system-ui';
    const w=Math.min(width-8,ctx.measureText(text).width+12);
    const tx=Math.max(3,Math.min(width-w-3,x+10)), ty=Math.max(3,Math.min(height-24,y-21));
    ctx.fillStyle='#142124';ctx.fillRect(tx,ty,w,21);
    ctx.fillStyle='#ffe7a7';ctx.fillText(text,tx+6,ty+14,w-12);
  }
}

function showDetail() {
  const feature = selected;
  field('detail-name',feature?.name || 'No matching feature');
  field('record-id',feature ? '№ '+feature.id : '');
  field('feature-type',feature ? body+' · '+feature.type : '');
  field('origin',feature ? (feature.origin || 'The Gazetteer gives no origin for this entry.') : 'Change the search or clear a filter to see records.');
  byId('facts').replaceChildren();
  for (const id of ['theme-panel','detail-actions','facts']) byId(id).hidden = !feature;
  if (!feature) return;
  const facts = [
    ['Centre',coordinate(feature.lat,true)+' / '+coordinate(feature.lon,false)],
    ['Diameter / length',feature.km ? format(Math.round(feature.km*100)/100)+' km' : 'Unreported'],
    ['Gazetteer origin group',feature.group || 'Unreported'],
    ['Approval year',feature.year || 'Unreported']
  ];
  for (const [title,value] of facts) {
    const wrap = document.createElement('div'), dt=document.createElement('dt'), dd=document.createElement('dd');
    dt.textContent=title; dd.textContent=value; wrap.append(dt,dd); byId('facts').append(wrap);
  }
  field('theme',namingTheme(body,feature.code));
  byId('source-link').href = 'https://planetarynames.wr.usgs.gov/Feature/'+feature.id;
  byId('permalink').href = permalink(feature.id);
}

function renderTable() {
  const pages=Math.max(1,Math.ceil(visible.length/PAGE_SIZE));
  page=Math.max(0,Math.min(pages-1,page));
  const start=page*PAGE_SIZE, end=Math.min(start+PAGE_SIZE,visible.length);
  const rows = document.createDocumentFragment();
  for (const feature of visible.slice(start,end)) {
    const tr=document.createElement('tr'), name=document.createElement('td'), type=document.createElement('td'), origin=document.createElement('td');
    const link=document.createElement('button');
    link.type='button';link.textContent=feature.name;link.dataset.id=String(feature.id);
    if (feature.id === selected?.id) {tr.className='chosen';link.setAttribute('aria-current','true');}
    name.append(link);type.textContent=feature.type;origin.textContent=feature.origin || 'Unreported';
    tr.append(name,type,origin);rows.append(tr);
  }
  byId('results').replaceChildren(rows);
  field('matches',format(visible.length)+' matching '+(visible.length===1?'feature':'features'));
  field('range',visible.length ? format(start+1)+'–'+format(end)+' shown' : '');
  field('map-count',format(visible.length)+' centres');
  field('page-number','Page '+(page+1)+' of '+pages);
  byId('prev').disabled=page===0;byId('next').disabled=page===pages-1;
}

function choose(feature, {locate=false,write=true}={}) {
  selected=feature;
  if (locate && feature) page=Math.floor(visible.indexOf(feature)/PAGE_SIZE);
  if (write) saveLink(feature);
  renderTable();showDetail();draw();
}

function filter(preferred, locate=false, write=true) {
  visible=matching(worlds[body],{query:byId('query').value,type:byId('type').value,group:byId('group').value,
    satellites:body==='Mars'||byId('satellite').checked});
  page=0;
  const candidate=visible.includes(preferred) ? preferred : (visible.includes(selected) ? selected : visible[0]);
  choose(candidate,{locate,write});
}

function changeWorld(name,feature) {
  body=name;
  document.querySelector('input[name=body][value="'+name+'"]').checked=true;
  byId('query').value='';
  byId('satellite').checked=feature?.code==='SF';
  byId('satellite-option').hidden=body!=='Moon';
  const availableTypes=worlds[body].filter(f=>body!=='Moon'||byId('satellite').checked||f.code!=='SF');
  options('type','All feature types',availableTypes.map(f=>f.type));
  options('group','All groups',worlds[body].map(f=>f.group));
  field('map-heading',name+' surface atlas');
  const credit=body==='Mars'?'NASA MGS / MOLA colour-shaded relief':'NASA / LRO WAC global mosaic';
  field('map-caption','Select a dot or choose a name below. Surface backdrop: '+credit+'.');
  filter(feature || allRecords.get(START[name])?.feature,true);
}

function jump(id) {
  const target=allRecords.get(Number(id));
  if (target) changeWorld(target.body,target.feature);
}

function ensureDetailsVisible() {
  const rect = byId('detail-name').getBoundingClientRect();
  if (rect.bottom < 0 || rect.top > innerHeight) byId('detail-name').scrollIntoView({block:'start'});
}

async function start() {
  const response=await fetch('./data/gazetteer.json');
  if (!response.ok) throw new Error('Snapshot unavailable');
  const data=await response.json();
  for (const [name, part] of Object.entries(data.bodies)) {
    worlds[name]=indexFeatures(part.features);
    for (const feature of worlds[name]) allRecords.set(feature.id,{body:name,feature});
    const image=new Image();images[name]=image;image.onload=draw;image.src='./maps/'+name.toLowerCase()+'.jpg';
  }
  field('dates','Source exports: Moon '+data.bodies.Moon.generated+' · Mars '+data.bodies.Mars.generated+'. Retrieved '+data.retrieved+' UTC. '+siteDate);
  byId('load-status').hidden=true;byId('workbench').hidden=false;
  const id=new URLSearchParams(location.hash.slice(1)).get('feature');
  if (id && allRecords.has(Number(id))) jump(id); else changeWorld('Mars');
  document.getElementById('body-choice').addEventListener('change',event=>changeWorld(event.target.value));
  for (const button of document.querySelectorAll('[data-example]')) button.onclick=()=>jump(button.dataset.example);
  for (const id of ['query','type','group']) byId(id).addEventListener(id==='query'?'input':'change',()=>filter());
  byId('satellite').onchange=()=>{
    const previous=byId('type').value;
    const available=worlds.Moon.filter(f=>byId('satellite').checked||f.code!=='SF');
    options('type','All feature types',available.map(f=>f.type));
    if (available.some(f=>f.type===previous)) byId('type').value=previous;
    filter();
  };
  byId('reset').onclick=()=>changeWorld(body);
  byId('prev').onclick=()=>{page--;renderTable();};
  byId('next').onclick=()=>{page++;renderTable();};
  byId('results').onclick=event=>{
    const button=event.target.closest('button[data-id]');
    if (button) {
      choose(allRecords.get(Number(button.dataset.id)).feature);
      // Re-rendered buttons are new elements; place focus on the selected record for keyboard users.
      byId('detail-name').tabIndex=-1;byId('detail-name').focus({preventScroll:true});ensureDetailsVisible();
    }
  };
  canvas.onclick=event=>{
    const rect=canvas.getBoundingClientRect();
    const pick=nearest(visible,event.clientX-rect.left,event.clientY-rect.top,rect.width,rect.height);
    if(pick)choose(pick,{locate:true});
  };
  new ResizeObserver(draw).observe(canvas);
  window.addEventListener('hashchange',()=>{
    const value=new URLSearchParams(location.hash.slice(1)).get('feature');
    if(value)jump(value);
  });
}

start().catch(()=>{
  byId('workbench').hidden=true;byId('load-status').hidden=false;
  field('load-status','The local snapshot could not be loaded. Reload the page or use the original Gazetteer linked below.');
});
