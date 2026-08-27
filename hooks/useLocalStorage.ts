/**
 * @file hooks/useLocalStorage.ts
 * Type-safe React hook for synchronizing state with LocalStorage and cross-tab updates.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { storageGet, storageSet } from '@/utils/storage';

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] {
  // Read initial state using safe storage helper
  const [storedValue, setStoredValue] = useState<T>(() => {
    return storageGet<T>(key, initialValue);
  });

  const keyRef = useRef(key);
  keyRef.current = key;

  // Setter function supporting direct values or updater callbacks
  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      setStoredValue((current) => {
        const valueToStore =
          value instanceof Function ? (value as (val: T) => T)(current) : value;
        storageSet(keyRef.current, valueToStore);
        return valueToStore;
      });
    },
    []
  );

  // Sync state if another browser tab updates the same localStorage key
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          const parsed = JSON.parse(e.newValue) as T;
          setStoredValue(parsed);
        } catch {
          // Ignore parse errors on external events
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
      return () => {
        window.removeEventListener('storage', handleStorageChange);
      };
    }
  }, [key]);

  return [storedValue, setValue];
}
