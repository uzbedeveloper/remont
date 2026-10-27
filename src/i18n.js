// UI copy in Uzbek (Latin), Russian and English.
// Uzbek and English: no long dashes, plain ' apostrophe. Ranges use a hyphen.
import { createContext, useContext } from 'react';

export const LANGS = ['uz', 'ru', 'en'];

const D = {
  tagline: ["Xonani videoga oling. Adolatli smeta oling. To'g'ri ustani toping.", 'Снимите комнату. Получите честную смету. Найдите нужных мастеров.', 'Film your room. Get a fair smeta. Hire the right ustas.'],
  step_film: ['Video', 'Видео', 'Film'],
  step_measure: ["O'lchov", 'Обмеры', 'Measure'],
  step_smeta: ['Smeta', 'Смета', 'Smeta'],
  step_jobs: ['Ishlar', 'Работы', 'Jobs'],
  step_hire: ['Ustalar', 'Мастера', 'Ustas'],
  new_room: ['Yangi xona', 'Новая комната', 'New room'],
  sample_badge: ["Namuna ma'lumot", 'Пример', 'Sample data'],
  loading: ['Yuklanmoqda…', 'Загрузка…', 'Loading…'],
  error: ['Xatolik: {e}', 'Ошибка: {e}', 'Something went wrong: {e}'],
  retry: ['Qayta urinish', 'Повторить', 'Try again'],

  home_kicker: ['Toshkentdagi remontlar uchun', 'Для ремонта в Ташкенте', 'For renovations in Tashkent'],
  home_title_1: ['Suratga ol.', 'Сними.', 'Film it.'],
  home_title_2: ['Narxini bil.', 'Посчитай.', 'Price it.'],
  home_title_3: ['Ustani top.', 'Найми.', 'Hire it.'],
  home_sub: [
    "Xonangizning 30 soniyalik videosidan o'lchangan devorlar, ustalar navbatidagi halol smeta va haqiqiy ustalar javob beradigan e'lonlar tayyor bo'ladi.",
    '30 секунд видео комнаты превращаются в обмеры, честную смету по порядку работ и объявления, на которые отвечают настоящие мастера.',
    'A 30-second video of your room becomes measured surfaces, an honest smeta in crew order, and job posts that real ustas answer.',
  ],
  home_upload: ['Video yuklash', 'Загрузить видео', 'Upload a video'],
  home_sample: ["Namuna xonani ko'rish", 'Открыть пример', 'Try the sample room'],
  home_upload_hint: ['MP4 yoki MOV, 20-40 soniya. Xona bo\'ylab sekin aylanib chiqing.', 'MP4 или MOV, 20–40 секунд. Медленно пройдите по комнате.', 'MP4 or MOV, 20-40 seconds. Walk slowly around the room.'],
  hero_caption: ['SAM 3.1 namuna xonani kadrma-kadr kuzatmoqda', 'SAM 3.1 отслеживает комнату кадр за кадром', 'SAM 3.1 tracking a sample room, frame by frame'],
  how_title: ['Qanday ishlaydi', 'Как это работает', 'How it works'],
  how1_t: ['Xonani videoga oling', 'Снимите комнату', 'Film the room'],
  how1_d: [
    'SAM 3.1 har bir devor, pol, eshik va derazani topadi va video davomida kuzatib boradi.',
    'SAM 3.1 находит каждую стену, пол, дверь и окно и ведёт их по всему видео.',
    'SAM 3.1 finds every wall, floor, door and window and follows them through the video.',
  ],
  how2_t: ['Halol smeta oling', 'Получите честную смету', 'Get an honest smeta'],
  how2_d: [
    "Muse Spark xonani o'lchaydi va har bir ishni ustalar navbati bilan rejalaydi. Narxlar taxmindan emas, Toshkent narxlar bazasidan olinadi.",
    'Muse Spark измеряет комнату и расписывает работы в порядке бригады. Цены берутся из базы цен Ташкента, а не наугад.',
    'Muse Spark measures the room and plans every step in crew order. Prices come from a Tashkent price base, not from guesswork.',
  ],
  how3_t: ['Kerakli ustani toping', 'Наймите нужных мастеров', 'Hire the right ustas'],
  how3_d: [
    "Har bir kasb uchun aniq hajmli alohida ish tayyor bo'ladi. Telegramga joylang va qaysi javob adolatli ekanini ko'ring.",
    'Для каждой специальности своя работа с точными объёмами. Опубликуйте в Telegram и узнайте, какие ответы честные.',
    'Each trade gets its own job with exact quantities. Post it to Telegram and see which replies are fair.',
  ],
  pitch: [
    'Dizayn ilovalari chiroyli rasm bilan tugaydi. Remont sizni adolatli narx va ishni boshlagan ustagacha olib boradi.',
    'Дизайн-приложения заканчиваются картинкой. Remont доводит до честной цены и мастера, который вышел на работу.',
    'Design apps stop at a picture. Remont gets you to a fair price and an usta who shows up.',
  ],
  built_with: ['Meta modellari bilan', 'На моделях Meta', 'Built on Meta models'],

  an_title: ['Sizning xonangiz', 'Ваша комната', 'Your room'],
  an_hint_label: ["Bitta o'lchamni bilasizmi? (ixtiyoriy)", 'Знаете один размер? (необязательно)', 'Know one size? (optional)'],
  an_hint_ph: ['masalan, deraza tomondagi devor 3,4 m', 'например, стена с окном 3,4 м', 'e.g. the window wall is 3.4 m'],
  an_start: ["Xonamni o'lcha", 'Измерить комнату', 'Measure my room'],
  an_uploading: ['Yuklanmoqda {p}%', 'Загрузка {p}%', 'Uploading {p}%'],
  an_prep: ['Video tayyorlanmoqda', 'Готовим видео', 'Preparing the video'],
  an_prep_done: ['{n} kadr, {fps} kadr/soniya', '{n} кадров, {fps} к/с', '{n} frames at {fps} fps'],
  an_sam: ['SAM 3.1 kuzatmoqda: {what}', 'SAM 3.1 отслеживает: {what}', 'SAM 3.1 tracking: {what}'],
  an_sam_done: ['{f} kadrda {n} ta', '{n} шт. в {f} кадрах', '{n} found across {f} frames'],
  an_measure: ["Muse Spark xonani o'lchamoqda", 'Muse Spark измеряет комнату', 'Muse Spark measuring the room'],
  an_wait: ["Taxminan 1-2 daqiqa. Modellar har bir kadrni ko'rib chiqmoqda.", 'Около 1–2 минут. Модели смотрят каждый кадр.', 'About 1-2 minutes. The models are looking at every frame.'],
  an_other: ['Boshqa video tanlash', 'Выбрать другое видео', 'Choose another video'],

  me_title: ["Videongizdan o'lchandi", 'Измерено по вашему видео', 'Measured from your video'],
  floor: ['Pol', 'Пол', 'Floor'],
  walls: ['Devorlar', 'Стены', 'Walls'],
  ceiling: ['Shift', 'Потолок', 'Ceiling'],
  height: ['Balandlik', 'Высота', 'Height'],
  me_walls_note: ['eshik va derazasiz', 'без дверей и окон', 'minus doors and windows'],
  me_dims: ["Xona o'lchami", 'Размер комнаты', 'Room size'],
  length: ['Uzunligi', 'Длина', 'Length'],
  width: ['Eni', 'Ширина', 'Width'],
  me_edit_hint: ["Noto'g'ri bo'lsa, istalgan raqamni tuzating, hammasi qayta hisoblanadi.", 'Неточно? Исправьте любое число, всё пересчитается.', 'Not right? Fix any number and everything recalculates.'],
  me_known: ["Eshik balandligini bilasizmi?", 'Знаете высоту двери?', 'Know your door height?'],
  me_rescale: ['Shunga moslash', 'Подогнать', 'Scale to it'],
  me_openings: ['Eshik va derazalar', 'Двери и окна', 'Doors and windows'],
  me_condition: ['Holati', 'Состояние', 'Condition'],
  me_notes: ['Smetachi nimani payqadi', 'Что заметил сметчик', 'What the estimator noticed'],
  me_conf: ['Ishonch: {c}', 'Уверенность: {c}', 'Confidence: {c}'],
  me_next: ['Ishlarni rejalash', 'Спланировать работы', 'Plan the work'],
  me_found: ['SAM 3.1 topdi', 'Найдено SAM 3.1', 'Found by SAM 3.1'],
  me_counts: ['Radiator {r} · Rozetka {s} · Chiroq {l}', 'Радиаторы {r} · Розетки {s} · Светильники {l}', 'Radiators {r} · Sockets {s} · Lights {l}'],
  me_how: ["Qanday o'lchandi", 'Как измерено', 'How it was measured'],
  conf_low: ['past', 'низкая', 'low'],
  conf_medium: ["o'rtacha", 'средняя', 'medium'],
  conf_high: ['yuqori', 'высокая', 'high'],
  door: ['Eshik', 'Дверь', 'Door'],
  window: ['Deraza', 'Окно', 'Window'],
  wall: ['Devor', 'Стены', 'Walls'],
  radiator: ['Radiator', 'Радиатор', 'Radiator'],
  cond_good: ['yaxshi', 'хорошее', 'good'],
  cond_worn: ['eskirgan', 'изношено', 'worn'],
  cond_poor: ['yomon', 'плохое', 'poor'],
  cond_none: ["yo'q", 'нет', 'none'],
  room_living_room: ['Mehmonxona', 'Гостиная', 'Living room'],
  room_bedroom: ['Yotoqxona', 'Спальня', 'Bedroom'],
  room_kitchen: ['Oshxona', 'Кухня', 'Kitchen'],
  room_bathroom: ['Hammom', 'Ванная', 'Bathroom'],
  room_hallway: ['Dahliz', 'Прихожая', 'Hallway'],
  room_other: ['Xona', 'Комната', 'Room'],

  sm_title: ['Nima qilmoqchisiz?', 'Что нужно сделать?', 'What do you want done?'],
  keep: ['Tegmang', 'Не трогать', 'Leave as is'],
  b_walls: ['Devorlar', 'Стены', 'Walls'],
  b_floor: ['Pol', 'Пол', 'Floor'],
  b_ceiling: ['Shift', 'Потолок', 'Ceiling'],
  b_window: ['Deraza', 'Окно', 'Window'],
  b_door: ['Eshik', 'Дверь', 'Door'],
  b_radiator: ['Radiator', 'Радиатор', 'Radiator'],
  b_electrics: ['Elektr', 'Электрика', 'Electrics'],
  o_paint: ["Bo'yash", 'Покраска', 'Paint'],
  o_wallpaper: ["Gulqog'oz", 'Обои', 'Wallpaper'],
  o_tiles: ['Kafel', 'Плитка', 'Tiles'],
  o_laminate: ['Laminat', 'Ламинат', 'Laminate'],
  o_linoleum: ['Linoleum', 'Линолеум', 'Linoleum'],
  o_stretch: ['Natyajnoy', 'Натяжной', 'Stretch'],
  o_replace: ['Almashtirish', 'Заменить', 'Replace'],
  o_rewire: ["To'liq yangilash", 'Полная замена', 'Full rewire'],
  o_points: ['Rozetka va chiroqlar', 'Розетки и свет', 'Sockets and lights'],
  sm_note_ph: ['Yana nimadir? Masalan, ijaraga berish uchun arzonroq remont', 'Что-то ещё? Например, бюджетный ремонт под сдачу', 'Anything else? e.g. a budget job for renting out'],
  sm_tier: ['Materiallar darajasi', 'Уровень материалов', 'Materials'],
  tier_economy: ['Ekonom', 'Эконом', 'Economy'],
  tier_standard: ['Standart', 'Стандарт', 'Standard'],
  tier_premium: ['Premium', 'Премиум', 'Premium'],
  sm_build: ['Smetani tuz', 'Составить смету', 'Build my smeta'],
  sm_rebuild: ['Qayta tuz', 'Пересоставить', 'Rebuild'],
  sm_building: ['Muse Spark har bir bosqichni rejalamoqda…', 'Muse Spark планирует каждый этап…', 'Muse Spark is planning every step…'],
  sm_total: ['Jami', 'Итого', 'Total'],
  sm_labor: ['Ish haqi', 'Работы', 'Labor'],
  sm_materials: ['Materiallar', 'Материалы', 'Materials'],
  sm_days: ['{n} ish kuni', '{n} рабочих дней', '{n} working days'],
  sm_price_note: ['Narxlar: Toshkent narxlar bazasi, {date} (qoralama, usta tekshiruvida). Ishlarni AI tanlaydi, hisobni kod qiladi.', 'Цены: база цен Ташкента, {date} (черновик, на проверке у мастера). Работы выбирает ИИ, считает код.', 'Prices: Tashkent price base, {date} (draft, being checked by an usta). The AI picks the work, code does the math.'],
  sm_schedule: ['Ish jadvali', 'График работ', 'Schedule'],
  sm_lines: ['Ishlar navbati bilan', 'Работы по порядку', 'Work in crew order'],
  sm_assumptions: ['Narx shunga asoslangan', 'Цена предполагает', 'The price assumes'],
  sm_print: ['Chop etish / PDF', 'Печать / PDF', 'Print / PDF'],
  sm_next: ['Ishlarga ajratish', 'Разбить на работы', 'Split into jobs'],
  sm_day: ['kun', 'дн.', 'd'],
  sm_render_t: ["Tayyor holatini ko'ring", 'Посмотрите результат', 'See it finished'],
  sm_render_d: ['Muse Image aynan shu xonani siz tanlagan pardoz bilan qayta chizadi.', 'Muse Image перерисует именно эту комнату с выбранной отделкой.', 'Muse Image repaints this exact room with the finishes you chose.'],
  sm_render_btn: ["Ko'rsat", 'Показать', 'Show me'],
  sm_rendering: ['Chizilmoqda… taxminan 20 soniya', 'Рисуем… около 20 секунд', 'Painting… about 20 seconds'],
  sm_pick_view: ["Ko'rinishni tanlang", 'Выберите ракурс', 'Pick the view'],
  before: ['Oldin', 'До', 'Before'],
  after: ['Keyin', 'После', 'After'],

  jb_title: ['Kimlarni yollash kerak', 'Кого нанять', 'Who to hire'],
  jb_sub: ['Har bir karta bitta ustaning ishi. Hajmlar videongizdan aniq olingan.', 'Каждая карточка — работа одного мастера. Объёмы точно по вашему видео.', "Each card is one usta's job, with exact quantities from your video."],
  jb_days: ['{a}-{b}-kun', 'Дни {a}–{b}', 'Day {a}-{b}'],
  jb_day: ['{a}-kun', 'День {a}', 'Day {a}'],
  jb_fair: ['Adolatli ish haqi', 'Честная цена работы', 'Fair labor price'],
  jb_materials: ['Materiallar', 'Материалы', 'Materials'],
  jb_find: ['Usta topish', 'Найти мастера', 'Find an usta'],

  hi_back: ['Barcha ishlar', 'Все работы', 'All jobs'],
  hi_where: ['Uy qayerda?', 'Где квартира?', 'Where is the flat?'],
  hi_match_t: ['Mos ustalar', 'Подходящие мастера', 'Ustas who fit'],
  hi_sample: ['Namuna profillar (demo uchun)', 'Примеры профилей (для демо)', 'Sample profiles for the demo'],
  hi_years: ['{n} yil', '{n} лет', '{n} yrs'],
  hi_jobs: ['{n} ta ish', '{n} работ', '{n} jobs'],
  hi_near: ['yaqin', 'рядом', 'nearby'],
  hi_their_price: ['Odatdagi narxi', 'Обычная цена', 'Usual price'],
  hi_why_fair: ['narxi adolatli oraliqda', 'цена в честном диапазоне', 'price sits in the fair range'],
  hi_why_cheap: ["o'rtachadan arzonroq", 'дешевле среднего', 'cheaper than average'],
  hi_why_pricey: ["o'rtachadan qimmatroq", 'дороже среднего', 'pricier than average'],
  hi_why_rating: ['{n} ta ishda {r}★', '{r}★ за {n} работ', '{r}★ over {n} jobs'],
  hi_why_near: ['{d}da ishlaydi', 'работает в районе {d}', 'works in {d}'],
  hi_message: ['Yozish', 'Написать', 'Message'],
  hi_message_off: ['Namuna profil, aloqa yo\'q', 'Пример профиля, без контакта', 'Sample profile, no contact'],
  hi_post_t: ["Telegramda e'lon bering", 'Объявление в Telegram', 'Announce the job in Telegram'],
  hi_post_d: ["Muse Spark e'lonni o'lchamlaringiz asosida o'zbek va rus tilida yozadi.", 'Muse Spark напишет объявление по вашим обмерам на узбекском и русском.', 'Muse Spark writes the post from your measurements, in Uzbek and Russian.'],
  hi_start: ['Boshlanish', 'Начало', 'Start'],
  hi_start_ph: ['masalan, 5-noyabrdan', 'например, с 5 ноября', 'e.g. from 5 November'],
  hi_mat_owner: ['Materialni o\'zim olaman', 'Материалы покупаю я', 'I buy materials'],
  hi_mat_usta: ['Materialni usta oladi', 'Материалы на мастере', 'Usta brings materials'],
  hi_write: ["E'lonni yoz", 'Написать объявление', 'Write the post'],
  hi_rewrite: ['Qayta yoz', 'Переписать', 'Rewrite'],
  hi_writing: ['Yozilmoqda…', 'Пишем…', 'Writing…'],
  hi_copy: ['Nusxalash', 'Скопировать', 'Copy'],
  hi_copied: ['Nusxalandi', 'Скопировано', 'Copied'],
  hi_share: ['Telegramda ulashish', 'Поделиться в Telegram', 'Share in Telegram'],
  hi_post_group: ['Guruhga joylash', 'Опубликовать в группе', 'Post to our group'],
  hi_posted: ['Guruhga joylandi', 'Опубликовано в группе', 'Posted to the group'],
  hi_replies_t: ['Ustalarning javoblari', 'Ответы мастеров', "Ustas' replies"],
  hi_replies_d: [
    "Guruhdagi javoblarni shu yerga qo'ying. Muse Spark ularni o'qiydi, o'zbekcha-ruscha aralash bo'lsa ham, va har bir narxni smetangiz bilan solishtiradi.",
    'Вставьте ответы из группы. Muse Spark прочитает их, даже вперемешку на узбекском и русском, и сверит каждую цену со сметой.',
    'Paste the replies from the group. Muse Spark reads them, even mixed Uzbek and Russian, and checks every price against your smeta.',
  ],
  hi_replies_ph: ["Xabarlarni shu yerga qo'ying…", 'Вставьте сообщения сюда…', 'Paste the messages here…'],
  hi_read: ['Javoblarni tekshir', 'Проверить ответы', 'Check the replies'],
  hi_reading: ["O'qilmoqda…", 'Читаем…', 'Reading…'],
  hi_quoted: ['Taklif', 'Предложение', 'Quoted'],
  hi_fair_lbl: ['Adolatli narx', 'Честная цена', 'Fair price'],
  hi_partial: ['ishning bir qismi uchun', 'за часть работы', 'for part of the job'],
  hi_with_mat: ['material bilan', 'с материалом', 'incl. materials'],
  hi_starts: ['Boshlaydi: {s}', 'Начнёт: {s}', 'Starts: {s}'],
  hi_exp: ['{n} yil tajriba', 'опыт {n} лет', '{n} yrs experience'],
  hi_photos: ['ish rasmlari bor', 'есть фото работ', 'has photos of past work'],
  hi_anon: ['Ismsiz', 'Без имени', 'No name'],
  v_fair: ['Adolatli narx', 'Честная цена', 'Fair price'],
  v_high: ['{p}% qimmat', 'на {p}% дороже', '{p}% above fair'],
  v_very_high: ['Juda qimmat, +{p}%', 'Сильно дороже, +{p}%', 'Way above fair, +{p}%'],
  v_low: ['Shubhali darajada arzon', 'Подозрительно дёшево', 'Suspiciously cheap'],
  v_vague: ['Narx aytilmagan', 'Цена не названа', 'No clear price'],

  u_m2: ['m²', 'м²', 'm²'],
  u_m: ['m', 'м', 'm'],
  u_pcs: ['dona', 'шт', 'pcs'],
  u_point: ['nuqta', 'точка', 'point'],
  u_bag: ['qop', 'меш.', 'bag'],
  u_L: ['l', 'л', 'L'],
  u_kg: ['kg', 'кг', 'kg'],
  u_roll: ['rulon', 'рул.', 'roll'],
  u_pack: ['pachka', 'пач.', 'pack'],
  u_set: ["to'plam", 'компл.', 'set'],
  currency: ["so'm", 'сум', "so'm"],
  mln: ['mln', 'млн', 'M'],
};

const DISTRICTS_RU = {
  Bektemir: 'Бектемир', Chilonzor: 'Чиланзар', Mirobod: 'Мирабад', "Mirzo Ulug'bek": 'Мирзо-Улугбек', Olmazor: 'Алмазар',
  Sergeli: 'Сергели', Shayxontohur: 'Шайхантахур', Uchtepa: 'Учтепа', Yakkasaroy: 'Яккасарай', Yangihayot: 'Янгихаёт',
  Yashnobod: 'Яшнабад', Yunusobod: 'Юнусабад',
};
export const DISTRICTS = Object.keys(DISTRICTS_RU);

export function makeT(lang) {
  const i = Math.max(0, LANGS.indexOf(lang));
  const t = (key, vars) => {
    let s = D[key]?.[i] ?? D[key]?.[2] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
    return s;
  };
  t.lang = lang;
  // Pick the right language from a {en, uz, ru} object.
  t.pick = o => (o ? o[lang] ?? o.en ?? '' : '');
  t.district = d => (lang === 'ru' ? DISTRICTS_RU[d] ?? d : d);
  t.unit = u => t(`u_${u}`);
  const loc = lang === 'en' ? 'en-US' : 'ru-RU';
  t.num = (n, digits = 1) => Number(n).toLocaleString(loc, { maximumFractionDigits: digits });
  t.money = n => `${Math.round(n).toLocaleString('ru-RU')} ${t('currency')}`;
  t.mln = n => `${(n / 1e6).toLocaleString(loc, { maximumFractionDigits: 1 })} ${t('mln')} ${t('currency')}`;
  t.range = ([a, b]) => `${(a / 1e6).toLocaleString(loc, { maximumFractionDigits: 2 })}-${t.mln(b)}`;
  t.day = n => t.num(n, 1);
  // Work that runs from day-offset s to e, as whole calendar days ("Day 3-5").
  t.span = (s, e) => {
    const a = Math.floor(s) + 1, b = Math.max(a, Math.ceil(e));
    return a === b ? t('jb_day', { a }) : t('jb_days', { a, b });
  };
  return t;
}

export const I18n = createContext(makeT('uz'));
export const useT = () => useContext(I18n);
