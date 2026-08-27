/**
 * @file utils/storage.ts
 * SSR-safe, fault-tolerant LocalStorage helper with in-memory fallback cache.
 */

const inMemoryFallback = new Map<string, string>();

/**
 * Checks if window.localStorage is accessible and writable.
 */
export function isLocalStorageAvailable(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }
  try {
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely retrieve a JSON-deserialized value from localStorage.
 */
export function storageGet<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') {
    return defaultValue;
  }

  // Attempt reading from window.localStorage first (even if write quota is exceeded)
  try {
    if (window.localStorage) {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        return JSON.parse(raw) as T;
      }
    }
  } catch (error) {
    console.warn(`[storageGet] Failed to read or parse key "${key}" from localStorage:`, error);
  }

  // Fall back to in-memory fallback cache
  try {
    const fallbackRaw = inMemoryFallback.get(key);
    if (fallbackRaw !== undefined) {
      return JSON.parse(fallbackRaw) as T;
    }
  } catch (error) {
    console.warn(`[storageGet] Failed to parse key "${key}" from in-memory fallback:`, error);
  }

  return defaultValue;
}

/**
 * Safely serialize and store a value in localStorage.
 */
export function storageSet<T>(key: string, value: T): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const serialized = JSON.stringify(value);
    if (isLocalStorageAvailable()) {
      window.localStorage.setItem(key, serialized);
    } else {
      inMemoryFallback.set(key, serialized);
    }
    return true;
  } catch (error) {
    console.warn(`[storageSet] Failed to write key "${key}":`, error);
    return false;
  }
}

/**
 * Safely remove an entry from localStorage.
 */
export function storageRemove(key: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    if (isLocalStorageAvailable()) {
      window.localStorage.removeItem(key);
    } else {
      inMemoryFallback.delete(key);
    }
    return true;
  } catch (error) {
    console.warn(`[storageRemove] Failed to remove key "${key}":`, error);
    return false;
  }
}

/**
 * Safely clear all storage.
 */
export function storageClear(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    if (isLocalStorageAvailable()) {
      window.localStorage.clear();
    }
    inMemoryFallback.clear();
    return true;
  } catch (error) {
    console.warn('[storageClear] Failed to clear storage:', error);
    return false;
  }
}
