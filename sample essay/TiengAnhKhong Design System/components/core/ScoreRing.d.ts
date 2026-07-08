export interface ScoreRingProps {
  /** IELTS band score (0–9, supports 0.5 steps) */
  score: number;
  /** Label rendered below the ring */
  label?: string;
  /** Ring diameter in px */
  size?: number;
  /** Ring stroke width in px */
  strokeWidth?: number;
  style?: React.CSSProperties;
}

export declare function ScoreRing(props: ScoreRingProps): JSX.Element;
