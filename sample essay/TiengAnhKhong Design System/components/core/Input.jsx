import React from 'react';

const sharedBase = {
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--text-base)',
  color: 'var(--text-primary)',
  background: 'var(--surface-raised)',
  border: '1px solid var(--surface-border)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-3) var(--space-4)',
  width: '100%',
  outline: 'none',
  transition: 'border-color var(--duration-default) var(--ease-default)',
  lineHeight: 'var(--leading-normal)',
};

export function Input({
  label,
  id,
  type = 'text',
  placeholder,
  value,
  onChange,
  disabled = false,
  error,
  hint,
  style: extra,
}) {
  const [focused, setFocused] = React.useState(false);
  const inputId = id || `tak-input-${Math.random().toString(36).slice(2, 7)}`;

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' } },
    label && React.createElement('label', {
      htmlFor: inputId,
      style: {
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-sm)',
        fontWeight: 'var(--weight-medium)',
        color: 'var(--text-secondary)',
        letterSpacing: 'var(--tracking-wide)',
      }
    }, label),
    React.createElement('input', {
      id: inputId,
      type,
      placeholder,
      value,
      onChange,
      disabled,
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
      style: {
        ...sharedBase,
        ...(focused ? { borderColor: 'var(--gray-900)' } : {}),
        ...(error ? { borderColor: 'var(--score-low)' } : {}),
        ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
        ...extra,
      }
    }),
    error && React.createElement('p', {
      style: { fontSize: 'var(--text-xs)', color: 'var(--score-low)', lineHeight: 1.4 }
    }, error),
    hint && !error && React.createElement('p', {
      style: { fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', lineHeight: 1.4 }
    }, hint),
  );
}

export function Textarea({
  label,
  id,
  placeholder,
  value,
  onChange,
  disabled = false,
  error,
  hint,
  rows = 6,
  style: extra,
  wordCount,
}) {
  const [focused, setFocused] = React.useState(false);
  const inputId = id || `tak-ta-${Math.random().toString(36).slice(2, 7)}`;

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' } },
    label && React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } },
      React.createElement('label', {
        htmlFor: inputId,
        style: {
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--weight-medium)',
          color: 'var(--text-secondary)',
          letterSpacing: 'var(--tracking-wide)',
        }
      }, label),
      wordCount !== undefined && React.createElement('span', {
        style: { fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }
      }, `${wordCount} words`),
    ),
    React.createElement('textarea', {
      id: inputId,
      placeholder,
      value,
      onChange,
      disabled,
      rows,
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
      style: {
        ...sharedBase,
        resize: 'vertical',
        lineHeight: 'var(--leading-relaxed)',
        ...(focused ? { borderColor: 'var(--gray-900)' } : {}),
        ...(error ? { borderColor: 'var(--score-low)' } : {}),
        ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
        ...extra,
      }
    }),
    error && React.createElement('p', {
      style: { fontSize: 'var(--text-xs)', color: 'var(--score-low)', lineHeight: 1.4 }
    }, error),
    hint && !error && React.createElement('p', {
      style: { fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', lineHeight: 1.4 }
    }, hint),
  );
}
