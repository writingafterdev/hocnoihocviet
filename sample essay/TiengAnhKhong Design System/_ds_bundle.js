/* @ds-bundle: {"format":3,"namespace":"TiengAnhKhongDesignSystem_3b3b0d","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Input","sourcePath":"components/core/Input.jsx"},{"name":"Textarea","sourcePath":"components/core/Input.jsx"},{"name":"ScoreRing","sourcePath":"components/core/ScoreRing.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"c57b037b4a7d","components/core/Button.jsx":"61b490b2dfc1","components/core/Card.jsx":"f5c4c7a450ea","components/core/Input.jsx":"539e9a272e69","components/core/ScoreRing.jsx":"8f1dc97c210f","components/core/Tag.jsx":"792c599d5cad","ui_kits/webapp/shared.jsx":"fe3674d121d0","ui_kits/webapp/views.jsx":"930184b73d14"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.TiengAnhKhongDesignSystem_3b3b0d = window.TiengAnhKhongDesignSystem_3b3b0d || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Badge.jsx
try { (() => {
const variantStyles = {
  default: {
    background: 'var(--surface-sunken)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--surface-border)'
  },
  outline: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--surface-strong)'
  },
  score: {
    background: 'var(--gray-900)',
    color: 'var(--gray-50)',
    border: '1px solid var(--gray-900)'
  },
  high: {
    background: 'var(--score-high-bg)',
    color: 'var(--score-high)',
    border: '1px solid color-mix(in oklch, var(--score-high) 25%, transparent)'
  },
  mid: {
    background: 'var(--score-mid-bg)',
    color: 'var(--score-mid)',
    border: '1px solid color-mix(in oklch, var(--score-mid) 25%, transparent)'
  },
  low: {
    background: 'var(--score-low-bg)',
    color: 'var(--score-low)',
    border: '1px solid color-mix(in oklch, var(--score-low) 25%, transparent)'
  }
};
const sizeStyles = {
  sm: {
    fontSize: 'var(--text-xs)',
    padding: '2px 8px',
    borderRadius: 'var(--radius-xs)'
  },
  md: {
    fontSize: 'var(--text-sm)',
    padding: '3px 10px',
    borderRadius: 'var(--radius-sm)'
  }
};
function Badge({
  children,
  variant = 'default',
  size = 'md',
  style: extra
}) {
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
      ...extra
    }
  }, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
const sizeStyles = {
  sm: {
    padding: '6px 12px',
    fontSize: 'var(--text-sm)',
    borderRadius: 'var(--radius-sm)',
    gap: '6px',
    height: '32px'
  },
  md: {
    padding: '9px 16px',
    fontSize: 'var(--text-base)',
    borderRadius: 'var(--radius-md)',
    gap: '8px',
    height: '40px'
  },
  lg: {
    padding: '12px 20px',
    fontSize: 'var(--text-md)',
    borderRadius: 'var(--radius-md)',
    gap: '8px',
    height: '48px'
  }
};
const variantBase = {
  primary: {
    background: 'var(--gray-900)',
    color: 'var(--gray-50)',
    border: '1px solid var(--gray-900)'
  },
  secondary: {
    background: 'var(--surface-raised)',
    color: 'var(--text-primary)',
    border: '1px solid var(--surface-border)'
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-primary)',
    border: '1px solid transparent'
  },
  destructive: {
    background: 'var(--score-low)',
    color: 'var(--gray-50)',
    border: '1px solid var(--score-low)'
  }
};
const variantHover = {
  primary: {
    background: 'var(--gray-700)',
    border: '1px solid var(--gray-700)'
  },
  secondary: {
    background: 'var(--surface-overlay)',
    border: '1px solid var(--surface-strong)'
  },
  ghost: {
    background: 'var(--surface-overlay)',
    border: '1px solid transparent'
  },
  destructive: {
    background: '#721e1a',
    border: '1px solid #721e1a'
  }
};
function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  onClick,
  type = 'button',
  style: extraStyle
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
    ...extraStyle
  };
  return React.createElement('button', {
    type,
    disabled: disabled || loading,
    style: base,
    onClick,
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false)
  }, loading && React.createElement('span', {
    style: {
      width: '14px',
      height: '14px',
      borderRadius: '50%',
      border: '2px solid currentColor',
      borderTopColor: 'transparent',
      animation: 'tak-spin 0.7s linear infinite',
      flexShrink: 0
    }
  }), icon && iconPosition === 'left' && !loading && React.createElement('span', {
    style: {
      display: 'flex',
      alignItems: 'center',
      flexShrink: 0
    }
  }, icon), React.createElement('span', null, children), icon && iconPosition === 'right' && !loading && React.createElement('span', {
    style: {
      display: 'flex',
      alignItems: 'center',
      flexShrink: 0
    }
  }, icon));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
const variantStyles = {
  default: {
    background: 'var(--surface-raised)',
    border: '1px solid var(--surface-border)',
    borderRadius: 'var(--radius-lg)'
  },
  flat: {
    background: 'var(--surface-sunken)',
    border: 'none',
    borderRadius: 'var(--radius-lg)'
  },
  outline: {
    background: 'transparent',
    border: '1px solid var(--surface-border)',
    borderRadius: 'var(--radius-lg)'
  }
};
const paddingStyles = {
  sm: 'var(--inset-sm)',
  md: 'var(--inset-lg)',
  lg: 'var(--inset-xl)'
};
function Card({
  children,
  variant = 'default',
  padding = 'md',
  style: extra,
  onClick
}) {
  const [hovered, setHovered] = React.useState(false);
  const isClickable = typeof onClick === 'function';
  return React.createElement('div', {
    style: {
      ...variantStyles[variant],
      padding: paddingStyles[padding],
      cursor: isClickable ? 'pointer' : 'default',
      transition: 'border-color var(--duration-default) var(--ease-default), background var(--duration-default)',
      ...(isClickable && hovered ? {
        borderColor: 'var(--surface-strong)',
        background: 'var(--surface-overlay)'
      } : {}),
      ...extra
    },
    onClick,
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false)
  }, children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Input.jsx
try { (() => {
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
  lineHeight: 'var(--leading-normal)'
};
function Input({
  label,
  id,
  type = 'text',
  placeholder,
  value,
  onChange,
  disabled = false,
  error,
  hint,
  style: extra
}) {
  const [focused, setFocused] = React.useState(false);
  const inputId = id || `tak-input-${Math.random().toString(36).slice(2, 7)}`;
  return React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-2)'
    }
  }, label && React.createElement('label', {
    htmlFor: inputId,
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--weight-medium)',
      color: 'var(--text-secondary)',
      letterSpacing: 'var(--tracking-wide)'
    }
  }, label), React.createElement('input', {
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
      ...(focused ? {
        borderColor: 'var(--gray-900)'
      } : {}),
      ...(error ? {
        borderColor: 'var(--score-low)'
      } : {}),
      ...(disabled ? {
        opacity: 0.5,
        cursor: 'not-allowed'
      } : {}),
      ...extra
    }
  }), error && React.createElement('p', {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--score-low)',
      lineHeight: 1.4
    }
  }, error), hint && !error && React.createElement('p', {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-tertiary)',
      lineHeight: 1.4
    }
  }, hint));
}
function Textarea({
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
  wordCount
}) {
  const [focused, setFocused] = React.useState(false);
  const inputId = id || `tak-ta-${Math.random().toString(36).slice(2, 7)}`;
  return React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-2)'
    }
  }, label && React.createElement('div', {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline'
    }
  }, React.createElement('label', {
    htmlFor: inputId,
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--weight-medium)',
      color: 'var(--text-secondary)',
      letterSpacing: 'var(--tracking-wide)'
    }
  }, label), wordCount !== undefined && React.createElement('span', {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-tertiary)',
      fontFamily: 'var(--font-mono)'
    }
  }, `${wordCount} words`)), React.createElement('textarea', {
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
      ...(focused ? {
        borderColor: 'var(--gray-900)'
      } : {}),
      ...(error ? {
        borderColor: 'var(--score-low)'
      } : {}),
      ...(disabled ? {
        opacity: 0.5,
        cursor: 'not-allowed'
      } : {}),
      ...extra
    }
  }), error && React.createElement('p', {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--score-low)',
      lineHeight: 1.4
    }
  }, error), hint && !error && React.createElement('p', {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-tertiary)',
      lineHeight: 1.4
    }
  }, hint));
}
Object.assign(__ds_scope, { Input, Textarea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Input.jsx", error: String((e && e.message) || e) }); }

// components/core/ScoreRing.jsx
try { (() => {
/**
 * ScoreRing — circular IELTS band score display.
 * Shows a score from 0–9 (IELTS scale) as a ring + numeral.
 */
function getScoreVariant(score) {
  if (score >= 7) return {
    stroke: 'var(--score-high)',
    text: 'var(--score-high)'
  };
  if (score >= 5) return {
    stroke: 'var(--score-mid)',
    text: 'var(--score-mid)'
  };
  return {
    stroke: 'var(--score-low)',
    text: 'var(--score-low)'
  };
}
function ScoreRing({
  score,
  label,
  size = 80,
  strokeWidth = 5,
  style: extra
}) {
  const r = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = score / 9 * circumference;
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
      ...extra
    }
  }, React.createElement('svg', {
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`,
    style: {
      display: 'block',
      transform: 'rotate(-90deg)'
    }
  }, React.createElement('circle', {
    cx,
    cy,
    r,
    fill: 'none',
    stroke: 'var(--surface-border)',
    strokeWidth
  }), React.createElement('circle', {
    cx,
    cy,
    r,
    fill: 'none',
    stroke: variant.stroke,
    strokeWidth,
    strokeLinecap: 'round',
    strokeDasharray: `${progress} ${circumference}`,
    style: {
      transition: 'stroke-dasharray var(--duration-slow) var(--ease-out)'
    }
  }), React.createElement('text', {
    x: cx,
    y: cy,
    textAnchor: 'middle',
    dominantBaseline: 'central',
    style: {
      transform: 'rotate(90deg)',
      transformOrigin: `${cx}px ${cy}px`
    },
    fill: variant.text,
    fontFamily: 'var(--font-mono)',
    fontWeight: '500',
    fontSize: fontSize
  }, score % 1 === 0 ? score.toFixed(0) : score.toFixed(1))), label && React.createElement('span', {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: `${labelSize}px`,
      fontWeight: 'var(--weight-medium)',
      color: 'var(--text-secondary)',
      letterSpacing: 'var(--tracking-wide)',
      textAlign: 'center',
      lineHeight: 1.2,
      maxWidth: `${size}px`
    }
  }, label));
}
Object.assign(__ds_scope, { ScoreRing });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/ScoreRing.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
/**
 * Tag — criterion label for IELTS feedback categories.
 * Also used for topic tags on essay cards.
 */
const criterionColors = {
  TA: {
    bg: '#EDF2F8',
    fg: '#2B5394',
    border: '#C3D4EC'
  },
  // Task Achievement — blue
  CC: {
    bg: '#F0EDF8',
    fg: '#4A2B94',
    border: '#CBBFEC'
  },
  // Coherence & Cohesion — purple
  LR: {
    bg: '#EDF8F2',
    fg: '#2B6644',
    border: '#BFE2CE'
  },
  // Lexical Resource — green
  GRA: {
    bg: '#F8F2ED',
    fg: '#7A3D1A',
    border: '#E2C9BF'
  } // Grammatical Range — brown
};
function Tag({
  children,
  criterion,
  style: extra
}) {
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
      ...extra
    }
  }, children || criterion);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// ui_kits/webapp/shared.jsx
try { (() => {
// TiengAnhKhong UI Kit — shared data and sub-components
// Loaded by index.html as a Babel script

const SAMPLE_ESSAY = `In today's rapidly changing world, many people believe that governments should invest more in public transportation rather than road infrastructure. While there are valid arguments on both sides, I strongly agree that prioritising public transport leads to greater long-term benefits for society.

To begin with, expanding public transportation significantly reduces traffic congestion in urban areas. When more commuters switch from private cars to buses and trains, the number of vehicles on the road decreases substantially. For example, cities such as Singapore and Tokyo have demonstrated that well-funded metro systems can move millions of passengers daily with minimal road congestion.

Furthermore, public transport is far more environmentally sustainable than road-based travel. A single bus can replace up to 40 private vehicles, leading to dramatic reductions in carbon emissions and air pollution. Given the urgent need to address climate change, governments have a responsibility to fund greener alternatives.

However, opponents argue that road infrastructure is essential for economic activity, particularly in rural areas where public transport is impractical. Goods must be transported by truck, and residents in remote communities rely entirely on personal vehicles. This is a legitimate concern, and a balanced approach — funding both systems — may be more realistic in practice.

In conclusion, while road infrastructure remains important, the environmental and social benefits of public transport make it the more worthwhile investment for modern governments. Strategic funding of interconnected rail and bus networks will serve the public interest for generations to come.`;
const ANNOTATIONS = [{
  start: 0,
  end: 3,
  text: 'rapidly changing world',
  type: 'LR',
  note: 'Overused collocation. Try "an era of rapid change" or "our accelerating world".'
}, {
  start: 4,
  end: 5,
  text: 'many people believe',
  type: 'TA',
  note: 'Vague attribution. Specify "urban planners" or "transport economists" for precision.'
}, {
  start: 6,
  end: 7,
  text: 'While there are valid arguments on both sides',
  type: 'CC',
  note: 'Formulaic concession. Consider integrating your counter-argument more naturally.'
}, {
  start: 10,
  end: 12,
  text: 'significantly reduces',
  type: 'GRA',
  note: 'Adverb placement is correct. Good use of present-tense generalisation.'
}];
const ESSAYS = [{
  id: 1,
  title: 'Public transport vs road infrastructure',
  task: 'Task 2',
  date: '14 Jun 2026',
  words: 287,
  overall: 7.0,
  TA: 7.0,
  CC: 6.5,
  LR: 7.5,
  GRA: 7.0
}, {
  id: 2,
  title: 'The rise of remote work and its effects',
  task: 'Task 2',
  date: '8 Jun 2026',
  words: 312,
  overall: 6.5,
  TA: 6.5,
  CC: 6.0,
  LR: 6.5,
  GRA: 7.0
}, {
  id: 3,
  title: 'Should zoos be banned?',
  task: 'Task 2',
  date: '1 Jun 2026',
  words: 256,
  overall: 6.0,
  TA: 6.0,
  CC: 5.5,
  LR: 6.5,
  GRA: 6.0
}];
function ScoreBadge({
  score
}) {
  const color = score >= 7 ? '#3D7A5B' : score >= 5.5 ? '#8B6325' : '#8B3A35';
  const bg = score >= 7 ? '#EEF4F0' : score >= 5.5 ? '#F7F1E6' : '#F5EDED';
  return React.createElement('span', {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '13px',
      fontWeight: 500,
      padding: '3px 8px',
      borderRadius: '4px',
      background: bg,
      color,
      border: `1px solid ${color}30`
    }
  }, score.toFixed(1));
}
function Tag({
  criterion
}) {
  const map = {
    TA: {
      bg: '#EDF2F8',
      fg: '#2B5394',
      label: 'Task Achievement'
    },
    CC: {
      bg: '#F0EDF8',
      fg: '#4A2B94',
      label: 'Coherence & Cohesion'
    },
    LR: {
      bg: '#EDF8F2',
      fg: '#2B6644',
      label: 'Lexical Resource'
    },
    GRA: {
      bg: '#F8F2ED',
      fg: '#7A3D1A',
      label: 'Grammar'
    }
  };
  const c = map[criterion];
  return React.createElement('span', {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: '11px',
      fontWeight: 500,
      letterSpacing: '0.04em',
      padding: '2px 7px',
      borderRadius: '3px',
      background: c.bg,
      color: c.fg,
      whiteSpace: 'nowrap'
    }
  }, criterion);
}
function MiniRing({
  score,
  label,
  size = 64
}) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const prog = score / 9 * circ;
  const color = score >= 7 ? '#3D7A5B' : score >= 5.5 ? '#8B6325' : '#8B3A35';
  const cx = size / 2,
    cy = size / 2;
  return React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4
    }
  }, React.createElement('svg', {
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`,
    style: {
      transform: 'rotate(-90deg)'
    }
  }, React.createElement('circle', {
    cx,
    cy,
    r,
    fill: 'none',
    stroke: '#E6E3D8',
    strokeWidth: 4
  }), React.createElement('circle', {
    cx,
    cy,
    r,
    fill: 'none',
    stroke: color,
    strokeWidth: 4,
    strokeLinecap: 'round',
    strokeDasharray: `${prog} ${circ}`
  }), React.createElement('text', {
    x: cx,
    y: cy,
    textAnchor: 'middle',
    dominantBaseline: 'central',
    fill: color,
    fontFamily: 'var(--font-mono)',
    fontSize: size * 0.22,
    fontWeight: 500,
    style: {
      transform: `rotate(90deg)`,
      transformOrigin: `${cx}px ${cy}px`
    }
  }, score.toFixed(1))), React.createElement('span', {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: '10px',
      color: 'var(--text-tertiary)',
      textAlign: 'center',
      lineHeight: 1.2,
      maxWidth: size
    }
  }, label));
}
Object.assign(window, {
  SAMPLE_ESSAY,
  ANNOTATIONS,
  ESSAYS,
  ScoreBadge,
  Tag: Tag,
  MiniRing
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/webapp/shared.jsx", error: String((e && e.message) || e) }); }

// ui_kits/webapp/views.jsx
try { (() => {
// TiengAnhKhong UI Kit — screen views
// Requires shared.jsx to be loaded first

function Sidebar({
  view,
  setView
}) {
  const navItems = [{
    id: 'dashboard',
    label: 'Essays'
  }, {
    id: 'submit',
    label: 'New essay'
  }, {
    id: 'feedback',
    label: 'Feedback'
  }];
  return React.createElement('nav', {
    style: {
      width: 220,
      flexShrink: 0,
      background: '#F2F0E9',
      borderRight: '1px solid #DEDAD0',
      display: 'flex',
      flexDirection: 'column',
      padding: '28px 0',
      height: '100vh',
      position: 'sticky',
      top: 0
    }
  }, React.createElement('div', {
    style: {
      padding: '0 24px 28px',
      borderBottom: '1px solid #DEDAD0'
    }
  }, React.createElement('div', {
    style: {
      fontFamily: 'var(--font-serif)',
      fontSize: '18px',
      fontWeight: 500,
      color: 'var(--text-primary)',
      letterSpacing: '-0.01em'
    }
  }, 'tienganhkhong'), React.createElement('div', {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: '11px',
      color: 'var(--text-tertiary)',
      marginTop: 2,
      letterSpacing: '0.04em'
    }
  }, 'IELTS Writing Feedback')), React.createElement('div', {
    style: {
      padding: '16px 12px',
      flex: 1
    }
  }, navItems.map(item => React.createElement('button', {
    key: item.id,
    onClick: () => setView(item.id),
    style: {
      display: 'block',
      width: '100%',
      textAlign: 'left',
      padding: '8px 12px',
      borderRadius: '6px',
      border: 'none',
      fontFamily: 'var(--font-sans)',
      fontSize: '14px',
      fontWeight: view === item.id ? 500 : 400,
      color: view === item.id ? 'var(--text-primary)' : 'var(--text-secondary)',
      background: view === item.id ? '#FFFFFF' : 'transparent',
      cursor: 'pointer',
      marginBottom: 2,
      boxShadow: view === item.id ? '0 1px 3px rgba(20,20,19,0.08)' : 'none',
      transition: 'all 150ms'
    }
  }, item.label))), React.createElement('div', {
    style: {
      padding: '0 24px',
      borderTop: '1px solid #DEDAD0',
      paddingTop: 16
    }
  }, React.createElement('div', {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: '12px',
      color: 'var(--text-tertiary)'
    }
  }, 'Minh Anh Nguyen'), React.createElement('div', {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: '11px',
      color: 'var(--text-tertiary)',
      opacity: 0.7
    }
  }, 'Target: Band 7.0')));
}
function DashboardView({
  setView
}) {
  return React.createElement('main', {
    style: {
      flex: 1,
      padding: '48px 56px',
      overflowY: 'auto',
      maxWidth: 860
    }
  }, React.createElement('div', {
    style: {
      marginBottom: 40
    }
  }, React.createElement('h1', {
    style: {
      fontFamily: 'var(--font-serif)',
      fontSize: '28px',
      fontWeight: 500,
      color: 'var(--text-primary)',
      letterSpacing: '-0.02em',
      marginBottom: 6
    }
  }, 'Your essays'), React.createElement('p', {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: '15px',
      color: 'var(--text-secondary)'
    }
  }, '3 submissions · Target band 7.0')), React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, ESSAYS.map(essay => React.createElement('div', {
    key: essay.id,
    onClick: () => setView('feedback'),
    style: {
      background: '#FFFFFF',
      border: '1px solid #DEDAD0',
      borderRadius: '10px',
      padding: '20px 24px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 24,
      transition: 'border-color 150ms'
    },
    onMouseEnter: e => e.currentTarget.style.borderColor = '#A9A494',
    onMouseLeave: e => e.currentTarget.style.borderColor = '#DEDAD0'
  }, React.createElement('div', {
    style: {
      flex: 1
    }
  }, React.createElement('div', {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: '15px',
      fontWeight: 500,
      color: 'var(--text-primary)',
      marginBottom: 4
    }
  }, essay.title), React.createElement('div', {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: '12px',
      color: 'var(--text-tertiary)',
      display: 'flex',
      gap: 12
    }
  }, React.createElement('span', null, essay.task), React.createElement('span', null, essay.date), React.createElement('span', null, `${essay.words} words`))), React.createElement('div', {
    style: {
      display: 'flex',
      gap: 20,
      alignItems: 'center'
    }
  }, ['TA', 'CC', 'LR', 'GRA'].map(c => React.createElement('div', {
    key: c,
    style: {
      textAlign: 'center'
    }
  }, React.createElement('div', {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '13px',
      fontWeight: 500,
      color: 'var(--text-secondary)'
    }
  }, essay[c].toFixed(1)), React.createElement('div', {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: '9px',
      color: 'var(--text-tertiary)',
      letterSpacing: '0.04em'
    }
  }, c))), React.createElement('div', {
    style: {
      width: 1,
      height: 32,
      background: '#DEDAD0',
      marginLeft: 4
    }
  }), React.createElement(ScoreBadge, {
    score: essay.overall
  }))))), React.createElement('button', {
    onClick: () => setView('submit'),
    style: {
      marginTop: 24,
      fontFamily: 'var(--font-sans)',
      fontSize: '14px',
      fontWeight: 500,
      background: '#141413',
      color: '#FAF9F5',
      border: 'none',
      borderRadius: '8px',
      padding: '10px 20px',
      cursor: 'pointer'
    }
  }, '+ New essay'));
}
function SubmitView({
  setView
}) {
  const [text, setText] = React.useState('');
  const [task, setTask] = React.useState('Task 2');
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return React.createElement('main', {
    style: {
      flex: 1,
      padding: '48px 56px',
      maxWidth: 780,
      overflowY: 'auto'
    }
  }, React.createElement('h1', {
    style: {
      fontFamily: 'var(--font-serif)',
      fontSize: '28px',
      fontWeight: 500,
      letterSpacing: '-0.02em',
      marginBottom: 6
    }
  }, 'Submit an essay'), React.createElement('p', {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: '15px',
      color: 'var(--text-secondary)',
      marginBottom: 32
    }
  }, 'Paste your IELTS writing and receive structured feedback.'), React.createElement('div', {
    style: {
      display: 'flex',
      gap: 8,
      marginBottom: 24
    }
  }, ['Task 1', 'Task 2'].map(t => React.createElement('button', {
    key: t,
    onClick: () => setTask(t),
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: '13px',
      fontWeight: task === t ? 500 : 400,
      padding: '6px 14px',
      borderRadius: '6px',
      cursor: 'pointer',
      background: task === t ? '#141413' : 'transparent',
      color: task === t ? '#FAF9F5' : 'var(--text-secondary)',
      border: task === t ? '1px solid #141413' : '1px solid #DEDAD0',
      transition: 'all 150ms'
    }
  }, t))), React.createElement('div', {
    style: {
      position: 'relative'
    }
  }, React.createElement('textarea', {
    placeholder: 'Paste or type your essay here…',
    value: text,
    onChange: e => setText(e.target.value),
    rows: 16,
    style: {
      width: '100%',
      fontFamily: 'var(--font-sans)',
      fontSize: '15px',
      lineHeight: '1.7',
      color: 'var(--text-primary)',
      background: '#FFFFFF',
      border: '1px solid #DEDAD0',
      borderRadius: '10px',
      padding: '20px',
      resize: 'vertical',
      outline: 'none',
      transition: 'border-color 150ms'
    },
    onFocus: e => e.target.style.borderColor = '#141413',
    onBlur: e => e.target.style.borderColor = '#DEDAD0'
  }), React.createElement('div', {
    style: {
      position: 'absolute',
      bottom: 12,
      right: 16,
      fontFamily: 'var(--font-mono)',
      fontSize: '12px',
      color: words < 150 ? '#8B3A35' : words >= 250 ? '#3D7A5B' : '#8B6325'
    }
  }, `${words} words`)), React.createElement('div', {
    style: {
      marginTop: 8,
      fontFamily: 'var(--font-sans)',
      fontSize: '12px',
      color: 'var(--text-tertiary)'
    }
  }, task === 'Task 2' ? 'Minimum 250 words recommended.' : 'Minimum 150 words recommended.'), React.createElement('div', {
    style: {
      display: 'flex',
      gap: 12,
      marginTop: 24
    }
  }, React.createElement('button', {
    onClick: () => setView('feedback'),
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: '14px',
      fontWeight: 500,
      background: '#141413',
      color: '#FAF9F5',
      border: 'none',
      borderRadius: '8px',
      padding: '11px 24px',
      cursor: 'pointer'
    }
  }, 'Analyse essay'), React.createElement('button', {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: '14px',
      color: 'var(--text-secondary)',
      background: 'transparent',
      border: '1px solid #DEDAD0',
      borderRadius: '8px',
      padding: '11px 20px',
      cursor: 'pointer'
    }
  }, 'Save draft')));
}
function FeedbackView() {
  const essay = ESSAYS[0];
  const [activeAnnotation, setActiveAnnotation] = React.useState(null);
  const [openSection, setOpenSection] = React.useState('TA');
  const criteriaDetail = {
    TA: {
      score: essay.TA,
      label: 'Task Achievement',
      summary: 'Your position is clear and consistent. All parts of the task are addressed, though supporting examples could be more specific and less generic.',
      suggestions: ['Avoid phrases like "many people believe" — be more specific about who.', 'Extend your second argument with a concrete statistic or named example.', 'Your conclusion restates the position well but adds little new insight.']
    },
    CC: {
      score: essay.CC,
      label: 'Coherence & Cohesion',
      summary: 'Paragraphs are logically sequenced. Cohesive devices are used but sometimes feel mechanical — especially "Furthermore" and "To begin with".',
      suggestions: ['Vary your discourse markers: try "This pattern is also visible in…" or "A further implication…"', 'Paragraph 4 shifts topic abruptly. Add a bridging sentence.']
    },
    LR: {
      score: essay.LR,
      label: 'Lexical Resource',
      summary: 'Vocabulary is generally varied and appropriate. A few overused collocations reduce the range. Paraphrasing of task keywords is effective.',
      suggestions: ['"rapidly changing world" is overused — substitute a more specific phrase.', 'Good use of "substantially", "sustainable", and "strategic".', 'Avoid repeating "public transport" — use "mass transit" or "collective mobility".']
    },
    GRA: {
      score: essay.GRA,
      label: 'Grammatical Range & Accuracy',
      summary: 'Range includes complex sentences, relative clauses, and passive voice. Some errors in article usage and subject-verb agreement.',
      suggestions: ['Check: "A single bus can replace up to 40 private vehicles" — this is correct, but "up to 40" is quite vague.', 'Consistent and accurate tense use throughout.', 'One minor comma splice in paragraph 3.']
    }
  };
  return React.createElement('main', {
    style: {
      flex: 1,
      display: 'flex',
      overflowY: 'auto'
    }
  },
  // Essay panel
  React.createElement('div', {
    style: {
      flex: '0 0 52%',
      padding: '40px 40px 40px 48px',
      borderRight: '1px solid #DEDAD0',
      overflowY: 'auto'
    }
  }, React.createElement('div', {
    style: {
      marginBottom: 24
    }
  }, React.createElement('div', {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: '11px',
      color: 'var(--text-tertiary)',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      marginBottom: 6
    }
  }, 'Task 2 · 287 words · 14 Jun 2026'), React.createElement('h2', {
    style: {
      fontFamily: 'var(--font-serif)',
      fontSize: '20px',
      fontWeight: 500,
      letterSpacing: '-0.01em',
      color: 'var(--text-primary)'
    }
  }, essay.title)), React.createElement('div', {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: '15px',
      lineHeight: '1.75',
      color: 'var(--text-primary)',
      whiteSpace: 'pre-wrap'
    }
  }, SAMPLE_ESSAY), React.createElement('div', {
    style: {
      marginTop: 24,
      padding: '14px 16px',
      background: '#F7F1E6',
      borderRadius: '8px',
      border: '1px solid #E2C9BF'
    }
  }, React.createElement('div', {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: '12px',
      fontWeight: 500,
      color: '#7A3D1A',
      marginBottom: 4
    }
  }, 'Annotation preview'), React.createElement('div', {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: '13px',
      color: '#5C2F10'
    }
  }, '"rapidly changing world" — Overused collocation. Try "an era of rapid change".'))),
  // Score panel
  React.createElement('div', {
    style: {
      flex: 1,
      padding: '40px 36px',
      overflowY: 'auto',
      background: '#FAF9F5'
    }
  }, React.createElement('div', {
    style: {
      display: 'flex',
      gap: 20,
      alignItems: 'center',
      marginBottom: 36,
      paddingBottom: 24,
      borderBottom: '1px solid #DEDAD0'
    }
  }, React.createElement(MiniRing, {
    score: essay.overall,
    label: 'Overall',
    size: 88
  }), React.createElement('div', null, React.createElement('div', {
    style: {
      fontFamily: 'var(--font-serif)',
      fontSize: '22px',
      fontWeight: 500,
      color: 'var(--text-primary)',
      letterSpacing: '-0.01em'
    }
  }, `Band ${essay.overall.toFixed(1)}`), React.createElement('div', {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: '13px',
      color: 'var(--text-secondary)',
      marginTop: 3,
      lineHeight: 1.5
    }
  }, 'Good range of vocabulary.\nArguments clear, evidence could be stronger.'))), React.createElement('div', {
    style: {
      display: 'flex',
      gap: 12,
      marginBottom: 32
    }
  }, Object.entries(criteriaDetail).map(([key, c]) => React.createElement(MiniRing, {
    key,
    score: c.score,
    label: key,
    size: 58
  }))), React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, Object.entries(criteriaDetail).map(([key, c]) => React.createElement('div', {
    key,
    style: {
      border: '1px solid #DEDAD0',
      borderRadius: '8px',
      overflow: 'hidden',
      background: '#FFFFFF'
    }
  }, React.createElement('button', {
    onClick: () => setOpenSection(openSection === key ? null : key),
    style: {
      width: '100%',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 16px',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontFamily: 'var(--font-sans)',
      fontSize: '13px',
      fontWeight: 500,
      color: 'var(--text-primary)'
    }
  }, React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, React.createElement(Tag, {
    criterion: key
  }), React.createElement('span', null, c.label)), React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, React.createElement(ScoreBadge, {
    score: c.score
  }), React.createElement('span', {
    style: {
      color: 'var(--text-tertiary)',
      fontSize: '12px'
    }
  }, openSection === key ? '▲' : '▼'))), openSection === key && React.createElement('div', {
    style: {
      padding: '0 16px 16px',
      borderTop: '1px solid #F2F0E9'
    }
  }, React.createElement('p', {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: '13px',
      color: 'var(--text-secondary)',
      lineHeight: 1.6,
      margin: '12px 0 12px'
    }
  }, c.summary), React.createElement('ul', {
    style: {
      margin: 0,
      paddingLeft: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, c.suggestions.map((s, i) => React.createElement('li', {
    key: i,
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: '13px',
      color: 'var(--text-primary)',
      lineHeight: 1.5
    }
  }, s)))))))));
}
Object.assign(window, {
  Sidebar,
  DashboardView,
  SubmitView,
  FeedbackView
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/webapp/views.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Textarea = __ds_scope.Textarea;

__ds_ns.ScoreRing = __ds_scope.ScoreRing;

__ds_ns.Tag = __ds_scope.Tag;

})();
