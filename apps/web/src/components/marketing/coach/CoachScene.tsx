import { CoachPlatform } from './CoachPlatform';
import { CoachLights } from './CoachLights';
import { CoachBody } from './CoachBody';
import { Float, PresentationControls, Environment } from '@react-three/drei';

export function CoachScene() {
  return (
    <>
      <CoachLights />
      
      {/* Allows user to gently inspect the 3D volume, breaking the flat 2D silhouette */}
      <PresentationControls 
        global 
        snap
        rotation={[0, 0.15, 0]} 
        polar={[-Math.PI / 8, Math.PI / 8]} 
        azimuth={[-Math.PI / 4, Math.PI / 4]}
      >
        <Float speed={2.5} rotationIntensity={0.15} floatIntensity={0.4} floatingRange={[-0.08, 0.08]}>
          <CoachBody />
        </Float>
      </PresentationControls>
      
      <CoachPlatform />
    </>
  );
}
