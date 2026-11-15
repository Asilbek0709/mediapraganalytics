import { lugat } from "../til.ts";

export const hisobotMatnlari = lugat(
  {
    "hs.eyebrow": "Eksport",
    "hs.izoh": "Natijalarni dissertatsiya va tahririy tahlil uchun eksport qilish",
    "hs.excel": "Excel hisobot (.xlsx)",
    "hs.excelIzoh": "Hisobotga {n} ta material kiradi, shundan {t} tasi to‘liq tahlil qilingan · metodika v{v}",
    "hs.yuklab": "Yuklab olish",
    "hs.varaq": "Varaq",
    "hs.mazmun": "Mazmuni",
    "hs.m.materiallar": "Mediabazadagi barcha materiallar: nashr, media turi, sana, janr, mavzu, havola, sarlavha, lid, holat",
    "hs.m.tahlil":
      "Har bir material bo‘yicha kodlash: sarlavha turi, muvofiqlik, kompozitsiya, auditoriya bahosi, kategoriyalar soni, K1–K5, LPSI, daraja",
    "hs.m.nashrlar": "Nashr bo‘yicha o‘rtacha K1–K5 va LPSI, har bir muammo uchragan materiallar ulushi (%)",
    "hs.m.reyting": "Nashrlar o‘rni LPSI va har bir mezon (K1–K5) bo‘yicha; LPSI bo‘yicha eng yuqori va eng past 10 ta material",
    "hs.m.media": "Bosma va raqamli media taqqosi — xuddi shu ko‘rsatkichlar",
    "hs.m.janrlar": "Janr bo‘yicha taqqoslash",
    "hs.m.muammolar": "Har bir kategoriya: jami birliklar, sarlavha / lid / asosiy matnda taqsimlanishi, materiallar ulushi",
    "hs.m.sarlavha": "Har bir sarlavha turining ulushi: umumiy, bosma va raqamli media ichida",
    "hs.m.dinamika": "Oylar, choraklar va yillar bo‘yicha K1–K5 va LPSI o‘rtachasi (barcha / bosma / raqamli)",
    "hs.m.ahamiyat":
      "Farqlarning statistik ahamiyati: bosma va raqamli (Mann–Whitney U, muammolar uchun Fisher testi), nashrlar, janrlar va yillar (Kruskal–Wallis H, Dunn post-hoc) — p, effekt hajmi, xulosa",
    "hs.m.kelishuv": "Har bir ko‘rsatkich bo‘yicha Krippendorff α, talqini, mos juftlar ulushi va o‘rtacha farq",
    "hs.m.vaznlar": "Ekspertlarning K1–K5 vaznlari, o‘rtacha / mediana / SD / CV, taklif etilgan vaznlar va Kendall W",
    "hs.m.metodika":
      "Hisobot tuzilgan metodika versiyasi: vaznlar, qiymatlar, jarimalar, shkala — natijalarni qayta tekshirish uchun",
    "hs.tilIzoh": "Hisobot interfeysning joriy tilida tuziladi.",
    "hs.pdf": "Tahlil kartasi (PDF)",
    "hs.pdfIzoh":
      "Har bir material uchun alohida PDF karta: metama’lumot, sarlavha va lid, K1–K5 formulalari bilan, LPSI va daraja, muvofiqlik, kompozitsiya, barcha belgilar (fragment va izoh bilan). Karta tahlil sahifasidagi «PDF karta» tugmasi yoki Mediabazadagi «PDF» tugmasi orqali ochiladi.",
    "hs.zaxira": "Ma’lumotlar zaxirasi",
  },
  {
    "hs.eyebrow": "Экспорт",
    "hs.izoh": "Экспорт результатов для диссертации и редакционного анализа",
    "hs.excel": "Отчёт Excel (.xlsx)",
    "hs.excelIzoh":
      "В отчёт входит {n} {материал|материала|материалов}, из них полностью размечено: {t} · методика v{v}",
    "hs.yuklab": "Скачать",
    "hs.varaq": "Лист",
    "hs.mazmun": "Содержание",
    "hs.m.materiallar": "Все материалы медиабазы: издание, тип СМИ, дата, жанр, тема, ссылка, заголовок, лид, статус",
    "hs.m.tahlil":
      "Разметка каждого материала: тип заголовка, соответствие, композиция, оценка аудитории, число категорий, K1–K5, LPSI, уровень",
    "hs.m.nashrlar": "Средние K1–K5 и LPSI по изданиям, доля материалов с каждой проблемой (%)",
    "hs.m.reyting": "Места изданий по LPSI и по каждому критерию K1–K5; 10 лучших и 10 худших материалов по LPSI",
    "hs.m.media": "Сравнение печатных и цифровых СМИ — те же показатели",
    "hs.m.janrlar": "Сравнение по жанрам",
    "hs.m.muammolar": "Каждая категория: всего единиц, распределение по заголовку / лиду / основному тексту, доля материалов",
    "hs.m.sarlavha": "Доля каждого типа заголовка: в целом, среди печатных и цифровых СМИ",
    "hs.m.dinamika": "Средние K1–K5 и LPSI по месяцам, кварталам и годам (все / печатные / цифровые)",
    "hs.m.ahamiyat":
      "Статистическая значимость различий: печатные и цифровые СМИ (Манн–Уитни, для проблем — критерий Фишера), издания, жанры и годы (Краскел–Уоллис, пост-хок Данна) — p, размер эффекта, вывод",
    "hs.m.kelishuv": "α Криппендорфа по каждому показателю, интерпретация, доля совпадающих пар и средняя разница",
    "hs.m.vaznlar": "Веса K1–K5 от экспертов, среднее / медиана / SD / CV, предложенные веса и W Кендалла",
    "hs.m.metodika":
      "Версия методики, по которой построен отчёт: веса, значения, штрафы, шкала — для проверки воспроизводимости",
    "hs.tilIzoh": "Отчёт формируется на текущем языке интерфейса.",
    "hs.pdf": "Карточка анализа (PDF)",
    "hs.pdfIzoh":
      "Отдельная PDF-карточка для каждого материала: метаданные, заголовок и лид, K1–K5 с формулами, LPSI и уровень, соответствие, композиция, все пометки (с фрагментом и комментарием). Открывается кнопкой «PDF-карточка» на странице анализа или кнопкой «PDF» в медиабазе.",
    "hs.zaxira": "Резервная копия данных",
  },
  {
    "hs.eyebrow": "Export",
    "hs.izoh": "Export results for the dissertation and editorial analysis",
    "hs.excel": "Excel report (.xlsx)",
    "hs.excelIzoh": "The report includes {n} {material|materials}, {t} of them fully coded · methodology v{v}",
    "hs.yuklab": "Download",
    "hs.varaq": "Sheet",
    "hs.mazmun": "Contents",
    "hs.m.materiallar": "All materials in the media base: outlet, media type, date, genre, topic, link, headline, lead, status",
    "hs.m.tahlil":
      "Coding of each material: headline type, coherence, composition, audience rating, category counts, K1–K5, LPSI, level",
    "hs.m.nashrlar": "Mean K1–K5 and LPSI by outlet, share of materials with each problem (%)",
    "hs.m.reyting": "Outlet ranks by LPSI and by each criterion K1–K5; top and bottom 10 materials by LPSI",
    "hs.m.media": "Print vs digital media — the same indicators",
    "hs.m.janrlar": "Comparison by genre",
    "hs.m.muammolar": "Each category: total units, distribution across headline / lead / body text, share of materials",
    "hs.m.sarlavha": "Share of each headline type: overall and within print and digital media",
    "hs.m.dinamika": "Mean K1–K5 and LPSI by month, quarter and year (all / print / digital)",
    "hs.m.ahamiyat":
      "Statistical significance of differences: print vs digital (Mann–Whitney U, Fisher’s test for problems), outlets, genres and years (Kruskal–Wallis H, Dunn post-hoc) — p, effect size, conclusion",
    "hs.m.kelishuv": "Krippendorff’s α for each indicator, interpretation, share of matching pairs and mean difference",
    "hs.m.vaznlar": "Experts’ K1–K5 weights, mean / median / SD / CV, proposed weights and Kendall’s W",
    "hs.m.metodika":
      "The methodology version the report was built with: weights, values, penalties, scale — for reproducibility checks",
    "hs.tilIzoh": "The report is generated in the current interface language.",
    "hs.pdf": "Analysis card (PDF)",
    "hs.pdfIzoh":
      "A separate PDF card for each material: metadata, headline and lead, K1–K5 with formulas, LPSI and level, coherence, composition, all marks (with fragment and note). Open it with the “PDF card” button on the analysis page or the “PDF” button in the media base.",
    "hs.zaxira": "Data backup",
  },
);
