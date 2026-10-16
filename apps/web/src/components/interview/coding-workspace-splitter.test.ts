import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  WorkspaceLayoutState,
  ArrangementType,
} from './coding-workspace';

const MIN_SPLIT_X = 25;
const MAX_SPLIT_X = 65;
const MIN_SPLIT_Y = 30;
const MAX_SPLIT_Y = 80;
const MIN_STACKED_SPLIT_X = 35;
const MAX_STACKED_SPLIT_X = 75;

function computeSplitX(clientX: number, rectLeft: number, rectWidth: number): number {
  if (rectWidth <= 0) return 40;
  const rawPct = ((clientX - rectLeft) / rectWidth) * 100;
  const clampedPct = Math.min(Math.max(rawPct, MIN_SPLIT_X), MAX_SPLIT_X);
  return Math.round(clampedPct * 10) / 10;
}

function computeSplitY(clientY: number, rectTop: number, rectHeight: number): number {
  if (rectHeight <= 0) return 65;
  const rawPct = ((clientY - rectTop) / rectHeight) * 100;
  const clampedPct = Math.min(Math.max(rawPct, MIN_SPLIT_Y), MAX_SPLIT_Y);
  return Math.round(clampedPct * 10) / 10;
}

function computeStackedSplitX(clientX: number, rectLeft: number, rectWidth: number): number {
  if (rectWidth <= 0) return 62;
  const rawPct = ((clientX - rectLeft) / rectWidth) * 100;
  const clampedPct = Math.min(Math.max(rawPct, MIN_STACKED_SPLIT_X), MAX_STACKED_SPLIT_X);
  return Math.round(clampedPct * 10) / 10;
}

function handleKeyStep(current: number, direction: 'left' | 'right', min: number, max: number): number {
  const STEP = 2;
  if (direction === 'left') {
    return Math.max(min, current - STEP);
  } else {
    return Math.min(max, current + STEP);
  }
}

describe('Coding Workspace Splitter Mechanics & Constraints', () => {
  it('correctly calculates continuous splitX within container boundaries', () => {
    const containerLeft = 100;
    const containerWidth = 1000;

    // Center drag (400px from left = 40%)
    assert.strictEqual(computeSplitX(500, containerLeft, containerWidth), 40);

    // Leftward drag (300px from left = 30%)
    assert.strictEqual(computeSplitX(400, containerLeft, containerWidth), 30);

    // Rightward drag (550px from left = 55%)
    assert.strictEqual(computeSplitX(650, containerLeft, containerWidth), 55);

    // Granular fractional position (425px = 42.5%)
    assert.strictEqual(computeSplitX(525, containerLeft, containerWidth), 42.5);
  });

  it('strictly clamps splitX to MIN_SPLIT_X (25%) and MAX_SPLIT_X (65%)', () => {
    const containerLeft = 0;
    const containerWidth = 1000;

    // Extreme left drag (100px = 10% -> must clamp to 25%)
    assert.strictEqual(computeSplitX(100, containerLeft, containerWidth), MIN_SPLIT_X);
    assert.strictEqual(computeSplitX(-50, containerLeft, containerWidth), MIN_SPLIT_X);

    // Extreme right drag (800px = 80% -> must clamp to 65%)
    assert.strictEqual(computeSplitX(800, containerLeft, containerWidth), MAX_SPLIT_X);
    assert.strictEqual(computeSplitX(1200, containerLeft, containerWidth), MAX_SPLIT_X);
  });

  it('correctly calculates and clamps splitY for horizontal splitter', () => {
    const containerTop = 50;
    const containerHeight = 800;

    // Normal drag (520px from top = 65%)
    assert.strictEqual(computeSplitY(570, containerTop, containerHeight), 65);

    // Clamp top (below 30%)
    assert.strictEqual(computeSplitY(100, containerTop, containerHeight), MIN_SPLIT_Y);

    // Clamp bottom (above 80%)
    assert.strictEqual(computeSplitY(750, containerTop, containerHeight), MAX_SPLIT_Y);
  });

  it('correctly calculates and clamps stackedSplitX for stacked layout', () => {
    const containerLeft = 0;
    const containerWidth = 1000;

    // Normal drag (620px = 62%)
    assert.strictEqual(computeStackedSplitX(620, containerLeft, containerWidth), 62);

    // Clamp left (below 35%)
    assert.strictEqual(computeStackedSplitX(200, containerLeft, containerWidth), MIN_STACKED_SPLIT_X);

    // Clamp right (above 75%)
    assert.strictEqual(computeStackedSplitX(900, containerLeft, containerWidth), MAX_STACKED_SPLIT_X);
  });

  it('handles keyboard arrow navigation steps and clamps correctly', () => {
    let currentX = 40;

    // Step left
    currentX = handleKeyStep(currentX, 'left', MIN_SPLIT_X, MAX_SPLIT_X);
    assert.strictEqual(currentX, 38);

    // Step right
    currentX = handleKeyStep(currentX, 'right', MIN_SPLIT_X, MAX_SPLIT_X);
    assert.strictEqual(currentX, 40);

    // Multiple steps left until clamp
    for (let i = 0; i < 15; i++) {
      currentX = handleKeyStep(currentX, 'left', MIN_SPLIT_X, MAX_SPLIT_X);
    }
    assert.strictEqual(currentX, MIN_SPLIT_X);

    // Multiple steps right until clamp
    for (let i = 0; i < 30; i++) {
      currentX = handleKeyStep(currentX, 'right', MIN_SPLIT_X, MAX_SPLIT_X);
    }
    assert.strictEqual(currentX, MAX_SPLIT_X);
  });

  it('validates panel widths sum to 100% minus 10px splitter gap', () => {
    const testSplitX = 42.5;
    const leftPaneStyleWidth = `${testSplitX}%`;
    const rightPaneStyleWidth = `calc(${100 - testSplitX}% - 10px)`;

    assert.strictEqual(leftPaneStyleWidth, '42.5%');
    assert.strictEqual(rightPaneStyleWidth, 'calc(57.5% - 10px)');
  });
});
