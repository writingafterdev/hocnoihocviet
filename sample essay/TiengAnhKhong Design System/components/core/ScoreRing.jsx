import React from 'react';

/**
 * ScoreRing — circular IELTS band score display.
 * Shows a score from 0–9 (IELTS scale) as a ring + numeral.
 */
function getScoreVariant(score) {
  if (score >= 7) return { stroke: 'var(--score-high)', text: 'var(--score-high)' };
  if (score >= 5) return { stroke: 'var(--score-mid)', text: 'var(--score-mid)' };
  return { stroke: 'var(--score-low)', text: 'var(--score-low)' };
}

export function ScoreRing({
  score,
  label,
  size = 80,
  strokeWidth = 5,
  style: extra,
}) {
  const r = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = (score / 9) * circumference;
  const variant = getScoreVariant(score);
  const cx = size / 2;
  const cy = size / 2;
  const fontSize = size * 0.26;
  const labelSize = size * 0.13;

  return React.createElement('div', {
    style: {
      display: 'inline-flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 'var(--space-2)',
      ...extra,
    }
  },
    React.createElement('svg', {
      width: size, height: size,
      viewBox: `0 0 ${size} ${size}`,
      style: { display: 'block', transform: 'rotate(-90deg)' },
    },
      React.createElement('circle', {
        cx, cy, r,
        fill: 'none',
        stroke: 'var(--surface-border)',
        strokeWidth,
      }),
      React.createElement('circle', {
        cx, cy, r,
        fill: 'none',
        stroke: variant.stroke,
        strokeWidth,
        strokeLinecap: 'round',
        strokeDasharray: `${progress} ${circumference}`,
        style: { transition: 'stroke-dasharray var(--duration-slow) var(--ease-out)' },
      }),
      React.createElement('text', {
        x: cx, y: cy,
        textAnchor: 'middle',
        dominantBaseline: 'central',
        style: { transform: 'rotate(90deg)', transformOrigin: `${cx}px ${cy}px` },
        fill: variant.text,
        fontFamily: 'var(--font-mono)',
        fontWeight: '500',
        fontSize: fontSize,
      }, score % 1 === 0 ? score.toFixed(0) : score.toFixed(1)),
    ),
    label && React.createElement('span', {
      style: {
        fontFamily: 'var(--font-sans)',
        fontSize: `${labelSize}px`,
        fontWeight: 'var(--weight-medium)',
        color: 'var(--text-secondary)',
        letterSpacing: 'var(--tracking-wide)',
        textAlign: 'center',
        lineHeight: 1.2,
        maxWidth: `${size}px`,
      }
    }, label),
  );
}
