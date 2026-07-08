export interface CardProps {
  children: React.ReactNode;
  /** `default` — white with border; `flat` — sunken grey; `outline` — transparent with border */
  variant?: 'default' | 'flat' | 'outline';
  /** Padding preset */
  padding?: 'sm' | 'md' | 'lg';
  /** Makes card clickable with hover state */
  onClick?: () => void;
  style?: React.CSSProperties;
}

export declare function Card(props: CardProps): JSX.Element;
