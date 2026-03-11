import { Canvas } from '@react-three/fiber';
import { useMemo, Suspense } from 'react';
import * as THREE from 'three';
import { Maze, generateMaze } from './Maze';
import { House } from './House';
import { Player } from './Player';
import { Nextbot } from './Nextbot';
import { SecondMonster } from './SecondMonster';
import { DogNPC } from './DogNPC';
import { ShotgunItem } from './ShotgunItem';
import { IntroCutscene } from './IntroCutscene';
import { NotesManager } from './Notes';
import { MultiplayerManager } from './Multiplayer';
import { useGameStore } from './store';
import { Physics } from '@react-three/rapier';

export const Game = () => {
  const walls = useMemo(() => generateMaze(), []);
  const map = useGameStore((state) => state.map);
  const gameState = useGameStore((state) => state.gameState);

  return (
    <Canvas>
      <fog attach="fog" args={['#050505', 2, 12]} />
      <ambientLight intensity={0.2} />
      <Suspense fallback={null}>
        <Physics gravity={[0, -30, 0]}>
          <MultiplayerManager />
          {gameState === 'intro' ? (
            <IntroCutscene />
          ) : map === 'maze' ? (
            <>
              <Maze walls={walls} />
              <Player spawnPos={[0, 2, 0]} />
              <Nextbot walls={walls} />
              <SecondMonster walls={walls} />
              <DogNPC walls={walls} />
              <ShotgunItem />
              <NotesManager />
            </>
          ) : (
            <>
              <House />
              <Player spawnPos={[-8, 2, -8]} />
              <Nextbot walls={[]} />
              <SecondMonster walls={[]} />
              <DogNPC walls={[]} />
              <ShotgunItem />
              <NotesManager />
            </>
          )}
        </Physics>
      </Suspense>
    </Canvas>
  );
};
