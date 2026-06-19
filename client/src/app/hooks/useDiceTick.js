import { useState, useEffect } from 'react';

/**
 * Hook that manages a 60ms ticker for dice roll animations.
 * @returns {number} The current tick value (0-99).
 */
export function useDiceTick() {
  const [rollTick, setRollTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setRollTick((prev) => (prev + 1) % 100);
    }, 60);
    return () => clearInterval(interval);
  }, []);

  return rollTick;
}
