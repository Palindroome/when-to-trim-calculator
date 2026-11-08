import './style.css';
import { geometricMeanCalibrator } from './domain/calibration';
import { DEFAULT_PARAMS } from './domain/params';
import { physicalRateModel } from './domain/physics';
import { getMessages } from './i18n';
import { LocalStoragePieceRepository } from './storage/pieces';
import { startApp } from './ui/app';
import { formConditionsSource } from './ui/form';

// Composition root: swap any of these for another implementation
// (language, fitted parameters, trained calibrator / rate model, sensor-backed conditions).
const params = DEFAULT_PARAMS;
const root = document.querySelector('main');
if (!root) throw new Error('<main> missing');

startApp({
  root,
  messages: getMessages(),
  params,
  repository: new LocalStoragePieceRepository(),
  conditions: formConditionsSource,
  rateModel: physicalRateModel(params),
  calibrator: geometricMeanCalibrator,
});
