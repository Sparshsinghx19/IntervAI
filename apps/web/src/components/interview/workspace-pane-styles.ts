import type { CSSProperties } from 'react';

/**
 * Below this width the coding workspace is a two-tab layout (Problem / Editor &
 * Results) instead of resizable panes. It matches Tailwind's `lg` breakpoint,
 * which already hides the splitters and shows the tab switcher.
 */
export const NARROW_WORKSPACE_QUERY = '(max-width: 1023.98px)';

export interface PaneLayout {
  arrangement: 'default' | 'editor-focus' | 'problem-focus' | 'stacked';
  splitX: number;
  splitY: number;
  stackedSplitX: number;
}

export interface PaneStyles {
  problem: CSSProperties | undefined;
  editor: CSSProperties | undefined;
}

/**
 * Inline sizes for the problem and editor panes.
 *
 * On wide screens these come from the saved splitter layout. On narrow screens
 * only one pane is shown at a time, so it gets no width or height cap from the
 * splitter (the saved layout itself is left untouched for when the screen widens).
 * The editor/results height split stays in the side-by-side arrangements, since
 * both remain visible together on the Editor & Results tab.
 */
export function paneStyles(layout: PaneLayout, narrow: boolean): PaneStyles {
  if (layout.arrangement === 'stacked') {
    return {
      problem: narrow ? undefined : { flex: `0 0 calc(${layout.splitY}% - 5px)`, maxHeight: `calc(${layout.splitY}% - 5px)` },
      editor: narrow ? undefined : { flex: `0 0 calc(${layout.stackedSplitX}% - 5px)`, maxWidth: `calc(${layout.stackedSplitX}% - 5px)` },
    };
  }
  return {
    problem: narrow ? undefined : { flex: `0 0 ${layout.splitX}%`, maxWidth: `${layout.splitX}%` },
    editor: { flex: `0 0 calc(${layout.splitY}% - 5px)`, maxHeight: `calc(${layout.splitY}% - 5px)` },
  };
}
