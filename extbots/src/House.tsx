import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { Instances, Instance, useTexture } from '@react-three/drei';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { useGameStore } from './store';

export const CELL_SIZE = 4;
export const WALL_HEIGHT = 4;

// 1 = Wall, 0 = Empty, S = Stairs Up (North), H = Hole (Empty, no floor)
export const houseLayout = {
  floor0: [
    "1111111111",
    "1000000001",
    "1011101101",
    "1010000101",
    "1010110101",
    "1000010001",
    "1111011111",
    "1000000001", // z=7 (Arrival from stairs if going down)
    "10000001S1", // z=8 (Stairs going UP towards North)
    "1111111111", // z=9
  ],
  floor1: [
    "1111111111",
    "1000100001",
    "1000100001",
    "1101111011",
    "1000000001",
    "1000000001",
    "1111111111",
    "1000000001", // z=7 (Floor 1 landing)
    "10000001H1", // z=8 (Hole for stairs)
    "1111111111", // z=9
  ]
};

export const buildHouseGraph = () => {
  const graph = new Map<string, string[]>();
  
  const addEdge = (u: string, v: string) => {
    if (!graph.has(u)) graph.set(u, []);
    if (!graph.has(v)) graph.set(v, []);
    graph.get(u)!.push(v);
    graph.get(v)!.push(u);
  };

  const isWalkable = (floor: number, x: number, z: number) => {
    const layout = floor === 0 ? houseLayout.floor0 : houseLayout.floor1;
    if (z < 0 || z >= layout.length || x < 0 || x >= layout[z].length) return false;
    const char = layout[z][x];
    if (floor === 1 && char === 'H') return false; // Don't walk on holes
    return char === '0' || char === 'S';
  };

  // Connect horizontal cells
  for (let y = 0; y < 2; y++) {
    const layout = y === 0 ? houseLayout.floor0 : houseLayout.floor1;
    for (let z = 0; z < layout.length; z++) {
      for (let x = 0; x < layout[z].length; x++) {
        if (isWalkable(y, x, z)) {
          const u = `${x},${y},${z}`;
          if (isWalkable(y, x + 1, z)) addEdge(u, `${x + 1},${y},${z}`);
          if (isWalkable(y, x, z + 1)) addEdge(u, `${x},${y},${z + 1}`);
        }
      }
    }
  }

  // Connect stairs
  // In floor0, S is at z=8. It connects to floor1 at z=7.
  // Let's find S and connect it to H or landing above it.
  for (let z = 0; z < houseLayout.floor0.length; z++) {
    for (let x = 0; x < houseLayout.floor0[z].length; x++) {
      if (houseLayout.floor0[z][x] === 'S') {
        // Connect bottom of stairs (z=8) to top of stairs landing (floor1, z=7)
        // Wait, the stairs go from z=8 to z=7.
        // So floor0, z=8 connects to floor1, z=7.
        addEdge(`${x},0,${z}`, `${x},1,${z - 1}`);
      }
    }
  }

  return graph;
};

export const House = () => {
  const [wallTex, floorTex, woodTex] = useTexture([
    'https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/images.jpeg',
    'https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/scary-dark-old-wall-texture-background-wall-is-full-stains-scratches_493325-1662.jpg',
    'https://images.unsplash.com/photo-1517646287270-a5a9ca602e5c?auto=format&fit=crop&q=80&w=512' // Wood texture for stairs/floor
  ]);

  useMemo(() => {
    wallTex.colorSpace = THREE.SRGBColorSpace;
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(2, 2);

    floorTex.colorSpace = THREE.SRGBColorSpace;
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(10, 10);

    woodTex.colorSpace = THREE.SRGBColorSpace;
    woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
    woodTex.repeat.set(2, 2);
  }, [wallTex, floorTex, woodTex]);

  const { walls, floors, stairs } = useMemo(() => {
    const w: { pos: THREE.Vector3 }[] = [];
    const f: { pos: THREE.Vector3 }[] = [];
    const s: { pos: THREE.Vector3 }[] = [];

    const processFloor = (layout: string[], yOffset: number, isFloor1: boolean) => {
      layout.forEach((row, z) => {
        for (let x = 0; x < row.length; x++) {
          const char = row[x];
          const posX = (x - 5) * CELL_SIZE;
          const posZ = (z - 5) * CELL_SIZE;

          if (char === '1') {
            w.push({ pos: new THREE.Vector3(posX, yOffset + WALL_HEIGHT / 2, posZ) });
          } else if (char === 'S') {
            s.push({ pos: new THREE.Vector3(posX, yOffset + WALL_HEIGHT / 2, posZ) });
          }

          // Add floor unless it's a hole or stairs
          if (isFloor1) {
            if (char !== 'H' && char !== 'S') {
              f.push({ pos: new THREE.Vector3(posX, yOffset, posZ) });
            }
          }
        }
      });
    };

    processFloor(houseLayout.floor0, 0, false);
    processFloor(houseLayout.floor1, WALL_HEIGHT, true);

    return { walls: w, floors: f, stairs: s };
  }, []);

  const wallPositions = useMemo(() => walls.map(w => w.pos), [walls]);
  const floorPositions = useMemo(() => floors.map(f => f.pos), [floors]);

  const setNotes = useGameStore(state => state.setNotes);
  const gameState = useGameStore(state => state.gameState);

  useEffect(() => {
    if (gameState === 'playing') {
      const graph = buildHouseGraph();
      const nodes = Array.from(graph.keys());
      const validSpawns = nodes.filter(n => {
        const [x, y, z] = n.split(',').map(Number);
        // Don't spawn exactly at player start (3,0,3)
        return Math.abs(x - 3) > 2 || Math.abs(z - 3) > 2;
      });

      validSpawns.sort(() => Math.random() - 0.5);
      const notes = [];
      for (let i = 0; i < 8 && i < validSpawns.length; i++) {
        const [x, y, z] = validSpawns[i].split(',').map(Number);
        notes.push({
          id: `note-house-${i}`,
          position: [(x - 5) * CELL_SIZE, y * 4 + 1.5, (z - 5) * CELL_SIZE] as [number, number, number]
        });
      }
      setNotes(notes);
    }
  }, [gameState, setNotes]);

  return (
    <group>
      {/* Ground Floor */}
      <RigidBody type="fixed" position={[-2, -0.5, -2]}>
        <CuboidCollider args={[(10 * CELL_SIZE) / 2, 0.5, (10 * CELL_SIZE) / 2]} />
        <mesh position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[10 * CELL_SIZE, 10 * CELL_SIZE]} />
          <meshStandardMaterial map={floorTex} color="#888888" roughness={0.9} />
        </mesh>
      </RigidBody>

      {/* Ceiling (Top of Floor 1) */}
      <RigidBody type="fixed" position={[-2, WALL_HEIGHT * 2 + 0.5, -2]}>
        <CuboidCollider args={[(10 * CELL_SIZE) / 2, 0.5, (10 * CELL_SIZE) / 2]} />
        <mesh position={[0, -0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[10 * CELL_SIZE, 10 * CELL_SIZE]} />
          <meshStandardMaterial color="#222222" roughness={0.9} />
        </mesh>
      </RigidBody>

      {/* Visual Walls */}
      <Instances limit={wallPositions.length}>
        <boxGeometry args={[CELL_SIZE, WALL_HEIGHT, CELL_SIZE]} />
        <meshStandardMaterial map={wallTex} color="#dddddd" roughness={0.8} />
        {wallPositions.map((pos, i) => (
          <Instance key={`w-${i}`} position={pos} />
        ))}
      </Instances>

      {/* Physics Walls */}
      {wallPositions.map((pos, i) => (
        <RigidBody key={`rb-w-${i}`} type="fixed" position={pos}>
          <CuboidCollider args={[CELL_SIZE / 2, WALL_HEIGHT / 2, CELL_SIZE / 2]} />
        </RigidBody>
      ))}

      {/* Visual Second Floor Tiles */}
      <Instances limit={floorPositions.length}>
        <boxGeometry args={[CELL_SIZE, 0.2, CELL_SIZE]} />
        <meshStandardMaterial map={woodTex} color="#aaaaaa" roughness={0.8} />
        {floorPositions.map((pos, i) => (
          <Instance key={`f-${i}`} position={pos} />
        ))}
      </Instances>

      {/* Physics Second Floor Tiles */}
      {floorPositions.map((pos, i) => (
        <RigidBody key={`rb-f-${i}`} type="fixed" position={pos}>
          <CuboidCollider args={[CELL_SIZE / 2, 0.1, CELL_SIZE / 2]} />
        </RigidBody>
      ))}

      {/* Stairs */}
      {stairs.map((stair, i) => (
        <RigidBody key={`s-${i}`} type="fixed" position={[stair.pos.x, WALL_HEIGHT / 2, stair.pos.z - CELL_SIZE / 2]}>
          <CuboidCollider 
            args={[CELL_SIZE / 2, 0.25, Math.sqrt(CELL_SIZE*CELL_SIZE + WALL_HEIGHT*WALL_HEIGHT) / 2]} 
            rotation={[-Math.atan(WALL_HEIGHT / CELL_SIZE), 0, 0]} 
          />
          {/* Ramp geometry. Rotated to go up towards -Z (North) */}
          <mesh rotation={[-Math.atan(WALL_HEIGHT / CELL_SIZE), 0, 0]}>
            <boxGeometry args={[CELL_SIZE, 0.5, Math.sqrt(CELL_SIZE*CELL_SIZE + WALL_HEIGHT*WALL_HEIGHT)]} />
            <meshStandardMaterial map={woodTex} color="#888888" roughness={0.8} />
          </mesh>
        </RigidBody>
      ))}
    </group>
  );
};

useTexture.preload('https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/images.jpeg');
useTexture.preload('https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/scary-dark-old-wall-texture-background-wall-is-full-stains-scratches_493325-1662.jpg');
useTexture.preload('https://images.unsplash.com/photo-1517646287270-a5a9ca602e5c?auto=format&fit=crop&q=80&w=512');
