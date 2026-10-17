'use client';

import { Check, Play, Send } from 'lucide-react';
import { Eyebrow, Heading, Lede, PreviewFrame, Reveal, SampleTag, Section } from './primitives';

// Token kinds map to the editor palette used in the real workspace (dark Monaco theme).
type Tok = [string, 'kw' | 'fn' | 'lit' | 'cm' | 'tx'];
const TONE: Record<Tok[1], string> = {
  kw: 'text-brand-300',
  fn: 'text-cyan-300',
  lit: 'text-amber-300',
  cm: 'text-slate-500',
  tx: 'text-slate-300',
};

const CODE: Tok[][] = [
  [['class ', 'kw'], ['Solution', 'fn'], [':', 'tx']],
  [['    def ', 'kw'], ['isPalindrome', 'fn'], ['(self, s: str) -> bool:', 'tx']],
  [['        left, right = ', 'tx'], ['0', 'lit'], [', len(s) - ', 'tx'], ['1', 'lit']],
  [['        while ', 'kw'], ['left < right:', 'tx']],
  [['            if not ', 'kw'], ['s[left].isalnum():', 'tx']],
  [['                left += ', 'tx'], ['1', 'lit']],
  [['            elif not ', 'kw'], ['s[right].isalnum():', 'tx']],
  [['                right -= ', 'tx'], ['1', 'lit']],
  [['            elif ', 'kw'], ['s[left].lower() != s[right].lower():', 'tx']],
  [['                return ', 'kw'], ['False', 'lit']],
  [['            else', 'kw'], [':', 'tx']],
  [['                left, right = left + ', 'tx'], ['1', 'lit'], [', right - ', 'tx'], ['1', 'lit']],
  [['        return ', 'kw'], ['True', 'lit']],
];

// The three public examples shipped with this problem in the catalog.
const SAMPLES = [
  { input: '"A man, a plan, a canal: Panama"', expected: 'true' },
  { input: '"race a car"', expected: 'false' },
  { input: '" "', expected: 'true' },
];

const SPECS = [
  { title: 'Monaco editor', body: 'The editor from VS Code, with starter code for C++, Python and Java.' },
  { title: 'Run against the samples', body: 'Run Code checks your solution on the public examples and shows input, expected and actual output.' },
  { title: 'Submit for the full suite', body: 'Submit Solution also runs hidden test cases and records the result with your interview.' },
  { title: 'Isolated execution', body: 'Code runs in a Judge0 sandbox. Drafts are kept per language while you switch.' },
];

export function CodingShowcase() {
  return (
    <Section id="coding" className="border-t border-white/[0.05]">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-40 h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-cyan-500/[0.06] blur-[120px]" />

      <div className="relative grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <Reveal>
          <Eyebrow index="02">Coding workspace</Eyebrow>
          <Heading>Write the code, not a description of it.</Heading>
          <Lede>
            Data structures and algorithms sessions come with real problems — Valid Palindrome, Reverse Linked List,
            Coin Change and others — each with a statement, constraints and worked examples beside the editor.
          </Lede>
        </Reveal>

        <Reveal delay={0.1}>
          <dl className="grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:pt-12">
            {SPECS.map((spec) => (
              <div key={spec.title} className="border-l border-white/10 pl-4">
                <dt className="text-[15px] font-medium text-white">{spec.title}</dt>
                <dd className="mt-1.5 text-[14px] leading-relaxed text-slate-400">{spec.body}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>

      <Reveal className="relative mt-14" delay={0.15}>
        <PreviewFrame label="intervai / interview / session · coding workspace" tag={<SampleTag>Preview</SampleTag>}>
          <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.25fr)_minmax(0,0.9fr)]">
            {/* Problem */}
            <div className="border-b border-white/[0.07] p-5 lg:border-b-0 lg:border-r">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[15px] font-medium text-white">Valid Palindrome</h3>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-300">EASY</span>
              </div>
              <p className="mt-1 font-mono text-[11px] text-slate-500">Strings · Two Pointers</p>
              <p className="mt-4 text-[13.5px] leading-relaxed text-slate-400">
                A phrase is a palindrome if, after lowercasing and removing non-alphanumeric characters, it reads the
                same forward and backward. Given a string <code className="font-mono text-slate-200">s</code>, return{' '}
                <code className="font-mono text-slate-200">true</code> if it is a palindrome.
              </p>
              <div className="mt-4 rounded-lg border border-white/[0.07] bg-black/30 p-3 font-mono text-[12px] leading-5">
                <p className="text-slate-500">Example 1</p>
                <p className="text-slate-300">Input: s = &quot;A man, a plan, a canal: Panama&quot;</p>
                <p className="text-slate-300">Output: true</p>
              </div>
              <p className="mt-4 font-mono text-[11px] text-slate-500">1 ≤ s.length ≤ 2 · 10⁵</p>
            </div>

            {/* Editor */}
            <div className="border-b border-white/[0.07] lg:border-b-0 lg:border-r">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2">
                <span className="rounded-md border border-white/10 px-2 py-1 text-[12px] text-slate-300">Python</span>
                <span className="font-mono text-[11px] text-slate-500">Draft saved (Python)</span>
              </div>
              <pre className="overflow-x-auto py-3 font-mono text-[12.5px] leading-6">
                <code>
                  {CODE.map((line, i) => (
                    <span key={i} className="flex">
                      <span className="w-10 shrink-0 select-none pr-4 text-right text-slate-600">{i + 1}</span>
                      <span className="whitespace-pre">
                        {line.map(([text, kind], j) => (
                          <span key={j} className={TONE[kind]}>
                            {text}
                          </span>
                        ))}
                      </span>
                    </span>
                  ))}
                </code>
              </pre>
              <div className="flex flex-wrap gap-2 border-t border-white/[0.06] px-4 py-3">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[12px] text-slate-200">
                  <Play aria-hidden className="h-3 w-3" /> Run Code
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-[12px] text-white">
                  <Send aria-hidden className="h-3 w-3" /> Submit Solution
                </span>
              </div>
            </div>

            {/* Results */}
            <div className="p-5">
              <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/[0.06] px-3 py-2.5">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-300/80">Sample verification</p>
                <p className="mt-1 text-[14px] font-medium text-white">3 / 3 sample tests passed</p>
              </div>
              <ul className="mt-4 space-y-2.5">
                {SAMPLES.map((sample, i) => (
                  <li key={i} className="rounded-lg border border-white/[0.07] bg-black/25 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[12.5px] font-medium text-white">Sample #{i + 1}</span>
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] text-cyan-300">
                        <Check aria-hidden className="h-3 w-3" /> PASSED
                      </span>
                    </div>
                    <p className="mt-1.5 truncate font-mono text-[11px] text-slate-500">in&nbsp; {sample.input}</p>
                    <p className="font-mono text-[11px] text-slate-500">
                      out <span className="text-slate-300">{sample.expected}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </PreviewFrame>

        <p className="mt-5 max-w-3xl text-[13px] leading-relaxed text-slate-500">
          <span className="text-slate-300">Language support today:</span> C++ and Python run live. Java has starter
          code and saved drafts, but running it needs a Linux runner that this deployment doesn&apos;t have yet.
        </p>
      </Reveal>
    </Section>
  );
}
