export function registerDiceHandlers(io, socket, registry, DEFAULT_ROOM) {
  /**
   * Handle collaborative dice rolling.
   * Generates random values for mixed dice groups and d20 (with advantage/disadvantage), then broadcasts.
   */
  socket.on('dice-roll', (data) => {
    const { d20, dice } = data || {};
    const room = socket.room || DEFAULT_ROOM;

    const user = registry.users.get(socket.id);
    if (!user) {
      console.warn(`[dice-roll] Socket ${socket.id} attempted to roll but user was not found in registry`);
      return;
    }

    console.log(`[dice-roll] Socket ${socket.id} (${user.name}) is rolling. Current registry color: ${user.color}`);

    const rollDie = (sides) => Math.floor(Math.random() * sides) + 1;
    const rollId = `roll_${Date.now()}_${Math.round(Math.random() * 1e9)}`;
    const timestamp = new Date().toISOString();

    // 1. Process d20 roll(s)
    let d20Result = null;
    if (d20 && typeof d20 === 'object' && d20.count > 0) {
      const safeD20Count = Math.max(1, Math.min(10, parseInt(d20.count, 10) || 0));
      const safeD20Mode = ['normal', 'advantage', 'disadvantage'].includes(d20.mode) ? d20.mode : 'normal';

      const rolls = [];
      for (let i = 0; i < safeD20Count; i++) {
        const r1 = rollDie(20);
        const r2 = rollDie(20);
        let kept, discarded;

        if (safeD20Mode === 'advantage') {
          kept = Math.max(r1, r2);
          discarded = Math.min(r1, r2);
        } else if (safeD20Mode === 'disadvantage') {
          kept = Math.min(r1, r2);
          discarded = Math.max(r1, r2);
        } else {
          kept = r1;
          discarded = null;
        }

        rolls.push({
          roll1: r1,
          roll2: safeD20Mode !== 'normal' ? r2 : null,
          kept,
          discarded
        });
      }

      d20Result = {
        count: safeD20Count,
        mode: safeD20Mode,
        rolls
      };
    }

    // 2. Process other custom dice groups
    const diceResults = [];
    let totalSum = 0;

    if (dice && Array.isArray(dice)) {
      for (const group of dice) {
        const type = parseInt(group.type, 10);
        const count = parseInt(group.count, 10);

        if ([4, 6, 8, 10, 12, 100].includes(type) && count > 0) {
          const safeCount = Math.max(1, Math.min(30, count)); // Limit count per type to 30
          const rolls = Array.from({ length: safeCount }, () => rollDie(type));
          const sum = rolls.reduce((a, b) => a + b, 0);

          diceResults.push({
            type,
            count: safeCount,
            rolls,
            sum
          });

          totalSum += sum;
        }
      }
    }

    const payload = {
      rollId,
      timestamp,
      userId: socket.id,
      userName: user.name,
      userColor: (data && data.userColor) || user.color || '#4f46e5',
      d20: d20Result,
      dice: diceResults,
      totalSum
    };

    io.to(room).emit('dice-rolled', payload);
  });
}
