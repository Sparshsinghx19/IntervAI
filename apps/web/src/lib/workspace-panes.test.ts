import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { NARROW_WORKSPACE_QUERY, paneStyles, PaneLayout } from '../components/interview/workspace-pane-styles';

const side: PaneLayout = { arrangement: 'default', splitX: 40, splitY: 65, stackedSplitX: 62 };
const stacked: PaneLayout = { arrangement: 'stacked', splitX: 40, splitY: 38, stackedSplitX: 62 };

describe('Coding workspace pane sizing', () => {
  it('applies the saved splitter widths on wide screens', () => {
    assert.deepEqual(paneStyles(side, false).problem, { flex: '0 0 40%', maxWidth: '40%' });
    assert.deepEqual(paneStyles({ ...side, splitX: 55, arrangement: 'problem-focus' }, false).problem, { flex: '0 0 55%', maxWidth: '55%' });
    assert.deepEqual(paneStyles(stacked, false).editor, { flex: '0 0 calc(62% - 5px)', maxWidth: 'calc(62% - 5px)' });
  });

  it('gives the active pane no splitter width cap on narrow screens', () => {
    // The bug: max-width 40% from the desktop splitter squeezed the description to ~140px on phones.
    for (const arrangement of ['default', 'editor-focus', 'problem-focus'] as const) {
      const s = paneStyles({ ...side, arrangement }, true);
      assert.equal(s.problem, undefined);
      assert.ok(!s.editor || !('maxWidth' in s.editor), 'the editor is never width-capped');
    }
    const st = paneStyles(stacked, true);
    assert.equal(st.problem, undefined, 'stacked problem pane fills the tab');
    assert.equal(st.editor, undefined, 'stacked editor is not capped at 62% width');
  });

  it('keeps the editor/results height split in side-by-side arrangements', () => {
    assert.deepEqual(paneStyles(side, true).editor, { flex: '0 0 calc(65% - 5px)', maxHeight: 'calc(65% - 5px)' });
  });

  it('does not change the saved layout', () => {
    const layout = { ...side, splitX: 33 };
    const copy = { ...layout };
    paneStyles(layout, true);
    assert.deepEqual(layout, copy);
  });

  it('switches at the same width as the tab switcher (Tailwind lg)', () => {
    assert.equal(NARROW_WORKSPACE_QUERY, '(max-width: 1023.98px)');
  });
});
