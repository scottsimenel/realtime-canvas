import { createContext, useContext, useState, useEffect, useCallback, createElement } from 'react';
import { getSocket } from '../lib/socket.js';
import { useDiceTick } from '../app/hooks/useDiceTick.js';

const DiceContext = createContext(null);

/**
 * Dice State Store Provider.
 * Manages dice selection, roll histories, WebGL overlays, and roll execution.
 */
export function DiceProvider({ children }) {
  const [mixedDice, setMixedDice] = useState({ d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d100: 0 });
  const [d20Count, setD20Count] = useState(1);
  const [d20Mode, setD20Mode] = useState('normal');
  const [activeRolls, setActiveRolls] = useState([]);
  const [rollHistory, setRollHistory] = useState([]);
  const [enable3dDice, setEnable3dDice] = useState(true);
  const [hoveredRoll, setHoveredRoll] = useState(null);
  const [shakeClass, setShakeClass] = useState('');

  const rollTick = useDiceTick();

  const [diceSizeMultiplier, setDiceSizeMultiplier] = useState(() => {
    try {
      const saved = localStorage.getItem('canvas_dice_size_multiplier');
      return saved !== null ? parseFloat(saved) : 1.0;
    } catch {
      return 1.0;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('canvas_dice_size_multiplier', diceSizeMultiplier.toString());
    } catch (e) {
      console.error(e);
    }
  }, [diceSizeMultiplier]);

  const handleCriticalRoll = useCallback(({ type, value }) => {
    if (type === 20) {
      if (value === 20) {
        setShakeClass('animate-shake-success');
        setTimeout(() => setShakeClass(''), 500);
      } else if (value === 1) {
        setShakeClass('animate-shake-fail');
        setTimeout(() => setShakeClass(''), 600);
      }
    }
  }, []);

  const handleRollDice = useCallback((currentUserColor) => {
    const socket = getSocket();
    if (!socket || !socket.connected) return;

    const diceGroups = Object.entries(mixedDice)
      .map(([key, val]) => ({
        type: parseInt(key.substring(1), 10),
        count: val
      }))
      .filter((g) => g.count > 0);

    socket.emit('dice-roll', {
      d20: {
        count: d20Count,
        mode: d20Mode
      },
      dice: diceGroups,
      userColor: currentUserColor
    });
  }, [mixedDice, d20Count, d20Mode]);

  const value = {
    mixedDice,
    setMixedDice,
    d20Count,
    setD20Count,
    d20Mode,
    setD20Mode,
    activeRolls,
    setActiveRolls,
    rollHistory,
    setRollHistory,
    enable3dDice,
    setEnable3dDice,
    hoveredRoll,
    setHoveredRoll,
    shakeClass,
    setShakeClass,
    rollTick,
    diceSizeMultiplier,
    setDiceSizeMultiplier,
    handleCriticalRoll,
    handleRollDice
  };

  return createElement(DiceContext.Provider, { value }, children);
}

/**
 * Hook to consume the Dice state store context.
 * @returns {object} The Dice state store values and setters.
 */
export function useDiceStore() {
  const context = useContext(DiceContext);
  if (!context) {
    throw new Error('useDiceStore must be used within a DiceProvider');
  }
  return context;
}
