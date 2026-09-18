/**
 * Building Suit — Color Tokens (Tailwind)
 * Source of truth: 03-visual-identity/01_COLOR_SYSTEM.md
 *
 * Spread into tailwind.config.js -> theme.extend.colors:
 *
 *   const buildingSuitColors = require('./tailwind.colors.js');
 *   module.exports = {
 *     theme: { extend: { colors: buildingSuitColors } },
 *   };
 *
 * Then use classes like:
 *   bg-navy        text-pearl       border-cloud
 *   bg-gold        text-graphite    bg-success/10
 *   bg-light-bg    dark:bg-dark-bg  (role tokens for theming)
 *
 * KEY RULE: the primary action color flips by mode —
 *   light → Building Navy, dark → Premium Gold.
 */

module.exports = {
  // -------------------------------------------------------------- //
  // Brand palette (fixed)                                          //
  // -------------------------------------------------------------- //
  navy: {
    DEFAULT: '#16293B', // buildingNavy
    deep: '#0D1B28', // deepStructureNavy
    midnight: '#0A111A', // midnightBackground
    surface: '#14233A', // navySurface
    raised: '#1B2E47', // navySurfaceRaised
    border: '#2E3F52', // steelBorder
  },

  gold: {
    DEFAULT: '#D89B42', // premiumGold
    highlight: '#EBB45A', // highlightGold
    700: '#A86C1C',
    600: '#C8902F',
    500: '#D89B42',
    400: '#EBB45A',
    300: '#F4CE86',
  },

  pearl: '#F7F8FA', // pearlWhite
  silver: '#E2E5EA', // softSilver
  cloud: '#CBD2DB', // cloudGray
  white: '#FFFFFF',

  // Secondary blues
  slate: {
    blue: '#36506E', // slateBlue
    gray: '#5A6573', // slateGray
  },
  sky: {
    steel: '#7E97B3', // skySteel
    pale: '#DCE6F1', // paleSky
  },

  // Neutrals / text
  graphite: '#232B33', // graphiteText
  steel: '#9AA6B4', // steelGray

  // -------------------------------------------------------------- //
  // Semantic (status) — base + tinted background + dark variant    //
  // -------------------------------------------------------------- //
  success: {
    DEFAULT: '#2E9E6B',
    bg: '#E4F4EC',
    dark: '#46B383',
    'dark-bg': '#18352A',
  },
  warning: {
    DEFAULT: '#E1841F',
    bg: '#FBEEDD',
    dark: '#F09A3C',
    'dark-bg': '#3A2A14',
  },
  error: {
    DEFAULT: '#D14B4B',
    bg: '#F8E3E3',
    dark: '#E26A6A',
    'dark-bg': '#3A1E1E',
  },
  info: {
    DEFAULT: '#2F77C9',
    bg: '#DCE6F1',
    dark: '#4F92DD',
    'dark-bg': '#15263A',
  },

  // -------------------------------------------------------------- //
  // Role tokens — map these to theme. Use `light-*` by default and //
  // `dark:dark-*` under the `dark` class, OR wire them to CSS vars  //
  // from colors.css for a single source of truth.                  //
  // -------------------------------------------------------------- //

  // Light mode roles
  'light-bg': '#F7F8FA',
  'light-surface': '#FFFFFF',
  'light-surface-muted': '#E2E5EA',
  'light-text': '#232B33',
  'light-text-muted': '#5A6573',
  'light-text-disabled': '#9AA6B4',
  'light-border': '#CBD2DB',
  'light-primary': '#16293B', // navy
  'light-accent': '#D89B42', // gold
  'light-link': '#36506E',

  // Dark mode roles
  'dark-bg': '#0A111A',
  'dark-surface': '#14233A',
  'dark-surface-muted': '#0D1B28',
  'dark-surface-raised': '#1B2E47',
  'dark-text': '#F7F8FA',
  'dark-text-muted': '#7E97B3',
  'dark-text-disabled': '#4A5A6E',
  'dark-border': '#2E3F52',
  'dark-primary': '#D89B42', // gold (primary flips on dark)
  'dark-accent': '#EBB45A', // highlight gold
  'dark-link': '#7E97B3',
};
