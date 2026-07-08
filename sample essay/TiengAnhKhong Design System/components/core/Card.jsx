import React from 'react';

const variantStyles = {
  default: {
    background: 'var(--surface-raised)',
    border: '1px solid var(--surface-border)',
    borderRadius: 'var(--radius-lg)',
  },
  flat: {
    background: 'var(--surface-sunken)',
    border: 'none',
    borderRadius: 'var(--radius-lg)',
  },
  outline: {
    background: 'transparent',
    border: '1px solid var(--surface-border)',
    borderRadius: 'var(--radius-lg)',
  },
};

const paddingStyles = {
  sm: 'var(--inset-sm)',
  md: 'var(--inset-lg)',
  lg: 'var(--inset-xl)',
};

export function Card({ children, variant = 'default', padding = 'md', style: extra, onClick }) {
  const [hovered, setHovered] = React.useState(false);
  const isClickable = typeof onClick === 'function';

  return React.createElement('div', {
    style: {
      ...variantStyles[variant],
      padding: paddingStyles[padding],
      cursor: isClickable ? 'pointer' : 'default',
      transition: 'border-color var(--duration-default) var(--ease-default), background var(--duration-default)',
      ...(isClickable && hovered ? { borderColor: 'var(--surface-strong)', background: 'var(--surface-overlay)' } : {}),
      ...extra,
    },
    onClick,
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  }, children);
}
