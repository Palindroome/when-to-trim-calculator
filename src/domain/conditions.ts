import type { Conditions } from './types';

/**
 * Where room / storage conditions come from. Today: the form fields.
 * Later: e.g. BLE temperature/humidity sensors on the shelf and in the damp room,
 * possibly merged with manual values. `subscribe` lets a live source trigger a recalculation.
 */
export interface ConditionsSource {
  read(): Conditions;
  /** Calls `onChange` whenever new readings are available; returns an unsubscribe function. */
  subscribe?(onChange: () => void): () => void;
}
