import { useRef } from "react";
import { Mesh } from "three";
import * as THREE from "three";

export function Board3D() {
  const meshRef = useRef<Mesh>(null);

  // Felt-like green board material
  const feltColor = new THREE.Color("#1a4d2e");
  const feltDark = new THREE.Color("#0f3320");

  return (
    <group position={[0, 0, 0]}>
      {/* Main felt surface - tilted toward viewer like a table */}
      <mesh
        ref={meshRef}
        rotation={[-0.15, 0, 0]}
        position={[0, -0.5, 0]}
        receiveShadow
      >
        <planeGeometry args={[14, 10]} />
        <meshStandardMaterial
          color={feltColor}
          roughness={0.9}
          metalness={0}
          emissive={feltDark}
          emissiveIntensity={0.2}
        />
      </mesh>
      {/* Wooden frame / border */}
      <mesh
        position={[0, -0.48, 0]}
        rotation={[-0.15, 0, 0]}
        receiveShadow
      >
        <ringGeometry args={[6.8, 7.2, 32]} />
        <meshStandardMaterial
          color="#3d2914"
          roughness={0.8}
          metalness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Inner decorative ring */}
      <mesh
        position={[0, -0.47, 0]}
        rotation={[-0.15, 0, 0]}
      >
        <ringGeometry args={[6.6, 6.8, 32]} />
        <meshStandardMaterial
          color="#5c4a0a"
          roughness={0.7}
          metalness={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
