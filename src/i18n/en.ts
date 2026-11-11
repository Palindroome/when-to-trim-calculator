// English UI strings, translated from ./pl.ts (the source of truth for `Messages`).
// Keys ending in `Html` contain trusted markup and are inserted unescaped.

import type { Cover } from '../domain/types';
import type { Messages } from './pl';

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

const coverPhrase: Record<Cover, string> = {
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
    progress: (step: number, total: number, title: string): string => `Step ${step} of ${total}: ${title}`,
    next: 'Next',
    back: 'Back',
    finish: 'Show the result',
    skip: 'Skip – show the full form',
    reopen: 'Walk me through it step by step',
  },

  summary: {
    edit: 'Edit',
    collapse: 'Collapse',
    editLabel: (section: string): string => `Edit: ${section}`,
    collapseLabel: (section: string): string => `Collapse: ${section}`,
    piece: (name: string, shape: string, mass: string, wall: string, base: string, clay: string): string =>
      [name, shape, `${mass} g`, `walls ${wall} mm, base ${base} mm`, clay].filter(Boolean).join(' · '),
    conditions: (temp: string, rh: string, airflow: string, night?: { temp: string; rh: string }): string =>
      [`${temp} °C, ${rh}%`, airflow, night && `night ${night.temp} °C, ${night.rh}%`].filter(Boolean).join(' · '),
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

  quickDate: (days: number): string => (days === 1 ? 'tomorrow' : days === 7 ? 'in a week' : `in ${days} days`),

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
    filterHint: "Untick what you can't or don't want to use this time. It applies only to this piece and its saved plan.",
    filterLastOne: 'Keep at least one method ticked.',
  },

  plan: {
    single: (cover: Cover): string => `${cap(coverPhrase[cover])} straight away.`,
    twoPhase: (first: Cover, duration: string, until: string, then: Cover): string =>
      `${cap(coverPhrase[first])} for ${duration} (until ${until}), then ${coverPhrase[then]}.`,
  },

  result: {
    recommendation: 'Recommendation',
    warning: 'Warning',
    ready: (date: string, lossPct: string, grams: number): string =>
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
    mould: 'More than 6 days in the damp: check every 2–3 days for mould, especially on a wooden board.',
  },

  weight: {
    tooSoft: (loss: string, estimate: string): string => `Loss ${loss}%: still too soft.${estimate}`,
    observedRate: (gramsPerHour: string, remaining: string): string =>
      ` At the current rate (${gramsPerHour} g/h) about ${remaining} to go.`,
    modelEstimate: (remaining: string): string => ` With this covering it needs about ${remaining} more.`,
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
    noteHtml: 'A multiplier &gt; 1 means this option dries more slowly in your studio than the model assumes.',
  },

  explainer: {
    summary: 'How it calculates (and what it cannot do yet)',
    itemsHtml: [
      '<b>Evaporation</b> depends on how much more water vapour the air can take (vapour pressure deficit: saturation pressure at the given temperature × (1 − humidity)). Airflow and the exposed surface add to it; the surface is worked out from the mass, wall thickness and shape.',
      '<b>Covering</b> has a factor: loosely bagged ≈ 30% of the open-air rate, fully bagged ≈ 7%, a closed box ≈ 5%. The damp room is calculated from its own temperature and humidity. Because it is small, the calculator only suggests it when the piece must stay very wet (the “attaching handles / soft” target) or when the wait is 4 days or longer.',
      '<b>Leather-hard</b> is a loss of about 5–7% of the mass since throwing, depending on the clay body, wetness and target. The trimming window is roughly ±1–1.5 percentage points around that value.',
      '<b>A thick base, porcelain, a plastic bat and a closed form</b> make it take longer. Plaster shortens it.',
      'All factors are <b>starting assumptions</b>. Every saved piece rated “too wet / just right / too dry” corrects the multiplier for its covering.',
      'Data is stored only in this browser. In a later version, BLE sensors on the shelf and in the damp room could enter the temperature and humidity.',
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
    monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    decimalSeparator: '.',
    minutes: (n: number): string => `${n} min`,
    hours: (n: number): string => `${n} h`,
    days: (n: number): string => `${n} d`,
    daysHours: (d: number, h: number): string => `${d} d ${h} h`,
    beyondHorizon: (days: number): string => `> ${days} days`,
    /** e.g. "Wed 4 Mar" */
    date: (weekday: string, day: number, _month: string, monthShort: string): string => `${weekday} ${day} ${monthShort}`,
    /** e.g. "Wed 4 Mar 10:00" */
    dateTime: (weekday: string, day: number, _month: string, hh: string, mm: string, monthShort: string): string =>
      `${weekday} ${day} ${monthShort} ${hh}:${mm}`,
  },
};
