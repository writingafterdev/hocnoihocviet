export interface BadgeProps {
  children: React.ReactNode;
  /**
   * `default` — muted grey; `outline` — bordered; `score` — black on cream;
   * `high/mid/low` — semantic score colours
   */
  variant?: 'default' | 'outline' | 'score' | 'high' | 'mid' | 'low';
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}

export declare function Badge(props: BadgeProps): JSX.Element;
