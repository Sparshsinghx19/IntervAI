'use client';

import { useRef, useState } from 'react';
import { FileText, Loader2, RotateCcw, ShieldCheck, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseResumeFile, parseResumeText, ResumeProfile } from '@/lib/adaptive-setup';

type Source = 'upload' | 'paste';

/**
 * Collects a resume (PDF/DOCX upload or pasted text), has the server extract
 * a profile, and shows that profile for the candidate to review.
 */
export function ResumeInput({
  profile,
  onProfile,
}: {
  profile: ResumeProfile | null;
  onProfile: (profile: ResumeProfile | null) => void;
}) {
  const [source, setSource] = useState<Source>('upload');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const analyse = async (run: () => Promise<{ ok: true; profile: ResumeProfile } | { ok: false; error: string }>) => {
    setBusy(true);
    setError('');
    const result = await run();
    setBusy(false);
    if (result.ok) onProfile(result.profile);
    else setError(result.error);
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    void analyse(() => parseResumeFile(file));
  };

  if (profile) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 sm:p-5" aria-live="polite">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Resume analysed</p>
            {profile.headline && <p className="mt-0.5 truncate text-xs text-slate-400">{profile.headline}</p>}
          </div>
          <button
            type="button"
            onClick={() => { onProfile(null); setFileName(''); setText(''); }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Replace
          </button>
        </div>

        {profile.skills.length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Skills</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {profile.skills.slice(0, 16).map((skill) => (
                <li key={skill} className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-slate-200">{skill}</li>
              ))}
            </ul>
          </div>
        )}

        {(profile.projects.length > 0 || profile.experience.length > 0) && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {profile.projects.length > 0 && (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Projects</p>
                <ul className="mt-1.5 space-y-1 text-sm text-slate-200">
                  {profile.projects.map((p) => <li key={p.name} className="truncate">{p.name}</li>)}
                </ul>
              </div>
            )}
            {profile.experience.length > 0 && (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Roles</p>
                <ul className="mt-1.5 space-y-1 text-sm text-slate-200">
                  {profile.experience.map((e, i) => <li key={`${e.title}-${i}`} className="truncate">{e.title}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        <p className="mt-4 flex items-start gap-1.5 text-xs text-slate-400">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" aria-hidden="true" />
          Your file and full text aren&apos;t stored. Only the skills, projects and roles above are kept with this interview to plan questions.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
      <div role="tablist" aria-label="How to add your resume" className="inline-flex rounded-lg border border-white/10 bg-black/20 p-0.5 text-xs">
        {(['upload', 'paste'] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={source === s}
            onClick={() => { setSource(s); setError(''); }}
            className={cn(
              'rounded-md px-3 py-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
              source === s ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
            )}
          >
            {s === 'upload' ? 'Upload file' : 'Paste text'}
          </button>
        ))}
      </div>

      {source === 'upload' ? (
        <div className="mt-3">
          <input
            ref={fileRef}
            id="resume-file"
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            onChange={(e) => onFile(e.target.files?.[0])}
            disabled={busy}
          />
          <label
            htmlFor="resume-file"
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 px-4 py-6 text-center transition-colors hover:border-brand-400/40 hover:bg-white/[0.02]',
              busy && 'cursor-progress opacity-70'
            )}
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin text-brand-300 motion-reduce:animate-none" aria-hidden="true" /> : <Upload className="h-5 w-5 text-brand-300" aria-hidden="true" />}
            <span className="text-sm text-slate-200">{busy ? `Analysing ${fileName || 'resume'}…` : 'Choose a PDF or Word (.docx) file'}</span>
            <span className="text-xs text-slate-400">Up to 2 MB</span>
          </label>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <label htmlFor="resume-text" className="sr-only">Resume text</label>
          <textarea
            id="resume-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            maxLength={30000}
            placeholder="Paste your resume here (projects, skills and experience)…"
            className="w-full resize-y rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            disabled={busy}
          />
          <button
            type="button"
            onClick={() => analyse(() => parseResumeText(text))}
            disabled={busy || text.trim().length === 0}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-white px-3.5 text-sm font-medium text-obsidian hover:bg-brand-100 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <FileText className="h-4 w-4" aria-hidden="true" />}
            {busy ? 'Analysing…' : 'Analyse resume'}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-xs text-rose-300">{error}</p>
      )}
    </div>
  );
}
