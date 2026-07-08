import React from 'react';

const variantStyles = {
  default: {
    background: 'var(--surface-sunken)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--surface-border)',
  },
  outline: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--surface-strong)',
  },
  score: {
    background: 'var(--gray-900)',
    color: 'var(--gray-50)',
    border: '1px solid var(--gray-900)',
  },
  high: {
    background: 'var(--score-high-bg)',
    color: 'var(--score-high)',
    border: '1px solid color-mix(in oklch, var(--score-high) 25%, transparent)',
  },
  mid: {
    background: 'var(--score-mid-bg)',
    color: 'var(--score-mid)',
    border: '1px solid color-mix(in oklch, var(--score-mid) 25%, transparent)',
  },
  low: {
    background: 'var(--score-low-bg)',
    color: 'var(--score-low)',
    border: '1px solid color-mix(in oklch, var(--score-low) 25%, transparent)',
  },
};

const sizeStyles = {
  sm: { fontSize: 'var(--text-xs)', padding: '2px 8px', borderRadius: 'var(--radius-xs)' },
  md: { fontSize: 'var(--text-sm)', padding: '3px 10px', borderRadius: 'var(--radius-sm)' },
};

export function Badge({ children, variant = 'default', size = 'md', style: extra }) {
  return React.createElement('span', {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      fontFamily: 'var(--font-sans)',
      fontWeight: 'var(--weight-medium)',
      lineHeight: 1,
      letterSpacing: 'var(--tracking-wide)',
      whiteSpace: 'nowrap',
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...extra,
    }
  }, children);
}
