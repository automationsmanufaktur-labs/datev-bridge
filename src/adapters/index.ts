import type { SourceAdapter } from './types';
import { stripeAdapter } from './stripe';

/** Registry of available source adapters. New source = add one entry here. */
const ADAPTERS: Record<string, SourceAdapter> = {
  [stripeAdapter.id]: stripeAdapter,
};

export function getAdapter(id: string): SourceAdapter {
  const adapter = ADAPTERS[id];
  if (!adapter) {
    throw new Error(
      `Unknown adapter "${id}". Available: ${Object.keys(ADAPTERS).join(', ')}`,
    );
  }
  return adapter;
}

export function listAdapters(): SourceAdapter[] {
  return Object.values(ADAPTERS);
}

export type { SourceAdapter };
