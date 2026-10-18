import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface QuestionSource {
  id: string;
  title: string;
  url: string;
  domain: string;
  retrievedAt?: string;
}

/** Only absolute http(s) links are rendered; anything else is dropped. */
export function safeSourceLinks(sources: unknown): QuestionSource[] {
  if (!Array.isArray(sources)) return [];
  return sources
    .filter((s): s is QuestionSource => !!s && typeof s.url === 'string' && typeof s.title === 'string')
    .filter((s) => {
      try {
        const url = new URL(s.url);
        return url.protocol === 'https:' || url.protocol === 'http:';
      } catch {
        return false;
      }
    })
    .slice(0, 3);
}

/**
 * Collapsed list of the web sources that informed a question. Rendered only
 * when the question has real, stored provenance.
 */
export function SourcesDisclosure({ sources, className }: { sources: unknown; className?: string }) {
  const links = safeSourceLinks(sources);
  if (links.length === 0) return null;

  return (
    <details className={cn('group rounded-lg border border-white/10 bg-white/[0.02] text-xs', className)}>
      <summary className="cursor-pointer select-none list-none px-3 py-2 text-slate-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded-lg [&::-webkit-details-marker]:hidden">
        <span className="font-medium">Sources</span>
        <span className="text-slate-500"> · {links.length} · informed by web research</span>
      </summary>
      <ul className="space-y-1.5 border-t border-white/10 px-3 py-2">
        {links.map((s) => (
          <li key={s.id || s.url} className="min-w-0">
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex max-w-full items-center gap-1.5 text-cyan-200 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded"
            >
              <span className="truncate">{s.title}</span>
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
            <span className="ml-1.5 text-slate-500">{s.domain}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
