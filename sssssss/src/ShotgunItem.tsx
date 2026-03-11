import { useEffect, useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useFBX, PositionalAudio } from '@react-three/drei';
import { useGameStore } from './store';

const defaultMaterial = new THREE.MeshStandardMaterial({
  color: 0x555555,
  roughness: 0.4,
  metalness: 0.8,
});

export const ShotgunItem = () => {
  const isShotgunDropped = useGameStore(s => s.isShotgunDropped);
  const shotgunPosition = useGameStore(s => s.shotgunPosition);
  const hasGun = useGameStore(s => s.hasGun);
  const setCanPickUpShotgun = useGameStore(s => s.setCanPickUpShotgun);
  const { camera } = useThree();
  
  const fbx = useFBX('https://raw.githubusercontent.com/Wellers20/OcenIVATel/master/doubleburrelfbx.fbx');
  const groupRef = useRef<THREE.Group>(null);
  const dropAudioRef = useRef<THREE.PositionalAudio>(null);

  const clonedFbx = useMemo(() => {
    const clone = fbx.clone();
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (!mesh.material || (Array.isArray(mesh.material) && mesh.material.length === 0)) {
           mesh.material = defaultMaterial;
        }
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    // Scale and position adjustment
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 0.8 / maxDim; // 0.8 meters long
    clone.scale.setScalar(scale);
    
    // Rotate to lay flat on the ground
    clone.rotation.x = Math.PI / 2;

    return clone;
  }, [fbx]);

  useEffect(() => {
    if (isShotgunDropped && !hasGun && dropAudioRef.current) {
      dropAudioRef.current.setVolume(2.0);
      dropAudioRef.current.play();
    }
  }, [isShotgunDropped, hasGun]);

  // Floating animation and distance check
  useFrame((state) => {
    if (groupRef.current && shotgunPosition) {
      groupRef.current.position.y = shotgunPosition[1] + Math.sin(state.clock.elapsedTime * 2) * 0.1;
      groupRef.current.rotation.y += 0.01;

      // Check distance to player
      const dist = camera.position.distanceTo(groupRef.current.position);
      const canPickUp = dist < 3;
      if (canPickUp !== useGameStore.getState().canPickUpShotgun) {
        setCanPickUpShotgun(canPickUp);
      }
    }
  });

  // Cleanup when unmounted or picked up
  useEffect(() => {
    return () => setCanPickUpShotgun(false);
  }, [setCanPickUpShotgun]);

  if (!isShotgunDropped || hasGun || !shotgunPosition) return null;

  return (
    <group ref={groupRef} position={shotgunPosition}>
      <primitive object={clonedFbx} />
      <PositionalAudio
        ref={dropAudioRef}
        url="https://raw.githubusercontent.com/Wellers20/OcenIVATel/master/4abea0e1158bf74.mp3"
        distance={20}
        loop={false}
        autoplay={false}
      />
    </group>
  );
};
