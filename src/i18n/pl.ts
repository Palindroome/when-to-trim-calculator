// Polish UI strings — the source of truth for the `Messages` type.
// A new language: copy en.ts, translate, type it as `Messages`, register it in ./index.ts.
// Keys ending in `Html` contain trusted markup and are inserted unescaped.

import type { BuiltInCoverId } from '../domain/covers';
import type { TipId } from '../domain/tips';
import type {
  AirflowId,
  BatId,
  ClayId,
  FeedbackKind,
  ShapeId,
  StageId,
  WetnessId,
} from '../domain/types';

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

const coverPhrase: Record<BuiltInCoverId, string> = {
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
    progress: (step: number, total: number, title: string): string =>
      `Krok ${step} z ${total}: ${title}`,
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
    piece: (
      name: string,
      shape: string,
      mass: string,
      wall: string,
      base: string,
      clay: string,
    ): string =>
      [name, shape, `${mass} g`, `ścianka ${wall} mm, dno ${base} mm`, clay]
        .filter(Boolean)
        .join(' · '),
    conditions: (
      temp: string,
      rh: string,
      airflow: string,
      night?: { temp: string; rh: string },
    ): string =>
      [`${temp} °C, ${rh}%`, airflow, night && `noc ${night.temp} °C, ${night.rh}%`]
        .filter(Boolean)
        .join(' · '),
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

  quickDate: (days: number): string =>
    days === 1 ? 'jutro' : days === 7 ? 'za tydzień' : `za ${days} dni`,

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

  weightHint:
    'Zważ pracę (bez batu) przy toczeniu i teraz. Utracona masa mówi więcej niż dotyk, zwłaszcza przy grubym dnie.',

  covers: {
    label: {
      open: 'Odkryta',
      partial: 'Worek częściowo',
      full: 'Cały worek',
      box: 'Pudełko',
      damp: 'Mokra przechowalnia',
    } satisfies Record<BuiltInCoverId, string>,
    phrase: coverPhrase,
    filterTitle: 'Sposoby okrycia, których mogę użyć',
    filterHint:
      'Odznacz to, czego tym razem nie możesz lub nie chcesz użyć. Dotyczy tylko tej pracy i jej zapisanego planu.',
    filterLastOne: 'Zostaw zaznaczony co najmniej jeden sposób.',
  },

  /** take cover phrases (`covers.phrase`), so a cover can supply its own text */
  plan: {
    single: (cover: string): string => `${cap(cover)} od razu.`,
    twoPhase: (first: string, duration: string, until: string, then: string): string =>
      `${cap(first)} na ${duration} (do ${until}), potem ${then}.`,
  },

  result: {
    recommendation: 'Rekomendacja',
    warning: 'Uwaga',
    ready: (date: string, lossPct: string, grams: string): string =>
      `Gotowa ok. ${date}: cel to utrata ok. ${lossPct}% masy (${grams} g).`,
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
    /** the save button's label for a moment after saving, also announced in a status region */
    saved: 'Zapisano',
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
    thickBase:
      'Grube dno lub forma zamknięta: przed trymowaniem sprawdź wagą albo dotykiem samo dno. Ścianki zwykle są gotowe wcześniej.',
    mould:
      'Ponad 6 dni w wilgoci: zajrzyj co 2–3 dni, czy nie pojawia się pleśń, zwłaszcza na drewnianym podłożu.',
  } satisfies Record<TipId, string>,

  weight: {
    tooSoft: (loss: string, estimate: string): string =>
      `Utrata ${loss}%: jeszcze za miękka.${estimate}`,
    observedRate: (gramsPerHour: string, remaining: string): string =>
      ` Przy obecnym tempie (${gramsPerHour} g/h) zostało ok. ${remaining}.`,
    modelEstimate: (remaining: string): string =>
      ` W tym opatuleniu potrzeba jeszcze ok. ${remaining}.`,
    inWindow: (loss: string): string =>
      `Utrata ${loss}%: jest w oknie trymowania. Jeśli trymujesz później, zawiń ją w worek.`,
    tooHard: (loss: string): string =>
      `Utrata ${loss}%: prawdopodobnie już za twarda na gładkie trymowanie. Spróbuj zawinąć ją z wilgotną gąbką na kilka godzin.`,
  },

  pieces: {
    empty:
      'Nie ma jeszcze zapisanych prac. Zapisz pracę z planem, a gdy będziesz ją trymować, oceń, jak trafiła prognoza. Po kilku ocenach czasy dopasują się do Twojej pracowni.',
    defaultName: (n: number): string => `Praca ${n}`,
    feedbackPrompt: 'Trymuję teraz i jest:',
    feedbackButton: { wet: 'za mokra', ok: 'w sam raz', dry: 'za sucha' } satisfies Record<
      FeedbackKind,
      string
    >,
    feedbackResult: {
      wet: 'była za mokra',
      ok: 'w sam raz',
      dry: 'była za sucha',
    } satisfies Record<FeedbackKind, string>,
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
    noteHtml:
      'Mnożnik &gt; 1 oznacza, że w Twojej pracowni ten wariant schnie wolniej, niż zakłada model.',
  },

  /**
   * "How it calculates": one step per stage of the calculation, with the numbers from the form.
   * Every number arrives already formatted; none is written into these strings.
   */
  explainer: {
    summary: 'Jak to liczy – krok po kroku',
    intro:
      'Każdy krok pokazuje wzór i liczby z Twojego formularza. Gdy zmienisz dane, liczby przeliczą się od razu.',
    /** Each step's formula as in the model code (shown as code) and what its symbols stand for. */
    formula: {
      inputs: 'm = max(m_min, m_wpisana)',
      inputsSymbols: 'tak samo ścianka s i dno d; bez dna d = s',
      surface: (mmToCm: string, cm2ToM2: string): string =>
        `A = m ÷ ρ ÷ (s ÷ ${mmToCm}) × f_kształt ÷ ${cm2ToM2}`,
      surfaceSymbols: 'A – powierzchnia w m², m – masa w g, ρ – gęstość gliny, s – ścianka w mm',
      slowness: (floor: string): string =>
        `S = f_kształt × f_masa × f_podłoże × max(${floor}, d ÷ s)^p`,
      slownessSymbols: 'd – dno, s – ścianka, p – wykładnik grubego dna',
      target: 'cel = u_masa + Δ_mokrość + Δ_cel; okno = [cel − Δ_dół, cel + Δ_góra]',
      targetSymbols: 'u_masa – utrata dla masy ceramicznej, w % masy',
      psat: (a: string, b: string, c: string): string =>
        `e_s(T) = ${a} × exp(${b} × T ÷ (${c} + T))`,
      vpd: (whole: string, percent: string): string =>
        `VPD = max(VPD_min, e_s(T) × (${whole} − clamp(RH, RH_min, RH_max) ÷ ${percent}))`,
      airSymbols: (vpdMin: string, rhMin: string, rhMax: string): string =>
        `T – temperatura w °C, RH – wilgotność względna w %, ograniczona do ${rhMin}–${rhMax}%; VPD_min = ${vpdMin} hPa`,
      rate: (one: string): string => `r = ${one} ÷ M × f_okrycie × f_ruch × k × A × VPD ÷ S`,
      rateSymbols:
        'najpierw to, co zależy od wariantu: mnożnik kalibracji M (dzieli tempo), okrycie i ruch powietrza pod nim; k – współczynnik parowania',
      time: 'utrata(t + Δt) = utrata(t) + r(t) × Δt, aż utrata ≥ cel',
      timeSymbols: 'Δt – krok symulacji',
      plan: '|t − H| ÷ H ≤ tolerancja',
      planSymbols: 't – czas wariantu, H – czas do terminu',
      result: 'gotowa = toczenie + t_planu; okno = toczenie + [t(początek okna), t(koniec okna)]',
    },
    /** Linked terms: Polish Wikipedia where it has an article, otherwise English. */
    terms: {
      vpd: {
        label: 'Niedobór pary (VPD)',
        href: 'https://en.wikipedia.org/wiki/Vapour-pressure_deficit',
      },
      psat: {
        label: 'ciśnienie pary nasyconej',
        href: 'https://pl.wikipedia.org/wiki/Ci%C5%9Bnienie_pary_nasyconej',
      },
      magnus: {
        label: 'wzorem Magnusa',
        href: 'https://en.wikipedia.org/wiki/Vapour_pressure_of_water',
      },
      rh: {
        label: 'wilgotność względna',
        href: 'https://pl.wikipedia.org/wiki/Wilgotno%C5%9B%C4%87_wzgl%C4%99dna',
      },
      euler: { label: 'metodą Eulera', href: 'https://pl.wikipedia.org/wiki/Metoda_Eulera' },
      bisection: {
        label: 'połowienie przedziału',
        href: 'https://pl.wikipedia.org/wiki/Metoda_r%C3%B3wnego_podzia%C5%82u',
      },
      /** the accessible hint after each link */
      newTab: '(otwiera się w nowej karcie)',
    },
    /** What each number in the steps is: shown on hover, focus or tap, and read as its description. */
    labels: {
      mass: 'masa po toczeniu, użyta w obliczeniu',
      wall: 'grubość ścianki',
      base: 'grubość dna',
      minMass: 'najmniejsza masa w modelu',
      minWall: 'najmniejsza grubość ścianki w modelu',
      minBase: 'najmniejsza grubość dna w modelu',
      density: 'gęstość masy ceramicznej',
      claySlow: 'spowolnienie przez masę ceramiczną',
      clayLoss: 'utrata masy dla tej masy ceramicznej',
      wallCm: 'grubość ścianki w centymetrach',
      sideArea: 'powierzchnia jednej strony arkusza gliny',
      areaFactor: 'współczynnik powierzchni dla kształtu',
      area: 'odsłonięta powierzchnia',
      thickExponent: 'wykładnik grubego dna',
      thick: 'współczynnik grubego dna',
      shapeSlow: 'spowolnienie przez kształt',
      batSlow: 'spowolnienie przez podłoże',
      slow: 'łączne spowolnienie',
      wetness: 'poprawka za mokrość, w punktach procentowych',
      stage: 'poprawka za cel, w punktach procentowych',
      loss: 'docelowa utrata masy',
      targetGrams: 'woda do odparowania do celu',
      softPct: 'początek okna: utrata masy',
      softGrams: 'początek okna: woda do odparowania',
      hardPct: 'koniec okna: utrata masy',
      hardGrams: 'koniec okna: woda do odparowania',
      magnusA: 'stała a wzoru Magnusa, hPa',
      magnusB: 'stała b wzoru Magnusa',
      magnusC: 'stała c wzoru Magnusa, °C',
      minVpd: 'najmniejszy niedobór pary w modelu',
      rhMin: 'najniższa wilgotność brana do obliczeń',
      rhMax: 'najwyższa wilgotność brana do obliczeń',
      temp: 'temperatura powietrza',
      rh: 'wilgotność względna, jak wpisana',
      psat: 'ciśnienie pary nasyconej w tej temperaturze',
      rhUsed: 'wilgotność użyta w obliczeniu (po ograniczeniu)',
      vpd: 'niedobór pary (VPD)',
      airflowFactor: 'mnożnik ruchu powietrza dla odkrytej pracy',
      multiplier: 'mnożnik kalibracji tego wariantu (z ocen Twoich prac)',
      samples: 'liczba ocenionych prac w tym wariancie',
      factor: 'współczynnik okrycia: jaka część tempa na otwartym powietrzu zostaje',
      air: 'ruch powietrza, który dociera pod to okrycie',
      k: 'współczynnik parowania',
      rate: 'tempo schnięcia w chwili toczenia',
      nightRate: 'tempo schnięcia nocą',
      stepHours: 'krok symulacji',
      hours: 'czas do celu w tym wariancie',
      deadline: 'czas od toczenia do terminu',
      dampMin: 'czekanie, od którego proponuję mokrą przechowalnię',
      optionHours: 'czas wybranego wariantu',
      off: 'różnica względem terminu',
      tolerance: 'dopuszczalna różnica względem terminu',
      switchAfter: 'czas pierwszej fazy',
      fastest: 'czas najszybszego dostępnego wariantu',
      slowest: 'czas najwolniejszego dostępnego wariantu',
      ready: 'kiedy praca dojdzie do celu',
      windowStart: 'początek okna',
      windowEnd: 'koniec okna',
      nightFrom: 'godzina, od której liczę warunki nocne',
      nightTo: 'godzina, do której liczę warunki nocne',
      neutral: 'wartość bez wpływu na tempo schnięcia',
      thickFloor: 'najmniejszy współczynnik grubego dna: cieńsze dno nie przyspiesza',
      whole: 'całość, czyli 100% wilgotności',
      sealedAir: 'pod szczelnym okryciem ruch powietrza nie dociera',
      calibrationOne: 'kalibracja dzieli tempo przez swój mnożnik',
      mmToCm: 'przeliczenie milimetrów na centymetry',
      cm2ToM2: 'przeliczenie cm² na m²',
      percent: 'przeliczenie procentów na ułamek',
    },
    inputs: {
      title: 'Dane pracy',
      values: (mass: string, wall: string, base: string): string =>
        `Masa ${mass} g, ścianka ${wall} mm, dno ${base} mm.`,
      material: (clay: string, density: string, slow: string, loss: string): string =>
        `Masa ceramiczna: ${clay} – gęstość ${density} g/cm³ (wspólna dla wszystkich mas), spowolnienie × ${slow}, bazowa utrata ${loss}% masy.`,
      massClamped: (min: string): string => `Masa poniżej minimum modelu: liczę z ${min} g.`,
      wallClamped: (min: string): string => `Ścianka poniżej minimum modelu: liczę z ${min} mm.`,
      baseClamped: (min: string): string => `Dno poniżej minimum modelu: liczę z ${min} mm.`,
      baseFromWall: 'Grubość dna nie podana: przyjmuję grubość ścianki.',
    },
    surface: {
      title: 'Odsłonięta powierzchnia',
      text: 'Glinę liczę jak płaski arkusz o grubości ścianki, a kształt mówi, ile tej powierzchni oddaje wodę.',
      sheet: (mass: string, density: string, wallCm: string, side: string): string =>
        `${mass} g ÷ ${density} g/cm³ ÷ ${wallCm} cm = ${side} cm²`,
      area: (side: string, factor: string, shape: string, area: string): string =>
        `${side} cm² × ${factor} (${shape}) = ${area} m²`,
    },
    slowness: {
      title: 'Spowolnienie',
      text: (neutral: string): string =>
        `Kształt, masa ceramiczna, podłoże i grube dno zmieniają tempo schnięcia. Wynik powyżej ${neutral} oznacza wolniej, poniżej ${neutral} szybciej.`,
      thick: (base: string, wall: string, exponent: string, thick: string, floor: string): string =>
        `grube dno: (${base} mm ÷ ${wall} mm)^${exponent} = ${thick} (co najmniej ${floor})`,
      product: (shape: string, clay: string, bat: string, thick: string, slow: string): string =>
        `${shape} (kształt) × ${clay} (masa) × ${bat} (podłoże) × ${thick} (dno) = ${slow}`,
    },
    target: {
      title: 'Cel i okno',
      text: (stage: string): string =>
        `Ile procent masy musi odparować do etapu „${stage}”: wartość dla masy ceramicznej plus poprawki za mokrość i cel.`,
      loss: (clay: string, wetness: string, stage: string, loss: string, grams: string): string =>
        `${clay}% (masa) ${wetness} (mokrość) ${stage} (cel) = ${loss}% masy, czyli ${grams} g wody`,
      window: (soft: string, softG: string, hard: string, hardG: string): string =>
        `Okno: od ${soft}% (${softG} g) do ${hard}% (${hardG} g)`,
    },
    air: {
      title: 'Siła schnięcia powietrza',
      text: (vpd: string, psat: string, magnus: string, rh: string, whole: string): string =>
        `${vpd} mówi, ile wilgoci powietrze może jeszcze przyjąć: ${psat} przy danej temperaturze (liczone ${magnus}) × (${whole} − ${rh}).`,
      start: 'W pracowni przy toczeniu',
      night: (from: string, to: string): string => `W pracowni nocą (${from}–${to})`,
      damp: 'W mokrej przechowalni',
      vpd: (
        where: string,
        temp: string,
        rh: string,
        psat: string,
        whole: string,
        rhUsed: string,
        vpd: string,
      ): string =>
        `${where}: ${temp} °C, ${rh}% → ${psat} hPa × (${whole} − ${rhUsed}%) = ${vpd} hPa`,
      floor: (min: string): string => ` (nie mniej niż ${min} hPa)`,
      airflow: (label: string, factor: string, sealed: string): string =>
        `Ruch powietrza „${label}”: × ${factor} dla odkrytej pracy, pierwiastek z tego pod luźnym workiem, × ${sealed} pod szczelnym okryciem.`,
    },
    rate: {
      title: 'Tempo schnięcia w każdym wariancie',
      text: 'W chwili toczenia: powierzchnia, niedobór pary i ruch powietrza przyspieszają, okrycie, spowolnienie i kalibracja hamują.',
      /** first line of a cover: what the cover itself contributes, its calibration first */
      cover: (cover: string, multiplier: string, factor: string, air: string): string =>
        `${cover}: kalibracja ÷ ${multiplier}, okrycie × ${factor}, ruch powietrza × ${air}`,
      modelCover: (cover: string, multiplier: string): string =>
        `${cover}: kalibracja ÷ ${multiplier}`,
      calibrated: (n: string): string => ` (z ocenionych prac: ${n})`,
      row: (
        one: string,
        multiplier: string,
        factor: string,
        air: string,
        k: string,
        area: string,
        vpd: string,
        slow: string,
        rate: string,
      ): string =>
        `${one} ÷ ${multiplier} × ${factor} × ${air} × ${k} × ${area} × ${vpd} ÷ ${slow} = ${rate} g/h`,
      modelText: 'W chwili toczenia, według dopasowanego modelu (bez rozbicia na czynniki).',
      modelRow: (rate: string): string => `${rate} g/h`,
      night: (from: string, to: string, rates: string): string => `Nocą (${from}–${to}): ${rates}.`,
      nightRate: (cover: string, rate: string): string => `${cover} ${rate} g/h`,
    },
    time: {
      title: 'Czas do celu',
      text: (euler: string, step: string, grams: string): string =>
        `Symulacja krokami po ${step} (${euler}) odejmuje odparowaną wodę, aż ubędzie ${grams} g.`,
      night: 'Nocne godziny liczy z warunkami nocnymi.',
      row: (cover: string, duration: string): string => `${cover}: ${duration}`,
    },
    plan: {
      title: 'Wybór planu',
      deadline: (hours: string): string => `Do terminu jest ${hours}.`,
      gateOpen: (covers: string, soft: string, min: string): string =>
        `${covers}: w grze, bo cel to „${soft}” albo czekanie trwa ${min} lub dłużej.`,
      gateClosed: (covers: string, soft: string, min: string): string =>
        `${covers}: pomijam, bo cel to nie „${soft}”, a czekanie jest krótsze niż ${min}.`,
      gateOnlyChoice: (covers: string, soft: string, min: string): string =>
        `${covers}: zwykle tylko dla celu „${soft}” albo czekania od ${min}, ale innych sposobów okrycia nie zaznaczono.`,
      excluded: (covers: string): string => `${covers}: wyłączone w sposobach okrycia, pomijam.`,
      single: (cover: string, hours: string, deadline: string, off: string, tol: string): string =>
        `${cover} trafia w termin: ${hours} wobec ${deadline}, różnica ${off}% mieści się w ±${tol}%.`,
      twoPhase: (
        tol: string,
        first: string,
        duration: string,
        then: string,
        bisection: string,
      ): string =>
        `Żaden wariant sam nie trafia w termin z dokładnością ±${tol}%, więc plan ma dwie fazy: ${first} przez ${duration}, potem ${then}. Moment zmiany szukam przez ${bisection}.`,
      tooFast: (fastest: string, deadline: string): string =>
        `Najszybszy wariant potrzebuje ${fastest}, a do terminu jest ${deadline}: termin jest za wcześnie.`,
      tooSlow: (slowest: string, deadline: string): string =>
        `Nawet najwolniejszy wariant dochodzi do celu w ${slowest}, przed terminem (${deadline}): termin jest za późno.`,
    },
    result: {
      title: 'Wynik',
      none: 'Żaden plan nie trafia w termin, więc nie ma daty gotowości. Zobacz ostrzeżenie w rekomendacji.',
    },
    notes: [
      'Wszystkie współczynniki to założenia startowe. Każda zapisana praca z oceną „za mokra / w sam raz / za sucha” koryguje mnożnik dla danego opatulenia.',
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
    contactHtml: (report: string, message: string): string =>
      `Coś nie działa albo wynik wygląda na błędny? ${report} lub ${message}.`,
    report: 'Zgłoś problem na GitHubie',
    message: 'napisz na Instagramie',
    licenceHtml: (licence: string): string =>
      `Z kalkulatora można korzystać bezpłatnie na ${licence}.`,
    licence: 'licencji MIT',
  },

  /** Inputs for the locale-aware formatter (../i18n/format.ts). */
  format: {
    weekdaysShort: ['nd', 'pn', 'wt', 'śr', 'czw', 'pt', 'sob'],
    /** Passed to `dateTime`; the Polish format shows the month number instead. */
    monthsShort: [
      'sty',
      'lut',
      'mar',
      'kwi',
      'maj',
      'cze',
      'lip',
      'sie',
      'wrz',
      'paź',
      'lis',
      'gru',
    ],
    decimalSeparator: ',',
    minutes: (n: number): string => `${n} min`,
    hours: (n: number): string => `${n} h`,
    days: (n: number): string => `${n} d`,
    daysHours: (d: number, h: number): string => `${d} d ${h} h`,
    beyondHorizon: (days: number): string => `> ${days} dni`,
    /** e.g. "śr 4.03" */
    date: (weekday: string, day: number, month: string, _monthShort: string): string =>
      `${weekday} ${day}.${month}`,
    /** e.g. "śr 4.03 10:00" */
    dateTime: (
      weekday: string,
      day: number,
      month: string,
      hh: string,
      mm: string,
      _monthShort: string,
    ): string => `${weekday} ${day}.${month} ${hh}:${mm}`,
  },
};

/** Shape every locale must provide. */
export type Messages = typeof pl;
