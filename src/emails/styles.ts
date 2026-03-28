// Design token system — single source of truth for all email styles.
// Every component derives its style values from these tokens.
// To update brand colours, typography, or spacing: change only this file.

export const colors = {
  bg:            '#F4F4F5',  // email outer background
  surface:       '#FFFFFF',  // card / content block background
  shading:       '#FBFBFC',  // subtle background shading
  border:        '#E4E4E7',  // card borders, dividers, table row separators
  textPrimary:   '#36363B',  // headings, stat numbers, field values
  textSecondary: '#52525B',  // body text, descriptions, context lines
  textMuted:     '#A1A1AA',  // footer, field labels, metadata
  accent:        '#3A6EA5',  // links, CTA buttons, message-block left border
  accentShading: 'rgba(94,150,199,0.15)',
  positive:      '#F7BC03',  // upward trend indicators
} as const;

export const typography = {
  fontStack: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  sizes: {
    display: '36px',
    h1:      '28px',
    h2:      '18px',
    body:    '15px',
    small:   '13px',
    label:   '11px',
  },
  weights: {
    light:   300,
    regular: 400,
    medium:  600,
    bold:    700,
  },
  lineHeights: {
    tight:   '1.1',
    heading: '1.3',
    body:    '1.6',
    small:   '1.5',
  },
  letterSpacing: {
    label: '0.08em',
    tight: '-0.02em',
  },
} as const;

export const spacing = {
  xs:        '4px',
  sm:        '8px',
  md:        '16px',
  lg:        '24px',
  xl:        '40px',
  container: '32px',
} as const;

export const radii = {
  container:    '16px',
  card:         '8px',
  button:       '6px',
  messageBlock: '4px',
} as const;

export const borders = {
  card:          `1px solid ${colors.border}`,
  tableRow:      `1px solid ${colors.border}`,
  messageAccent: `4px solid ${colors.accent}`,
} as const;
