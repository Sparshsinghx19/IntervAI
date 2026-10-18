import { type MutableRefObject } from 'react';
import { useThree } from '@react-three/fiber';
import { PresentationControls } from '@react-three/drei';
import { CoachPlatform } from './CoachPlatform';
import { CoachLights } from './CoachLights';
import { CoachBody } from './CoachBody';
import { useCoachAssets } from './useCoachAssets';
import type { CoachMood, CoachPointer, CoachVariant } from './types';

interface CoachSceneProps {
  pointer: MutableRefObject<CoachPointer>;
  reducedMotion: boolean;
  lowPower: boolean;
  allowDrag: boolean;
  mood?: CoachMood;
  variant?: CoachVariant;
}

// Approximate world-space extents of robot + platform, used to fit narrow viewports.
const FIT_WIDTH = 2.9;

/**
 * Compact (head-and-shoulders) framing, from the robot's measured bounds in its
 * own coordinates: antenna tip 1.74 (+0.04 float), head 0.34-1.51, eyes 0.80-0.98,
 * shoulders -0.17-0.21, chest emblem about -0.12-0.08, widest point (ears) ±0.87.
 * The frame runs from just below the chest emblem to above the antenna, with even
 * breathing room on both ends.
 */
export const COMPACT_FRAME = (() => {
  const top = 1.78;
  const bottom = -0.2;
  const margin = 0.12; // of the subject height, above and below
  const height = (top - bottom) * (1 + 2 * margin);
  const fov = 26;
  return {
    fov,
    // The default camera looks at the origin, so the robot is lowered by the frame's centre.
    offsetY: -(top + bottom) / 2,
    distance: height / 2 / Math.tan(((fov / 2) * Math.PI) / 180),
  };
})();

export function CoachScene({ pointer, reducedMotion, lowPower, allowDrag, mood = 'idle', variant = 'hero' }: CoachSceneProps) {
  const { geometries, anchors, materials, shadowTexture } = useCoachAssets(lowPower ? 'low' : 'high');
  const viewport = useThree((s) => s.viewport);

  // Keep the whole character in frame on narrow (mobile) canvases. The compact
  // head-and-shoulders camera frames itself, so it is not rescaled.
  const fit = variant === 'compact' ? 1 : Math.min(1, viewport.width / FIT_WIDTH);

  return (
    <>
      <CoachLights />
      <group scale={fit} position={[0, variant === 'compact' ? COMPACT_FRAME.offsetY : -0.05, 0]}>
        {/* Gentle drag-to-inspect that springs back to the front view */}
        <PresentationControls
          global
          enabled={allowDrag}
          snap
          rotation={[0, 0, 0]}
          polar={[-Math.PI / 14, Math.PI / 14]}
          azimuth={[-Math.PI / 4, Math.PI / 4]}
        >
          <CoachBody geometries={geometries} anchors={anchors} materials={materials} pointer={pointer} reducedMotion={reducedMotion} mood={mood} />
        </PresentationControls>
        {variant === 'hero' && <CoachPlatform shadowTexture={shadowTexture} reducedMotion={reducedMotion} />}
      </group>
    </>
  );
}
