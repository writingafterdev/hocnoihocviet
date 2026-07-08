import React from 'react';

/**
 * Tag — criterion label for IELTS feedback categories.
 * Also used for topic tags on essay cards.
 */
const criterionColors = {
  TA:  { bg: '#EDF2F8', fg: '#2B5394', border: '#C3D4EC' },  // Task Achievement — blue
  CC:  { bg: '#F0EDF8', fg: '#4A2B94', border: '#CBBFEC' },  // Coherence & Cohesion — purple
  LR:  { bg: '#EDF8F2', fg: '#2B6644', border: '#BFE2CE' },  // Lexical Resource — green
  GRA: { bg: '#F8F2ED', fg: '#7A3D1A', border: '#E2C9BF' },  // Grammatical Range — brown
};

export function Tag({ children, criterion, style: extra }) {
  const colors = criterion ? criterionColors[criterion] : null;

  return React.createElement('span', {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-xs)',
      fontWeight: 'var(--weight-medium)',
      letterSpacing: 'var(--tracking-wide)',
      lineHeight: 1,
      padding: '4px 8px',
      borderRadius: 'var(--radius-xs)',
      whiteSpace: 'nowrap',
      background: colors ? colors.bg : 'var(--surface-sunken)',
      color: colors ? colors.fg : 'var(--text-secondary)',
      border: `1px solid ${colors ? colors.border : 'var(--surface-border)'}`,
      ...extra,
    }
  }, children || criterion);
}
