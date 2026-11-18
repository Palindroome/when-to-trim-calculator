// English UI strings, translated from ./pl.ts (the source of truth for `Messages`).
// Keys ending in `Html` contain trusted markup and are inserted unescaped.

import type { BuiltInCoverId } from '../domain/covers';
import type { Messages } from './pl';

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

const coverPhrase: Record<BuiltInCoverId, string> = {
  open: 'leave uncovered',
  partial: 'cover loosely with a bag (base or rim exposed)',
  full: 'wrap fully in a bag',
  box: 'put in a closed box',
  damp: 'put in the damp room',
};

export const en: Messages = {
  lang: 'en',
  title: 'When to trim? – prototype',
  heading: 'When to trim?',
  lead: 'Enter the piece, the conditions and when you want to trim. The calculator suggests how to cover it, and learns your studio from every piece you save.',

  language: {
    label: 'Language',
    names: { pl: 'Polski', en: 'English' },
  },

  theme: {
    label: 'Theme',
    system: 'System',
    light: 'Light',
    dark: 'Dark',
  },

  sections: {
    piece: 'Piece',
    conditions: 'Conditions',
    schedule: 'Timing',
    weight: 'Check by weight',
    pieces: 'My pieces and calibration',
  },

  wizard: {
    label: 'Step-by-step guide',
    progress: (step: number, total: number, title: string): string =>
      `Step ${step} of ${total}: ${title}`,
    next: 'Next',
    back: 'Back',
    finish: 'Show the result',
    skip: 'Skip – show the full form',
  },

  welcome: {
    title: 'Plan your piece’s drying',
    intro: [
      'The calculator estimates when a freshly thrown piece will be ready for the next stage: attaching handles, trimming or carving.',
      'It also suggests how to cover it so that it is ready on the day you want.',
    ],
    stepsTitle: 'How it works',
    steps: [
      'Describe the piece: mass, shape, wall and base thickness, clay.',
      'Enter the studio conditions: temperature, humidity and airflow.',
      'Pick a date and save the plan. When the piece reaches that stage, rate the result – every rating teaches the calculator about your studio.',
    ],
    privacy:
      "Your pieces are saved in this browser on this device and stay after you close it. They're removed only if you clear your browsing data. We don't send them anywhere.",
    start: 'New piece',
    pieces: (n: number): string => `My pieces (${n})`,
    details: 'Details',
    detailsLabel: (name: string): string => `Details: ${name}`,
    back: 'New piece',
  },

  summary: {
    edit: 'Edit',
    collapse: 'Collapse',
    editLabel: (section: string): string => `Edit: ${section}`,
    collapseLabel: (section: string): string => `Collapse: ${section}`,
    piece: (
      name: string,
      shape: string,
      mass: string,
      wall: string,
      base: string,
      clay: string,
    ): string =>
      [name, shape, `${mass} g`, `walls ${wall} mm, base ${base} mm`, clay]
        .filter(Boolean)
        .join(' · '),
    conditions: (
      temp: string,
      rh: string,
      airflow: string,
      night?: { temp: string; rh: string },
    ): string =>
      [`${temp} °C, ${rh}%`, airflow, night && `night ${night.temp} °C, ${night.rh}%`]
        .filter(Boolean)
        .join(' · '),
    schedule: (thrown: string, when: string): string => `Thrown ${thrown} · trim ${when}`,
  },

  fields: {
    name: 'Name (optional)',
    namePlaceholder: 'e.g. Thursday mugs',
    mass: 'Mass after throwing',
    shape: 'Shape',
    wall: 'Wall thickness',
    base: 'Base thickness',
    clay: 'Clay body',
    bat: 'Bat',
    wetness: 'Wetness after throwing',
    stage: 'Ready for',
    temp: 'Studio temperature',
    rh: 'Air humidity',
    airflow: 'Airflow at the shelf',
    night: 'Cooler at night (e.g. heating off)',
    nightTemp: 'Night temperature (22–7)',
    nightRh: 'Night humidity',
    dampTemp: 'Damp room: temp.',
    dampRh: 'Damp room: humidity',
    thrown: 'Thrown',
    when: 'Trim at',
    massNow: 'Mass now',
    massNowPlaceholder: 'e.g. 470',
    coverSoFar: 'Covering so far',
  },

  units: { grams: 'g', millimetres: 'mm', celsius: '°C', percent: '%' },

  weather: {
    fetch: 'Fill from the weather forecast',
    info: 'Privacy and weather data source',
    note: (hours: number): string =>
      `When you click, a map opens. Its tiles come from the OpenStreetMap servers, which see your IP address and the area you view. A town name you type goes to Open-Meteo.com, and after you confirm, the chosen point, rounded to about 10 km, is sent there to get the forecast for the next ${hours} h. Your browser location is only shown on the map. Your pieces are not sent anywhere.`,
    attribution: 'Weather data:',
    loading: 'Getting the forecast…',
    filled: (time: string): string => `≈ from the forecast (outdoors), ${time}`,
    kept: {
      day: (hours: number): string =>
        `Day values unchanged – no daytime hours in the next ${hours} h.`,
      night: (hours: number): string =>
        `Night values unchanged – no night hours in the next ${hours} h.`,
    },
    mapTitle: 'Choose the forecast place',
    mapNote:
      'Map tiles come from OpenStreetMap (it sees your IP address and the area you view). Open-Meteo.com gets the town you type and the confirmed point, rounded to about 10 km.',
    map: 'Map: click to place the pin; arrow keys pan, + and − zoom',
    pinAtCentre: 'Place the pin at the map centre',
    pin: (name: string): string => `Pin: ${name}`,
    noPin: 'No pin yet – click the map.',
    confirm: 'Confirm',
    cancel: 'Cancel',
    searchLabel: 'Town',
    searchPlaceholder: 'e.g. Krakow',
    search: 'Search',
    searching: 'Searching…',
    noResults: 'No such town found.',
    place: (name: string): string => `Place: ${name}`,
    forget: 'Forget place',
    errors: {
      location: 'Your location could not be determined – choose the place on the map.',
      map: 'The map could not be loaded. Check your connection.',
      offline: 'The weather service could not be reached. Values unchanged.',
      service: 'The weather service did not answer properly. Values unchanged.',
    },
  },

  options: {
    shape: {
      cyl: 'Mug / cylinder',
      bowl: 'Bowl',
      plate: 'Plate / flat',
      vase: 'Narrow vase',
      closed: 'Closed form',
    },
    clay: {
      grog: 'Grogged',
      stone: 'Smooth stoneware',
      porc: 'Porcelain',
      earth: 'Red earthenware',
    },
    bat: {
      plastic: 'Plastic bat',
      wood: 'Wooden board / plywood',
      plaster: 'Plaster bat',
    },
    wetness: {
      dry: 'Thrown "dry"',
      normal: 'Normal',
      wet: 'Very wet, lots of slip',
    },
    stage: {
      soft: 'Attaching handles / soft',
      trim: 'Trimming',
      hard: 'Carving / firm',
    },
    airflow: {
      still: 'Still, closed corner',
      light: 'Light movement (people, ventilation)',
      draft: 'Draught, fan, radiator nearby',
    },
  },

  quickDate: (days: number): string =>
    days === 1 ? 'tomorrow' : days === 7 ? 'in a week' : `in ${days} days`,

  dateTime: {
    day: 'Day',
    time: 'Time',
    timePlaceholder: 'hh:mm',
    invalidTime: 'Enter the time as hh:mm, e.g. 9:30.',
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    today: 'today',
    yesterday: 'yesterday',
    tomorrow: 'tomorrow',
    relativeDay: (relative: string, date: string): string => `${relative} · ${date}`,
    presets: {
      now: 'now',
      hourAgo: 'an hour ago',
      morning: 'this morning',
      lastEvening: 'last evening',
    },
  },

  weightHint:
    'Weigh the piece (without the bat) when thrown and now. The mass lost tells you more than touch, especially with a thick base.',

  covers: {
    label: {
      open: 'Uncovered',
      partial: 'Loosely bagged',
      full: 'Fully bagged',
      box: 'Closed box',
      damp: 'Damp room',
    },
    phrase: coverPhrase,
    filterTitle: 'Covering methods I can use',
    filterHint:
      "Untick what you can't or don't want to use this time. It applies only to this piece and its saved plan.",
    filterLastOne: 'Keep at least one method ticked.',
  },

  plan: {
    single: (cover: string): string => `${cap(cover)} straight away.`,
    twoPhase: (first: string, duration: string, until: string, then: string): string =>
      `${cap(first)} for ${duration} (until ${until}), then ${then}.`,
  },

  result: {
    recommendation: 'Recommendation',
    warning: 'Warning',
    ready: (date: string, lossPct: string, grams: string): string =>
      `Ready around ${date}: the target is a loss of about ${lossPct}% of the mass (${grams} g).`,
    window: (from: string, to: string): string => `Window: ${from} → ${to}`,
    windowOpenEnd: '…',
    compareTitle: 'How long each option takes',
    dampNote: 'only if it must stay very wet or for waits of 4+ days',
    excludedBar: 'excluded',
    legend: (deadline: string): string =>
      `The vertical line is your deadline (${deadline}). The number next to a name is how many pieces have calibrated that option.`,
    noDeadline: '–',
    alternatives: 'Other ways to hit the same deadline:',
    save: 'Save this piece with its plan',
    saved: 'Saved',
  },

  errors: {
    invalidDeadline: 'The trimming time must be after throwing.',
    tooFast: (duration: string): string =>
      `Even uncovered it will be ready in ${duration} at the earliest. Put it somewhere warmer with moving air, or move the deadline.`,
    tooSlow: (duration: string): string =>
      `Even with the tightest covering it will take ${duration} or less. Wrap it tightly and check earlier.`,
    tooFastWith: (duration: string, cover: string): string =>
      `Even with the fastest method available (${cover}) it will be ready in ${duration} at the earliest. Put it somewhere warmer with moving air, move the deadline, or tick other covering methods.`,
    tooSlowWith: (duration: string, cover: string): string =>
      `Even with the slowest method available (${cover}) it will take ${duration} or less. Check earlier, or tick other covering methods.`,
    excludedWouldMeet: 'With the excluded covering methods it would make this deadline.',
  },

  tips: {
    dryAirRim:
      'The air is dry or there is a draught. The rim and handles will dry much faster than the base, so wrap them with a strip of plastic or turn the piece upside down once the rim stiffens.',
    thickBase:
      'Thick base or closed form: before trimming, check the base itself by weight or by touch. The walls are usually ready earlier.',
    mould:
      'More than 6 days in the damp: check every 2–3 days for mould, especially on a wooden board.',
  },

  weight: {
    tooSoft: (loss: string, estimate: string): string =>
      `Loss ${loss}%: still too soft.${estimate}`,
    observedRate: (gramsPerHour: string, remaining: string): string =>
      ` At the current rate (${gramsPerHour} g/h) about ${remaining} to go.`,
    modelEstimate: (remaining: string): string =>
      ` With this covering it needs about ${remaining} more.`,
    inWindow: (loss: string): string =>
      `Loss ${loss}%: it is in the trimming window. If you trim later, wrap it in a bag.`,
    tooHard: (loss: string): string =>
      `Loss ${loss}%: probably already too firm for smooth trimming. Try wrapping it with a damp sponge for a few hours.`,
  },

  pieces: {
    empty:
      'No saved pieces yet. Save a piece with its plan, and when you trim it, rate how the forecast did. After a few ratings the times adjust to your studio.',
    defaultName: (n: number): string => `Piece ${n}`,
    feedbackPrompt: 'Trimming now and it is:',
    feedbackButton: { wet: 'too wet', ok: 'just right', dry: 'too dry' },
    feedbackResult: { wet: 'was too wet', ok: 'just right', dry: 'was too dry' },
    rated: (result: string, after: string): string => `${result} · after ${after}`,
    dueIn: (duration: string): string => `in ${duration}`,
    due: 'should be ready',
    meta: (thrown: string, forecast: string): string => `Thrown ${thrown} · forecast ${forecast}`,
    remove: 'delete',
  },

  calibration: {
    cover: 'Option',
    multiplier: 'Time multiplier',
    count: 'Pieces',
    value: (m: string): string => `× ${m}`,
    noteHtml:
      'A multiplier &gt; 1 means this option dries more slowly in your studio than the model assumes.',
  },

  explainer: {
    summary: 'How it calculates – step by step',
    intro:
      'Each step shows the formula and the numbers from your form. When you change an input, the numbers update at once.',
    formula: {
      inputs: 'm = max(m_min, m_entered)',
      inputsSymbols: 'the same for the wall w and the base b; without a base, b = w',
      surface: (mmToCm: string, cm2ToM2: string): string =>
        `A = m ÷ ρ ÷ (w ÷ ${mmToCm}) × f_shape ÷ ${cm2ToM2}`,
      surfaceSymbols: 'A – surface in m², m – mass in g, ρ – clay density, w – wall in mm',
      slowness: (floor: string): string => `S = f_shape × f_clay × f_bat × max(${floor}, b ÷ w)^p`,
      slownessSymbols: 'b – base, w – wall, p – thick-base exponent',
      target:
        'target = l_clay + Δ_wetness + Δ_target; window = [target − Δ_below, target + Δ_above]',
      targetSymbols: 'l_clay – loss for the clay body, in % of the mass',
      psat: (a: string, b: string, c: string): string =>
        `e_s(T) = ${a} × exp(${b} × T ÷ (${c} + T))`,
      vpd: (whole: string, percent: string): string =>
        `VPD = max(VPD_min, e_s(T) × (${whole} − clamp(RH, RH_min, RH_max) ÷ ${percent}))`,
      airSymbols: (vpdMin: string, rhMin: string, rhMax: string): string =>
        `T – temperature in °C, RH – relative humidity in %, limited to ${rhMin}–${rhMax}%; VPD_min = ${vpdMin} hPa`,
      rate: (one: string): string => `r = ${one} ÷ M × f_cover × f_air × k × A × VPD ÷ S`,
      rateSymbols:
        'first what depends on the option: the calibration multiplier M (it divides the rate), the cover and the airflow under it; k – evaporation coefficient',
      time: 'loss(t + Δt) = loss(t) + r(t) × Δt, until loss ≥ target',
      timeSymbols: 'Δt – simulation step',
      plan: '|t − H| ÷ H ≤ tolerance',
      planSymbols: 't – time of an option, H – time to the deadline',
      result: 'ready = thrown + t_plan; window = thrown + [t(window start), t(window end)]',
    },
    terms: {
      vpd: {
        label: 'The vapour pressure deficit (VPD)',
        href: 'https://en.wikipedia.org/wiki/Vapour-pressure_deficit',
      },
      psat: {
        label: 'saturation vapour pressure',
        href: 'https://en.wikipedia.org/wiki/Vapour_pressure_of_water',
      },
      magnus: {
        label: 'the Magnus formula',
        href: 'https://en.wikipedia.org/wiki/Vapour_pressure_of_water',
      },
      rh: { label: 'relative humidity', href: 'https://en.wikipedia.org/wiki/Relative_humidity' },
      euler: { label: 'the Euler method', href: 'https://en.wikipedia.org/wiki/Euler_method' },
      bisection: {
        label: 'repeatedly halving the interval',
        href: 'https://en.wikipedia.org/wiki/Bisection_method',
      },
      newTab: '(opens in a new tab)',
    },
    labels: {
      mass: 'thrown mass used in the calculation',
      wall: 'wall thickness',
      base: 'base thickness',
      minMass: 'smallest mass in the model',
      minWall: 'smallest wall thickness in the model',
      minBase: 'smallest base thickness in the model',
      density: "clay's density",
      claySlow: 'slowness from the clay body',
      clayLoss: 'mass loss for this clay body',
      wallCm: 'wall thickness in centimetres',
      sideArea: 'area of one side of the clay sheet',
      areaFactor: 'surface factor of the shape',
      area: 'exposed surface',
      thickExponent: 'thick-base exponent',
      thick: 'thick-base factor',
      shapeSlow: 'slowness from the shape',
      batSlow: 'slowness from the bat',
      slow: 'total slowness',
      wetness: 'wetness correction, in percentage points',
      stage: 'target correction, in percentage points',
      loss: 'target mass loss',
      targetGrams: 'water to evaporate to the target',
      softPct: 'window start: mass loss',
      softGrams: 'window start: water to evaporate',
      hardPct: 'window end: mass loss',
      hardGrams: 'window end: water to evaporate',
      magnusA: 'Magnus formula constant a, hPa',
      magnusB: 'Magnus formula constant b',
      magnusC: 'Magnus formula constant c, °C',
      minVpd: 'smallest vapour pressure deficit in the model',
      rhMin: 'lowest humidity used in the calculation',
      rhMax: 'highest humidity used in the calculation',
      temp: 'air temperature',
      rh: 'relative humidity, as entered',
      psat: 'saturation vapour pressure at this temperature',
      rhUsed: 'humidity used in the calculation (after the limits)',
      vpd: 'vapour pressure deficit (VPD)',
      airflowFactor: 'airflow multiplier for an uncovered piece',
      multiplier: "this option's calibration multiplier (from your rated pieces)",
      samples: 'number of rated pieces for this option',
      factor: 'cover factor: the share of the open-air rate that remains',
      air: 'airflow that reaches the piece under this cover',
      k: 'evaporation coefficient',
      rate: 'drying rate at throwing time',
      nightRate: 'drying rate at night',
      stepHours: 'simulation step',
      hours: 'time to the target for this option',
      deadline: 'time from throwing to the deadline',
      dampMin: 'wait from which the damp room is suggested',
      optionHours: 'time of the chosen option',
      off: 'difference from the deadline',
      tolerance: 'allowed difference from the deadline',
      switchAfter: 'length of the first phase',
      fastest: 'time of the fastest available option',
      slowest: 'time of the slowest available option',
      ready: 'when the piece reaches the target',
      windowStart: 'window start',
      windowEnd: 'window end',
      nightFrom: 'hour from which the night conditions apply',
      nightTo: 'hour until which the night conditions apply',
      neutral: 'the value with no effect on the drying speed',
      thickFloor: 'smallest thick-base factor: a thinner base does not speed it up',
      whole: 'the whole, i.e. 100% humidity',
      sealedAir: 'no airflow reaches the piece under a tight cover',
      calibrationOne: 'calibration divides the rate by its multiplier',
      mmToCm: 'millimetres to centimetres',
      cm2ToM2: 'cm² to m²',
      percent: 'percent to a fraction',
    },
    inputs: {
      title: 'Your piece',
      values: (mass: string, wall: string, base: string): string =>
        `Mass ${mass} g, wall ${wall} mm, base ${base} mm.`,
      material: (clay: string, density: string, slow: string, loss: string): string =>
        `Clay body: ${clay} – density ${density} g/cm³ (the same for every clay body), slowness × ${slow}, base loss ${loss}% of the mass.`,
      massClamped: (min: string): string => `Mass below the model minimum: using ${min} g.`,
      wallClamped: (min: string): string => `Wall below the model minimum: using ${min} mm.`,
      baseClamped: (min: string): string => `Base below the model minimum: using ${min} mm.`,
      baseFromWall: 'No base thickness given: using the wall thickness.',
    },
    surface: {
      title: 'Exposed surface',
      text: 'The clay counts as a flat sheet as thick as the wall; the shape says how much of that surface gives off water.',
      sheet: (mass: string, density: string, wallCm: string, side: string): string =>
        `${mass} g ÷ ${density} g/cm³ ÷ ${wallCm} cm = ${side} cm²`,
      area: (side: string, factor: string, shape: string, area: string): string =>
        `${side} cm² × ${factor} (${shape}) = ${area} m²`,
    },
    slowness: {
      title: 'Slowness',
      text: (neutral: string): string =>
        `The shape, clay body, bat and a thick base change the drying speed. A result above ${neutral} means slower, below ${neutral} faster.`,
      thick: (base: string, wall: string, exponent: string, thick: string, floor: string): string =>
        `thick base: (${base} mm ÷ ${wall} mm)^${exponent} = ${thick} (at least ${floor})`,
      product: (shape: string, clay: string, bat: string, thick: string, slow: string): string =>
        `${shape} (shape) × ${clay} (clay) × ${bat} (bat) × ${thick} (base) = ${slow}`,
    },
    target: {
      title: 'Target and window',
      text: (stage: string): string =>
        `How much of the mass has to evaporate for “${stage}”: the value for the clay body plus corrections for wetness and target.`,
      loss: (clay: string, wetness: string, stage: string, loss: string, grams: string): string =>
        `${clay}% (clay) ${wetness} (wetness) ${stage} (target) = ${loss}% of the mass, or ${grams} g of water`,
      window: (soft: string, softG: string, hard: string, hardG: string): string =>
        `Window: from ${soft}% (${softG} g) to ${hard}% (${hardG} g)`,
    },
    air: {
      title: 'Drying power of the air',
      text: (vpd: string, psat: string, magnus: string, rh: string, whole: string): string =>
        `${vpd} says how much more moisture the air can take: the ${psat} at the given temperature (from ${magnus}) × (${whole} − ${rh}).`,
      start: 'Studio at throwing time',
      night: (from: string, to: string): string => `Studio at night (${from}–${to})`,
      damp: 'Damp room',
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
      floor: (min: string): string => ` (at least ${min} hPa)`,
      airflow: (label: string, factor: string, sealed: string): string =>
        `Airflow “${label}”: × ${factor} for an uncovered piece, its square root under a loose bag, × ${sealed} under a tight cover.`,
    },
    rate: {
      title: 'Drying rate for each option',
      text: 'At throwing time: surface, vapour pressure deficit and airflow speed it up; the cover, slowness and calibration hold it back.',
      cover: (cover: string, multiplier: string, factor: string, air: string): string =>
        `${cover}: calibration ÷ ${multiplier}, cover × ${factor}, airflow × ${air}`,
      modelCover: (cover: string, multiplier: string): string =>
        `${cover}: calibration ÷ ${multiplier}`,
      calibrated: (n: string): string => ` (from rated pieces: ${n})`,
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
      modelText: 'At throwing time, from the fitted model (not split into factors).',
      modelRow: (rate: string): string => `${rate} g/h`,
      night: (from: string, to: string, rates: string): string =>
        `At night (${from}–${to}): ${rates}.`,
      nightRate: (cover: string, rate: string): string => `${cover} ${rate} g/h`,
    },
    time: {
      title: 'Time to the target',
      text: (euler: string, step: string, grams: string): string =>
        `A simulation in ${step} steps (${euler}) subtracts the evaporated water until ${grams} g are gone.`,
      night: 'Night hours use the night conditions.',
      row: (cover: string, duration: string): string => `${cover}: ${duration}`,
    },
    plan: {
      title: 'Choosing the plan',
      deadline: (hours: string): string => `The deadline is ${hours} away.`,
      gateOpen: (covers: string, soft: string, min: string): string =>
        `${covers}: considered, because the target is “${soft}” or the wait is ${min} or longer.`,
      gateClosed: (covers: string, soft: string, min: string): string =>
        `${covers}: left out, because the target is not “${soft}” and the wait is shorter than ${min}.`,
      gateOnlyChoice: (covers: string, soft: string, min: string): string =>
        `${covers}: normally only for the “${soft}” target or waits of ${min} or more, but no other covering is ticked.`,
      excluded: (covers: string): string => `${covers}: unticked in the coverings, left out.`,
      single: (cover: string, hours: string, deadline: string, off: string, tol: string): string =>
        `${cover} meets the deadline: ${hours} against ${deadline}, a difference of ${off}% within ±${tol}%.`,
      twoPhase: (
        tol: string,
        first: string,
        duration: string,
        then: string,
        bisection: string,
      ): string =>
        `No single option meets the deadline within ±${tol}%, so the plan has two phases: ${first} for ${duration}, then ${then}. The switch time is found by ${bisection}.`,
      tooFast: (fastest: string, deadline: string): string =>
        `The fastest option needs ${fastest}, but the deadline is ${deadline} away: the deadline is too early.`,
      tooSlow: (slowest: string, deadline: string): string =>
        `Even the slowest option reaches the target in ${slowest}, before the deadline (${deadline}): the deadline is too late.`,
    },
    result: {
      title: 'Result',
      none: 'No plan meets the deadline, so there is no ready date. See the warning in the recommendation.',
    },
    notes: [
      'All factors are starting assumptions. Every saved piece rated “too wet / just right / too dry” corrects the multiplier for its covering.',
      "Your pieces are saved in this browser on this device and stay after you close it. They're removed only if you clear your browsing data. We don't send them anywhere. In a later version, BLE sensors on the shelf and in the damp room could enter the temperature and humidity.",
    ],
  },

  footer: {
    label: 'Author online',
    github: 'GitHub',
    githubLabel: 'GitHub – author’s profile',
    instagram: 'Instagram',
    instagramLabel: 'Instagram – author’s profile (@palindroom)',
    contactHtml: (report: string, message: string): string =>
      `Something not working, or does a result look wrong? ${report} or ${message}.`,
    report: 'Report a problem on GitHub',
    message: 'send a message on Instagram',
    licenceHtml: (licence: string): string => `The calculator is free to use under the ${licence}.`,
    licence: 'MIT licence',
  },

  /** Inputs for the locale-aware formatter (../i18n/format.ts). */
  format: {
    weekdaysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    monthsShort: [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ],
    decimalSeparator: '.',
    minutes: (n: number): string => `${n} min`,
    hours: (n: number): string => `${n} h`,
    days: (n: number): string => `${n} d`,
    daysHours: (d: number, h: number): string => `${d} d ${h} h`,
    beyondHorizon: (days: number): string => `> ${days} days`,
    /** e.g. "Wed 4 Mar" */
    date: (weekday: string, day: number, _month: string, monthShort: string): string =>
      `${weekday} ${day} ${monthShort}`,
    /** e.g. "Wed 4 Mar 10:00" */
    dateTime: (
      weekday: string,
      day: number,
      _month: string,
      hh: string,
      mm: string,
      monthShort: string,
    ): string => `${weekday} ${day} ${monthShort} ${hh}:${mm}`,
  },
};
