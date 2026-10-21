import type { MotionValue } from 'motion/react';

/**
 * Live, render-free handles to each item's position/size (world px). Drag and resize
 * write here every pointer move; the document store is only committed on release.
 */
export interface ItemHandles {
  x: MotionValue<number>;
  y: MotionValue<number>;
  w: MotionValue<number>;
  h: MotionValue<number>;
  /** Scale pulse used for the snap "thunk". */
  pulse: MotionValue<number>;
  /** Set while the item is under direct manipulation (skip spring-to-committed). */
  live: { current: boolean };
}

export const registry = new Map<string, ItemHandles>();
