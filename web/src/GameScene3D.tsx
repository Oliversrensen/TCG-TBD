import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Board3D } from "./Board3D";

export function GameScene3D() {
  return (
    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, #0d1b2a 0%, #050a0f 100%)" }}>
      <Canvas
        camera={{ position: [0, 8, 12], fov: 45 }}
        shadows
        gl={{ alpha: true, antialias: true }}
      >
        <color attach="background" args={["transparent"]} />
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[10, 15, 10]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={50}
          shadow-camera-left={-15}
          shadow-camera-right={15}
          shadow-camera-top={15}
          shadow-camera-bottom={-15}
        />
        <pointLight position={[-5, 5, 5]} intensity={0.5} color="#4a7cff" />
        <Board3D />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 2 - 0.4}
          maxPolarAngle={Math.PI / 2 + 0.15}
          minAzimuthAngle={-0.3}
          maxAzimuthAngle={0.3}
        />
      </Canvas>
    </div>
  );
}
