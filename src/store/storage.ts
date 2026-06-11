/**
 * Tiny persistence module (PRD §4): everything goes through here so the
 * backing store can be swapped later. Falls back to an in-memory map when
 * localStorage is unavailable (tests, private-mode quirks).
 */

const PREFIX = 'clue.v1.';

const memory = new Map<string, string>();

function backend(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {
    // fall through to memory
  }
  return {
    getItem: (k) => memory.get(k) ?? null,
    setItem: (k, v) => void memory.set(k, v),
    removeItem: (k) => void memory.delete(k),
  };
}

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = backend().getItem(PREFIX + key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    backend().setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage full or blocked; the app keeps working from memory.
  }
}

export function remove(key: string): void {
  try {
    backend().removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}
