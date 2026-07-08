export interface TagProps {
  children?: React.ReactNode;
  /**
   * When set to an IELTS criterion code, renders with that criterion's
   * branded colour. Omit for a neutral topic tag.
   */
  criterion?: 'TA' | 'CC' | 'LR' | 'GRA';
  style?: React.CSSProperties;
}

export declare function Tag(props: TagProps): JSX.Element;
