import {
  AlertTriangle, CircleDashed, Navigation, Zap, CheckCircle2, XCircle, Clock,
} from 'lucide-react';

export const STATUS: Record<string, { bg: string; color: string; Icon: any; label: string }> = {
  pending:    { bg: '#fff4ee', color: '#e68f38', Icon: AlertTriangle, label: 'Pending' },
  inProgress: { bg: '#e5f3fe', color: '#008dff', Icon: CircleDashed,  label: 'In progress' },
  submitted:  { bg: '#e5f3fe', color: '#3b82f6', Icon: Navigation,    label: 'Submitted' },
  inReview:   { bg: '#fcf4db', color: '#e6961f', Icon: Zap,           label: 'In review' },
  success:    { bg: '#e1fae8', color: '#37c25c', Icon: CheckCircle2,  label: 'Success' },
  failed:     { bg: '#fdefee', color: '#ec6a5b', Icon: XCircle,       label: 'Failed' },
  expired:    { bg: '#f1f1f1', color: '#787878', Icon: Clock,         label: 'Expired' },
};

export function StatusBadge({ kind, size = 'sm' }: { kind: string; size?: 'sm' | 'md' }) {
  const s = STATUS[kind] ?? STATUS['inProgress'];
  const Icon = s.Icon;
  const pad = size === 'md'
    ? 'pl-3.5 pr-4 py-2 text-[14px] rounded-2xl gap-2'
    : 'pl-2.5 pr-3 py-1.5 text-[12px] rounded-xl gap-1.5';
  const iconSize = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';
  return (
    <span className={`inline-flex items-center ${pad}`} style={{ background: s.bg, color: s.color }}>
      <Icon className={iconSize} strokeWidth={2.2} />
      {s.label}
    </span>
  );
}
