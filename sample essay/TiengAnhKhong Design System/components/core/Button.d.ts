/**
 * @startingPoint section="Components" subtitle="Primary action button — three variants, three sizes" viewport="700x120"
 */
export interface ButtonProps {
  /** Button label */
  children: React.ReactNode;
  /** Visual treatment */
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  /** Height tier */
  size?: 'sm' | 'md' | 'lg';
  /** Prevents interaction and dims opacity */
  disabled?: boolean;
  /** Shows spinner; disables click */
  loading?: boolean;
  /** Optional icon element */
  icon?: React.ReactNode;
  /** Icon placement */
  iconPosition?: 'left' | 'right';
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  style?: React.CSSProperties;
}

export declare function Button(props: ButtonProps): JSX.Element;
