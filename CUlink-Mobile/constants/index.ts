// Central constants for the CUlink mobile app
import { useThemeStore } from '../store';

// ── API ────────────────────────────────────────────────────────────────────
export const API_BASE_URL = 'https://www.culink.me/api/v1/';

// ── Pusher ─────────────────────────────────────────────────────────────────
export const PUSHER_CLUSTER = 'ap1';
export const PUSHER_KEY = '60490e9f86732e30a7b6';

// ── Brand ─────────────────────────────────────────────────────────────────
export const PRIMARY = '#FF3FA4';
export const PRIMARY_DARK = '#e0348e';

// ── Dark theme (default) ──────────────────────────────────────────────────
export const DarkColors = {
  bg:            '#111114',
  bgCard:        '#1a1a1f',
  bgCardAlt:     '#1f1f2a',
  bgInput:       '#1f1f2a',
  primary:       PRIMARY,
  primaryDark:   PRIMARY_DARK,
  primaryLight:  '#ff75c0',
  accent:        PRIMARY,
  textPrimary:   '#f0f0f5',
  textSecondary: '#a0a0b0',
  textMuted:     '#666680',
  success:       '#22c55e',
  error:         '#ef4444',
  warning:       '#f59e0b',
  info:          '#3b82f6',
  border:        '#2a2a35',
  borderLight:   '#3a3a50',
  isDark:        true,
} as const;

// ── Light theme ───────────────────────────────────────────────────────────
export const LightColors = {
  bg:            '#f5f5f7',
  bgCard:        '#ffffff',
  bgCardAlt:     '#f0f0f5',
  bgInput:       '#f0f0f5',
  primary:       PRIMARY,
  primaryDark:   PRIMARY_DARK,
  primaryLight:  '#ff75c0',
  accent:        PRIMARY,
  textPrimary:   '#111114',
  textSecondary: '#444455',
  textMuted:     '#888899',
  success:       '#16a34a',
  error:         '#dc2626',
  warning:       '#d97706',
  info:          '#2563eb',
  border:        '#e0e0e8',
  borderLight:   '#d0d0dc',
  isDark:        false,
} as const;

export type ThemeColors = {
  bg:            string;
  bgCard:        string;
  bgCardAlt:     string;
  bgInput:       string;
  primary:       string;
  primaryDark:   string;
  primaryLight:  string;
  accent:        string;
  textPrimary:   string;
  textSecondary: string;
  textMuted:     string;
  success:       string;
  error:         string;
  warning:       string;
  info:          string;
  border:        string;
  borderLight:   string;
  isDark:        boolean;
};

// ── useTheme hook — call this inside any component ─────────────────────────
export function useTheme(): ThemeColors {
  const isDark = useThemeStore((s) => s.isDark);
  return isDark ? DarkColors : LightColors;
}

// ── Legacy export (dark) — kept so old static StyleSheets still compile ────
export const Colors = DarkColors;

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
