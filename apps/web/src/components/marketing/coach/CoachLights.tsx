import { Environment, Lightformer } from '@react-three/drei';

/**
 * Studio lighting for glossy white armor on a dark page.
 *
 * Reflections come from a tiny, locally rendered environment (Lightformers, rendered
 * once — no HDR download): a big soft key from above, white side strips for the
 * ceramic highlights, and violet / cyan cards that tint the edges with brand colour.
 */
export function CoachLights() {
  return (
    <>
      <ambientLight intensity={0.35} color="#eef0ff" />

      {/* Key: top-front-left */}
      <directionalLight position={[-3.5, 5.5, 6]} intensity={2.1} color="#ffffff" />
      {/* Fill: front-right, cool */}
      <directionalLight position={[4, 1.5, 5]} intensity={0.75} color="#e8edff" />

      {/* Rim lights from behind: cyan on one side, violet on the other */}
      <spotLight position={[5.5, 3, -4.5]} angle={0.8} penumbra={0.9} intensity={38} color="#22d3ee" distance={20} decay={1.5} />
      <spotLight position={[-5.5, 3, -4.5]} angle={0.8} penumbra={0.9} intensity={42} color="#a855f7" distance={20} decay={1.5} />

      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.2} position={[0, 6, 1]} scale={[10, 6, 1]} />
        <Lightformer form="rect" intensity={2.6} position={[-6, 1.5, 3]} scale={[3, 8, 1]} />
        <Lightformer form="rect" intensity={1.3} position={[6, 1, 3]} scale={[2, 8, 1]} />
        <Lightformer form="rect" intensity={0.8} position={[0, 0.5, 8]} scale={[6, 2.5, 1]} />
        <Lightformer form="rect" color="#a855f7" intensity={3} position={[-5, -0.5, -4]} scale={[3, 6, 1]} />
        <Lightformer form="rect" color="#22d3ee" intensity={2.4} position={[5, -0.5, -4]} scale={[2.5, 6, 1]} />
      </Environment>
    </>
  );
}
