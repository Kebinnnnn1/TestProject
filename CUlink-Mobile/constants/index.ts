// Central constants for the CUlink mobile app

// ── API ────────────────────────────────────────────────────────────────────
// ✅ Set this to your Vercel URL (found in your Vercel dashboard)
// Example: 'https://culink-abc123.vercel.app/api/v1'
// For LOCAL testing with Expo Go on your phone:
//   1. Run: ipconfig  (Windows) → find your IPv4 address e.g. 192.168.1.5
//   2. Change to: 'http://192.168.1.5:8000/api/v1'
//   3. Make sure Django is running: python manage.py runserver 0.0.0.0:8000
export const API_BASE_URL = 'https://YOUR-PROJECT.vercel.app/api/v1';

// ── Pusher ─────────────────────────────────────────────────────────────────
// ✅ Fixed: your Pusher cluster is 'ap1' (from your .env PUSHER_CLUSTER)
export const PUSHER_CLUSTER = 'ap1';
export const PUSHER_KEY = '60490e9f86732e30a7b6'; // public-safe, already in your HTML

// ── Colors ─────────────────────────────────────────────────────────────────
export const Colors = {
  // Backgrounds
  bg:           '#0f1117',
  bgCard:       '#1a1d27',
  bgInput:      '#252836',
  bgModal:      '#1e2130',

  // Brand
  primary:      '#7c6ef5',   // purple-indigo
  primaryDark:  '#5a4fd4',
  primaryLight: '#a89cf7',
  accent:       '#f59e42',   // warm orange accent

  // Text
  textPrimary:  '#f0f0f5',
  textSecondary:'#9b9bb5',
  textMuted:    '#5e6075',

  // Status
  success:      '#22c55e',
  error:        '#ef4444',
  warning:      '#f59e0b',
  info:         '#3b82f6',

  // Borders
  border:       '#2e3148',
  borderLight:  '#3a3f5c',

  // University badge colors
  uni: {
    CTU: '#1d4ed8',
    CEC: '#15803d',
    SWU: '#b91c1c',
    ACT: '#7c3aed',
    UV:  '#b45309',
  },
} as const;

// ── Typography ─────────────────────────────────────────────────────────────
export const Font = {
  regular:   'System',
  medium:    'System',
  bold:      'System',
  mono:      'System',
} as const;

// ── Spacing ────────────────────────────────────────────────────────────────
export const Spacing = {
  xs:   4,
  sm:   8,
  md:   16,
  lg:   24,
  xl:   32,
  xxl:  48,
} as const;

// ── Border Radius ──────────────────────────────────────────────────────────
export const Radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  full: 9999,
} as const;
