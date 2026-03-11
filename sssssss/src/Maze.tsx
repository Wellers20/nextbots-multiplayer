import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { Instances, Instance, useTexture } from '@react-three/drei';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { useGameStore } from './store';

export const WALL_HEIGHT = 4;
export const CELL_SIZE = 4;

export const generateMaze = () => {
  const size = 15; // 31x31 grid
  const grid = Array(size * 2 + 1).fill(0).map(() => Array(size * 2 + 1).fill(1));
  
  const carve = (x: number, y: number) => {
    grid[y][x] = 0;
    const dirs = [[0, -2], [0, 2], [-2, 0], [2, 0]].sort(() => Math.random() - 0.5);
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (nx > 0 && nx < size * 2 && ny > 0 && ny < size * 2 && grid[ny][nx] === 1) {
        grid[y + dy / 2][x + dx / 2] = 0;
        carve(nx, ny);
      }
    }
  };
  
  carve(size, size); // Start from center
  
  // Add loops (remove random walls) to make it feel like backrooms
  for (let i = 0; i < size * size; i++) {
    const rx = Math.floor(Math.random() * (size * 2 - 2)) + 1;
    const ry = Math.floor(Math.random() * (size * 2 - 2)) + 1;
    grid[ry][rx] = 0;
  }

  // Clear center 3x3 for spawn
  for(let i = size - 1; i <= size + 1; i++) {
    for(let j = size - 1; j <= size + 1; j++) {
      grid[i][j] = 0;
    }
  }

  const walls = [];
  for (let i = 0; i <= size * 2; i++) {
    for (let j = 0; j <= size * 2; j++) {
      if (grid[i][j] === 1) {
        walls.push([i - size, j - size]);
      }
    }
  }
  return walls;
};

export const Maze = ({ walls }: { walls: number[][] }) => {
  const [wallTex, floorTex] = useTexture([
    'https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/images.jpeg',
    'https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/scary-dark-old-wall-texture-background-wall-is-full-stains-scratches_493325-1662.jpg'
  ]);

  useMemo(() => {
    wallTex.colorSpace = THREE.SRGBColorSpace;
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(2, 2);

    floorTex.colorSpace = THREE.SRGBColorSpace;
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(30, 30);
  }, [wallTex, floorTex]);

  const mazeSize = 15 * 2 * CELL_SIZE + CELL_SIZE;

  const setNotes = useGameStore(state => state.setNotes);
  const gameState = useGameStore(state => state.gameState);

  useEffect(() => {
    if (gameState === 'playing') {
      const gridSet = new Set(walls.map(w => `${w[0]},${w[1]}`));
      const validSpawns = [];
      for (let x = -14; x <= 14; x++) {
        for (let z = -14; z <= 14; z++) {
          if (!gridSet.has(`${x},${z}`) && (Math.abs(x) > 3 || Math.abs(z) > 3)) {
            validSpawns.push([x, z]);
          }
        }
      }
      
      validSpawns.sort(() => Math.random() - 0.5);
      const notes = [];
      for (let i = 0; i < 8 && i < validSpawns.length; i++) {
        notes.push({
          id: `note-maze-${i}`,
          position: [validSpawns[i][0] * CELL_SIZE, 1.5, validSpawns[i][1] * CELL_SIZE] as [number, number, number]
        });
      }
      setNotes(notes);
    }
  }, [gameState, walls, setNotes]);

  return (
    <group>
      {/* Floor */}
      <RigidBody type="fixed" position={[0, -0.5, 0]}>
        <CuboidCollider args={[mazeSize / 2, 0.5, mazeSize / 2]} />
        <mesh position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[mazeSize, mazeSize]} />
          <meshStandardMaterial map={floorTex} color="#cccccc" roughness={0.9} />
        </mesh>
      </RigidBody>
      
      {/* Ceiling */}
      <RigidBody type="fixed" position={[0, WALL_HEIGHT + 0.5, 0]}>
        <CuboidCollider args={[mazeSize / 2, 0.5, mazeSize / 2]} />
        <mesh position={[0, -0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[mazeSize, mazeSize]} />
          <meshStandardMaterial color="#222222" roughness={0.9} />
        </mesh>
      </RigidBody>

      {/* Visual Walls */}
      <Instances limit={walls.length}>
        <boxGeometry args={[CELL_SIZE, WALL_HEIGHT, CELL_SIZE]} />
        <meshStandardMaterial map={wallTex} color="#dddddd" roughness={0.8} />
        {walls.map(([x, z], i) => (
          <Instance key={i} position={[x * CELL_SIZE, WALL_HEIGHT / 2, z * CELL_SIZE]} />
        ))}
      </Instances>

      {/* Physics Walls */}
      {walls.map(([x, z], i) => (
        <RigidBody key={`rb-${i}`} type="fixed" position={[x * CELL_SIZE, WALL_HEIGHT / 2, z * CELL_SIZE]}>
          <CuboidCollider args={[CELL_SIZE / 2, WALL_HEIGHT / 2, CELL_SIZE / 2]} />
        </RigidBody>
      ))}
    </group>
  );
};

useTexture.preload('https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/images.jpeg');
useTexture.preload('https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/scary-dark-old-wall-texture-background-wall-is-full-stains-scratches_493325-1662.jpg');
