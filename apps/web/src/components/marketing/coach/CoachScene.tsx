import { type MutableRefObject } from 'react';
import { useThree } from '@react-three/fiber';
import { PresentationControls } from '@react-three/drei';
import { CoachPlatform } from './CoachPlatform';
import { CoachLights } from './CoachLights';
import { CoachBody } from './CoachBody';
import { useCoachAssets } from './useCoachAssets';
import type { CoachPointer } from './types';

interface CoachSceneProps {
  pointer: MutableRefObject<CoachPointer>;
  reducedMotion: boolean;
  lowPower: boolean;
  allowDrag: boolean;
}

// Approximate world-space extents of robot + platform, used to fit narrow viewports.
const FIT_WIDTH = 2.9;

export function CoachScene({ pointer, reducedMotion, lowPower, allowDrag }: CoachSceneProps) {
  const { geometries, anchors, materials, shadowTexture } = useCoachAssets(lowPower ? 'low' : 'high');
  const viewport = useThree((s) => s.viewport);

  // Keep the whole character in frame on narrow (mobile) canvases.
  const fit = Math.min(1, viewport.width / FIT_WIDTH);

  return (
    <>
      <CoachLights />
      <group scale={fit} position={[0, -0.05, 0]}>
        {/* Gentle drag-to-inspect that springs back to the front view */}
        <PresentationControls
          global
          enabled={allowDrag}
          snap
          rotation={[0, 0, 0]}
          polar={[-Math.PI / 14, Math.PI / 14]}
          azimuth={[-Math.PI / 4, Math.PI / 4]}
        >
          <CoachBody geometries={geometries} anchors={anchors} materials={materials} pointer={pointer} reducedMotion={reducedMotion} />
        </PresentationControls>
        <CoachPlatform shadowTexture={shadowTexture} reducedMotion={reducedMotion} />
      </group>
    </>
  );
}
