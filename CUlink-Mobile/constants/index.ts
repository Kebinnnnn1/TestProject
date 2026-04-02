// Central constants for the CUlink mobile app — dark theme matching the web

// ── API ────────────────────────────────────────────────────────────────────
export const API_BASE_URL = 'https://www.culink.me/api/v1/';

// ── Pusher ─────────────────────────────────────────────────────────────────
export const PUSHER_CLUSTER = 'ap1';
export const PUSHER_KEY = '60490e9f86732e30a7b6';

// ── Colors — exactly matching the web [data-theme="dark"] CSS variables ───
export const Colors = {
  // Backgrounds
  bg:           '#111114',   // --bg
  bgCard:       '#1a1a1f',   // --bg-card
  bgCardAlt:    '#1f1f2a',   // --bg-card-alt
  bgDark:       '#0a0a0d',   // --bg-dark
  bgInput:      '#1f1f2a',

  // Brand — exact CUlink pink
  primary:      '#FF3FA4',   // --pink
  primaryDark:  '#e0348e',   // --pink-dark
  primaryLight: '#ff75c0',
  accent:       '#FF3FA4',

  // Text
  textPrimary:  '#f0f0f5',   // --text-dark (in dark mode)
  textSecondary:'#a0a0b0',   // --text-mid
  textMuted:    '#666680',   // --text-light

  // Status
  success:      '#22c55e',
  error:        '#ef4444',
  warning:      '#f59e0b',
  info:         '#3b82f6',

  // Borders
  border:       '#2a2a35',
  borderLight:  '#3a3a50',
} as const;

// ── Spacing ────────────────────────────────────────────────────────────────
export const Spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
} as const;

// ── Border Radius ──────────────────────────────────────────────────────────
export const Radius = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  full: 9999,
} as const;
