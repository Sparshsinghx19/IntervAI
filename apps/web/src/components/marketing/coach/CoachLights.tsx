export function CoachLights() {
  return (
    <>
      {/* 5. PURPLE AMBIENT: Very subtle environmental tint for the white shell */}
      <ambientLight intensity={1.5} color="#4c1d95" />
      
      {/* 1. KEY LIGHT: Soft cool white, illuminates the front of the white body */}
      <directionalLight position={[-4, 6, 5]} intensity={4} color="#f8fafc" />
      
      {/* 4. BLUE FILL: Subtle electric blue from below to prevent harsh black shadows */}
      <directionalLight position={[0, -2, 5]} intensity={1.5} color="#3b82f6" />
      
      {/* 2. CYAN RIM: Bright cyan outlining one side of the Coach */}
      <spotLight 
        position={[6, 3, -5]} 
        angle={0.8} 
        penumbra={0.8} 
        intensity={60} 
        color="#22d3ee" 
        distance={25}
        decay={1.5}
      />
      
      {/* 3. VIOLET RIM: Signature purple outlining the opposite side */}
      <spotLight 
        position={[-5, 1, -4]} 
        angle={0.8} 
        penumbra={0.8} 
        intensity={40} 
        color="#8b5cf6" 
        distance={25}
        decay={1.5}
      />
    </>
  );
}
