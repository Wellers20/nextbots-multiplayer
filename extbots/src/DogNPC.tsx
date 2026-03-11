import { useRef, useEffect, useState, useMemo, Suspense } from 'react';
import { useFrame, useThree, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { useFBX, PositionalAudio } from '@react-three/drei';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { useGameStore } from './store';
import { CELL_SIZE, buildHouseGraph } from './House';

const DIALOG_SEQUENCE = [
  { speaker: 'Собака', text: 'асалам алейкум ты видел этого уебка?', audio: 'https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/One.mp3' },
  { speaker: 'Вы', text: 'да я видел', audio: 'https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/Two.mp3' },
  { speaker: 'Собака', text: 'он такой страшный я его вообще боюсь как свою мать', audio: 'https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/Three.mp3' },
  { speaker: 'Вы', text: 'нужно как то ему отомстить', audio: 'https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/Chetire.mp3' },
  { speaker: 'Собака', text: 'э да братан вообще согласен вот возьми мой большой ствол', audio: 'https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/Pat.mp3' },
  { speaker: 'Вы', text: 'спасибо браточек', audio: 'https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/Six.mp3' }
];

const defaultDogMaterial = new THREE.MeshStandardMaterial({ 
  color: 0xffffff,
  roughness: 0.7,
  metalness: 0.1,
  side: THREE.DoubleSide
});

const DogModel = () => {
  const fbx = useFBX('https://raw.githubusercontent.com/Wellers20/OcenIVATel/master/dog+3d+model.fbx');
  
  const clonedFbx = useMemo(() => {
    const clone = fbx.clone();

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (!mesh.material || (Array.isArray(mesh.material) && mesh.material.length === 0)) {
           mesh.material = defaultDogMaterial;
        }
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    
    // Делаем собаку еще больше (высота 2.5 единицы)
    const scale = 2.5 / size.y; 
    clone.scale.setScalar(scale);
    
    // Сдвигаем модель так, чтобы её нижняя точка стояла ровно на полу (y=0)
    const center = box.getCenter(new THREE.Vector3());
    clone.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    
    return clone;
  }, [fbx]);

  return <primitive object={clonedFbx} />;
};

export const DogNPC = ({ walls }: { walls: number[][] }) => {
  const { camera } = useThree();
  const map = useGameStore(s => s.map);
  const setDialog = useGameStore(s => s.setDialog);
  const setHasGun = useGameStore(s => s.setHasGun);
  const setShotgunDropped = useGameStore(s => s.setShotgunDropped);
  const dialog = useGameStore(s => s.dialog);
  const gameState = useGameStore(s => s.gameState);
  const groupRef = useRef<THREE.Group>(null);
  const audioRefs = useRef<(THREE.PositionalAudio | null)[]>([]);

  const [dialogStep, setDialogStep] = useState(-1);
  const [hasTalked, setHasTalked] = useState(false);
  const [spawnPos, setSpawnPos] = useState<THREE.Vector3 | null>(null);

  // Spawning logic (similar to Nextbot)
  const grid = useMemo(() => {
    const set = new Set<string>();
    walls.forEach(([x, z]) => set.add(`${x},${z}`));
    return set;
  }, [walls]);

  const houseGraph = useMemo(() => {
    if (map === 'house') return buildHouseGraph();
    return null;
  }, [map]);

  useEffect(() => {
    if (gameState !== 'playing') {
      setDialogStep(-1);
      setHasTalked(false);
      return;
    }

    // Spawn logic
    // FOR TESTING: Spawn dog right in front of the player
    setSpawnPos(new THREE.Vector3(0, 0, -5));
  }, [map, grid, houseGraph, gameState]);

  // Interaction and rotation logic
  useFrame(() => {
    if (!spawnPos || gameState !== 'playing') return;

    // Rotate to face player
    if (groupRef.current) {
      const targetPosition = camera.position.clone();
      targetPosition.y = groupRef.current.position.y; // Keep rotation only on Y axis
      groupRef.current.lookAt(targetPosition);
    }

    if (hasTalked) return;

    const dist = camera.position.distanceTo(spawnPos);
    if (dist < 4 && dialogStep === -1) {
      setDialogStep(0);
      setDialog(DIALOG_SEQUENCE[0]);
    }
  });

  // Handle audio playback
  useEffect(() => {
    // Stop all currently playing audio
    audioRefs.current.forEach(audio => {
      if (audio?.isPlaying) {
        audio.stop();
      }
    });

    // Play the current step's audio
    if (dialogStep >= 0 && dialogStep < DIALOG_SEQUENCE.length) {
      const currentAudio = audioRefs.current[dialogStep];
      if (currentAudio && !currentAudio.isPlaying) {
        currentAudio.play();
      }
    }
  }, [dialogStep]);

  // Handle input for dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyE' && dialogStep >= 0 && !hasTalked) {
        const nextStep = dialogStep + 1;
        if (nextStep < DIALOG_SEQUENCE.length) {
          setDialogStep(nextStep);
          setDialog(DIALOG_SEQUENCE[nextStep]);
        } else {
          setDialog(null);
          setHasTalked(true);
          if (spawnPos) {
            setShotgunDropped(true, [spawnPos.x, 0.5, spawnPos.z + 2]);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialogStep, hasTalked, setDialog, setShotgunDropped, spawnPos]);

  // Expose a global function for mobile UI to trigger the dialog step
  useEffect(() => {
    (window as any).advanceDogDialog = () => {
      if (dialogStep >= 0 && !hasTalked) {
        const nextStep = dialogStep + 1;
        if (nextStep < DIALOG_SEQUENCE.length) {
          setDialogStep(nextStep);
          setDialog(DIALOG_SEQUENCE[nextStep]);
        } else {
          setDialog(null);
          setHasTalked(true);
          if (spawnPos) {
            setShotgunDropped(true, [spawnPos.x, 0.5, spawnPos.z + 2]);
          }
        }
      }
    };
    return () => {
      delete (window as any).advanceDogDialog;
    };
  }, [dialogStep, hasTalked, setDialog, setShotgunDropped, spawnPos]);

  if (!spawnPos) return null;

  return (
    <RigidBody type="fixed" position={spawnPos} colliders={false}>
      <CuboidCollider args={[0.8, 1.25, 1.5]} position={[0, 1.25, 0]} />
      <group ref={groupRef}>
        <Suspense fallback={<mesh><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="brown" /></mesh>}>
          <DogModel />

          {DIALOG_SEQUENCE.map((step, index) => (
            <PositionalAudio
              key={index}
              ref={(el) => (audioRefs.current[index] = el as any)}
              url={step.audio}
              distance={25}
              loop={false}
              autoplay={false}
            />
          ))}
        </Suspense>
      </group>
    </RigidBody>
  );
};

// Preload assets to ensure they load during the initial loading screen
useFBX.preload('https://raw.githubusercontent.com/Wellers20/OcenIVATel/master/dog+3d+model.fbx');
DIALOG_SEQUENCE.forEach(step => {
  useLoader.preload(THREE.AudioLoader, step.audio);
});
