import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function CoachBody() {
  const coreLightRef = useRef<THREE.PointLight>(null);
  const ivBrandRef = useRef<THREE.Group>(null);

  // Future Interaction / FK Animation Hierarchy Refs
  const headRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftElbowRef = useRef<THREE.Group>(null);
  const rightElbowRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    // Core pulsing logic (Speaking / Evaluating states baseline)
    const pulse = 1 + Math.sin(clock.elapsedTime * 2) * 0.15;
    if (coreLightRef.current) {
      coreLightRef.current.intensity = 15 * pulse;
    }
    if (ivBrandRef.current) {
      ivBrandRef.current.children.forEach((mesh: any) => {
        if (mesh.material && mesh.material.emissiveIntensity !== undefined) {
          mesh.material.emissiveIntensity = 2 * pulse;
        }
      });
    }

    // Gentle idle floating/breathing animation for the limbs
    const time = clock.elapsedTime;
    if (leftArmRef.current) leftArmRef.current.rotation.z = Math.sin(time) * 0.02 + 0.05;
    if (rightArmRef.current) rightArmRef.current.rotation.z = -Math.sin(time) * 0.02 - 0.05;
    
    // Subtle head tracking/idle movement
    if (headRef.current) {
      headRef.current.rotation.y = Math.sin(time * 0.5) * 0.05;
      headRef.current.rotation.x = Math.sin(time * 0.8) * 0.02;
    }
  });

  // Premium White/Silver hardware base (Cinematic lighting canvas)
  const matChassis = <meshStandardMaterial color="#CBD5E1" metalness={0.5} roughness={0.4} />;
  const matShell = <meshStandardMaterial color="#F1F5F9" metalness={0.7} roughness={0.2} />;
  const matVisor = <meshStandardMaterial color="#0b132b" metalness={0.9} roughness={0.1} />;
  const matJoint = <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.6} />;
  const matRecess = <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.4} />;

  return (
    <group position={[0, 0.2, 0]} scale={[1.5, 1.5, 1.5]}>
      
      {/* ========================================== */}
      {/* 1. HEAD & VISOR (FK ROOT)                  */}
      {/* ========================================== */}
      <group name="Head_Root" ref={headRef} position={[0, 1.35, 0]}>
        {/* Wide, panoramic futuristic head dome */}
        <mesh scale={[1.4, 1, 1.2]}>
          <sphereGeometry args={[0.45, 64, 64]} />
          {matShell}
        </mesh>
        
        {/* Sweeping black glass visor seamlessly embedded in the face */}
        <group name="Visor_Group" position={[0, -0.02, 0.02]}>
          <mesh scale={[1.42, 1.02, 1.22]}>
            <sphereGeometry args={[0.45, 64, 64, Math.PI * 0.15, Math.PI * 0.7]} />
            {matVisor}
          </mesh>
          
          {/* FUTURE INTERACTIVE EYES HIERARCHY */}
          {/* <group name="Left_Eye" position={[-0.2, 0, 0.4]} /> */}
          {/* <group name="Right_Eye" position={[0.2, 0, 0.4]} /> */}
        </group>
      </group>

      {/* ========================================== */}
      {/* 2. NECK JOINT                              */}
      {/* ========================================== */}
      <mesh name="Neck_Joint" position={[0, 1.15, -0.05]} rotation={[0.1, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.18, 0.25, 32]} />
        {matJoint}
      </mesh>

      {/* ========================================== */}
      {/* 3. MAIN BODY (TEARDROP POD)                */}
      {/* ========================================== */}
      <group name="Body_Root">
        {/* A single, completely enclosed premium white/silver pod. */}
        <mesh position={[0, 0.15, 0]} scale={[1, 1.5, 0.9]}>
          <sphereGeometry args={[0.65, 64, 64]} />
          {matShell}
        </mesh>
      </group>

      {/* ========================================== */}
      {/* 4. LEFT ARM (FORWARD KINEMATICS CHAIN)     */}
      {/* ========================================== */}
      <group name="Left_Arm_Root" ref={leftArmRef} position={[-0.8, 0.75, 0]}>
        <mesh name="L_Shoulder">
          <sphereGeometry args={[0.12, 32, 32]} />
          {matJoint}
        </mesh>
        
        <mesh name="L_UpperArm" position={[-0.05, -0.3, 0]} rotation={[0, 0, 0.15]}>
          <capsuleGeometry args={[0.08, 0.4, 32, 32]} />
          {matShell}
        </mesh>

        <group name="Left_Elbow_Root" ref={leftElbowRef} position={[-0.1, -0.6, 0]}>
          <mesh name="L_Elbow">
            <sphereGeometry args={[0.1, 32, 32]} />
            {matJoint}
          </mesh>
          
          <mesh name="L_Forearm" position={[0.05, -0.25, 0.1]} rotation={[0.2, 0, -0.1]}>
            <capsuleGeometry args={[0.07, 0.35, 32, 32]} />
            {matShell}
          </mesh>
          
          <group name="Left_Wrist_Root" position={[0.1, -0.5, 0.2]} rotation={[0.2, 0, -0.1]}>
            <mesh name="L_Wrist">
              <sphereGeometry args={[0.06, 32, 32]} />
              {matJoint}
            </mesh>
            
            {/* Advanced Manipulator Hand */}
            <group name="L_Hand" position={[0, -0.1, 0]}>
              <mesh scale={[1, 1.2, 0.7]}>
                <sphereGeometry args={[0.07, 32, 32]} />
                {matShell}
              </mesh>
              <mesh position={[0, -0.05, 0.03]}>
                <sphereGeometry args={[0.02, 16, 16]} />
                <meshBasicMaterial color="#22d3ee" />
              </mesh>
              <mesh position={[0, -0.1, 0.03]} rotation={[-0.2, 0, 0]}>
                <capsuleGeometry args={[0.015, 0.08, 16, 16]} />
                {matJoint}
              </mesh>
              <mesh position={[-0.04, -0.08, 0.01]} rotation={[0, 0, -0.3]}>
                <capsuleGeometry args={[0.015, 0.08, 16, 16]} />
                {matJoint}
              </mesh>
              <mesh position={[0.04, -0.08, 0.01]} rotation={[0, 0, 0.3]}>
                <capsuleGeometry args={[0.015, 0.08, 16, 16]} />
                {matJoint}
              </mesh>
            </group>
          </group>
        </group>
      </group>

      {/* ========================================== */}
      {/* 5. RIGHT ARM (FORWARD KINEMATICS CHAIN)    */}
      {/* ========================================== */}
      <group name="Right_Arm_Root" ref={rightArmRef} position={[0.8, 0.75, 0]}>
        <mesh name="R_Shoulder">
          <sphereGeometry args={[0.12, 32, 32]} />
          {matJoint}
        </mesh>
        
        <mesh name="R_UpperArm" position={[0.05, -0.3, 0]} rotation={[0, 0, -0.15]}>
          <capsuleGeometry args={[0.08, 0.4, 32, 32]} />
          {matShell}
        </mesh>

        <group name="Right_Elbow_Root" ref={rightElbowRef} position={[0.1, -0.6, 0]}>
          <mesh name="R_Elbow">
            <sphereGeometry args={[0.1, 32, 32]} />
            {matJoint}
          </mesh>
          
          <mesh name="R_Forearm" position={[-0.05, -0.25, 0.1]} rotation={[0.2, 0, 0.1]}>
            <capsuleGeometry args={[0.07, 0.35, 32, 32]} />
            {matShell}
          </mesh>
          
          <group name="Right_Wrist_Root" position={[-0.1, -0.5, 0.2]} rotation={[0.2, 0, 0.1]}>
            <mesh name="R_Wrist">
              <sphereGeometry args={[0.06, 32, 32]} />
              {matJoint}
            </mesh>
            
            <group name="R_Hand" position={[0, -0.1, 0]}>
              <mesh scale={[1, 1.2, 0.7]}>
                <sphereGeometry args={[0.07, 32, 32]} />
                {matShell}
              </mesh>
              <mesh position={[0, -0.05, 0.03]}>
                <sphereGeometry args={[0.02, 16, 16]} />
                <meshBasicMaterial color="#22d3ee" />
              </mesh>
              <mesh position={[0, -0.1, 0.03]} rotation={[-0.2, 0, 0]}>
                <capsuleGeometry args={[0.015, 0.08, 16, 16]} />
                {matJoint}
              </mesh>
              <mesh position={[0.04, -0.08, 0.01]} rotation={[0, 0, 0.3]}>
                <capsuleGeometry args={[0.015, 0.08, 16, 16]} />
                {matJoint}
              </mesh>
              <mesh position={[-0.04, -0.08, 0.01]} rotation={[0, 0, -0.3]}>
                <capsuleGeometry args={[0.015, 0.08, 16, 16]} />
                {matJoint}
              </mesh>
            </group>
          </group>
        </group>
      </group>

      {/* ========================================== */}
      {/* 6. INTEGRATED IV CORE HOUSING              */}
      {/* ========================================== */}
      <group name="IV_Core_Group" position={[0, 0.4, 0.61]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <cylinderGeometry args={[0.35, 0.35, 0.1, 64]} />
          {matRecess}
        </mesh>
        
        <mesh position={[0, 0, 0.06]}>
          <ringGeometry args={[0.3, 0.32, 64]} />
          <meshStandardMaterial color="#8b5cf6" emissive="#8b5cf6" emissiveIntensity={1} toneMapped={false} />
        </mesh>
        
        <mesh position={[0, 0, 0.06]}>
          <ringGeometry args={[0.22, 0.23, 64]} />
          <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.5} toneMapped={false} />
        </mesh>

        {/* HARDWARE-INTEGRATED "IV" LOGO */}
        <group ref={ivBrandRef} position={[0, 0, 0.06]}>
          <mesh position={[-0.08, 0, 0]}>
            <capsuleGeometry args={[0.015, 0.15, 16, 16]} />
            <meshStandardMaterial color="#ffffff" emissive="#22d3ee" emissiveIntensity={2} toneMapped={false} />
          </mesh>
          <mesh position={[0.03, 0, 0]} rotation={[0, 0, 0.35]}>
            <capsuleGeometry args={[0.015, 0.16, 16, 16]} />
            <meshStandardMaterial color="#ffffff" emissive="#22d3ee" emissiveIntensity={2} toneMapped={false} />
          </mesh>
          <mesh position={[0.11, 0, 0]} rotation={[0, 0, -0.35]}>
            <capsuleGeometry args={[0.015, 0.16, 16, 16]} />
            <meshStandardMaterial color="#ffffff" emissive="#22d3ee" emissiveIntensity={2} toneMapped={false} />
          </mesh>
        </group>

        <pointLight ref={coreLightRef} color="#8b5cf6" distance={2} intensity={5} decay={2} position={[0, 0, 0.1]} />
      </group>

    </group>
  );
}
