export interface InputProps {
  label?: string;
  id?: string;
  type?: 'text' | 'email' | 'password' | 'search' | 'url';
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  error?: string;
  hint?: string;
  style?: React.CSSProperties;
}

export interface TextareaProps {
  label?: string;
  id?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  disabled?: boolean;
  error?: string;
  hint?: string;
  rows?: number;
  /** Live word count displayed beside label */
  wordCount?: number;
  style?: React.CSSProperties;
}

export declare function Input(props: InputProps): JSX.Element;
export declare function Textarea(props: TextareaProps): JSX.Element;
