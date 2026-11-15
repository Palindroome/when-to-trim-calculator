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
    inputs: {
      title: 'Your piece',
      values: (mass: string, wall: string, base: string): string =>
        `Mass ${mass} g, wall ${wall} mm, base ${base} mm.`,
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
      text: 'The shape, clay body, bat and a thick base slow the drying down. 1 is a smooth stoneware mug on a board.',
      thick: (base: string, wall: string, exponent: string, thick: string): string =>
        `thick base: (${base} mm ÷ ${wall} mm)^${exponent} = ${thick} (at least 1)`,
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
      text: 'The vapour pressure deficit (VPD) says how much more moisture the air can take: saturation pressure at the given temperature × (1 − humidity).',
      start: 'Studio at throwing time',
      night: (from: string, to: string): string => `Studio at night (${from}–${to})`,
      damp: 'Damp room',
      vpd: (
        where: string,
        temp: string,
        rh: string,
        psat: string,
        rhUsed: string,
        vpd: string,
      ): string => `${where}: ${temp} °C, ${rh}% → ${psat} hPa × (1 − ${rhUsed}%) = ${vpd} hPa`,
      floor: (min: string): string => ` (at least ${min} hPa)`,
      airflow: (label: string, factor: string): string =>
        `Airflow “${label}”: × ${factor} for an uncovered piece, its square root under a loose bag, × 1 under a tight cover.`,
    },
    rate: {
      title: 'Drying rate for each option',
      text: (k: string): string =>
        `At throwing time: ${k} × surface × VPD × airflow × cover factor ÷ (slowness × calibration multiplier).`,
      row: (
        cover: string,
        k: string,
        area: string,
        vpd: string,
        air: string,
        factor: string,
        slow: string,
        multiplier: string,
        rate: string,
      ): string =>
        `${cover}: ${k} × ${area} × ${vpd} × ${air} × ${factor} ÷ (${slow} × ${multiplier}) = ${rate} g/h`,
      modelText: 'At throwing time, from the fitted model (not split into factors).',
      modelRow: (cover: string, rate: string): string => `${cover}: ${rate} g/h`,
      calibrated: (n: number): string => `multiplier from rated pieces: ${n}`,
      night: (from: string, to: string, rates: string): string =>
        `At night (${from}–${to}): ${rates}.`,
      nightRate: (cover: string, rate: string): string => `${cover} ${rate} g/h`,
    },
    time: {
      title: 'Time to the target',
      text: (step: string, grams: string): string =>
        `A simulation in ${step} steps subtracts the evaporated water until ${grams} g are gone. It takes the night into account on the way.`,
      row: (cover: string, duration: string): string => `${cover}: ${duration}`,
    },
    plan: {
      title: 'Choosing the plan',
      deadline: (hours: string): string => `The deadline is ${hours} away.`,
      gateOpen: (covers: string, soft: string, min: string): string =>
        `${covers}: considered, because the target is “${soft}” or the wait is ${min} or longer.`,
      gateClosed: (covers: string, soft: string, min: string): string =>
        `${covers}: left out, because the target is not “${soft}” and the wait is shorter than ${min}.`,
      single: (cover: string, hours: string, deadline: string, off: string, tol: string): string =>
        `${cover} meets the deadline: ${hours} against ${deadline}, a difference of ${off}% within ±${tol}%.`,
      twoPhase: (tol: string, first: string, duration: string, then: string): string =>
        `No single option meets the deadline within ±${tol}%, so the plan has two phases: ${first} for ${duration}, then ${then}. The switch time is found by repeatedly halving the interval.`,
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
