// Proje sayfası: dil, üst çubuk, giriş hareketleri, ölçüt listesi, okul yılı sürgüsü,
// 3B gezginin geç yüklenmesi, şekil büyütme ve okullar aracı.
import { setLang, applyStatic, onLang, pt, getLang } from './explorer/i18n.js';

const $ = (id) => document.getElementById(id);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- dil ---------- */
for (const b of document.querySelectorAll('[data-lang]')) b.addEventListener('click', () => setLang(b.dataset.lang));
onLang(() => setYear(+yrRange.value));

/* ---------- menü (dar ekran) ---------- */
const menuBtn = $('menuBtn'), links = $('links');
menuBtn.addEventListener('click', () => {
  const open = !links.classList.contains('open');
  links.classList.toggle('open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
});
links.addEventListener('click', (e) => {
  if (e.target.closest('a')) { links.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); }
});

/* ---------- üst çubuk: açılışın üstünde saydam, sonra zemin rengi; geçerli bölüm işaretli ---------- */
const bar = $('bar'), hero = $('top');
const navLinks = [...links.querySelectorAll('a[href^="#"]')];
const secs = navLinks.map((a) => document.querySelector(a.getAttribute('href')));
let barTick = false, barY = scrollY, navUntil = 0;
function paintBar() {
  barTick = false;
  bar.classList.toggle("solid", hero.getBoundingClientRect().bottom < bar.offsetHeight + 1 || scrollY > innerHeight * 0.6);
  // aşağı inerken çubuk çekilir, yukarı çıkarken geri gelir
  const dy = scrollY - barY;
  if (performance.now() < navUntil) { bar.classList.remove('away'); barY = scrollY; }
  else if (Math.abs(dy) > 6) { bar.classList.toggle('away', dy > 0 && scrollY > innerHeight && !links.classList.contains('open')); barY = scrollY; }
  const y = innerHeight * 0.35;
  let cur = -1;
  secs.forEach((s, i) => { const r = s.getBoundingClientRect(); if (r.top <= y && r.bottom > y) cur = i; });
  navLinks.forEach((a, i) => a.setAttribute('aria-current', String(i === cur)));
}
addEventListener('scroll', () => { if (!barTick) { barTick = true; requestAnimationFrame(paintBar); } }, { passive: true });
addEventListener('resize', paintBar);
paintBar();

/* ---------- giriş hareketleri: bölümün parçaları okuma sırasıyla ---------- */
for (const sec of document.querySelectorAll('section')) {
  sec.querySelectorAll('.rv').forEach((el, i) => el.style.setProperty('--i', Math.min(i, 8)));
}
// Gözlemci yerine kaydırma taraması: sayfa hızla atlandığında üstünden geçilen parçalar da açılır.
let hidden = [...document.querySelectorAll('.rv, .h-head, .tool')];
let rvTick = false;
function reveal() {
  rvTick = false;
  const line = innerHeight * 0.9;
  hidden = hidden.filter((el) => {
    if (el.getBoundingClientRect().top < line) { el.classList.add('in'); return false; }
    return true;
  });
  if (!hidden.length) removeEventListener('scroll', onRvScroll);
}
function onRvScroll() { if (!rvTick) { rvTick = true; requestAnimationFrame(reveal); } }
addEventListener('scroll', onRvScroll, { passive: true });
addEventListener('resize', onRvScroll);
reveal();

/* ---------- yumuşak kaydırma ve bölüm bağlantıları ---------- */
// Lenis kaydırmaya hafif bir atalet verir; bağlantılar bölüm başlığını çubuğun hemen altına getirir.
let lenis = null;
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function smoothTo(y, duration = 1.4) {
  if (lenis) lenis.scrollTo(y, { duration, easing: easeIO });
  else scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
}
if (!reduce && window.Lenis) {
  lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 1, prevent: (node) => !!(node.closest && node.closest('.lb, .p-scroll, .dock')) });
  const tick = (t) => { lenis.raf(t); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  document.documentElement.classList.add('lenis');
}
const stageEl = $('stage');
// 3B sahnenin ekranda ortalandığı kaydırma konumu (üst çubuk payıyla)
const stageY = () => { const r = stageEl.getBoundingClientRect(); return r.top + scrollY - (innerHeight - r.height + bar.offsetHeight) / 2; };
function goTo(hash) {
  const sec = document.querySelector(hash);
  if (!sec) return;
  if (hash === '#senaryolar') { smoothTo(stageY()); navUntil = performance.now() + 1700; history.replaceState(null, '', hash); return; }
  const head = sec.matches('#top') ? sec : sec.querySelector('h2, h1') || sec;
  const shift = new DOMMatrix(getComputedStyle(head).transform).m42 || 0;   // açılmamış başlığın kayması
  const y = Math.max(0, head.getBoundingClientRect().top - shift + scrollY - bar.offsetHeight - 28);
  smoothTo(y);
  navUntil = performance.now() + 1700;
  history.replaceState(null, '', hash);
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || a.getAttribute('href') === '#main' || a.getAttribute('href').length < 2) return;
  e.preventDefault();
  goTo(a.getAttribute('href'));
});
if (location.hash.length > 1) addEventListener('load', () => setTimeout(() => goTo(location.hash), 60));
let settleT = 0, snapping = false;
addEventListener('scroll', () => {
  clearTimeout(settleT);
  if (snapping || performance.now() < navUntil) return;
  settleT = setTimeout(() => {
    if (!wide.matches || reduce || stageEl.classList.contains('focus')) return;
    const d = stageY() - scrollY;
    if (Math.abs(d) > 6 && Math.abs(d) < innerHeight * 0.38) {
      snapping = true;
      smoothTo(stageY(), 0.8);
      setTimeout(() => { snapping = false; }, 900);
    }
  }, 160);
}, { passive: true });

/* ---------- açılış videosu ---------- */
const vid = $('heroVid');
if (reduce) { vid.removeAttribute('autoplay'); vid.pause(); }

/* ---------- ölçütler: etkin satır fotoğrafı değiştirir ---------- */
const crl = $('crl'), crImgs = [...document.querySelectorAll('.cr-photo img')];
function setCr(k) {
  for (const li of crl.children) {
    const on = li.dataset.k === String(k);
    li.classList.toggle('on', on);
    li.querySelector('.crl-b').setAttribute('aria-expanded', String(on));
  }
  for (const im of crImgs) im.classList.toggle('on', im.dataset.k === String(k));
}
crl.addEventListener('click', (e) => { const li = e.target.closest('li[data-k]'); if (li) setCr(li.dataset.k); });
const crTrack = $('crTrack');
let crCur = 0;
// geniş ekranda tıklama, ilgili ölçütün kaydırma konumuna götürür
crl.addEventListener('click', (e) => {
  const li = e.target.closest('li[data-k]');
  if (!li || !wide.matches || reduce) return;
  const r = crTrack.getBoundingClientRect();
  smoothTo(r.top + scrollY + ((+li.dataset.k + 0.5) / 4) * (r.height - innerHeight), 0.9);
});
crl.addEventListener('focusin', (e) => { const li = e.target.closest('li[data-k]'); if (li) setCr(li.dataset.k); });

/* ---------- yöntem: okul yılı sürgüsü ---------- */
const YEAR = {
  tr: [
    { c: 'Eylülde okul açılır ve sınıfların aşırı ısındığı saatler sayılmaya başlar.', len: '30 gün', load: 'Aşırı ısınma', count: 'Sınır aşımı saatleri sayılır' },
    { c: 'Ekimden nisana ısıtma dönemi: bugünkü okulda yıllık enerjinin çoğu kazanda yanar.', len: '7 ay, 212 gün', load: 'Isıtma, doğalgaz', count: 'Yıllık enerji ve karbon' },
    { c: 'Mayıstan haziran ortasına güneş yükselir, sınıflar ısınır.', len: '45 gün', load: 'Aşırı ısınma', count: 'Sınır aşımı saatleri sayılır' },
    { c: 'Yaz tatili: en sıcak haftalar boş binaya denk gelir.', len: '78 gün', load: 'Bina boş', count: 'Konfor sayımı dışında' },
  ],
  en: [
    { c: 'School opens in September and the hours when classrooms overheat start being counted.', len: '30 days', load: 'Overheating', count: 'Hours above the limit counted' },
    { c: 'October to April is the heating season: in today’s school most of the year’s energy burns in the boiler.', len: '7 months, 212 days', load: 'Heating, natural gas', count: 'Annual energy and carbon' },
    { c: 'From May to mid-June the sun climbs and classrooms warm up.', len: '45 days', load: 'Overheating', count: 'Hours above the limit counted' },
    { c: 'Summer holiday: the hottest weeks fall on an empty building.', len: '78 days', load: 'Building empty', count: 'Outside the comfort count' },
  ],
};
const yrRange = $('yrRange'), yrSegs = [...$('yr').children], yrBtns = [...$('yrNames').querySelectorAll('button')];
function setYear(i) {
  const d = YEAR[getLang() === 'en' ? 'en' : 'tr'][i];
  const cl = $('mtClause'); cl.textContent = d.c; cl.classList.remove('swap'); void cl.offsetWidth; cl.classList.add('swap');
  $('yrLen').textContent = d.len; $('yrLoad').textContent = d.load; $('yrCount').textContent = d.count;
  yrSegs.forEach((s, j) => s.classList.toggle('on', j === i));
  yrBtns.forEach((b, j) => b.setAttribute('aria-current', String(j === i)));
  yrRange.value = i;
  yrRange.setAttribute('aria-valuetext', yrBtns[i].textContent);
}
yrRange.addEventListener('input', () => setYear(+yrRange.value));
yrBtns.forEach((b) => b.addEventListener('click', () => setYear(+b.dataset.i)));

/* ---------- 3B gezgin: bölüm yaklaşınca yüklenir ---------- */
const exIo = new IntersectionObserver(([e]) => {
  if (!e.isIntersecting) return;
  exIo.disconnect();
  import('./explorer/main.js').catch(() => { $('ldPct').textContent = '–'; $('loader').classList.add('done'); });
}, { rootMargin: '900px 0px' });
exIo.observe($('senaryolar'));

/* ---------- şekil büyütme ---------- */
const lb = $('lb'), lbImg = $('lbImg');
$('figs').addEventListener('click', (e) => {
  const b = e.target.closest('.fig-open');
  if (!b) return;
  lbImg.src = b.dataset.src;
  lbImg.alt = b.querySelector('img').alt;
  lb.showModal();
});
$('lbX').addEventListener('click', () => lb.close());
lb.addEventListener('click', (e) => { if (e.target === lb) lb.close(); });


/* ---------- kaydırma: zemin rengi, açılış çerçevesi, yavaş kayan görseller, sahnenin büyümesi ---------- */
const body = document.body;
const fieldEls = [...document.querySelectorAll('[data-bg]')];
const parEls = [...document.querySelectorAll('[data-par]')];
const growEls = [...document.querySelectorAll('[data-grow]')];
const wide = matchMedia('(min-width: 901px)');
const introTrack = $('introTrack'), stackEls = [...document.querySelectorAll('#introStack .st')];
const hgal = $('hgal'), figRow = $('figs'), figEls = [...figRow.children];
let hgalRun = 0;
figEls.forEach((f, i) => f.style.setProperty('--side', i % 2 ? 1 : -1));
function sizeGallery() {
  if (!wide.matches || reduce) { hgal.style.removeProperty('--hgal-h'); hgalRun = 0; return; }
  hgalRun = Math.max(0, figRow.scrollWidth - figRow.parentElement.clientWidth);
  hgal.style.setProperty('--hgal-h', (hgalRun + innerHeight * 1.15) + 'px');
}
sizeGallery();
addEventListener('resize', sizeGallery);
addEventListener('load', () => { sizeGallery(); onScroll(); });
let scTick = false, lastY = scrollY;
function onScroll() {
  scTick = false;
  const vh = innerHeight;
  // zemin: ekranın ortasındaki bölümün rengi; tüm ekran birlikte geçer
  let f = 'paper';
  for (const el of fieldEls) { const r = el.getBoundingClientRect(); if (r.top < vh * 0.55 && r.bottom > vh * 0.55) f = el.dataset.bg; }
  if (scrollY + vh >= document.documentElement.scrollHeight - 4) f = fieldEls[fieldEls.length - 1].dataset.bg;   // sayfa sonunda alt bilgi
  if (body.dataset.field !== f) {
    const jump = Math.abs(scrollY - lastY) > vh * 1.2;
    if (jump) { body.classList.add('jump'); requestAnimationFrame(() => requestAnimationFrame(() => body.classList.remove('jump'))); }
    body.dataset.field = f;
  }
  lastY = scrollY;
  if (reduce) return;
  const hr = hero.getBoundingClientRect();
  hero.style.setProperty('--hp', Math.min(1, Math.max(0, -hr.top / (hr.height * 0.9))).toFixed(3));
  for (const el of parEls) {
    const r = el.getBoundingClientRect();
    if (r.bottom < -100 || r.top > vh + 100) continue;
    el.style.setProperty('--p', Math.min(1, Math.max(0, 1 - (r.top + r.height / 2) / vh)).toFixed(3));
  }
  if (wide.matches) {
    // ölçütler: iz boyunca dört ölçüt sırayla
    const cr = crTrack.getBoundingClientRect();
    const cp = Math.min(0.999, Math.max(0, -cr.top / (cr.height - vh)));
    const k = Math.floor(cp * 4);
    if (k !== crCur) { crCur = k; setCr(k); }
    // sorun: her fotoğraf ekrana girerken alttan açılır, sonra sayfadan yavaş kayar
    for (const el of stackEls) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) continue;
      el.style.setProperty('--r', Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.75))).toFixed(3));
      el.style.setProperty('--p', Math.min(1, Math.max(0, 1 - (r.top + r.height / 2) / vh)).toFixed(3));
    }
    // şekiller: dikey kaydırma yatay galeriyi sürer
    const gr = hgal.getBoundingClientRect();
    const gp = Math.min(1, Math.max(0, -gr.top / (gr.height - vh)));
    figRow.style.setProperty('--hx', (gp * hgalRun).toFixed(1));
    const cx = innerWidth / 2;
    for (const f of figEls) {
      const fr = f.getBoundingClientRect();
      f.style.setProperty('--c', (1 - Math.min(1, Math.abs(fr.left + fr.width / 2 - cx) / innerWidth)).toFixed(3));
    }
  }
  for (const el of growEls) {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--g', Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.7))).toFixed(3));
  }
}
addEventListener('scroll', () => { if (!scTick) { scTick = true; requestAnimationFrame(onScroll); } }, { passive: true });
addEventListener('resize', onScroll);
onScroll();

/* ---------- iklim sayıları bir kez sayar ---------- */
const counts = [...document.querySelectorAll('[data-count]')];
const countIo = new IntersectionObserver((es) => {
  for (const e of es) {
    if (!e.isIntersecting) continue;
    countIo.unobserve(e.target);
    if (reduce) continue;
    const el = e.target, n = +el.dataset.count, pre = el.dataset.pre || '', t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 1300), v = Math.round(n * (1 - Math.pow(1 - k, 3)));
      el.textContent = pre + v;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}, { threshold: 0.6 });
counts.forEach((el) => countIo.observe(el));

applyStatic();
setYear(1);
document.documentElement.classList.add('ready');
