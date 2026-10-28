# SolarPES · Proje sitesi

Ankara'daki devlet okullarının enerji renovasyon senaryolarını bugünün ve 2050'nin ikliminde ölçen
SolarPES projesinin tanıtım sitesi. Türkçe / İngilizce.

## Sayfalar

- `index.html` — proje sayfası: sorun, 3B renovasyon gezgini (dokuz önlem), dört ölçüt, araçlar,
  okul yılı ve yöntem, iklim, bulgular, simülasyon şekilleri, hakkında
- `okullar.html` — yirmi okulu süzme ve en çok üçünü dört ölçütte karşılaştırma (okul adları ve değerler örnek veridir)
- `senaryo/` — senaryo kur ve analiz et: binayı tanımla, önlemleri 3B model üzerinde dene, rapor al

## Yapı

- `css/site.css`, `css/explorer.css`, `css/transition.css` — tasarım, 3B gezgin ve sayfa geçişi
- `js/page.js` — kaydırma hareketleri, bölümler, dil; `js/schools.js` — okullar aracı;
  `js/explorer/` — 3B gezgin (three.js); `js/strings.js` — İngilizce metinler
- `assets/` — okul modeli (`school.glb`), teknik detay modelleri, görseller, şekiller, video

Derleme adımı yoktur; three.js ve Lenis CDN'den yüklenir.

## Yerelde çalıştırma

```bash
py -m http.server 5175
```

Ardından `http://localhost:5175` adresini açın.
