// What the app is started with (AppDeps), and what it shares with the feature modules (AppContext).
import type { Calibrator, CalibratorFactory, CoverCalibration } from '../domain/calibration';
import type { ConditionsSource } from '../domain/conditions';
import type { CoverId } from '../domain/covers';
import type { ModelParams } from '../domain/params';
import type { RateModel } from '../domain/physics';
import type { PlanOption } from '../domain/planner';
import type { DryingContext } from '../domain/simulate';
import type { Piece } from '../domain/types';
import type { Messages } from '../i18n';
import type { ActivityStore } from '../storage/activity';
import type { PieceRepository, StoredPiece } from '../storage/pieces';
import type { Theme } from '../storage/preferences';
import type { SessionStore } from '../storage/session';
import type { WizardStore } from '../storage/wizard';
import type { View } from './render';

export interface AppDeps {
  root: HTMLElement;
  /** page footer, re-rendered with the language; optional so pages without one still work */
  footer?: HTMLElement;
  /** initial language */
  messages: Messages;
  /** languages offered by the switch, by locale code */
  locales: Readonly<Record<string, Messages>>;
  /** called with the locale code when the user picks a language */
  onLocaleChange: (code: string) => void;
  /** theme chosen earlier (null: follow the system); index.html has already applied it */
  theme: Theme | null;
  /** called when the user picks a theme (null: System) */
  onThemeChange: (theme: Theme | null) => void;
  params: ModelParams;
  repository: PieceRepository;
  wizard: WizardStore;
  /** time of the last interaction, for the welcome screen */
  activity: ActivityStore;
  /** pause after which the welcome screen is shown again (default: 1 hour) */
  idleResetMs?: number;
  /** the page state of this tab, restored by a reload within the idle window */
  session: SessionStore;
  conditions: ConditionsSource;
  rateModel: RateModel;
  calibrator: CalibratorFactory;
  now?: () => number;
}

/** Plan that can be saved with the current inputs. */
export interface Saveable {
  piece: Piece;
  startMs: number;
  option: PlanOption;
  ws: number;
  we: number;
}

export interface AppContext {
  /** the current language, formatter, params and cover catalog */
  readonly view: View;
  now(): number;
  /** saved pieces, newest first */
  readonly pieces: StoredPiece[];
  /** replaces the saved pieces and writes them to the repository */
  storePieces(pieces: StoredPiece[]): void;
  /** plan of the last recalculation, null when it cannot be saved */
  readonly saveable: Saveable | null;
  /** calibrator built from the rated pieces */
  calibration(): Calibrator;
  /** calibration of every cover, for the comparison bars and the calibration table */
  perCover(): Record<CoverId, CoverCalibration>;
  /** drying context for a piece thrown at `startMs`, with the current conditions and calibration */
  context(piece: Piece, startMs: number): DryingContext;
  /** recalculates the recommendation, the summaries and the weight check */
  compute(): void;
  /** re-renders the page in another language, keeping the form */
  switchLanguage(code: string): void;
  /** stores the theme choice (null: follow the system) */
  setTheme(theme: Theme | null): void;
}
