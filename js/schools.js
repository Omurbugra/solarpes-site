// Okullar sayfası: dil, menü ve okul havuzu / süzgeç / karşılaştırma aracı.
import { setLang, applyStatic, onLang, pt, getLang } from './explorer/i18n.js';

const $ = (id) => document.getElementById(id);
for (const b of document.querySelectorAll('[data-lang]')) b.addEventListener('click', () => setLang(b.dataset.lang));
onLang(() => renderSchools());
const menuBtn = $('menuBtn'), links = $('links');
menuBtn.addEventListener('click', () => {
  const open = !links.classList.contains('open');
  links.classList.toggle('open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
});

/* ====================================================================
   Okullar: havuz, süzgeç ve karşılaştırma. Okul adları ve değerler örnek veri
   (şablondaki üreteçle aynı, belirlenimci); analizler bitince gerçek veriyle değişecek.
   ==================================================================== */
const NAMES = ['Deneme Anadolu Lisesi', 'Ülkü Akın Ortaokulu', 'M. E. Resulzade And. Lisesi', 'Çankaya İlkokulu', 'Kızılay Ortaokulu',
  'Etimesgut Anadolu Lisesi', 'Keçiören İlkokulu', 'Yenimahalle Ortaokulu', 'Bahçelievler Lisesi', 'Emek İlkokulu', 'Dikmen Ortaokulu',
  'Balgat Anadolu Lisesi', 'Mamak İlkokulu', 'Sincan Ortaokulu', 'Gölbaşı Lisesi', 'Pursaklar İlkokulu', 'Batıkent Ortaokulu',
  'Ostim Meslek Lisesi', 'Demetevler İlkokulu', 'Ayrancı Anadolu Lisesi'];
const CLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const ecls = (i) => (i <= 40 ? 'A' : i <= 55 ? 'B' : i <= 70 ? 'C' : i <= 85 ? 'D' : i <= 100 ? 'E' : i <= 120 ? 'F' : 'G');
const rnd = (i) => { const v = (Math.sin(i * 97.13) * 10000) % 1; return v < 0 ? v + 1 : v; };
const SCHOOLS = NAMES.map((name, i) => {
  const plan = ['flat', 'l', 'u'][Math.floor(rnd(i) * 3) % 3];
  const floors = 2 + Math.floor(rnd(i + 7) * 3);
  const students = 250 + Math.floor(rnd(i + 3) * 22) * 50;
  const insulated = rnd(i + 11) > 0.55;
  let comfort = insulated ? 68 + Math.floor(rnd(i + 1) * 22) : 46 + Math.floor(rnd(i + 1) * 24);
  comfort -= plan === 'u' ? 6 : plan === 'l' ? 3 : 0;
  comfort = Math.max(34, Math.min(92, comfort));
  const energy = insulated ? 38 + Math.floor(rnd(i + 5) * 46) : 86 + Math.floor(rnd(i + 5) * 42);
  const emis = Math.max(40, energy - 6 + Math.floor(rnd(i + 9) * 16));
  const type = name.includes('İlkokul') ? 'İlkokul' : name.includes('Ortaokul') ? 'Ortaokul' : 'Lise';
  const func = name.includes('Meslek') ? 'Meslek' : 'Genel';
  const cost = Math.round(52 + energy * 0.55 + rnd(i + 13) * 22);
  return { id: 's' + i, name, type, func, plan, floors, students, comfort, energy, emis, cost, ready: i < 14 };
});
Object.assign(SCHOOLS[0], { plan: 'flat', floors: 3, students: 600, comfort: 74, energy: 100, emis: 100, cost: 100 });
for (const s of SCHOOLS) s.cls = ecls(s.energy);
// Fotoğraf, enerji sınıfıyla çelişmeyecek biçimde okulun özelliklerinden seçilir.
function photo(s) {
  const k = s.func === 'Meslek' ? 'meslek-lisesi' : s.cls === 'A' ? 'okul-pv-vrf' : s.cls === 'B' ? 'okul-yenilenmis'
    : s.cls === 'C' ? 'okul-golgeleme' : s.type === 'İlkokul' ? 'ilkokul' : (s.cls === 'F' || s.cls === 'G') ? 'okul-yipranmis'
    : s.plan === 'u' ? 'okul-tugla' : 'okul-lise';
  return `assets/img/${k}-s.jpg`;
}

const FLT = { cls: new Set(), type: new Set(), plan: new Set() };
let picked = ['s0', 's5'];
const KEYS = ['#FFD23F', '#7CC6FF', '#9BE38A'];
const pass = (s) => (!FLT.cls.size || FLT.cls.has(s.cls)) && (!FLT.type.size || FLT.type.has(s.type)) && (!FLT.plan.size || FLT.plan.has(s.plan));
const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function chipRow(el, key, items) {
  el.innerHTML = items.map(([v, label]) => `<button type="button" data-v="${v}" aria-pressed="${FLT[key].has(v)}">${esc(label)}</button>`).join('');
}
function renderFilters() {
  const ekb = $('ekbBar');
  ekb.innerHTML = CLS.map((c) => {
    const n = SCHOOLS.filter((s) => s.cls === c).length;
    return `<button type="button" data-c="${c}" style="--c:var(--${c})" aria-pressed="${FLT.cls.has(c)}" aria-label="${esc(pt('ekbBtn')(c, n))}" ${n ? '' : 'disabled'}><b>${c}</b><span>${esc(pt('schoolsN')(n))}</span></button>`;
  }).join('');
  ekb.classList.toggle('filtering', FLT.cls.size > 0);
  const T = pt('types'), P = pt('plans');
  chipRow($('fType'), 'type', Object.keys(T).map((k) => [k, T[k]]));
  chipRow($('fPlan'), 'plan', Object.keys(P).map((k) => [k, P[k]]));
  $('fReset').disabled = !(FLT.cls.size || FLT.type.size || FLT.plan.size);
}
function renderPool() {
  const T = pt('types'), PL = pt('planLong');
  const fmtN = new Intl.NumberFormat(getLang() === 'en' ? 'en-GB' : 'tr-TR');
  $('poolBody').innerHTML = SCHOOLS.filter(pass).map((s) => {
    const on = picked.includes(s.id);
    const sub = `${T[s.type]}, ${PL[s.plan]}, ${fmtN.format(s.students)} ${pt('students')}`;
    const vals = s.ready
      ? `<td><span class="cls" data-c="${s.cls}" style="--c:var(--${s.cls})">${s.cls}</span></td><td class="num">${s.energy}</td><td class="num hide-s">${s.emis}</td><td class="num hide-s">${s.cost}</td><td class="num">${s.comfort}</td>`
      : `<td colspan="5">${esc(pt('soon'))}</td>`;
    return `<tr data-id="${s.id}" class="${on ? 'sel' : ''} ${s.ready ? '' : 'soon'}">
      <td><input type="checkbox" ${on ? 'checked' : ''} ${s.ready ? '' : 'disabled'} aria-label="${esc(pt('pick')(s.name))}"></td>
      <td><div class="sch"><img src="${photo(s)}" alt="" width="64" height="44" loading="lazy"><div><b>${esc(s.name)}</b><small>${esc(sub)}</small></div></div></td>${vals}</tr>`;
  }).join('');
}
function renderCompare() {
  const box = $('cmp');
  const ss = picked.map((id) => SCHOOLS.find((s) => s.id === id));
  if (!ss.length) { box.innerHTML = `<h3>${esc(pt('cmpH'))}</h3><p class="cmp-empty">${esc(pt('cmpEmpty'))}</p>`; return; }
  const IND = pt('ind'), SUB = pt('indSub');
  const scale = { energy: [160, 100], emis: [160, 100], cost: [160, 100], comfort: [100, SCHOOLS[0].comfort] };
  const heads = ss.map((s, i) => `<figure style="--k:${KEYS[i]}"><img src="${photo(s)}" alt="" width="800" height="447" loading="lazy">
    <figcaption><i></i><span>${esc(s.name)}</span><button type="button" data-rm="${s.id}" aria-label="${esc(pt('remove')(s.name))}"><svg class="ico"><use href="#i-close"/></svg></button></figcaption></figure>`).join('');
  const inds = Object.keys(scale).map((k) => {
    const [max, base] = scale[k];
    const rows = ss.map((s, i) => `<div class="brow" style="--k:${KEYS[i]};--w:${(s[k] / max) * 82}%"><i></i><span>${s[k]}</span></div>`).join('');
    return `<div class="cmp-ind"><h4>${esc(IND[k])}<small>${esc(SUB[k])}</small></h4><div class="bars" style="--base:${(base / max) * 82}%">${rows}</div></div>`;
  }).join('');
  box.innerHTML = `<h3>${esc(pt('cmpH'))}</h3><div class="cmp-heads" style="--n:3">${heads}</div>${inds}<p class="cmp-legend">${esc(pt('baseLine'))}</p>`;
}
function renderSchools() { renderFilters(); renderPool(); renderCompare(); }

function toggleSchool(id) {
  const s = SCHOOLS.find((x) => x.id === id);
  if (!s?.ready) return;
  if (picked.includes(id)) picked = picked.filter((x) => x !== id);
  else if (picked.length < 3) picked.push(id);
  else { $('cmp').querySelector('.cmp-legend').textContent = pt('cmpFull'); renderPool(); return; }
  renderPool(); renderCompare();
}
$('poolBody').addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-id]');
  if (tr) toggleSchool(tr.dataset.id);
});
$('poolBody').addEventListener('keydown', (e) => {
  if (e.key === ' ' && e.target.matches('input')) { e.preventDefault(); toggleSchool(e.target.closest('tr').dataset.id); }
});
$('cmp').addEventListener('click', (e) => {
  const b = e.target.closest('[data-rm]');
  if (b) { picked = picked.filter((x) => x !== b.dataset.rm); renderPool(); renderCompare(); }
});
function flt(key, v) { FLT[key].has(v) ? FLT[key].delete(v) : FLT[key].add(v); renderFilters(); renderPool(); }
$('ekbBar').addEventListener('click', (e) => { const b = e.target.closest('button[data-c]'); if (b) flt('cls', b.dataset.c); });
$('fType').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) flt('type', b.dataset.v); });
$('fPlan').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) flt('plan', b.dataset.v); });
$('fReset').addEventListener('click', () => { for (const k in FLT) FLT[k].clear(); renderFilters(); renderPool(); });

applyStatic();
renderSchools();
document.documentElement.classList.add('ready');
