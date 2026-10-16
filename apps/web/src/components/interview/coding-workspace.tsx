import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Editor } from '@monaco-editor/react';
import {
  Play,
  Send,
  RefreshCcw,
  Terminal,
  Code2,
  Beaker,
  CheckCircle,
  ChevronDown,
  AlertCircle,
  FileText,
  Info,
  Columns,
  Maximize2,
  BookOpen,
  RotateCcw,
  Rows,
  Layout,
  Move,
  Loader2,
  XCircle,
  Clock,
  Cpu,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  fetchCodingProblem,
  runCode,
  submitCode,
  PublicCodingProblem,
  RunCodeResponse,
  SubmitCodeResponse
} from '@/lib/coding-api';

export type Language = 'cpp' | 'python' | 'java';

export const LANGUAGE_LABELS: Record<Language, string> = {
  cpp: 'C++',
  python: 'Python',
  java: 'Java'
};

export const TEMPLATES: Record<Language, string> = {
  cpp: `class Solution {
public:
    // Write your solution here
};`,
  python: `class Solution:
    # Write your solution here
    pass
`,
  java: `class Solution {
    // Write your solution here
}
`
};

// Languages currently supported by the sandboxed execution backend on this host
export const SUPPORTED_EXECUTION_LANGUAGES: readonly Language[] = ['cpp', 'python'];

export type ArrangementType = 'default' | 'editor-focus' | 'problem-focus' | 'stacked';

export interface WorkspaceLayoutState {
  arrangement: ArrangementType;
  splitX: number; // For side-by-side: width % of left problem pane (25 - 65)
  splitY: number; // For side-by-side: height % of editor (30 - 80). For stacked: height % of top problem (25 - 65)
  stackedSplitX: number; // For stacked: width % of bottom-left editor (40 - 75)
}

const DEFAULT_LAYOUT: WorkspaceLayoutState = {
  arrangement: 'default',
  splitX: 40,
  splitY: 65,
  stackedSplitX: 62
};

const ARRANGEMENT_DEFAULTS: Record<ArrangementType, { splitX: number; splitY: number; stackedSplitX: number }> = {
  default: { splitX: 40, splitY: 65, stackedSplitX: 62 },
  'editor-focus': { splitX: 25, splitY: 75, stackedSplitX: 72 },
  'problem-focus': { splitX: 55, splitY: 60, stackedSplitX: 52 },
  stacked: { splitX: 40, splitY: 38, stackedSplitX: 62 }
};

const MIN_SPLIT_X = 25;
const MAX_SPLIT_X = 65;
const MIN_SPLIT_Y = 30;
const MAX_SPLIT_Y = 80;
const MIN_STACKED_SPLIT_X = 35;
const MAX_STACKED_SPLIT_X = 75;

const STORAGE_KEY = 'intervai_coding_workspace_layout_v2';

function loadSavedLayout(): WorkspaceLayoutState {
  if (typeof window === 'undefined') return DEFAULT_LAYOUT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_LAYOUT;

    const arrangement = parsed.arrangement as ArrangementType;
    const splitX = Number(parsed.splitX);
    const splitY = Number(parsed.splitY);
    const stackedSplitX = Number(parsed.stackedSplitX);

    if (
      ['default', 'editor-focus', 'problem-focus', 'stacked'].includes(arrangement) &&
      Number.isFinite(splitX) && splitX >= MIN_SPLIT_X && splitX <= MAX_SPLIT_X &&
      Number.isFinite(splitY) && splitY >= MIN_SPLIT_Y && splitY <= MAX_SPLIT_Y &&
      Number.isFinite(stackedSplitX) && stackedSplitX >= MIN_STACKED_SPLIT_X && stackedSplitX <= MAX_STACKED_SPLIT_X
    ) {
      return { arrangement, splitX, splitY, stackedSplitX };
    }
  } catch (err) {
    console.warn('Failed to load coding workspace layout from localStorage:', err);
  }
  return DEFAULT_LAYOUT;
}

function saveLayout(layout: WorkspaceLayoutState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch (err) {
    console.warn('Failed to save coding workspace layout to localStorage:', err);
  }
}

interface CodingWorkspaceProps {
  interviewId?: string;
  question: {
    id?: string | number;
    questionText?: string;
    difficulty?: string;
    focusArea?: string;
    codingProblemSlug?: string;
    examples?: Array<{
      input: string;
      output: string;
      explanation?: string;
    }>;
    constraints?: string[];
    [key: string]: unknown;
  };
  interviewDifficulty?: string;
  interviewFocusArea?: string;
  onSubmit?: (code: string, language: string) => void;
  onSubmitSuccess?: (submission: SubmitCodeResponse) => void;
  isSubmitting?: boolean;
  questionNumber?: number;
  totalQuestions?: number;
}

type PanelTab = 'testcases' | 'output' | 'results';
type MobileView = 'problem' | 'code';

export function CodingWorkspace({
  interviewId,
  question,
  interviewDifficulty,
  interviewFocusArea,
  onSubmit,
  onSubmitSuccess,
  isSubmitting: externalSubmitting = false,
  questionNumber,
  totalQuestions
}: CodingWorkspaceProps) {
  // Language & Drafts State
  const [language, setLanguage] = useState<Language>('cpp');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [stdin, setStdin] = useState<string>('');
  const [activeTab, setActiveTab] = useState<PanelTab>('testcases');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>('problem');

  // Live Execution & Problem State
  const [problemData, setProblemData] = useState<PublicCodingProblem | null>(null);
  const [isProblemLoading, setIsProblemLoading] = useState(false);
  const [problemError, setProblemError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);
  const [runResult, setRunResult] = useState<RunCodeResponse | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitCodeResponse | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  // Fetch coding problem metadata when question or interview changes
  useEffect(() => {
    if (!interviewId || !question?.id) return;
    let isCancelled = false;

    const loadProblem = async () => {
      setIsProblemLoading(true);
      setProblemError(null);
      const res = await fetchCodingProblem({
        interviewId,
        questionId: String(question.id),
      });
      if (isCancelled) return;
      setIsProblemLoading(false);
      if (res.supported && res.problem) {
        setProblemData(res.problem);
      } else {
        setProblemError(res.error || 'Coding metadata is not available for this problem.');
      }
    };

    loadProblem();
    return () => {
      isCancelled = true;
    };
  }, [interviewId, question?.id]);

  // Layout & Resizing State
  const [layout, setLayout] = useState<WorkspaceLayoutState>(DEFAULT_LAYOUT);
  const [isDraggingSplitter, setIsDraggingSplitter] = useState<'vert' | 'horiz' | 'stacked-vert' | null>(null);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);

  // Panel Rearrangement Dragging State
  const [isDraggingPanelHeader, setIsDraggingPanelHeader] = useState(false);
  const [activeSnapTarget, setActiveSnapTarget] = useState<ArrangementType | null>(null);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const rightContainerRef = useRef<HTMLDivElement>(null);
  const layoutMenuRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const activeSplitterRef = useRef<'vert' | 'horiz' | 'stacked-vert' | null>(null);
  const activePointerIdRef = useRef<number | null>(null);

  // Hydration-safe localStorage restore
  useEffect(() => {
    const timer = setTimeout(() => {
      const saved = loadSavedLayout();
      setLayout(saved);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Close Layout Menu on Click Outside
  useEffect(() => {
    if (!showLayoutMenu) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (layoutMenuRef.current && !layoutMenuRef.current.contains(e.target as Node)) {
        setShowLayoutMenu(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [showLayoutMenu]);

  const currentDraftKey = `${question?.id ?? 'default'}-${language}`;
  const starterCodeForLang = (problemData?.starterCode?.[language]) || TEMPLATES[language];
  const currentCode = drafts[currentDraftKey] ?? starterCodeForLang;
  const isExecutionSupported = SUPPORTED_EXECUTION_LANGUAGES.includes(language);

  // Execution actions
  const handleRunCode = async () => {
    if (isRunning || isSubmittingCode || !interviewId || !question?.id) return;
    setIsRunning(true);
    setExecutionError(null);
    setActiveTab('output');

    const res = await runCode({
      interviewId,
      questionId: String(question.id),
      language,
      sourceCode: currentCode,
    });

    setIsRunning(false);
    if (res.result) {
      setRunResult(res.result);
      setActiveTab('results');
    } else {
      setExecutionError(res.error || 'Execution failed.');
      setActiveTab('output');
    }
  };

  const handleSubmitSolution = async () => {
    if (isRunning || isSubmittingCode || !interviewId || !question?.id) return;
    if (!problemData?.hasHiddenTests) return;

    setIsSubmittingCode(true);
    setExecutionError(null);
    setActiveTab('output');

    const res = await submitCode({
      interviewId,
      questionId: String(question.id),
      language,
      sourceCode: currentCode,
    });

    setIsSubmittingCode(false);
    if (res.result) {
      setSubmitResult(res.result);
      setActiveTab('results');
      onSubmitSuccess?.(res.result);
      if (onSubmit) {
        onSubmit(currentCode, language);
      }
    } else {
      setExecutionError(res.error || 'Submission failed.');
      setActiveTab('output');
    }
  };

  // Difficulty badge resolver
  const activeDifficulty = (
    problemData?.difficulty || question?.difficulty || interviewDifficulty || 'MEDIUM'
  ).toUpperCase();

  const getDifficultyBadge = (diff: string) => {
    switch (diff) {
      case 'EASY':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'HARD':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      default:
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    }
  };

  const handleLanguageChange = (newLanguage: Language) => {
    setLanguage(newLanguage);
    setShowResetConfirm(false);
  };

  const handleCodeChange = (value: string | undefined) => {
    const newCode = value ?? '';
    setDrafts(prev => ({
      ...prev,
      [currentDraftKey]: newCode
    }));
  };

  const handleReset = () => {
    if (currentCode !== starterCodeForLang) {
      setShowResetConfirm(true);
    } else {
      setDrafts(prev => ({
        ...prev,
        [currentDraftKey]: starterCodeForLang
      }));
    }
  };

  const confirmReset = () => {
    setDrafts(prev => ({
      ...prev,
      [currentDraftKey]: starterCodeForLang
    }));
    setShowResetConfirm(false);
  };

  // Layout arrangement actions
  const applyArrangement = (arr: ArrangementType) => {
    const defaults = ARRANGEMENT_DEFAULTS[arr];
    const newLayout: WorkspaceLayoutState = {
      arrangement: arr,
      splitX: defaults.splitX,
      splitY: defaults.splitY,
      stackedSplitX: defaults.stackedSplitX
    };
    setLayout(newLayout);
    saveLayout(newLayout);
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
  };

  const handleResetProportions = () => {
    applyArrangement(layout.arrangement);
  };

  const handleSplitterKeyDown = (type: 'vert' | 'horiz' | 'stacked-vert', e: React.KeyboardEvent) => {
    const STEP = 2;
    if (type === 'vert') {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setLayout(prev => {
          const next = { ...prev, splitX: Math.max(MIN_SPLIT_X, prev.splitX - STEP) };
          saveLayout(next);
          return next;
        });
        window.dispatchEvent(new Event('resize'));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setLayout(prev => {
          const next = { ...prev, splitX: Math.min(MAX_SPLIT_X, prev.splitX + STEP) };
          saveLayout(next);
          return next;
        });
        window.dispatchEvent(new Event('resize'));
      }
    } else if (type === 'horiz') {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setLayout(prev => {
          const next = { ...prev, splitY: Math.max(MIN_SPLIT_Y, prev.splitY - STEP) };
          saveLayout(next);
          return next;
        });
        window.dispatchEvent(new Event('resize'));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setLayout(prev => {
          const next = { ...prev, splitY: Math.min(MAX_SPLIT_Y, prev.splitY + STEP) };
          saveLayout(next);
          return next;
        });
        window.dispatchEvent(new Event('resize'));
      }
    } else if (type === 'stacked-vert') {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setLayout(prev => {
          const next = { ...prev, stackedSplitX: Math.max(MIN_STACKED_SPLIT_X, prev.stackedSplitX - STEP) };
          saveLayout(next);
          return next;
        });
        window.dispatchEvent(new Event('resize'));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setLayout(prev => {
          const next = { ...prev, stackedSplitX: Math.min(MAX_STACKED_SPLIT_X, prev.stackedSplitX + STEP) };
          saveLayout(next);
          return next;
        });
        window.dispatchEvent(new Event('resize'));
      }
    }
  };

  const handleSplitterPointerDown = (type: 'vert' | 'horiz' | 'stacked-vert', e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    activeSplitterRef.current = type;
    activePointerIdRef.current = e.pointerId;
    setIsDraggingSplitter(type);
  };

  // Stable Window-Level Splitter Dragging Mechanics (Capture Phase)
  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      const activeType = activeSplitterRef.current;
      if (!activeType) return;

      if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) {
        return;
      }

      e.preventDefault();

      if (activeType === 'vert') {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width <= 0) return;
        const rawPct = ((e.clientX - rect.left) / rect.width) * 100;
        const clampedPct = Math.min(Math.max(rawPct, MIN_SPLIT_X), MAX_SPLIT_X);
        const nextVal = Math.round(clampedPct * 10) / 10;
        setLayout(prev => {
          if (prev.splitX === nextVal) return prev;
          return { ...prev, splitX: nextVal };
        });
      } else if (activeType === 'horiz') {
        if (!rightContainerRef.current) return;
        const rightRect = rightContainerRef.current.getBoundingClientRect();
        if (rightRect.height <= 0) return;
        const rawPct = ((e.clientY - rightRect.top) / rightRect.height) * 100;
        const clampedPct = Math.min(Math.max(rawPct, MIN_SPLIT_Y), MAX_SPLIT_Y);
        const nextVal = Math.round(clampedPct * 10) / 10;
        setLayout(prev => {
          if (prev.splitY === nextVal) return prev;
          return { ...prev, splitY: nextVal };
        });
      } else if (activeType === 'stacked-vert') {
        if (!rightContainerRef.current) return;
        const rightRect = rightContainerRef.current.getBoundingClientRect();
        if (rightRect.width <= 0) return;
        const rawPct = ((e.clientX - rightRect.left) / rightRect.width) * 100;
        const clampedPct = Math.min(Math.max(rawPct, MIN_STACKED_SPLIT_X), MAX_STACKED_SPLIT_X);
        const nextVal = Math.round(clampedPct * 10) / 10;
        setLayout(prev => {
          if (prev.stackedSplitX === nextVal) return prev;
          return { ...prev, stackedSplitX: nextVal };
        });
      }
    };

    const handleGlobalPointerUp = () => {
      if (!activeSplitterRef.current) return;
      activeSplitterRef.current = null;
      activePointerIdRef.current = null;
      setIsDraggingSplitter(null);
      setLayout(current => {
        saveLayout(current);
        return current;
      });
      window.dispatchEvent(new Event('resize'));
    };

    window.addEventListener('pointermove', handleGlobalPointerMove, { capture: true, passive: false });
    window.addEventListener('pointerup', handleGlobalPointerUp, { capture: true });
    window.addEventListener('pointercancel', handleGlobalPointerUp, { capture: true });
    window.addEventListener('blur', handleGlobalPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove, { capture: true });
      window.removeEventListener('pointerup', handleGlobalPointerUp, { capture: true });
      window.removeEventListener('pointercancel', handleGlobalPointerUp, { capture: true });
      window.removeEventListener('blur', handleGlobalPointerUp);
    };
  }, []);

  // Synchronize document cursor and text selection during drag
  useEffect(() => {
    if (!isDraggingSplitter) return;
    const prevUserSelect = document.body.style.userSelect;
    const prevCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = isDraggingSplitter === 'horiz' ? 'row-resize' : 'col-resize';
    return () => {
      document.body.style.userSelect = prevUserSelect;
      document.body.style.cursor = prevCursor;
    };
  }, [isDraggingSplitter]);

  // Panel Rearrangement Dragging Mechanics (Snap Targets)
  const handlePanelHeaderPointerDown = (e: React.PointerEvent) => {
    dragStartPos.current = { x: e.clientX, y: e.clientY };

    const handlePointerMove = (moveEv: PointerEvent) => {
      if (!dragStartPos.current) return;
      const dx = Math.abs(moveEv.clientX - dragStartPos.current.x);
      const dy = Math.abs(moveEv.clientY - dragStartPos.current.y);

      if (dx > 5 || dy > 5) {
        setIsDraggingPanelHeader(true);
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const relX = (moveEv.clientX - rect.left) / rect.width;
          const relY = (moveEv.clientY - rect.top) / rect.height;

          if (relY < 0.35) {
            setActiveSnapTarget('stacked');
          } else if (relX < 0.28) {
            setActiveSnapTarget('editor-focus');
          } else if (relX > 0.52) {
            setActiveSnapTarget('problem-focus');
          } else {
            setActiveSnapTarget('default');
          }
        }
      }
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      dragStartPos.current = null;

      setActiveSnapTarget(target => {
        if (target) {
          applyArrangement(target);
        }
        return null;
      });
      setIsDraggingPanelHeader(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // -------------------------------------------------------------
  // Sub-renderers: Problem, Editor, Results, Splitters
  // -------------------------------------------------------------

  const renderProblemPane = () => (
    <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden bg-[#0d121d]">
      {/* Pane Header (LeetCode Tab Style) */}
      <div className="h-10 sm:h-11 border-b border-white/10 bg-[#121824] px-3 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/5 border border-white/10 text-xs font-semibold text-slate-200">
            <FileText className="w-3.5 h-3.5 text-brand-400" />
            <span>Description</span>
            {questionNumber && totalQuestions && (
              <span className="text-[11px] text-slate-400 font-mono">({questionNumber}/{totalQuestions})</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Rearrange Drag Handle */}
          <div
            onPointerDown={handlePanelHeaderPointerDown}
            className="hidden sm:flex items-center gap-1 px-1.5 py-1 rounded text-slate-400 hover:text-white hover:bg-white/5 cursor-grab active:cursor-grabbing text-xs transition-colors"
            title="Drag header to rearrange panels"
          >
            <Move className="w-3 h-3 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Pane Content (Independently Scrollable with scrollbar on edge) */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-slate-300 text-sm min-h-0 custom-scrollbar">
        {/* Title & Metadata */}
        <div>
          {isProblemLoading && (
            <div className="flex items-center gap-2 text-xs text-brand-300 pb-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Loading problem details...</span>
            </div>
          )}

          <h2 className="text-lg sm:text-xl font-semibold text-white tracking-tight leading-snug mb-2">
            {problemData?.title || question?.questionText || 'Technical Coding Problem'}
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${getDifficultyBadge(problemData?.difficulty || activeDifficulty)}`}>
              {problemData?.difficulty || activeDifficulty}
            </span>

            <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-white/5 text-slate-400 border border-white/10">
              {problemData?.category || question?.focusArea || interviewFocusArea || 'Algorithms'}
            </span>

            {problemData?.slug && (
              <span className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-cyan-950/40 text-cyan-300 border border-cyan-500/20">
                slug: {problemData.slug}
              </span>
            )}
          </div>
        </div>

        {/* Problem Statement */}
        <div className="text-slate-300 text-sm leading-relaxed space-y-3 font-sans">
          {problemData ? (
            <div className="whitespace-pre-line text-slate-200 bg-black/20 p-3.5 rounded-lg border border-white/5 leading-relaxed font-sans">
              {problemData.description}
            </div>
          ) : (
            <div className="bg-black/30 border border-white/5 rounded-lg p-3.5 text-slate-200 leading-relaxed">
              {question?.questionText}
            </div>
          )}
        </div>

        {/* Examples Section */}
        {problemData?.examples && problemData.examples.length > 0 ? (
          <div className="space-y-3 pt-1">
            <h3 className="text-white font-semibold text-xs tracking-wider uppercase">Public Examples</h3>
            {problemData.examples.map((ex, idx) => (
              <div key={idx} className="bg-black/40 border border-white/10 rounded-lg p-3 space-y-1.5 font-mono text-xs">
                <div className="text-brand-300 font-sans font-semibold text-xs">Example #{idx + 1}:</div>
                <div className="whitespace-pre-wrap"><span className="text-slate-400 font-sans">Input:</span> <span className="text-slate-200">{ex.input}</span></div>
                <div className="whitespace-pre-wrap"><span className="text-slate-400 font-sans">Output:</span> <span className="text-emerald-300">{ex.output}</span></div>
                {ex.explanation && (
                  <div className="text-slate-400 font-sans pt-1 text-[11px] border-t border-white/5">
                    <span className="font-semibold text-slate-300">Explanation:</span> {ex.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : question?.examples && Array.isArray(question.examples) && question.examples.length > 0 ? (
          <div className="space-y-3 pt-1">
            <h3 className="text-white font-semibold text-xs tracking-wider uppercase">Examples</h3>
            {question.examples.map((ex, idx) => (
              <div key={idx} className="bg-black/40 border border-white/10 rounded-lg p-3 space-y-1.5 font-mono text-xs">
                <div className="text-brand-300 font-sans font-semibold text-xs">Example #{idx + 1}:</div>
                <div><span className="text-slate-400 font-sans">Input:</span> <span className="text-slate-200">{ex.input}</span></div>
                <div><span className="text-slate-400 font-sans">Output:</span> <span className="text-slate-200">{ex.output}</span></div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Constraints Section */}
        {problemData?.constraints && problemData.constraints.length > 0 ? (
          <div className="space-y-2 pt-1">
            <h3 className="text-white font-semibold text-xs tracking-wider uppercase">Constraints</h3>
            <ul className="list-disc list-inside text-xs text-slate-400 space-y-1 font-mono">
              {problemData.constraints.map((c, i) => (
                <li key={i}><span className="text-slate-300">{c}</span></li>
              ))}
            </ul>
          </div>
        ) : question?.constraints && Array.isArray(question.constraints) && question.constraints.length > 0 ? (
          <div className="space-y-2 pt-1">
            <h3 className="text-white font-semibold text-xs tracking-wider uppercase">Constraints</h3>
            <ul className="list-disc list-inside text-xs text-slate-400 space-y-1 font-mono">
              {question.constraints.map((c, i) => (
                <li key={i}><span className="text-slate-300">{c}</span></li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Guidance when problem is not mapped */}
        {!problemData && (
          <div className="bg-amber-950/20 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-300 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Runnable Problem Definition Unavailable
            </div>
            <p className="leading-relaxed text-slate-300">
              {problemError || 'This coding question does not have an executable problem definition configured. Code execution and submission are disabled. If this question is theoretical, you can switch to Text Mode.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );

  const renderEditorPane = () => (
    <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden bg-[#1e1e1e]">
      {/* Editor Toolbar (LeetCode Style) */}
      <div className="h-10 sm:h-11 border-b border-white/10 bg-[#121824] px-3 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2.5">
          <Code2 className="w-4 h-4 text-brand-400" />

          {/* Language Selector */}
          <div className="relative group">
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value as Language)}
              className="appearance-none bg-[#1a2130] border border-white/10 rounded text-xs font-medium text-white pl-2.5 pr-6 py-1 cursor-pointer outline-none hover:border-brand-500/50 transition-colors"
              aria-label="Select programming language"
            >
              <option value="cpp" className="bg-obsidian">C++</option>
              <option value="python" className="bg-obsidian">Python</option>
              <option value="java" className="bg-obsidian">Java (Requires Linux Runner)</option>
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-brand-300" />
          </div>

          <span className="hidden md:inline text-[11px] text-slate-500 font-mono">
            Draft saved ({LANGUAGE_LABELS[language]})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Reset Action */}
          <AnimatePresence>
            {showResetConfirm ? (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex items-center gap-1.5 bg-red-950/40 border border-red-500/30 px-2 py-0.5 rounded"
              >
                <span className="text-[11px] text-red-300">Reset code?</span>
                <button
                  type="button"
                  onClick={confirmReset}
                  className="text-[11px] text-white bg-red-500/40 hover:bg-red-500/60 px-1.5 py-0.5 rounded transition-colors font-medium"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="text-[11px] text-slate-300 hover:text-white px-1 py-0.5"
                >
                  No
                </button>
              </motion.div>
            ) : (
              <button
                type="button"
                onClick={handleReset}
                className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors flex items-center gap-1 text-xs"
                title="Reset code to language starter template"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                <span className="hidden xl:inline text-[11px]">Reset</span>
              </button>
            )}
          </AnimatePresence>

          {/* Compact Layout Selector Menu */}
          <div className="relative" ref={layoutMenuRef}>
            <button
              type="button"
              onClick={() => setShowLayoutMenu(!showLayoutMenu)}
              className={`px-2 py-1 rounded text-xs flex items-center gap-1.5 transition-colors border ${
                showLayoutMenu
                  ? 'bg-brand-500/20 border-brand-500/40 text-white'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
              }`}
              title="Change workspace arrangement"
            >
              <Layout className="w-3.5 h-3.5 text-brand-400" />
              <span className="hidden sm:inline font-medium">Layout</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showLayoutMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl bg-[#0e131f] border border-white/10 shadow-2xl p-1.5 z-50 text-xs flex flex-col gap-0.5">
                <div className="px-2.5 py-1 text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                  Workspace Layout
                </div>

                <button
                  type="button"
                  onClick={() => { applyArrangement('default'); setShowLayoutMenu(false); }}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                    layout.arrangement === 'default'
                      ? 'bg-brand-500/20 text-brand-300 font-semibold'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Columns className="w-3.5 h-3.5" />
                    Default Split
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">40/60</span>
                </button>

                <button
                  type="button"
                  onClick={() => { applyArrangement('editor-focus'); setShowLayoutMenu(false); }}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                    layout.arrangement === 'editor-focus'
                      ? 'bg-brand-500/20 text-brand-300 font-semibold'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Maximize2 className="w-3.5 h-3.5" />
                    Editor Focus
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">25/75</span>
                </button>

                <button
                  type="button"
                  onClick={() => { applyArrangement('problem-focus'); setShowLayoutMenu(false); }}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                    layout.arrangement === 'problem-focus'
                      ? 'bg-brand-500/20 text-brand-300 font-semibold'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5" />
                    Problem Focus
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">55/45</span>
                </button>

                <button
                  type="button"
                  onClick={() => { applyArrangement('stacked'); setShowLayoutMenu(false); }}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                    layout.arrangement === 'stacked'
                      ? 'bg-brand-500/20 text-brand-300 font-semibold'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Rows className="w-3.5 h-3.5" />
                    Stacked View
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Top/Bottom</span>
                </button>

                <div className="my-1 border-t border-white/5" />

                <button
                  type="button"
                  onClick={() => { handleResetProportions(); setShowLayoutMenu(false); }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                  <span>Reset Proportions</span>
                </button>
              </div>
            )}
          </div>

          {/* Rearrange Drag Handle */}
          <div
            onPointerDown={handlePanelHeaderPointerDown}
            className="hidden sm:flex items-center gap-1 px-1.5 py-1 rounded text-slate-400 hover:text-white hover:bg-white/5 cursor-grab active:cursor-grabbing text-xs transition-colors"
            title="Drag header to rearrange panels"
          >
            <Move className="w-3 h-3 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Unsupported Language Host Warning Banner */}
      {!isExecutionSupported && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-3 py-1.5 flex items-center justify-between text-xs text-amber-300 shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>{LANGUAGE_LABELS[language]} runner unavailable on this host:</strong> JVM thread isolation requires Linux cgroups v1. Live execution is active for <strong>C++</strong> and <strong>Python</strong>.
            </span>
          </div>
        </div>
      )}

      {/* Monaco Editor Canvas */}
      <div className="flex-1 bg-[#1e1e1e] relative min-h-0 overflow-hidden">
        <Editor
          height="100%"
          language={language}
          theme="vs-dark"
          value={currentCode}
          onChange={handleCodeChange}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            lineHeight: 1.5,
            padding: { top: 12, bottom: 12 },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            renderLineHighlight: 'all',
            wordWrap: 'on',
            automaticLayout: true,
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
              useShadows: false,
              verticalSliderSize: 8,
              horizontalSliderSize: 8
            }
          }}
        />
      </div>
    </div>
  );

  const renderResultsPane = () => (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 h-full overflow-hidden bg-[#0d121d]">
      {/* Tabs Bar (LeetCode Style) */}
      <div className="h-10 sm:h-11 border-b border-white/10 bg-[#121824] px-3 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center h-full">
          <button
            type="button"
            onClick={() => setActiveTab('testcases')}
            className={`px-3 h-full text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'testcases'
                ? 'border-brand-500 text-brand-300 font-semibold bg-white/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Beaker className="w-3.5 h-3.5" /> Test Cases
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('output')}
            className={`px-3 h-full text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'output'
                ? 'border-brand-500 text-brand-300 font-semibold bg-white/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" /> Output
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('results')}
            className={`px-3 h-full text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'results'
                ? 'border-brand-500 text-brand-300 font-semibold bg-white/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" /> Results
          </button>
        </div>

        {/* Live Execution Actions */}
        <div className="flex items-center gap-2">
          {problemData && !problemData.hasHiddenTests && (
            <span
              className="hidden lg:inline-flex items-center gap-1 text-[10px] text-amber-400/90 font-mono bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded"
              title="Private test dataset is not configured on the server. You can still test with Run Code."
            >
              <Info className="w-3 h-3 text-amber-400" />
              Hidden Tests Unconfigured
            </span>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-7 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 text-xs px-2.5 transition-all"
            disabled={!Boolean(problemData && problemData.slug) || !isExecutionSupported || isRunning || isSubmittingCode}
            onClick={handleRunCode}
            title={
              !isExecutionSupported
                ? `${LANGUAGE_LABELS[language]} execution is unavailable on this runner (Linux cgroups v1 required). Please switch to C++ or Python.`
                : !problemData || !problemData.slug
                ? 'Run Code is disabled because this question does not have an executable problem definition.'
                : 'Run public sample test cases through Judge0 isolated sandbox'
            }
          >
            {isRunning ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin text-cyan-400" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-3 h-3 mr-1 text-emerald-400" />
                Run Code
              </>
            )}
          </Button>

          <Button
            variant="glow"
            size="sm"
            disabled={!Boolean(problemData && problemData.slug) || !problemData?.hasHiddenTests || !isExecutionSupported || isRunning || isSubmittingCode || externalSubmitting}
            onClick={handleSubmitSolution}
            className="h-7 text-xs px-3 transition-all"
            title={
              !isExecutionSupported
                ? `${LANGUAGE_LABELS[language]} execution is unavailable on this runner (Linux cgroups v1 required). Please switch to C++ or Python.`
                : !problemData || !problemData.slug
                ? 'Submit Solution is disabled because this question does not have an executable problem definition.'
                : !problemData?.hasHiddenTests
                ? 'Submit Solution is disabled: Private hidden test cases are not configured on the server. You can still test your code with Run Code.'
                : 'Execute all public & hidden test suites and submit solution attempt'
            }
          >
            {isSubmittingCode || externalSubmitting ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin text-brand-300" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-3 h-3 mr-1" />
                Submit Solution
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Tabs Body (Independently scrollable) */}
      <div className="flex-1 p-3.5 overflow-y-auto bg-obsidian min-h-0 space-y-3 custom-scrollbar">
        {/* Test Cases Tab */}
        {activeTab === 'testcases' && (
          <div className="space-y-3 min-h-0">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold block">
                Standard Input (stdin)
              </label>
              {problemData && (
                <span className="text-[11px] text-cyan-400 font-mono">
                  {problemData.examples?.length || 0} public sample cases loaded
                </span>
              )}
            </div>

            <textarea
              value={stdin || problemData?.examples?.[0]?.input || ''}
              onChange={(e) => setStdin(e.target.value)}
              className="w-full h-24 bg-black/40 border border-white/10 rounded-lg p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-brand-500/50 resize-none leading-relaxed custom-scrollbar"
              placeholder="Provide custom test inputs for your program..."
            />

            {problemData?.examples && problemData.examples.length > 0 && (
              <div className="space-y-2 pt-1">
                <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold block">
                  Sample Test Inputs
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {problemData.examples.map((ex, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setStdin(ex.input)}
                      className="p-2 rounded-lg bg-white/5 border border-white/10 hover:border-brand-500/50 text-left transition-colors font-mono text-[11px]"
                    >
                      <div className="text-brand-300 font-sans font-semibold mb-1">Case #{idx + 1}</div>
                      <div className="text-slate-300 truncate">{ex.input}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Output Tab */}
        {activeTab === 'output' && (
          <div className="h-full flex flex-col space-y-3">
            {isRunning || isSubmittingCode ? (
              <div className="flex flex-col items-center justify-center flex-1 py-10 space-y-3">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                <span className="text-xs text-slate-300 font-mono">
                  Executing code in sandboxed runner...
                </span>
              </div>
            ) : executionError ? (
              <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-4 text-xs text-rose-300 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-rose-400">
                  <AlertCircle className="w-4 h-4" />
                  <span>Execution Error</span>
                </div>
                <p className="leading-relaxed font-sans">{executionError}</p>
              </div>
            ) : (runResult?.compileOutput || submitResult?.compileOutput) ? (
              <div className="bg-red-950/30 border border-red-500/30 rounded-xl p-4 text-xs font-mono text-red-200 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-red-400 font-sans">
                  <XCircle className="w-4 h-4" />
                  <span>Compilation / Build Error</span>
                </div>
                <pre className="whitespace-pre-wrap overflow-x-auto text-[11px] leading-relaxed bg-black/40 p-3 rounded-lg border border-red-500/20 custom-scrollbar">
                  {runResult?.compileOutput || submitResult?.compileOutput}
                </pre>
              </div>
            ) : (runResult?.stderr) ? (
              <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-4 text-xs font-mono text-amber-200 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-amber-400 font-sans">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Standard Error (stderr)</span>
                </div>
                <pre className="whitespace-pre-wrap overflow-x-auto text-[11px] leading-relaxed bg-black/40 p-3 rounded-lg border border-amber-500/20 custom-scrollbar">
                  {runResult.stderr}
                </pre>
              </div>
            ) : (runResult || submitResult) ? (
              <div className="space-y-3">
                <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>Execution completed successfully</span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">
                    Language: {language.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  View individual assertions and comparison cards under the <button type="button" onClick={() => setActiveTab('results')} className="text-brand-300 underline font-semibold">Results</button> tab.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 py-10 text-center space-y-1.5">
                <Terminal className="w-6 h-6 text-slate-500" />
                <h4 className="text-xs font-semibold text-slate-300">No Execution Output</h4>
                <p className="text-[11px] text-slate-500 max-w-sm">
                  Click <strong className="text-slate-400">Run Code</strong> to test sample cases or <strong className="text-slate-400">Submit Solution</strong> to run full test suites.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Results Tab */}
        {activeTab === 'results' && (
          <div className="space-y-4 min-h-0">
            {isRunning || isSubmittingCode ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-3">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                <span className="text-xs text-slate-300 font-mono">
                  Evaluating test case assertions...
                </span>
              </div>
            ) : submitResult ? (
              <div className="space-y-3">
                {/* Submit Summary Banner */}
                <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  submitResult.status?.toUpperCase() === 'ACCEPTED'
                    ? 'bg-emerald-950/30 border-emerald-500/30'
                    : 'bg-rose-950/30 border-rose-500/30'
                }`}>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded text-xs font-bold font-mono border ${
                        submitResult.status?.toUpperCase() === 'ACCEPTED'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                      }`}>
                        {submitResult.status}
                      </span>
                      <span className="text-xs text-slate-300 font-semibold">
                        Final Attempt Recorded
                      </span>
                    </div>
                    <div className="text-lg font-bold font-mono text-white">
                      {submitResult.testsPassed} / {submitResult.totalTests} tests passed
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
                    {submitResult.executionTimeMs != null && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {submitResult.executionTimeMs} ms
                      </span>
                    )}
                    {submitResult.memoryKb != null && (
                      <span className="flex items-center gap-1">
                        <Cpu className="w-3.5 h-3.5 text-slate-400" />
                        {Math.round(submitResult.memoryKb / 1024)} MB
                      </span>
                    )}
                  </div>
                </div>

                {/* Public Sample Results Cards */}
                <div className="space-y-2 pt-1">
                  <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                    Public Sample Test Cases
                  </h4>
                  {submitResult.publicResults?.map((res, idx) => (
                    <div
                      key={idx}
                      className={`rounded-xl border p-3.5 space-y-2.5 font-mono text-xs ${
                        res.passed
                          ? 'bg-emerald-950/15 border-emerald-500/20'
                          : 'bg-rose-950/15 border-rose-500/20'
                      }`}
                    >
                      <div className="flex items-center justify-between font-sans">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">Test Case #{idx + 1}</span>
                          <span className="text-[11px] text-slate-400">({res.label})</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                          res.passed
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        }`}>
                          {res.passed ? 'PASSED' : res.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                        <div className="space-y-1 min-w-0">
                          <span className="text-slate-400 font-sans block">Input:</span>
                          <div className="bg-black/40 p-2 rounded border border-white/5 whitespace-pre-wrap break-words text-slate-200">
                            {res.input}
                          </div>
                        </div>
                        <div className="space-y-1 min-w-0">
                          <span className="text-slate-400 font-sans block">Expected Output:</span>
                          <div className="bg-black/40 p-2 rounded border border-white/5 whitespace-pre-wrap break-words text-emerald-300">
                            {res.expectedOutput}
                          </div>
                        </div>
                        <div className="space-y-1 min-w-0">
                          <span className="text-slate-400 font-sans block">Actual Output:</span>
                          <div className={`bg-black/40 p-2 rounded border border-white/5 whitespace-pre-wrap break-words ${
                            res.passed ? 'text-emerald-300' : 'text-rose-300'
                          }`}>
                            {res.actualOutput || '<No output>'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Hidden Test Case Results Cards */}
                {submitResult.hiddenResults && submitResult.hiddenResults.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                      Hidden Private Test Cases
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {submitResult.hiddenResults.map((hRes, hIdx) => (
                        <div
                          key={hIdx}
                          className={`rounded-xl border p-3 flex items-center justify-between text-xs ${
                            hRes.passed
                              ? 'bg-emerald-950/15 border-emerald-500/20'
                              : 'bg-rose-950/15 border-rose-500/20'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <span className="font-semibold text-white font-sans">{hRes.label}</span>
                            <p className="text-[10px] text-slate-400 font-sans">Server-side private test</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono border ${
                            hRes.passed
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          }`}>
                            {hRes.passed ? 'PASSED' : hRes.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : runResult ? (
              <div className="space-y-3">
                {/* Run Summary Banner */}
                <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  runResult.overallStatus?.toUpperCase() === 'ACCEPTED'
                    ? 'bg-emerald-950/30 border-emerald-500/30'
                    : 'bg-rose-950/30 border-rose-500/30'
                }`}>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded text-xs font-bold font-mono border ${
                        runResult.overallStatus?.toUpperCase() === 'ACCEPTED'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                      }`}>
                        {runResult.overallStatus}
                      </span>
                      <span className="text-xs text-slate-300 font-semibold">
                        Sample Verification (Unsaved)
                      </span>
                    </div>
                    <div className="text-lg font-bold font-mono text-white">
                      {runResult.testsPassed} / {runResult.totalTests} sample tests passed
                    </div>
                  </div>
                </div>

                {/* Public Sample Results Cards */}
                <div className="space-y-2 pt-1">
                  {runResult.results?.map((res, idx) => (
                    <div
                      key={idx}
                      className={`rounded-xl border p-3.5 space-y-2.5 font-mono text-xs ${
                        res.passed
                          ? 'bg-emerald-950/15 border-emerald-500/20'
                          : 'bg-rose-950/15 border-rose-500/20'
                      }`}
                    >
                      <div className="flex items-center justify-between font-sans">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">Sample #{idx + 1}</span>
                          <span className="text-[11px] text-slate-400">({res.label})</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                          res.passed
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        }`}>
                          {res.passed ? 'PASSED' : res.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                        <div className="space-y-1 min-w-0">
                          <span className="text-slate-400 font-sans block">Input:</span>
                          <div className="bg-black/40 p-2 rounded border border-white/5 whitespace-pre-wrap break-words text-slate-200">
                            {res.input}
                          </div>
                        </div>
                        <div className="space-y-1 min-w-0">
                          <span className="text-slate-400 font-sans block">Expected Output:</span>
                          <div className="bg-black/40 p-2 rounded border border-white/5 whitespace-pre-wrap break-words text-emerald-300">
                            {res.expectedOutput}
                          </div>
                        </div>
                        <div className="space-y-1 min-w-0">
                          <span className="text-slate-400 font-sans block">Actual Output:</span>
                          <div className={`bg-black/40 p-2 rounded border border-white/5 whitespace-pre-wrap break-words ${
                            res.passed ? 'text-emerald-300' : 'text-rose-300'
                          }`}>
                            {res.actualOutput || '<No output>'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-1.5">
                <CheckCircle className="w-6 h-6 text-slate-500" />
                <h4 className="text-xs font-semibold text-slate-300">No Test Results Yet</h4>
                <p className="text-[11px] text-slate-500 max-w-sm">
                  Run sample cases or submit your solution to see test assertions and comparison breakdowns here.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 w-full overflow-hidden relative coding-workspace">
      {/* Fullscreen transparent dragging overlay to prevent Monaco Editor / iframe / selection interference */}
      {isDraggingSplitter && (
        <div
          className="fixed inset-0 z-50 select-none bg-transparent"
          style={{
            cursor: isDraggingSplitter === 'horiz' ? 'row-resize' : 'col-resize',
            pointerEvents: 'auto'
          }}
        />
      )}

      {/* Mobile / Small Screen View Switcher */}
      <div className="flex lg:hidden bg-white/5 p-1 rounded-lg border border-white/10 shrink-0 mb-2">
        <button
          type="button"
          onClick={() => setMobileView('problem')}
          className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium flex items-center justify-center gap-2 transition-all ${
            mobileView === 'problem'
              ? 'bg-brand-500 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" /> Problem Description
        </button>
        <button
          type="button"
          onClick={() => setMobileView('code')}
          className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium flex items-center justify-center gap-2 transition-all ${
            mobileView === 'code'
              ? 'bg-brand-500 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" /> Editor & Results
        </button>
      </div>

      {/* Snap Target Drag Overlay (Visible ONLY during panel header drag) */}
      {isDraggingPanelHeader && (
        <div className="absolute inset-0 z-40 bg-black/75 backdrop-blur-[2px] p-3 flex flex-col pointer-events-none select-none">
          <div className="text-center text-xs font-medium text-slate-300 pb-2.5 flex items-center justify-center gap-2">
            <Move className="w-3.5 h-3.5 text-brand-400 animate-pulse" />
            <span>Release on a snap target zone to rearrange workspace</span>
          </div>

          <div className="flex-1 grid grid-cols-12 gap-3 min-h-0">
            {/* Target 1: Default Split (40/60) */}
            <div className={`col-span-4 rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-3 text-center transition-all ${
              activeSnapTarget === 'default'
                ? 'border-brand-400 bg-brand-500/20 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] scale-[1.01]'
                : 'border-white/20 bg-black/40 text-slate-400'
            }`}>
              <Columns className="w-6 h-6 mb-1.5 text-brand-300" />
              <span className="text-xs font-semibold">Default Split</span>
              <span className="text-[10px] text-slate-400 mt-0.5">40% Problem / 60% Workspace</span>
            </div>

            {/* Target 2: Editor Focus (25/75) */}
            <div className={`col-span-3 rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-3 text-center transition-all ${
              activeSnapTarget === 'editor-focus'
                ? 'border-brand-400 bg-brand-500/20 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] scale-[1.01]'
                : 'border-white/20 bg-black/40 text-slate-400'
            }`}>
              <Maximize2 className="w-6 h-6 mb-1.5 text-brand-300" />
              <span className="text-xs font-semibold">Editor Focus</span>
              <span className="text-[10px] text-slate-400 mt-0.5">25% Problem / 75% Editor</span>
            </div>

            {/* Target 3: Problem Focus (55/45) */}
            <div className={`col-span-3 rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-3 text-center transition-all ${
              activeSnapTarget === 'problem-focus'
                ? 'border-brand-400 bg-brand-500/20 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] scale-[1.01]'
                : 'border-white/20 bg-black/40 text-slate-400'
            }`}>
              <BookOpen className="w-6 h-6 mb-1.5 text-brand-300" />
              <span className="text-xs font-semibold">Problem Focus</span>
              <span className="text-[10px] text-slate-400 mt-0.5">55% Wide Problem Statement</span>
            </div>

            {/* Target 4: Stacked View */}
            <div className={`col-span-2 rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-3 text-center transition-all ${
              activeSnapTarget === 'stacked'
                ? 'border-cyan-400 bg-cyan-500/20 text-white shadow-[0_0_20px_rgba(6,182,212,0.4)] scale-[1.01]'
                : 'border-white/20 bg-black/40 text-slate-400'
            }`}>
              <Rows className="w-6 h-6 mb-1.5 text-cyan-300" />
              <span className="text-xs font-semibold">Stacked</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Problem on Top</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace: 4 Supported Arrangements */}
      {layout.arrangement === 'stacked' ? (
        /* ======================================================== */
        /* STACKED ARRANGEMENT: Problem on Top, Editor/Results Below */
        /* ======================================================== */
        <div
          ref={containerRef}
          className="flex-1 flex flex-col min-h-0 h-full w-full overflow-hidden relative"
        >
          {/* Top: Problem Pane */}
          <div
            style={{
              flex: `0 0 calc(${layout.splitY}% - 5px)`,
              maxHeight: `calc(${layout.splitY}% - 5px)`
            }}
            className={`flex flex-col min-h-0 min-w-0 overflow-hidden border border-white/10 rounded-lg shrink-0 grow-0 ${
              mobileView === 'problem' ? 'flex max-lg:!w-full max-lg:!h-full max-lg:!flex-1' : 'hidden lg:flex'
            }`}
          >
            {renderProblemPane()}
          </div>

          {/* Draggable Horizontal Splitter */}
          <div
            role="separator"
            tabIndex={0}
            aria-orientation="horizontal"
            aria-label="Resize stacked problem and editor workspace"
            aria-valuenow={Math.round(layout.splitY)}
            aria-valuemin={MIN_SPLIT_Y}
            aria-valuemax={MAX_SPLIT_Y}
            style={{ flex: '0 0 10px', height: '10px' }}
            onPointerDown={(e) => handleSplitterPointerDown('horiz', e)}
            onKeyDown={(e) => handleSplitterKeyDown('horiz', e)}
            className="hidden lg:flex h-2.5 items-center justify-center cursor-row-resize shrink-0 grow-0 select-none group relative z-20 touch-none transition-colors focus:outline-none focus:ring-1 focus:ring-brand-500 rounded"
          >
            <div className={`h-px w-full pointer-events-none transition-colors ${
              isDraggingSplitter === 'horiz' ? 'bg-brand-400 shadow-[0_0_8px_rgba(168,85,247,0.7)]' : 'bg-white/10 group-hover:bg-brand-500/50'
            }`} />
          </div>

          {/* Bottom: Editor + Results side by side */}
          <div
            ref={rightContainerRef}
            style={{ flex: '1 1 0%', minHeight: 0 }}
            className={`flex flex-col lg:flex-row min-h-0 h-full overflow-hidden flex-1 ${
              mobileView === 'code' ? 'flex max-lg:!w-full max-lg:!h-full' : 'hidden lg:flex'
            }`}
          >
            {/* Editor Pane */}
            <div
              style={{
                flex: `0 0 calc(${layout.stackedSplitX}% - 5px)`,
                maxWidth: `calc(${layout.stackedSplitX}% - 5px)`
              }}
              className="flex flex-col min-h-0 min-w-0 overflow-hidden max-lg:!w-full max-lg:!flex-1 border border-white/10 rounded-lg shrink-0 grow-0"
            >
              {renderEditorPane()}
            </div>

            {/* Draggable Vertical Splitter between Editor and Results in stacked mode */}
            <div
              role="separator"
              tabIndex={0}
              aria-orientation="vertical"
              aria-label="Resize editor and test results"
              aria-valuenow={Math.round(layout.stackedSplitX)}
              aria-valuemin={MIN_STACKED_SPLIT_X}
              aria-valuemax={MAX_STACKED_SPLIT_X}
              style={{ flex: '0 0 10px', width: '10px' }}
              onPointerDown={(e) => handleSplitterPointerDown('stacked-vert', e)}
              onKeyDown={(e) => handleSplitterKeyDown('stacked-vert', e)}
              className="hidden lg:flex w-2.5 items-center justify-center cursor-col-resize shrink-0 grow-0 select-none group relative z-20 touch-none transition-colors focus:outline-none focus:ring-1 focus:ring-brand-500 rounded"
            >
              <div className={`w-px h-full pointer-events-none transition-colors ${
                isDraggingSplitter === 'stacked-vert' ? 'bg-brand-400 shadow-[0_0_8px_rgba(168,85,247,0.7)]' : 'bg-white/10 group-hover:bg-brand-500/50'
              }`} />
            </div>

            {/* Results Pane */}
            <div
              style={{ flex: '1 1 0%', minWidth: 0 }}
              className="flex flex-col min-h-0 min-w-0 overflow-hidden max-lg:!w-full max-lg:!h-[240px] max-lg:!shrink-0 border border-white/10 rounded-lg flex-1"
            >
              {renderResultsPane()}
            </div>
          </div>
        </div>
      ) : (
        /* ======================================================== */
        /* SIDE-BY-SIDE ARRANGEMENTS (Default, Editor Focus, Problem) */
        /* ======================================================== */
        <div
          ref={containerRef}
          className="flex-1 flex flex-col lg:flex-row min-h-0 h-full w-full overflow-hidden relative"
        >
          {/* Left Pane: Problem Description */}
          <div
            style={{
              flex: `0 0 ${layout.splitX}%`,
              maxWidth: `${layout.splitX}%`
            }}
            className={`flex flex-col min-h-0 min-w-0 h-full overflow-hidden border border-white/10 rounded-lg shrink-0 grow-0 ${
              mobileView === 'problem' ? 'flex max-lg:!w-full max-lg:!h-full max-lg:!flex-1' : 'hidden lg:flex'
            }`}
          >
            {renderProblemPane()}
          </div>

          {/* Draggable Vertical Splitter */}
          <div
            role="separator"
            tabIndex={0}
            aria-orientation="vertical"
            aria-label="Resize problem pane and code workspace"
            aria-valuenow={Math.round(layout.splitX)}
            aria-valuemin={MIN_SPLIT_X}
            aria-valuemax={MAX_SPLIT_X}
            style={{ flex: '0 0 10px', width: '10px' }}
            onPointerDown={(e) => handleSplitterPointerDown('vert', e)}
            onKeyDown={(e) => handleSplitterKeyDown('vert', e)}
            className="hidden lg:flex w-2.5 items-center justify-center cursor-col-resize shrink-0 grow-0 select-none group relative z-20 touch-none transition-colors focus:outline-none focus:ring-1 focus:ring-brand-500 rounded"
          >
            <div className={`w-px h-full pointer-events-none transition-colors ${
              isDraggingSplitter === 'vert' ? 'bg-brand-400 shadow-[0_0_8px_rgba(168,85,247,0.7)]' : 'bg-white/10 group-hover:bg-brand-500/50'
            }`} />
          </div>

          {/* Right Pane: Monaco Editor (Top) + Results (Bottom) */}
          <div
            ref={rightContainerRef}
            style={{ flex: '1 1 0%', minWidth: 0 }}
            className={`flex flex-col min-h-0 min-w-0 h-full overflow-hidden flex-1 ${
              mobileView === 'code' ? 'flex max-lg:!w-full max-lg:!h-full' : 'hidden lg:flex'
            }`}
          >
            {/* Editor Pane */}
            <div
              style={{
                flex: `0 0 calc(${layout.splitY}% - 5px)`,
                maxHeight: `calc(${layout.splitY}% - 5px)`
              }}
              className="flex flex-col min-h-0 min-w-0 overflow-hidden max-lg:!flex-1 border border-white/10 rounded-lg shrink-0 grow-0"
            >
              {renderEditorPane()}
            </div>

            {/* Draggable Horizontal Splitter */}
            <div
              role="separator"
              tabIndex={0}
              aria-orientation="horizontal"
              aria-label="Resize code editor and test results"
              aria-valuenow={Math.round(layout.splitY)}
              aria-valuemin={MIN_SPLIT_Y}
              aria-valuemax={MAX_SPLIT_Y}
              style={{ flex: '0 0 10px', height: '10px' }}
              onPointerDown={(e) => handleSplitterPointerDown('horiz', e)}
              onKeyDown={(e) => handleSplitterKeyDown('horiz', e)}
              className="hidden lg:flex h-2.5 items-center justify-center cursor-row-resize shrink-0 grow-0 select-none group relative z-20 touch-none transition-colors focus:outline-none focus:ring-1 focus:ring-brand-500 rounded"
            >
              <div className={`h-px w-full pointer-events-none transition-colors ${
                isDraggingSplitter === 'horiz' ? 'bg-brand-400 shadow-[0_0_8px_rgba(168,85,247,0.7)]' : 'bg-white/10 group-hover:bg-brand-500/50'
              }`} />
            </div>

            {/* Results Pane */}
            <div
              style={{ flex: '1 1 0%', minHeight: 0 }}
              className="flex flex-col min-h-0 min-w-0 overflow-hidden max-lg:!h-[240px] max-lg:!shrink-0 border border-white/10 rounded-lg flex-1"
            >
              {renderResultsPane()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
