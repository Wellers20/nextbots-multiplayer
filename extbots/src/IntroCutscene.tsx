import { useFrame, useThree, useLoader } from '@react-three/fiber';
import { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useGameStore } from './store';
import { useFBX, useAnimations, PositionalAudio } from '@react-three/drei';

const introMonsterMaterial = new THREE.MeshStandardMaterial({ 
  color: 0xcccccc,
  roughness: 0.5,
});

export const IntroCutscene = () => {
  const { camera } = useThree();
  const triggerIntroJumpscare = useGameStore(s => s.triggerIntroJumpscare);
  const gameState = useGameStore(s => s.gameState);
  
  const monsterRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const hasTriggeredJumpscare = useRef(false);

  // Load FBX
  const runFbx = useFBX('https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/Run.fbx');
  const clonedFbx = useMemo(() => runFbx.clone(), [runFbx]);
  
  const animations = useMemo(() => {
    if (!runFbx) return [];
    if (runFbx.animations.length > 0) runFbx.animations[0].name = 'Run';
    
    const removeRootMotion = (clip: THREE.AnimationClip) => {
      clip.tracks.forEach(track => {
        if (track.name.includes('.position')) {
          const initialX = track.values[0];
          const initialZ = track.values[2];
          for (let i = 0; i < track.values.length; i += 3) {
            track.values[i] = initialX;
            track.values[i + 2] = initialZ;
          }
        }
      });
    };
    runFbx.animations.forEach(removeRootMotion);
    return [...runFbx.animations];
  }, [runFbx]);

  const { actions } = useAnimations(animations, monsterRef);

  useEffect(() => {
    if (clonedFbx) {
      clonedFbx.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if ((child.material as THREE.MeshStandardMaterial).map === null) {
            child.material = introMonsterMaterial;
          }
        }
      });
      
      const box = new THREE.Box3().setFromObject(clonedFbx);
      const size = new THREE.Vector3();
      box.getSize(size);
      
      const targetHeight = 4.0;
      const scaleFactor = size.y > 0.01 ? (targetHeight / size.y) : 0.05;
      
      clonedFbx.scale.setScalar(scaleFactor);
      clonedFbx.position.set(0, 0, 0);
    }
  }, [clonedFbx]);

  useEffect(() => {
    if (gameState === 'intro') {
      timeRef.current = 0;
      hasTriggeredJumpscare.current = false;
      camera.position.set(0, 2, 10);
      camera.rotation.set(0, 0, 0);
      
      if (monsterRef.current) {
        monsterRef.current.position.set(5, 0, -5); // Hidden around corner
        monsterRef.current.rotation.set(0, -Math.PI / 2, 0);
      }
      
      const runAction = actions['Run'];
      if (runAction) {
        runAction.reset().play();
      }
    }
  }, [gameState, camera, actions]);

  useFrame((state, delta) => {
    if (gameState !== 'intro') return;
    
    timeRef.current += delta;
    const t = timeRef.current;

    // Camera bobbing and moving forward slowly
    if (t < 3) {
      camera.position.z -= delta * 2;
      camera.position.y = 2 + Math.sin(t * 5) * 0.1;
    }

    if (monsterRef.current) {
      if (t > 2 && t < 3) {
        // Monster steps out
        monsterRef.current.position.x -= delta * 5;
        if (monsterRef.current.position.x < 0) monsterRef.current.position.x = 0;
        monsterRef.current.rotation.y = THREE.MathUtils.lerp(monsterRef.current.rotation.y, 0, delta * 5);
      } else if (t >= 3) {
        // Monster runs at player
        monsterRef.current.position.z += delta * 15;
        monsterRef.current.rotation.y = 0;
      }

      // Check distance for jumpscare
      const dist = camera.position.distanceTo(new THREE.Vector3(monsterRef.current.position.x, camera.position.y, monsterRef.current.position.z));
      if (dist < 2.5 && !hasTriggeredJumpscare.current) {
        hasTriggeredJumpscare.current = true;
        triggerIntroJumpscare();
      }
    }
  });

  if (gameState !== 'intro') return null;

  return (
    <group>
      {/* Simple Corridor */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 50]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[-5, 2.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[50, 5]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh position={[5, 2.5, 5]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[30, 5]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh position={[0, 5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 50]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      
      {/* Corner wall */}
      <mesh position={[5, 2.5, -5]} rotation={[0, 0, 0]}>
        <planeGeometry args={[10, 5]} />
        <meshStandardMaterial color="#333" />
      </mesh>

      <ambientLight intensity={0.1} />
      <pointLight position={[0, 4, 10]} intensity={2} distance={10} color="#fff5e6" />
      <pointLight position={[0, 4, 0]} intensity={2} distance={10} color="#fff5e6" />
      <pointLight position={[0, 4, -10]} intensity={2} distance={10} color="#fff5e6" />

      <group ref={monsterRef}>
        {clonedFbx && <primitive object={clonedFbx} />}
        <PositionalAudio
          url="https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/fast-walking-on-a-concrete-surface.mp3"
          distance={15}
          loop
          autoplay
        />
        <PositionalAudio
          url="https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/monster-growl.mp3"
          distance={20}
          loop
          autoplay
        />
      </group>
    </group>
  );
};

useFBX.preload('https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/Run.fbx');
useLoader.preload(THREE.AudioLoader, 'https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/fast-walking-on-a-concrete-surface.mp3');
useLoader.preload(THREE.AudioLoader, 'https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/monster-growl.mp3');
