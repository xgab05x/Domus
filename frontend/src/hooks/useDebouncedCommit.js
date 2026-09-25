import { useEffect, useRef, useState } from "react";

// Local value with debounced commit: keeps sliders smooth while limiting API calls.
export function useDebouncedCommit(value, commit, ms = 220) {
  const [local, setLocal] = useState(value);
  const timer = useRef(null);
  const dirty = useRef(false);

  useEffect(() => { if (!dirty.current) setLocal(value); }, [value]);

  const set = (v) => {
    dirty.current = true;
    setLocal(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try { await commit(v); } finally { dirty.current = false; }
    }, ms);
  };

  useEffect(() => () => clearTimeout(timer.current), []);
  return [local, set];
}
