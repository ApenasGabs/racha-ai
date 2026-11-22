import { beforeEach, describe, expect, it } from 'vitest';
import { hasSeenTour, markTourSeen } from './tour';

const store = new Map<string, string>();

const mockLocalStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, value);
  },
  removeItem: (key: string) => {
    store.delete(key);
  },
  clear: () => {
    store.clear();
  },
};

describe('tour persistence', () => {
  beforeEach(() => {
    store.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage,
      configurable: true,
    });
  });

  it('marca e consulta corretamente se o usuário já viu o tour por escopo', () => {
    expect(hasSeenTour('landing')).toBe(false);
    expect(hasSeenTour('host')).toBe(false);

    markTourSeen('landing');
    expect(hasSeenTour('landing')).toBe(true);
    expect(hasSeenTour('host')).toBe(false);
  });
});
