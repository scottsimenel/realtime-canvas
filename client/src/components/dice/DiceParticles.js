/**
 * Helper generators for canvas 2D particle systems:
 * Confetti bursts, sparks, stars, and Nat 20/1 effects.
 */

export const generateSparks = (x, y, color, count = 8) => {
  const sparks = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.8 + Math.random() * 4;
    sparks.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.2,
      color,
      size: 2 + Math.random() * 2.5,
      alpha: 1.0,
      life: 0,
      maxLife: 25 + Math.floor(Math.random() * 15)
    });
  }
  return sparks;
};

export const generateCelebration = (x, y) => {
  const confetti = [];
  const colors = ['#fbbf24', '#f59e0b', '#fb7185', '#38bdf8', '#a78bfa', '#34d399'];
  for (let i = 0; i < 35; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3.5 + Math.random() * 5.5;
    confetti.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 3 + Math.random() * 3.5,
      alpha: 1.0,
      life: 0,
      maxLife: 55 + Math.floor(Math.random() * 25)
    });
  }
  return confetti;
};

export const generateCritSuccess = (x, y) => {
  const particles = [];
  const colors = ['#ffe066', '#f59e0b', '#fbbf24', '#ffffff', '#eab308'];

  // Add standard celebration confetti
  particles.push(...generateCelebration(x, y));

  // Gold stars burst
  for (let i = 0; i < 25; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4.5 + Math.random() * 5.0;
    particles.push({
      type: 'star',
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2.0,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 5 + Math.random() * 4,
      alpha: 1.0,
      life: 0,
      maxLife: 45 + Math.floor(Math.random() * 20)
    });
  }

  // Expanding golden rings of light
  particles.push({
    type: 'ring',
    x,
    y,
    vx: 0,
    vy: 0,
    radius: 6,
    growSpeed: 5.5,
    color: '#ffe066',
    alpha: 1.0,
    life: 0,
    maxLife: 28,
    lineWidth: 5
  });

  particles.push({
    type: 'ring',
    x,
    y,
    vx: 0,
    vy: 0,
    radius: 2,
    growSpeed: 3.5,
    color: '#fbbf24',
    alpha: 0.8,
    life: 0,
    maxLife: 38,
    lineWidth: 3
  });

  // Floating Nat 20 text
  particles.push({
    type: 'text',
    x,
    y: y - 45,
    vx: 0,
    vy: -1.0,
    text: 'NAT 20!',
    color: '#fbbf24',
    font: '900 32px "Outfit", "Inter", sans-serif',
    shadowColor: '#d97706',
    alpha: 1.0,
    life: 0,
    maxLife: 75
  });

  return particles;
};

export const generateCritFailure = (x, y) => {
  const particles = [];
  const smokeColors = ['#3b0764', '#1e1b4b', '#475569', '#1e293b', '#b91c1c', '#7f1d1d'];

  // Dark smoke cloud and fire sparks
  for (let i = 0; i < 40; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.0 + Math.random() * 3.5;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.6,
      color: smokeColors[Math.floor(Math.random() * smokeColors.length)],
      size: 7 + Math.random() * 9,
      alpha: 0.75,
      life: 0,
      maxLife: 50 + Math.floor(Math.random() * 20)
    });
  }

  // Expanding dark red warning ring
  particles.push({
    type: 'ring',
    x,
    y,
    vx: 0,
    vy: 0,
    radius: 4,
    growSpeed: 3.8,
    color: '#ef4444',
    alpha: 1.0,
    life: 0,
    maxLife: 32,
    lineWidth: 4
  });

  // Floating Fumble text
  particles.push({
    type: 'text',
    x,
    y: y - 45,
    vx: 0,
    vy: -0.7,
    text: 'NAT 1',
    color: '#ef4444',
    font: '900 32px "Outfit", "Inter", sans-serif',
    shadowColor: '#991b1b',
    alpha: 1.0,
    life: 0,
    maxLife: 75
  });

  return particles;
};
