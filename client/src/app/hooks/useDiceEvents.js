import { useEffect } from 'react';
import { getSocket } from '../../lib/socket.js';
import { useDiceStore } from '../../state/diceStore.js';
import { EVENTS } from '../../../../shared/protocol.js';

/**
 * Hook to listen to dice roll broadcast socket events and update dice state store.
 */
export function useDiceEvents() {
  const { setActiveRolls, setRollHistory } = useDiceStore();

  useEffect(() => {
    const s = getSocket();

    const onDiceRolled = (roll) => {
      setActiveRolls((prev) => [...prev, { ...roll, status: 'rolling' }]);

      setTimeout(() => {
        setActiveRolls((prev) =>
          prev.map((r) => (r.rollId === roll.rollId ? { ...r, status: 'resolved' } : r))
        );
        setRollHistory((prev) => [roll, ...prev].slice(0, 15));
      }, 1500);

      setTimeout(() => {
        setActiveRolls((prev) => prev.filter((r) => r.rollId !== roll.rollId));
      }, 5000);
    };

    s.on(EVENTS.DICE_ROLLED, onDiceRolled);

    return () => {
      s.off(EVENTS.DICE_ROLLED, onDiceRolled);
    };
  }, [setActiveRolls, setRollHistory]);
}
