import './style.css';
import { geometricMeanCalibrator } from './domain/calibration';
import { DEFAULT_PARAMS } from './domain/params';
import { physicalRateModel } from './domain/physics';
import { getMessages, LOCALES, resolveLocale } from './i18n';
import { LocalStoragePieceRepository } from './storage/pieces';
import { loadLanguage, saveLanguage } from './storage/preferences';
import { startApp } from './ui/app';
import { formConditionsSource } from './ui/form';

// Composition root: swap any of these for another implementation
// (language, fitted parameters, trained calibrator / rate model, sensor-backed conditions).
const params = DEFAULT_PARAMS;
const root = document.querySelector('main');
if (!root) throw new Error('<main> missing');

const repository = new LocalStoragePieceRepository();
const available = Object.keys(LOCALES);
const locale = resolveLocale({
  stored: loadLanguage(available),
  browser: navigator.languages?.length ? navigator.languages : [navigator.language],
  hasExistingData: repository.load().length > 0,
  available,
});

startApp({
  root,
  messages: getMessages(locale),
  locales: LOCALES,
  onLocaleChange: saveLanguage,
  params,
  repository,
  conditions: formConditionsSource,
  rateModel: physicalRateModel(params),
  calibrator: geometricMeanCalibrator,
});
