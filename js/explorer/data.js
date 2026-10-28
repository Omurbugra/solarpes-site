// Renovasyon sistemleri. `key` GLB'deki node önekidir (ör. "wall__FAC_...").
// pin / view koordinatları three.js dünyasındadır (x = Rhino X, y = Rhino Z, z = -Rhino Y).
export const GROUPS = [
  { id: 'kabuk', name: 'Kabuk' },
  { id: 'pasif', name: 'Pasif' },
  { id: 'sistem', name: 'Sistem' },
  { id: 'uretim', name: 'Üretim' },
];

export const FEATURES = [
  {
    key: 'wall', icon: 'wall', group: 'kabuk', tag: 'Kabuk', title: 'Duvar yalıtımı',
    pin: [10.2, 8.5, 21],
    view: { target: [-12, 6, 27], dir: [0.55, 0.32, 0.77], dist: 78 },
    detail: { dir: [0.75, 0.45, 1] },
    body: [
      'Dış duvarlar dıştan EPS levha ile mantolanır, üzerine file, sıva ve boya uygulanır.',
      'Kışın ısınma, yazın serinlik ihtiyacını düşürür.',
    ],
    how: 'Geniş duvar yüzeyinden ısı kaçışını keser. Yüzey büyük olduğu için maliyeti yüksek olabilir.',
    eff: [['energy', 'azalır', 'good'], ['emis', 'azalır', 'good'], ['cost', 'yüksek', 'neu'], ['iod', 'iyi', 'good']],
  },
  {
    key: 'roof', icon: 'roof', group: 'kabuk', tag: 'Kabuk', title: 'Çatı yalıtımı',
    pin: [-30, 15.6, 22],
    view: { target: [-14, 13, 27], dir: [-0.35, 0.78, 0.52], dist: 74 },
    detail: { dir: [0.8, 0.6, 1] },
    body: [
      'Binanın en çok ısı alışverişi yaptığı yüzey çatıdır. Kiremit örtünün altına, tavan döşemesinin üzerine taşyünü serilir.',
      'Bu binada tek başına uygulandığında aşırı ısınma saatini en çok azaltan kabuk önlemidir.',
    ],
    how: 'Güneşten ısınan çatı iç mekâna ısı verir; yalıtım bu geçişi büyük ölçüde keser.',
    eff: [['energy', 'azalır', 'good'], ['emis', 'azalır', 'good'], ['cost', 'orta', 'neu'], ['iod', 'çok iyi', 'good']],
  },
  {
    key: 'ground', icon: 'ground', group: 'kabuk', tag: 'Kabuk', title: 'Zemin yalıtımı',
    pin: [-33, 0.4, 39.5],
    // kamera güneybatıdaki ağaç tepesinin (x −49…−44) doğusunda, güneyden alçak açıyla bakar
    view: { target: [-34, -0.3, 37.5], dir: [-0.25, 0.42, 0.87], dist: 19 },
    detail: { dir: [0.85, 0.55, 1] },
    body: [
      'Toprağa oturan zemin döşemesinde betonarme plağın altına 10 cm XPS levha serilir; altında bitümlü su yalıtımı, grobeton ve kırma taş dolgu yer alır.',
      'Ama yazın toprağın serinletici etkisini keser; sınıfları daha da ısıtabilir.',
    ],
    how: 'Kışın faydalı, yazın ters etki yapabilir. Çatı veya gölgeleme ile birlikte düşünülmeli.',
    warn: 'Tek başına yaz konforunu kötüleştirebilir.',
    eff: [['energy', 'az azalır', 'good'], ['emis', 'az azalır', 'good'], ['cost', 'düşük', 'neu'], ['iod', 'kötüleşir', 'bad']],
  },
  {
    key: 'window', icon: 'window', group: 'kabuk', tag: 'Kabuk', title: 'Pencere / yalıtımlı cam',
    pin: [-29, 7.4, 39.4],
    view: { target: [-24, 6, 39], dir: [0.3, 0.16, 0.94], dist: 30 },
    detail: { dir: [0.35, 1, 0.9] },
    body: [
      'Çift/üçlü cam, argon gazı ve low-e kaplama ile ısı geçişini azaltır.',
      'İyi cam yazın ısıyı içeride de tutabildiğinden etkisi dengelidir.',
    ],
    how: 'Low-e kaplama ısı ışınımını yansıtır. Tek başına etkisi sınırlıdır, gölgeleme ile birlikte artar.',
    eff: [['energy', 'azalır', 'good'], ['emis', 'az azalır', 'good'], ['cost', 'orta', 'neu'], ['iod', 'nötr', 'neu']],
  },
  {
    key: 'shading', icon: 'shade', group: 'pasif', tag: 'Pasif', title: 'Güneş gölgelemesi',
    pin: [-17, 9.9, 40.4],
    view: { target: [-14, 6.5, 38], dir: [0.5, 0.3, 0.81], dist: 38 },
    detail: { dir: [0.95, 0.35, 0.7] },
    body: [
      'Güney cephesine yatay saçak, doğu ve batıya dikey kanat. Yüksek yaz güneşini pencereye girmeden keser.',
      'Enerji harcamadan çalışır; etkisi 2050 ikliminde belirginleşir.',
    ],
    how: 'Enerji harcamadan, sadece geometriyle güneş ısısını dışarıda tutar.',
    eff: [['energy', 'azalır', 'good'], ['emis', 'az azalır', 'good'], ['cost', 'düşük', 'neu'], ['iod', 'çok iyi', 'good']],
  },
  {
    key: 'heatpump', icon: 'hp', group: 'sistem', tag: 'Sistem', title: 'Isı pompası (VRF)',
    pin: [7, 1.8, 38.8],
    view: { target: [5, 1.4, 38.6], dir: [-0.3, 0.42, 0.86], dist: 22 },
    detail: { dir: [0.7, 0.4, 1] },
    body: [
      'Kazan ve split klima yerine tek bir elektrikli ısı pompası. Dış üniteden iç ünitelere ısı taşınır.',
      'Hem ısıtır hem soğutur. Mevsimsel verimi yaklaşık 3,4 alınmıştır, yani bir birim elektrikle üç birimden fazla ısı taşır.',
    ],
    how: 'Doğalgaz yakmak yerine elektrikle ısı taşır. Şebeke temizlendikçe (2050) karbon avantajı büyür.',
    eff: [['energy', 'çok azalır', 'good'], ['emis', 'çok azalır', 'good'], ['cost', 'yüksek', 'neu'], ['iod', 'etkisiz', 'neu']],
  },
  {
    key: 'pvroof', icon: 'pv', group: 'uretim', tag: 'Üretim', title: 'Çatı güneş paneli',
    pin: [-6, 16.4, 33],
    view: { target: [-14, 14.5, 28], dir: [0.3, 0.8, 0.52], dist: 60 },
    detail: { dir: [0.45, 0.8, 1] },
    body: [
      'Güneye bakan çatı yüzeylerine yerleştirilen paneller güneşten elektrik üretir.',
      'Elektrik giderini ve karbonu düşürür. Isı pompasıyla birlikte kullanıldığında üretilen elektriğin yerinde tüketilen payı artar.',
    ],
    how: 'Üretilen elektrik önce okulun tüketimini karşılar. Konforu doğrudan etkilemez.',
    eff: [['energy', 'çok azalır', 'good'], ['emis', 'çok azalır', 'good'], ['cost', 'yüksek', 'neu'], ['iod', 'etkisiz', 'neu']],
  },
  {
    key: 'pvshade', icon: 'pv', group: 'uretim', tag: 'Üretim', title: 'Gölgeleme güneş paneli',
    pin: [-26, 13.6, 40.6],
    view: { target: [-14, 12.4, 36], dir: [0.32, 0.55, 0.77], dist: 36 },
    detail: { dir: [0.95, 0.35, 0.75] },
    body: [
      'Güney cephesinin üst katında saçak görevi gören PV modüller. Pencereyi yüksek yaz güneşinden korurken elektrik üretir.',
      'Gölgeleme ile üretimi tek bir elemanda birleştirir; ayrı saçak ve ayrı panel yerine tek yatırım.',
    ],
    how: 'Modül eğimi hem gölge boyunu hem üretimi belirler. Kışın alçak güneş altından geçip sınıfı ısıtır.',
    eff: [['energy', 'azalır', 'good'], ['emis', 'azalır', 'good'], ['cost', 'orta', 'neu'], ['iod', 'iyi', 'good']],
  },
  {
    key: 'pvpark', icon: 'pv', group: 'uretim', tag: 'Üretim', title: 'Otopark güneş paneli',
    pin: [22, 5, 47],
    view: { target: [22, 3, 50], dir: [0.42, 0.55, 0.72], dist: 46 },
    detail: { dir: [0.9, 0.6, 0.8] },
    body: [
      'Otoparkın üzerine çelik taşıyıcılı PV sundurma. Araçları gölgeler, yağmurdan korur ve elektrik üretir.',
      'Çatı alanı sınırlı olduğunda üretimi büyütmenin en kolay yoludur; elektrikli araç şarjıyla doğrudan eşleşir.',
    ],
    how: 'Bina kabuğuna dokunmadan kurulur. Üretim okul saatleriyle örtüştüğü için yerinde tüketim payı yüksektir.',
    eff: [['energy', 'çok azalır', 'good'], ['emis', 'çok azalır', 'good'], ['cost', 'yüksek', 'neu'], ['iod', 'etkisiz', 'neu']],
  },
];

export const INDICATORS = {
  energy: { label: 'Enerji', color: 'var(--energy)' },
  emis: { label: 'Emisyon', color: 'var(--emis)' },
  cost: { label: 'Maliyet', color: 'var(--cost)' },
  iod: { label: 'Konfor', color: 'var(--iod)' },
};

// Hazır olan detay modelleri: dosyayı `assets/details/<key>.glb` olarak koyup anahtarı buraya ekleyin (ör. 'wall').
export const DETAIL_MODELS = ['wall', 'roof', 'ground', 'window', 'shading', 'heatpump', 'pvroof', 'pvshade', 'pvpark'];

export const HOME_VIEW = { target: [-6, 2, 30], dir: [0.36, 0.52, 0.78], dist: 170 };
