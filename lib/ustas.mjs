// The usta directory: phone numbers, trades and districts pulled from public Telegram and OLX ads.

// A run of digits that could be an Uzbek phone number: +998 90 123 45 67, 90-123-45-67, 901234567, (99) 784 07 07.
export const PHONE_RE = /(?:\+?998[\s\-()]*)?\(?\d{2}\)?[\s\-]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}(?!\d)/;
const PHONE_ALL = new RegExp(PHONE_RE.source, 'g');
// Mobile operator codes and Tashkent landlines (71, 78).
const CODES = new Set(['20', '33', '50', '55', '61', '62', '65', '66', '67', '69', '71', '73', '75', '76', '77', '78', '79', '88', '90', '91', '93', '94', '95', '97', '98', '99']);

// Every phone in a text, as 998XXXXXXXXX.
export function phones(text) {
  const out = new Set();
  for (const m of String(text).matchAll(PHONE_ALL)) {
    let d = m[0].replace(/\D/g, '');
    if (d.length === 12 && d.startsWith('998')) d = d.slice(3);
    if (d.length === 9 && CODES.has(d.slice(0, 2))) out.add(`998${d}`);
  }
  return [...out];
}

export const prettyPhone = p => `+998 ${p.slice(3, 5)} ${p.slice(5, 8)} ${p.slice(8, 10)} ${p.slice(10, 12)}`;

// Renovation work words (Uzbek Latin and Cyrillic, Russian). An ad must mention one to be kept.
export const TRADE_RE = /usta|уста|remont|ремонт|kafel|кафел|plitk|плитк|santex|сантех|elektr|электр|oboy|обо[ий]|gips|гипс|shpak|шпак|malyar|маляр|molyar|bo['ʻ’`]?yoq|бўёқ|suvoq|сувоқ|штукатур|shtukatur|potol|потол|natyaj|натяж|laminat|ламинат|parket|паркет|styajk|стяжк|pol quy|пол|eshik|двер|deraza|okno|окн|rom\b|отдел|pardoz|qurilish|қурилиш|строит|stroy|demontaj|демонтаж|svarsh|свар|kafelchi|plitochnik|плиточник/i;

export const DISTRICTS = ['Bektemir', 'Chilonzor', 'Mirobod', "Mirzo Ulug'bek", 'Olmazor', 'Sergeli', 'Shayxontohur', 'Uchtepa', 'Yakkasaroy', 'Yangihayot', 'Yashnobod', 'Yunusobod'];

// OLX district names (Russian) → ours.
export const OLX_DISTRICT = {
  'Бектемирский район': 'Bektemir', 'Чиланзарский район': 'Chilonzor', 'Мирабадский район': 'Mirobod', 'Мирзо-Улугбекский район': "Mirzo Ulug'bek",
  'Алмазарский район': 'Olmazor', 'Сергелийский район': 'Sergeli', 'Шайхантахурский район': 'Shayxontohur', 'Учтепинский район': 'Uchtepa',
  'Яккасарайский район': 'Yakkasaroy', 'Янгихаётский район': 'Yangihayot', 'Яшнабадский район': 'Yashnobod', 'Юнусабадский район': 'Yunusobod',
};

// Ustas for a job: right trade first, then near you, then active and well described.
// No ratings yet: "recent" and "posts photos" are what we know.
export function rankDirectory(list, trade, district) {
  const now = Date.now();
  return list
    .filter(u => u.trades.includes(trade))
    .map(u => {
      const days = (now - Date.parse(u.last_seen)) / 86400000;
      const near = Boolean(district) && (u.districts.includes(district) || u.districts.includes('all'));
      const score = (near ? 30 : 0) + (u.districts.includes(district) ? 10 : 0) + Math.max(0, 20 - days / 3)
        + Math.min(u.years || 0, 15) + (u.photos ? 6 : 0) + Math.min(u.posts, 10) * 0.5 + (u.trades.length <= 2 ? 4 : 0);
      return { ...u, near, score };
    })
    .sort((a, b) => b.score - a.score);
}
