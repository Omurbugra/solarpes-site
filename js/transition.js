// Sayfalar arası geçiş perdesi: site içindeki başka bir sayfaya giden bağlantıda perde kapanır, sonra gidilir;
// yeni sayfa açılınca perde açılır. Aynı sayfadaki #bölüm bağlantılarına dokunmaz.
(function () {
  var d = document.documentElement;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  try {
    if (sessionStorage.getItem('sp-trans') === '1') {
      sessionStorage.removeItem('sp-trans');
      d.classList.add('arrive');
      setTimeout(function () { d.classList.remove('arrive'); }, 1100);
    }
  } catch (e) { /* depolama kapalı */ }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
    var url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.hash) return;
    e.preventDefault();
    try { sessionStorage.setItem('sp-trans', '1'); } catch (err) { /* yok */ }
    d.classList.add('leave');
    setTimeout(function () { location.href = url.href; }, 650);
  });
  // Geri tuşuyla önbellekten dönülürse perde kapalı kalmasın
  addEventListener('pageshow', function (e) { if (e.persisted) d.classList.remove('leave', 'arrive'); });
})();
