// What the owner checks before paying each trade. Plain tests anyone can do with a phone,
// a sheet of paper or a 2 m straight edge (the usta has one; ask for it).
const c = (uz, ru, en) => ({ uz, ru, en });

export const CHECKS = {
  demolition: [
    c("Eski gulqog'oz va bo'yoq to'liq ko'chirilgan", 'Старые обои и краска сняты полностью', 'Old wallpaper and paint fully removed'),
    c("Devorni chertib ko'ring: bo'sh ovoz chiqmasin (ko'chgan suvoq qolmagan)", 'Простучите стены: нет глухого звука (отслоившейся штукатурки не осталось)', 'Tap the walls: no hollow sound (no loose plaster left)'),
    c("Chiqindi olib chiqilgan, yo'lak toza", 'Мусор вывезен, подъезд чистый', 'Rubble taken away, the stairwell is clean'),
    c("Quvur va simlar shikastlanmagan", 'Трубы и провода не повреждены', 'Pipes and wires not damaged'),
  ],
  electrician: [
    c("Har bir rozetkani telefon zaryadkasi bilan tekshiring", 'Проверьте каждую розетку зарядкой телефона', 'Test every socket with a phone charger'),
    c("Shchitda UZO bor, «Test» tugmasi bosilganda o'chadi", 'В щитке есть УЗО, при нажатии «Тест» отключается', 'The panel has an RCD that trips when you press «Test»'),
    c("Kabel mis, VVGng deb yozilgan (alyuminiy emas)", 'Кабель медный, с маркировкой ВВГнг (не алюминий)', 'Cable is copper, marked VVGng (not aluminium)'),
    c("Suvoqdan oldin devordagi simlarni rasmga oling", 'До штукатурки сфотографируйте провода в стенах', 'Photograph the wires in the walls before plastering'),
  ],
  plumber: [
    c("Suvni 10 daqiqa oqizing, ulanishlarni quruq qog'oz bilan tekshiring", 'Пустите воду на 10 минут, проверьте стыки сухой салфеткой', 'Run the water for 10 minutes; check joints with a dry paper towel'),
    c("Radiator bir tekis isiydi, kranlardan tomchi yo'q", 'Радиатор греет равномерно, краны не капают', 'The radiator heats evenly, valves do not drip'),
    c("Quvurlar qisqichlar bilan mahkam, qimirlamaydi", 'Трубы закреплены хомутами, не шатаются', 'Pipes are clamped tight and do not wobble'),
    c("Devor yopilishidan oldin quvurlarni rasmga oling", 'До закрытия стен сфотографируйте трубы', 'Photograph the pipes before the walls are closed'),
  ],
  windows_doors: [
    c("Rom silliq ochiladi, yopiladi va qiya ochiladi", 'Окно плавно открывается, закрывается и откидывается', 'The window opens, closes and tilts smoothly'),
    c("Qog'oz sinovi: yopiq rom qog'ozni mahkam ushlaydi", 'Тест бумагой: закрытая створка крепко держит лист', 'Paper test: a closed sash grips a sheet of paper tight'),
    c("Ko'pik tashqaridan yopilgan, tirqish yo'q", 'Пена снаружи закрыта, щелей нет', 'The foam is covered outside, no gaps'),
    c("Eshik ishqalanmasdan yopiladi, tirqishlar bir xil", 'Дверь закрывается без трения, зазоры ровные', 'The door closes without rubbing, gaps are even'),
  ],
  plasterer: [
    c("2 metrli reykani devorga qo'ying: tirqish 3 mm dan oshmasin", 'Приложите 2-метровое правило: зазор не больше 3 мм', 'Lay a 2 m straight edge on the wall: no gap over 3 mm'),
    c("Burchaklar to'g'ri (90°), burchak o'lchagich bilan tekshiring", 'Углы прямые (90°), проверьте угольником', "Corners are square (90°): check with a builder's square"),
    c("Yoriq yo'q, chertganda bo'sh ovoz chiqmaydi", 'Трещин нет, при простукивании нет глухого звука', 'No cracks, no hollow sound when tapped'),
    c("Bo'yashdan oldin devor kamida bir hafta qurisin", 'Перед покраской стены сохнут минимум неделю', 'Walls dry at least a week before painting'),
  ],
  tiler: [
    c("Kafelni chertib ko'ring: bo'sh ovoz chiqmasin", 'Простучите плитку: нет глухого звука', 'Tap the tiles: no hollow sound'),
    c("Choklar bir xil kenglikda, qatorlar tekis", 'Швы одной ширины, ряды ровные', 'Joints are the same width, rows are straight'),
    c("Hammomda suv quying: trap tomon oqib ketadi", 'В ванной пролейте воду: она уходит к трапу', 'In the bathroom pour water: it runs to the drain'),
    c("Choklar to'liq to'ldirilgan, teshik yo'q", 'Швы заполнены полностью, без пустот', 'Grout is full, no holes'),
  ],
  painter: [
    c("Telefon chirog'ini devor bo'ylab yon tomondan tuting: dog' va izlar yo'q", 'Посветите фонариком телефона вдоль стены: нет пятен и полос', 'Shine a phone torch along the wall from the side: no streaks or patches'),
    c("Rang bir tekis, ikki qavat bo'yalgan", 'Цвет ровный, покрашено в два слоя', 'Even colour, two coats'),
    c("Shift, rozetka va plintus yonidagi chetlar toza", 'Края у потолка, розеток и плинтуса чистые', 'Clean edges at the ceiling, sockets and skirting'),
    c("Rom va polda bo'yoq yo'q", 'На окнах и полу нет краски', 'No paint on the windows or floor'),
  ],
  ceiling: [
    c("Shiftda burma yo'q, 2 metrdan chok ko'rinmaydi", 'На потолке нет складок, шов не виден с 2 метров', 'No wrinkles; the seam is not visible from 2 m'),
    c("Chiroqlar kelishilgan joyda, hammasi yonadi", 'Светильники где договорились, все горят', 'Lights are where agreed, all of them work'),
    c("Chetlari (baget) tekis va toza", 'Края (багет) ровные и аккуратные', 'Edges (trim) are straight and neat'),
    c("Shift osilib turmaydi", 'Потолок не провисает', 'The ceiling does not sag'),
  ],
  floor: [
    c("Taxtalar orasida tirqish yo'q", 'Между досками нет щелей', 'No gaps between boards'),
    c("Yurganda g'ichirlamaydi va bukilmaydi", 'При ходьбе не скрипит и не прогибается', 'No creaking or bouncing when you walk'),
    c("Devor yonida 8-10 mm bo'shliq qoldirilgan (plintus ostida)", 'У стен оставлен зазор 8–10 мм (под плинтусом)', 'An 8-10 mm gap is left at the walls (under the skirting)'),
    c("Plintus mahkam, burchaklari toza", 'Плинтус прилегает плотно, углы аккуратные', 'Skirting is tight, corners are neat'),
  ],
};

export const checksFor = trade => CHECKS[trade] ?? [];
export function checksDone(card, trade) {
  const list = checksFor(trade);
  const ok = list.filter((_, i) => card.checks?.[i] === 'ok').length;
  const bad = list.filter((_, i) => card.checks?.[i] === 'bad').length;
  return { ok, bad, total: list.length, all: list.length > 0 && ok === list.length };
}

// Payment stages of an agreement, as shares of the price: avans, middle, after the check.
export const STAGES = { '30-40-30': [0.3, 0.4, 0.3], '50-50': [0.5, 0, 0.5], '20-30-50': [0.2, 0.3, 0.5] };
export const paidOf = card => (card.payments ?? []).reduce((s, p) => s + p.sum, 0);
