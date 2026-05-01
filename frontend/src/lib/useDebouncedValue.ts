import { useEffect, useState } from "react";

/**
 * Returns a debounced copy of {@code value}. Stale during the debounce
 * window, then updates once. Used to keep search-driven queries from
 * firing on every keystroke.
 */
export function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
