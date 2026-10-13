export const RANDOM_NAMES = [
  'Creative Fox',
  'Swift Eagle',
  'Artistic Panther',
  'Curious Dolphin',
  'Design Koala',
  'Dynamic Tiger',
  'Smart Owl',
  'Bright Cheetah',
];

export const PRESET_COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#14b8a6', // Teal
];

export const SAMPLE_IMAGES = [
  {
    name: 'Neon Waves',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=60',
  },
  {
    name: 'Abstract Glass',
    url: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=400&auto=format&fit=crop&q=60',
  },
  {
    name: 'Deep Space',
    url: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=400&auto=format&fit=crop&q=60',
  },
  {
    name: 'Cyberpunk Grid',
    url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=400&auto=format&fit=crop&q=60',
  },
];

export const RANDOM_ROOM_PREFIXES = [
  'realm',
  'canvas',
  'nexus',
  'spire',
  'vault',
  'grove',
  'haven',
  'forge',
  'sanctum',
  'dungeon',
];

export const RANDOM_ROOM_SUFFIXES = [
  'amber',
  'frost',
  'shadow',
  'solar',
  'mystic',
  'arcane',
  'astral',
  'cyber',
  'nova',
  'echo',
];

/**
 * Generates a memorable, URL-friendly random room ID.
 * e.g. "realm-amber-42"
 * 
 * @returns {string}
 */
export function generateRandomRoomId() {
  const prefix = RANDOM_ROOM_PREFIXES[Math.floor(Math.random() * RANDOM_ROOM_PREFIXES.length)];
  const suffix = RANDOM_ROOM_SUFFIXES[Math.floor(Math.random() * RANDOM_ROOM_SUFFIXES.length)];
  const num = Math.floor(Math.random() * 90) + 10;
  return `${prefix}-${suffix}-${num}`;
}
