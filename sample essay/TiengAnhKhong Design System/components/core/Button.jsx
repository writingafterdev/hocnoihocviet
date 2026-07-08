import React from 'react';

const sizeStyles = {
  sm: { padding: '6px 12px', fontSize: 'var(--text-sm)', borderRadius: 'var(--radius-sm)', gap: '6px', height: '32px' },
  md: { padding: '9px 16px', fontSize: 'var(--text-base)', borderRadius: 'var(--radius-md)', gap: '8px', height: '40px' },
  lg: { padding: '12px 20px', fontSize: 'var(--text-md)', borderRadius: 'var(--radius-md)', gap: '8px', height: '48px' },
};

const variantBase = {
  primary: {
    background: 'var(--gray-900)',
    color: 'var(--gray-50)',
    border: '1px solid var(--gray-900)',
  },
  secondary: {
    background: 'var(--surface-raised)',
    color: 'var(--text-primary)',
    border: '1px solid var(--surface-border)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-primary)',
    border: '1px solid transparent',
  },
  destructive: {
    background: 'var(--score-low)',
    color: 'var(--gray-50)',
    border: '1px solid var(--score-low)',
  },
};

const variantHover = {
  primary: { background: 'var(--gray-700)', border: '1px solid var(--gray-700)' },
  secondary: { background: 'var(--surface-overlay)', border: '1px solid var(--surface-strong)' },
  ghost: { background: 'var(--surface-overlay)', border: '1px solid transparent' },
  destructive: { background: '#721e1a', border: '1px solid #721e1a' },
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  onClick,
  type = 'button',
  style: extraStyle,
}) {
  const [hovered, setHovered] = React.useState(false);

  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-sans)',
    fontWeight: 'var(--weight-medium)',
    letterSpacing: 'var(--tracking-wide)',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    transition: 'background var(--duration-default) var(--ease-default), border-color var(--duration-default) var(--ease-default), opacity var(--duration-default)',
    outline: 'none',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    textDecoration: 'none',
    ...sizeStyles[size],
    ...(hovered && !disabled && !loading ? variantHover[variant] : variantBase[variant]),
    ...extraStyle,
  };

  return React.createElement('button', {
    type,
    disabled: disabled || loading,
    style: base,
    onClick,
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  },
    loading && React.createElement('span', {
      style: {
        width: '14px', height: '14px', borderRadius: '50%',
        border: '2px solid currentColor', borderTopColor: 'transparent',
        animation: 'tak-spin 0.7s linear infinite',
        flexShrink: 0,
      }
    }),
    icon && iconPosition === 'left' && !loading && React.createElement('span', {
      style: { display: 'flex', alignItems: 'center', flexShrink: 0 }
    }, icon),
    React.createElement('span', null, children),
    icon && iconPosition === 'right' && !loading && React.createElement('span', {
      style: { display: 'flex', alignItems: 'center', flexShrink: 0 }
    }, icon),
  );
}
