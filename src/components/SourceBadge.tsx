// src/components/SourceBadge.tsx
import type { SourceSlug } from '@/types';

const SOURCE_LABELS: Record<SourceSlug, string> = {
  'economist':      'The Economist',
  'new-yorker':     'The New Yorker',
  'new-scientist':  'New Scientist',
};

export default function SourceBadge({ source }: { source: SourceSlug }) {
  return (
    <span className={`source-badge ${source}`} aria-label={`Source: ${SOURCE_LABELS[source]}`}>
      {SOURCE_LABELS[source]}
    </span>
  );
}
