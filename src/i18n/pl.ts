// Polish UI strings — the source of truth for the `Messages` type.
// A new language: copy en.ts, translate, type it as `Messages`, register it in ./index.ts.
// Keys ending in `Html` contain trusted markup and are inserted unescaped.

import type { TipId } from '../domain/tips';
import type { AirflowId, BatId, ClayId, Cover, FeedbackKind, ShapeId, StageId, WetnessId } from '../domain/types';

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

const coverPhrase: Record<Cover, string> = {
  open: 'zostaw odkrytą',
  partial: 'przykryj luźno workiem (dno lub brzeg odsłonięte)',
  full: 'zawiń całą w worek',
  box: 'włóż do zamkniętego pudełka',
  damp: 'wstaw do mokrej przechowalni',
};

export const pl = {
  lang: 'pl',
  title: 'Kiedy trymować? – prototyp',
  heading: 'Kiedy trymować?',
  lead: 'Podaj pracę, warunki i termin trymowania. Kalkulator podpowie, jak ją opatulić, i z każdą zapisaną pracą uczy się Twojej pracowni.',

  /** Language switch; `names` are endonyms, keyed by locale code. */
  language: {
    label: 'Język',
    names: { pl: 'Polski', en: 'English' } satisfies Record<string, string>,
  },

  /** Colour scheme switch: button names (icons only on screen, these are the accessible names and tooltips). */
  theme: {
    label: 'Motyw',
    system: 'Systemowy',
    light: 'Jasny',
    dark: 'Ciemny',
  },

  sections: {
    piece: 'Praca',
    conditions: 'Warunki',
    schedule: 'Termin',
    weight: 'Sprawdź wagą',
    pieces: 'Moje prace i kalibracja',
  },

  wizard: {
    label: 'Przewodnik krok po kroku',
    progress: (step: number, total: number, title: string): string => `Krok ${step} z ${total}: ${title}`,
    next: 'Dalej',
    back: 'Wstecz',
    finish: 'Pokaż wynik',
    skip: 'Pomiń – pokaż cały formularz',
  },

  /** shown on the first visit and after a long pause */
  welcome: {
    title: 'Zaplanuj suszenie pracy',
    intro: [
      'Kalkulator szacuje, kiedy świeżo wytoczona praca będzie gotowa do kolejnego etapu: doklejania uch, trymowania albo rzeźbienia.',
      'Podpowiada też, jak ją przykryć, żeby zdążyła na wybrany termin.',
    ],
    stepsTitle: 'Jak to działa',
    steps: [
      'Opisz pracę: masę, kształt, grubość ścianki i dna, masę ceramiczną.',
      'Podaj warunki w pracowni: temperaturę, wilgotność i ruch powietrza.',
      'Wybierz termin i zapisz plan. Gdy praca dojdzie do tego etapu, oceń wynik – z każdą oceną kalkulator lepiej zna Twoją pracownię.',
    ],
    privacy:
      'Twoje prace zapisują się w tej przeglądarce na tym urządzeniu i zostają po jej zamknięciu. Znikną tylko, jeśli wyczyścisz dane przeglądania. Nigdzie ich nie wysyłamy.',
    start: 'Nowa praca',
    pieces: (n: number): string => `Moje prace (${n})`,
    details: 'Szczegóły',
    detailsLabel: (name: string): string => `Szczegóły: ${name}`,
    /** on the working page: shows the welcome screen again */
    back: 'Nowa praca',
  },

  /** sections 1–3 collapsed to one line after the wizard */
  summary: {
    edit: 'Zmień',
    collapse: 'Zwiń',
    editLabel: (section: string): string => `Zmień: ${section}`,
    collapseLabel: (section: string): string => `Zwiń: ${section}`,
    piece: (name: string, shape: string, mass: string, wall: string, base: string, clay: string): string =>
      [name, shape, `${mass} g`, `ścianka ${wall} mm, dno ${base} mm`, clay].filter(Boolean).join(' · '),
    conditions: (temp: string, rh: string, airflow: string, night?: { temp: string; rh: string }): string =>
      [`${temp} °C, ${rh}%`, airflow, night && `noc ${night.temp} °C, ${night.rh}%`].filter(Boolean).join(' · '),
    schedule: (thrown: string, when: string): string => `Wytoczona ${thrown} · trymowanie ${when}`,
  },

  fields: {
    name: 'Nazwa (opcjonalnie)',
    namePlaceholder: 'np. kubki z czwartku',
    mass: 'Masa po toczeniu',
    shape: 'Kształt',
    wall: 'Grubość ścianki',
    base: 'Grubość dna',
    clay: 'Masa ceramiczna',
    bat: 'Podłoże',
    wetness: 'Mokrość po toczeniu',
    stage: 'Na co ma być gotowa',
    temp: 'Temperatura w pracowni',
    rh: 'Wilgotność powietrza',
    airflow: 'Ruch powietrza przy półce',
    night: 'W nocy jest chłodniej (np. ogrzewanie wyłączone)',
    nightTemp: 'Temperatura nocą (22–7)',
    nightRh: 'Wilgotność nocą',
    dampTemp: 'Mokra przechowalnia: temp.',
    dampRh: 'Mokra przechowalnia: wilg.',
    thrown: 'Wytoczona',
    when: 'Chcę trymować',
    massNow: 'Masa teraz',
    massNowPlaceholder: 'np. 470',
    coverSoFar: 'Przez ten czas była',
  },

  units: { grams: 'g', millimetres: 'mm', celsius: '°C', percent: '%' },

  options: {
    shape: {
      cyl: 'Kubek / cylinder',
      bowl: 'Miska',
      plate: 'Talerz / płaska',
      vase: 'Wąski wazon',
      closed: 'Forma zamknięta',
    } satisfies Record<ShapeId, string>,
    clay: {
      grog: 'Z szamotem',
      stone: 'Kamionka gładka',
      porc: 'Porcelana',
      earth: 'Czerwona / fajans',
    } satisfies Record<ClayId, string>,
    bat: {
      plastic: 'Bat plastikowy',
      wood: 'Deska / sklejka',
      plaster: 'Bat gipsowy',
    } satisfies Record<BatId, string>,
    wetness: {
      dry: 'Toczona „na sucho”',
      normal: 'Normalnie',
      wet: 'Bardzo mokra, dużo szlikru',
    } satisfies Record<WetnessId, string>,
    stage: {
      soft: 'Doklejanie uch / miękka',
      trim: 'Trymowanie',
      hard: 'Rzeźbienie / twarda',
    } satisfies Record<StageId, string>,
    airflow: {
      still: 'Cisza, zamknięty kąt',
      light: 'Lekki ruch (ludzie, wentylacja)',
      draft: 'Przeciąg, wentylator, kaloryfer obok',
    } satisfies Record<AirflowId, string>,
  },

  quickDate: (days: number): string => (days === 1 ? 'jutro' : days === 7 ? 'za tydzień' : `za ${days} dni`),

  /** Day + 24 h time picker in section 3 (thrown and trim date). */
  dateTime: {
    day: 'Dzień',
    time: 'Godzina',
    timePlaceholder: 'gg:mm',
    invalidTime: 'Wpisz godzinę jako gg:mm, np. 9:30.',
    /** calendar paging buttons (icons on screen, these are their names) */
    previousMonth: 'Poprzedni miesiąc',
    nextMonth: 'Następny miesiąc',
    today: 'dziś',
    yesterday: 'wczoraj',
    tomorrow: 'jutro',
    /** chosen day with a relative word, e.g. "dziś · śr 4.03" */
    relativeDay: (relative: string, date: string): string => `${relative} · ${date}`,
    /** quick choices for the throwing time */
    presets: {
      now: 'teraz',
      hourAgo: 'godzinę temu',
      morning: 'dziś rano',
      lastEvening: 'wczoraj wieczorem',
    },
  },

  weightHint: 'Zważ pracę (bez batu) przy toczeniu i teraz. Utracona masa mówi więcej niż dotyk, zwłaszcza przy grubym dnie.',

  covers: {
    label: {
      open: 'Odkryta',
      partial: 'Worek częściowo',
      full: 'Cały worek',
      box: 'Pudełko',
      damp: 'Mokra przechowalnia',
    } satisfies Record<Cover, string>,
    phrase: coverPhrase,
    filterTitle: 'Sposoby okrycia, których mogę użyć',
    filterHint: 'Odznacz to, czego tym razem nie możesz lub nie chcesz użyć. Dotyczy tylko tej pracy i jej zapisanego planu.',
    filterLastOne: 'Zostaw zaznaczony co najmniej jeden sposób.',
  },

  plan: {
    single: (cover: Cover): string => `${cap(coverPhrase[cover])} od razu.`,
    twoPhase: (first: Cover, duration: string, until: string, then: Cover): string =>
      `${cap(coverPhrase[first])} na ${duration} (do ${until}), potem ${coverPhrase[then]}.`,
  },

  result: {
    recommendation: 'Rekomendacja',
    warning: 'Uwaga',
    ready: (date: string, lossPct: string, grams: number): string => `Gotowa ok. ${date}: cel to utrata ok. ${lossPct}% masy (${grams} g).`,
    window: (from: string, to: string): string => `Okno: ${from} → ${to}`,
    windowOpenEnd: '…',
    compareTitle: 'Ile to potrwa w każdym wariancie',
    dampNote: 'tylko gdy ma być bardzo mokra lub przy czekaniu 4+ dni',
    excludedBar: 'wyłączone',
    legend: (deadline: string): string =>
      `Pionowa kreska to Twój termin (${deadline}). Liczba przy nazwie to liczba prac, które skalibrowały ten wariant.`,
    noDeadline: '–',
    alternatives: 'Inne sposoby na ten sam termin:',
    save: 'Zapisz tę pracę z planem',
  },

  errors: {
    invalidDeadline: 'Termin trymowania musi być po toczeniu.',
    tooFast: (duration: string): string =>
      `Nawet odkryta będzie gotowa najwcześniej za ${duration}. Postaw ją w cieplejszym miejscu z ruchem powietrza albo przesuń termin.`,
    tooSlow: (duration: string): string =>
      `Nawet w najszczelniejszym opatuleniu zajmie to ${duration} lub mniej. Zawiń ją szczelnie i sprawdzaj wcześniej.`,
    tooFastWith: (duration: string, cover: string): string =>
      `Nawet przy najszybszym dostępnym sposobie (${cover}) będzie gotowa najwcześniej za ${duration}. Postaw ją w cieplejszym miejscu z ruchem powietrza, przesuń termin albo włącz inne sposoby okrycia.`,
    tooSlowWith: (duration: string, cover: string): string =>
      `Nawet przy najwolniejszym dostępnym sposobie (${cover}) zajmie to ${duration} lub mniej. Sprawdzaj wcześniej albo włącz inne sposoby okrycia.`,
    excludedWouldMeet: 'Z wyłączonymi sposobami okrycia zdążyłaby na ten termin.',
  },

  tips: {
    dryAirRim:
      'Powietrze jest suche lub jest przeciąg. Brzeg i ucha wyschną dużo szybciej niż dno, więc owiń je paskiem folii albo obróć pracę dnem do góry, gdy brzeg zesztywnieje.',
    thickBase: 'Grube dno lub forma zamknięta: przed trymowaniem sprawdź wagą albo dotykiem samo dno. Ścianki zwykle są gotowe wcześniej.',
    mould: 'Ponad 6 dni w wilgoci: zajrzyj co 2–3 dni, czy nie pojawia się pleśń, zwłaszcza na drewnianym podłożu.',
  } satisfies Record<TipId, string>,

  weight: {
    tooSoft: (loss: string, estimate: string): string => `Utrata ${loss}%: jeszcze za miękka.${estimate}`,
    observedRate: (gramsPerHour: string, remaining: string): string =>
      ` Przy obecnym tempie (${gramsPerHour} g/h) zostało ok. ${remaining}.`,
    modelEstimate: (remaining: string): string => ` W tym opatuleniu potrzeba jeszcze ok. ${remaining}.`,
    inWindow: (loss: string): string => `Utrata ${loss}%: jest w oknie trymowania. Jeśli trymujesz później, zawiń ją w worek.`,
    tooHard: (loss: string): string =>
      `Utrata ${loss}%: prawdopodobnie już za twarda na gładkie trymowanie. Spróbuj zawinąć ją z wilgotną gąbką na kilka godzin.`,
  },

  pieces: {
    empty:
      'Nie ma jeszcze zapisanych prac. Zapisz pracę z planem, a gdy będziesz ją trymować, oceń, jak trafiła prognoza. Po kilku ocenach czasy dopasują się do Twojej pracowni.',
    defaultName: (n: number): string => `Praca ${n}`,
    feedbackPrompt: 'Trymuję teraz i jest:',
    feedbackButton: { wet: 'za mokra', ok: 'w sam raz', dry: 'za sucha' } satisfies Record<FeedbackKind, string>,
    feedbackResult: { wet: 'była za mokra', ok: 'w sam raz', dry: 'była za sucha' } satisfies Record<FeedbackKind, string>,
    rated: (result: string, after: string): string => `${result} · po ${after}`,
    dueIn: (duration: string): string => `za ${duration}`,
    due: 'powinna być gotowa',
    meta: (thrown: string, forecast: string): string => `Toczona ${thrown} · prognoza ${forecast}`,
    remove: 'usuń',
  },

  calibration: {
    cover: 'Wariant',
    multiplier: 'Mnożnik czasu',
    count: 'Prace',
    value: (m: string): string => `× ${m}`,
    noteHtml: 'Mnożnik &gt; 1 oznacza, że w Twojej pracowni ten wariant schnie wolniej, niż zakłada model.',
  },

  explainer: {
    summary: 'Jak to liczy (i czego jeszcze nie umie)',
    itemsHtml: [
      '<b>Parowanie</b> zależy od tego, ile pary wodnej powietrze może jeszcze przyjąć (niedobór pary: ciśnienie nasycenia przy danej temperaturze × (1 − wilgotność)). Do tego dochodzą ruch powietrza i odsłonięta powierzchnia, liczona z masy, grubości ścianki i kształtu.',
      '<b>Opatulenie</b> ma współczynnik: worek częściowo ≈ 30% tempa na otwartym powietrzu, cały worek ≈ 7%, szczelne pudełko ≈ 5%. Przechowalnia liczona jest z jej własnej temperatury i wilgotności. Ponieważ jest mała, kalkulator proponuje ją tylko wtedy, gdy praca ma zostać bardzo mokra (cel „doklejanie uch / miękka”) albo gdy czekanie trwa 4 dni lub dłużej.',
      '<b>Skórzana twardość</b> to utrata ok. 5–7% masy od toczenia, zależnie od masy ceramicznej, mokrości i celu. Okno trymowania to mniej więcej ±1–1,5 punktu procentowego wokół tej wartości.',
      '<b>Grube dno, porcelana, plastikowy bat i forma zamknięta</b> wydłużają czas. Gips go skraca.',
      'Wszystkie współczynniki to <b>założenia startowe</b>. Każda zapisana praca z oceną „za mokra / w sam raz / za sucha” koryguje mnożnik dla danego opatulenia.',
      'Twoje prace zapisują się w tej przeglądarce na tym urządzeniu i zostają po jej zamknięciu. Znikną tylko, jeśli wyczyścisz dane przeglądania. Nigdzie ich nie wysyłamy. W kolejnej wersji temperaturę i wilgotność mogą wpisywać czujniki BLE z półki i przechowalni.',
    ],
  },

  /** Site footer: links to the author's profiles; each `…Label` starts with the visible link text. */
  footer: {
    label: 'Autor w sieci',
    github: 'GitHub',
    githubLabel: 'GitHub – profil autora',
    instagram: 'Instagram',
    instagramLabel: 'Instagram – profil autora (@palindroom)',
    /** `report` and `message` are the link texts placed into `contactHtml`, `licence` into `licenceHtml` */
    contactHtml: (report: string, message: string): string => `Coś nie działa albo wynik wygląda na błędny? ${report} lub ${message}.`,
    report: 'Zgłoś problem na GitHubie',
    message: 'napisz na Instagramie',
    licenceHtml: (licence: string): string => `Z kalkulatora można korzystać bezpłatnie na ${licence}.`,
    licence: 'licencji MIT',
  },

  /** Inputs for the locale-aware formatter (../i18n/format.ts). */
  format: {
    weekdaysShort: ['nd', 'pn', 'wt', 'śr', 'czw', 'pt', 'sob'],
    /** Passed to `dateTime`; the Polish format shows the month number instead. */
    monthsShort: ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'],
    decimalSeparator: ',',
    minutes: (n: number): string => `${n} min`,
    hours: (n: number): string => `${n} h`,
    days: (n: number): string => `${n} d`,
    daysHours: (d: number, h: number): string => `${d} d ${h} h`,
    beyondHorizon: (days: number): string => `> ${days} dni`,
    /** e.g. "śr 4.03" */
    date: (weekday: string, day: number, month: string, _monthShort: string): string => `${weekday} ${day}.${month}`,
    /** e.g. "śr 4.03 10:00" */
    dateTime: (weekday: string, day: number, month: string, hh: string, mm: string, _monthShort: string): string =>
      `${weekday} ${day}.${month} ${hh}:${mm}`,
  },
};

/** Shape every locale must provide. */
export type Messages = typeof pl;
