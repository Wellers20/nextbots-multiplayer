import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import * as THREE from 'three';
import { useGameStore } from './store';
import { useTexture } from '@react-three/drei';

const Note = ({ id, position }: { id: string, position: [number, number, number] }) => {
  const ref = useRef<THREE.Mesh>(null);
  const texture = useTexture('https://raw.githubusercontent.com/Wellers20/OcenIVATel/master/db004b5faca6b68b660a6ca8341df743.jpg');
  const pickUpNote = useGameStore(state => state.pickUpNote);
  const [pickedUp, setPickedUp] = useState(false);

  useFrame(({ camera, clock }) => {
    if (!ref.current || pickedUp) return;
    
    // Float and rotate
    ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * 2 + position[0]) * 0.1;
    ref.current.rotation.y += 0.01;

    // Check distance
    if (camera.position.distanceTo(ref.current.position) < 2.5) {
      setPickedUp(true);
      pickUpNote(id);
      // Play sound
      const audio = new Audio('https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/silent-click-with-echo.mp3');
      audio.volume = 1.0;
      audio.play().catch(() => {});
    }
  });

  if (pickedUp) return null;

  return (
    <mesh ref={ref} position={position}>
      <planeGeometry args={[0.6, 0.8]} />
      <meshStandardMaterial map={texture} side={THREE.DoubleSide} />
      <pointLight distance={4} intensity={2} color="#ffffff" />
    </mesh>
  );
};

export const NotesManager = () => {
  const activeNotes = useGameStore(state => state.activeNotes);
  return (
    <>
      {activeNotes.map(note => (
        <Note key={note.id} id={note.id} position={note.position} />
      ))}
    </>
  );
};
