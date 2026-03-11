import { useFrame, useThree, useLoader } from '@react-three/fiber';
import { useRef, useEffect, useMemo, useState } from 'react';
import { useFBX, useAnimations, PositionalAudio } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from './store';
import { CELL_SIZE } from './Maze';
import { buildHouseGraph, houseLayout } from './House';

const nextbotMaterial = new THREE.MeshStandardMaterial({ 
  color: 0xcccccc,
  roughness: 0.5,
});

export const SecondMonster = ({ walls }: { walls: number[][] }) => {
  const ref = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const gameState = useGameStore((state) => state.gameState);

  const velocity = useRef(new THREE.Vector3());
  const targetPos = useRef(new THREE.Vector3());
  const finalTargetPos = useRef(new THREE.Vector3());
  const lastPathUpdate = useRef(0);
  const lastSeenPlayerTime = useRef(0);
  const lastSeenPlayerPos = useRef(new THREE.Vector3());

  const [isChasing, setIsChasing] = useState(false);
  const [isDead, setIsDead] = useState(false);

  // Load both FBX files for the second monster
  const walkFbx = useFBX('https://raw.githubusercontent.com/Wellers20/OcenIVATel/master/Strut%20Walking%20(1).fbx');
  const runFbx = useFBX('https://raw.githubusercontent.com/Wellers20/OcenIVATel/master/Walk%20With%20Rifle.fbx');

  // Combine animations and remove root motion
  const animations = useMemo(() => {
    if (!walkFbx || !runFbx) return [];
    
    if (walkFbx.animations.length > 0) walkFbx.animations[0].name = 'Walk';
    if (runFbx.animations.length > 0) runFbx.animations[0].name = 'Run';
    
    const removeRootMotion = (clip: THREE.AnimationClip) => {
      clip.tracks.forEach(track => {
        if (track.name.includes('.position')) {
          const initialX = track.values[0];
          const initialZ = track.values[2];
          for (let i = 0; i < track.values.length; i += 3) {
            track.values[i] = initialX;     // Lock X
            track.values[i + 2] = initialZ; // Lock Z
          }
        }
      });
    };

    walkFbx.animations.forEach(removeRootMotion);
    runFbx.animations.forEach(removeRootMotion);

    return [...walkFbx.animations, ...runFbx.animations];
  }, [walkFbx, runFbx]);

  const { actions } = useAnimations(animations, ref);

  // Setup the model materials and scale
  useEffect(() => {
    if (walkFbx) {
      walkFbx.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if ((child.material as THREE.MeshStandardMaterial).map === null) {
            child.material = nextbotMaterial;
          }
        }
      });

      walkFbx.position.set(0, 0, 0);
      walkFbx.rotation.set(0, 0, 0);
      walkFbx.scale.setScalar(1);
      
      const box = new THREE.Box3().setFromObject(walkFbx);
      const size = new THREE.Vector3();
      box.getSize(size);
      
      const targetHeight = 4.0;
      const scaleFactor = size.y > 0.01 ? (targetHeight / size.y) : 0.05;
      
      walkFbx.scale.setScalar(scaleFactor);
      walkFbx.position.set(0, 0, 0);
    }
  }, [walkFbx]);

  // Handle animation transitions
  useEffect(() => {
    const walkAction = actions['Walk'];
    const runAction = actions['Run'];
    
    if (!walkAction || !runAction) return;

    if (isChasing) {
      walkAction.fadeOut(0.3);
      runAction.reset().fadeIn(0.3).play();
      runAction.setLoop(THREE.LoopRepeat, Infinity);
    } else {
      runAction.fadeOut(0.3);
      walkAction.reset().fadeIn(0.3).play();
      walkAction.setLoop(THREE.LoopRepeat, Infinity);
    }
  }, [isChasing, actions]);

  const map = useGameStore((state) => state.map);

  const grid = useMemo(() => {
    const g = new Set<string>();
    for (const [x, z] of walls) {
      g.add(`${x},${z}`);
    }
    return g;
  }, [walls]);

  const houseGraph = useMemo(() => {
    if (map !== 'house') return null;
    return buildHouseGraph();
  }, [map]);

  const getNextStep = (startX: number, startY: number, startZ: number, targetX: number, targetY: number, targetZ: number) => {
    if (map === 'house' && houseGraph) {
      const startNode = `${startX},${startY},${startZ}`;
      const targetNode = `${targetX},${targetY},${targetZ}`;
      
      const queue = [startNode];
      const visited = new Set<string>();
      visited.add(startNode);
      const parent = new Map<string, string>();

      let found = false;
      let iterations = 0;
      const maxIterations = 500;

      while (queue.length > 0 && iterations < maxIterations) {
        iterations++;
        const curr = queue.shift()!;
        if (curr === targetNode) {
          found = true;
          break;
        }
        
        const neighbors = houseGraph.get(curr) || [];
        for (const nx of neighbors) {
          if (!visited.has(nx)) {
            visited.add(nx);
            parent.set(nx, curr);
            queue.push(nx);
          }
        }
      }

      if (found) {
        let curr = targetNode;
        const path = [];
        while (curr !== startNode) {
          path.push(curr);
          const p = parent.get(curr);
          if (!p) break;
          curr = p;
        }
        if (path.length > 0) {
          const next = path[path.length - 1];
          const [nx, ny, nz] = next.split(',').map(Number);
          return [nx, ny, nz];
        }
      }
      return null;
    }

    // Maze pathfinding
    const queue = [[startX, startZ]];
    const visited = new Set<string>();
    visited.add(`${startX},${startZ}`);
    const parent = new Map<string, string>();

    let found = false;
    let iterations = 0;
    const maxIterations = 500;

    while (queue.length > 0 && iterations < maxIterations) {
      iterations++;
      const [cx, cz] = queue.shift()!;
      if (cx === targetX && cz === targetZ) {
        found = true;
        break;
      }
      
      const neighbors = [[cx+1, cz], [cx-1, cz], [cx, cz+1], [cx, cz-1]];
      neighbors.sort(() => Math.random() - 0.5);

      for (const [nx, nz] of neighbors) {
        const key = `${nx},${nz}`;
        if (!visited.has(key) && !grid.has(key)) {
          visited.add(key);
          parent.set(key, `${cx},${cz}`);
          queue.push([nx, nz]);
        }
      }
    }

    if (found) {
      let curr = `${targetX},${targetZ}`;
      const path = [];
      while (curr !== `${startX},${startZ}`) {
        path.push(curr);
        const p = parent.get(curr);
        if (!p) break;
        curr = p;
      }
      if (path.length > 0) {
        const next = path[path.length - 1];
        const [nx, nz] = next.split(',').map(Number);
        return [nx, 0, nz];
      }
    }
    return null;
  };

  useEffect(() => {
    if (ref.current && gameState === 'playing') {
      let spawnX = -20;
      let spawnY = 0;
      let spawnZ = -20;
      let found = false;
      let attempts = 0;
      
      if (map === 'house' && houseGraph) {
        const nodes = Array.from(houseGraph.keys());
        if (nodes.length > 0) {
          while (!found && attempts < 100) {
            const randomNode = nodes[Math.floor(Math.random() * nodes.length)];
            const [nx, ny, nz] = randomNode.split(',').map(Number);
            // Don't spawn too close to player
            if (Math.abs(nx - 3) > 2 || Math.abs(nz - 3) > 2 || ny !== 0) {
              spawnX = nx - 5; // Convert grid to world
              spawnY = ny;
              spawnZ = nz - 5; // Convert grid to world
              found = true;
            }
            attempts++;
          }
        }
      } else {
        const validSpawns = [];
        for (let x = -14; x <= 14; x++) {
          for (let z = -14; z <= 14; z++) {
            if (!grid.has(`${x},${z}`) && (Math.abs(x) > 5 || Math.abs(z) > 5)) {
              validSpawns.push([x, z]);
            }
          }
        }
        if (validSpawns.length > 0) {
          const spawn = validSpawns[Math.floor(Math.random() * validSpawns.length)];
          spawnX = spawn[0];
          spawnY = 0;
          spawnZ = spawn[1];
        }
      }

      ref.current.position.set(spawnX * CELL_SIZE, spawnY * 4, spawnZ * CELL_SIZE);
      velocity.current.set(0, 0, 0);
      targetPos.current.copy(ref.current.position);
      finalTargetPos.current.copy(ref.current.position);
    }
  }, [gameState, grid, map, houseGraph]);

  useEffect(() => {
    const onFire = (e: CustomEvent) => {
      if (isDead || gameState !== 'playing' || !ref.current) return;
      const { position, direction } = e.detail;
      
      const monsterPos = ref.current.position.clone();
      monsterPos.y += 2; // Aim at center of mass
      
      const toMonster = monsterPos.sub(position);
      const distance = toMonster.length();

      if (distance > 25) return; // Max shotgun range

      toMonster.normalize();
      const angle = direction.angleTo(toMonster);

      // Shotgun spread is relatively wide, say ~15 degrees (0.26 rad)
      if (angle < 0.25) {
        setIsDead(true);
        setTimeout(() => {
          setIsDead(false);
          // Teleport far away to respawn
          if (ref.current) {
            const rx = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 15 + 15);
            const rz = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 15 + 15);
            ref.current.position.set(rx, 0, rz);
            targetPos.current.copy(ref.current.position);
            finalTargetPos.current.copy(ref.current.position);
            velocity.current.set(0, 0, 0);
          }
        }, 10000); // 10 seconds dead
      }
    };

    window.addEventListener('shotgun-fire', onFire as any);
    return () => window.removeEventListener('shotgun-fire', onFire as any);
  }, [isDead, gameState]);

  useFrame((state, delta) => {
    if (gameState !== 'playing' || !ref.current) return;

    const bot = ref.current;

    if (isDead) {
      velocity.current.set(0, 0, 0);
      bot.rotation.x = THREE.MathUtils.lerp(bot.rotation.x, -Math.PI / 2, delta * 5);
      return;
    } else {
      bot.rotation.x = THREE.MathUtils.lerp(bot.rotation.x, 0, delta * 5);
    }

    const time = state.clock.getElapsedTime();
    
    const botGridX = map === 'house' ? Math.round(bot.position.x / CELL_SIZE) + 5 : Math.round(bot.position.x / CELL_SIZE);
    const botGridY = Math.round(bot.position.y / 4);
    const botGridZ = map === 'house' ? Math.round(bot.position.z / CELL_SIZE) + 5 : Math.round(bot.position.z / CELL_SIZE);
    
    const playerGridX = map === 'house' ? Math.round(camera.position.x / CELL_SIZE) + 5 : Math.round(camera.position.x / CELL_SIZE);
    const playerGridY = Math.max(0, Math.round((camera.position.y - 2) / 4));
    const playerGridZ = map === 'house' ? Math.round(camera.position.z / CELL_SIZE) + 5 : Math.round(camera.position.z / CELL_SIZE);

    // Line of sight check (Raymarching)
    const checkLineOfSight = (start: THREE.Vector3, end: THREE.Vector3) => {
      if (map === 'house') {
        if (Math.abs(start.y - end.y) > 2) return false;
        const distance = start.distanceTo(end);
        const direction = new THREE.Vector3().subVectors(end, start).normalize();
        const stepSize = CELL_SIZE / 4;
        let currentDist = 0;
        
        while (currentDist < distance) {
          const point = start.clone().add(direction.clone().multiplyScalar(currentDist));
          const gx = Math.round(point.x / CELL_SIZE);
          const gy = Math.round(point.y / 4);
          const gz = Math.round(point.z / CELL_SIZE);
          if (houseGraph && !houseGraph.has(`${gx},${gy},${gz}`)) {
             if (!houseGraph.has(`${gx},${gy},${gz}`)) return false;
          }
          currentDist += stepSize;
        }
        return true;
      }

      const distance = start.distanceTo(end);
      const direction = new THREE.Vector3().subVectors(end, start).normalize();
      const stepSize = CELL_SIZE / 4;
      let currentDist = 0;

      while (currentDist < distance) {
        const point = start.clone().add(direction.clone().multiplyScalar(currentDist));
        const gridX = Math.round(point.x / CELL_SIZE);
        const gridZ = Math.round(point.z / CELL_SIZE);
        if (grid.has(`${gridX},${gridZ}`)) {
          return false; // Hit a wall
        }
        currentDist += stepSize;
      }
      return true; // Clear line of sight
    };

    const distToPlayer = bot.position.distanceTo(camera.position);
    const hasLOS = checkLineOfSight(bot.position, camera.position);
    
    // Check if player is in front of the bot (Field of View)
    const dirToPlayer = new THREE.Vector3().subVectors(camera.position, bot.position).setY(0).normalize();
    const botFacing = new THREE.Vector3(Math.sin(bot.rotation.y), 0, Math.cos(bot.rotation.y)).normalize();
    const angleToPlayer = botFacing.angleTo(dirToPlayer);
    const isInFOV = angleToPlayer < Math.PI / 2; // 180 degrees field of view (90 left, 90 right)
    
    // If bot sees player (in front, no walls, within distance), update memory
    if (hasLOS && isInFOV && distToPlayer < 25) {
      lastSeenPlayerTime.current = time;
      lastSeenPlayerPos.current.copy(camera.position);
    }

    // Chase if seen within the last 3 seconds
    const shouldChase = (time - lastSeenPlayerTime.current) < 3.0;
    
    if (shouldChase !== isChasing) {
      setIsChasing(shouldChase);
    }

    const currentSpeed = shouldChase ? 8.0 : 3.0;

    if (time - lastPathUpdate.current > 0.5) {
      lastPathUpdate.current = time;
      
      let targetX = playerGridX;
      let targetY = playerGridY;
      let targetZ = playerGridZ;

      if (shouldChase) {
        // Chase last known position
        targetX = map === 'house' ? Math.round(lastSeenPlayerPos.current.x / CELL_SIZE) + 5 : Math.round(lastSeenPlayerPos.current.x / CELL_SIZE);
        targetY = Math.max(0, Math.round((lastSeenPlayerPos.current.y - 2) / 4));
        targetZ = map === 'house' ? Math.round(lastSeenPlayerPos.current.z / CELL_SIZE) + 5 : Math.round(lastSeenPlayerPos.current.z / CELL_SIZE);
      } else {
        const distToFinal = new THREE.Vector3(finalTargetPos.current.x, finalTargetPos.current.y, finalTargetPos.current.z).distanceTo(bot.position);
        if (distToFinal < 2 || (finalTargetPos.current.x === 0 && finalTargetPos.current.z === 0)) {
           let found = false;
           let attempts = 0;
           
           if (map === 'house' && houseGraph) {
             const nodes = Array.from(houseGraph.keys());
             if (nodes.length > 0) {
               while (!found && attempts < 20) {
                 const randomNode = nodes[Math.floor(Math.random() * nodes.length)];
                 const [nx, ny, nz] = randomNode.split(',').map(Number);
                 finalTargetPos.current.set((nx - 5) * CELL_SIZE, ny * 4, (nz - 5) * CELL_SIZE);
                 found = true;
                 attempts++;
               }
             }
           } else {
             const validTargets = [];
             for (let x = -14; x <= 14; x++) {
               for (let z = -14; z <= 14; z++) {
                 if (!grid.has(`${x},${z}`)) validTargets.push([x, z]);
               }
             }
             if (validTargets.length > 0) {
               const target = validTargets[Math.floor(Math.random() * validTargets.length)];
               finalTargetPos.current.set(target[0] * CELL_SIZE, 0, target[1] * CELL_SIZE);
             }
           }
        }
        targetX = map === 'house' ? Math.round(finalTargetPos.current.x / CELL_SIZE) + 5 : Math.round(finalTargetPos.current.x / CELL_SIZE);
        targetY = Math.round(finalTargetPos.current.y / 4);
        targetZ = map === 'house' ? Math.round(finalTargetPos.current.z / CELL_SIZE) + 5 : Math.round(finalTargetPos.current.z / CELL_SIZE);
      }

      const nextStep = getNextStep(botGridX, botGridY, botGridZ, targetX, targetY, targetZ);
      if (nextStep) {
         const worldX = map === 'house' ? (nextStep[0] - 5) * CELL_SIZE : nextStep[0] * CELL_SIZE;
         const worldZ = map === 'house' ? (nextStep[2] - 5) * CELL_SIZE : nextStep[2] * CELL_SIZE;
         targetPos.current.set(worldX, nextStep[1] * 4, worldZ);
      } else {
         finalTargetPos.current.set(0, 0, 0); // Force new target if stuck
      }
    }

    const direction = new THREE.Vector3().subVectors(targetPos.current, bot.position);
    const flatDirection = direction.clone();
    flatDirection.y = 0;
    const distToTarget = flatDirection.length();

    if (distToTarget > 0.1) {
      flatDirection.normalize();
      
      const targetRotation = Math.atan2(flatDirection.x, flatDirection.z);
      let rotDiff = targetRotation - bot.rotation.y;
      while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
      while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
      bot.rotation.y += rotDiff * delta * 10;

      velocity.current.x = flatDirection.x * currentSpeed;
      velocity.current.z = flatDirection.z * currentSpeed;
      
      if (Math.abs(direction.y) > 0.1) {
        velocity.current.y = Math.sign(direction.y) * currentSpeed * 0.5;
      } else {
        bot.position.y += (targetPos.current.y - bot.position.y) * delta * 5;
        velocity.current.y = 0;
      }
    } else {
      velocity.current.x = 0;
      velocity.current.z = 0;
      velocity.current.y = 0;
    }

    const newPos = bot.position.clone().add(velocity.current.clone().multiplyScalar(delta));
    
    if (map === 'maze') {
      const radius = 1.0;
      
      const checkCollision = (x: number, z: number) => {
        const corners = [
          [x + radius, z + radius],
          [x + radius, z - radius],
          [x - radius, z + radius],
          [x - radius, z - radius],
        ];
        for (const [cx, cz] of corners) {
          if (grid.has(`${Math.round(cx / CELL_SIZE)},${Math.round(cz / CELL_SIZE)}`)) {
            return true;
          }
        }
        return false;
      };

      let canMoveX = !checkCollision(newPos.x, bot.position.z);
      let canMoveZ = !checkCollision(bot.position.x, newPos.z);

      if (canMoveX) bot.position.x = newPos.x;
      else velocity.current.x = 0;
      
      if (canMoveZ) bot.position.z = newPos.z;
      else velocity.current.z = 0;
    } else {
      const radius = 1.0;
      const checkHouseCollision = (x: number, y: number, z: number) => {
        const floor = Math.round(y / 4);
        const layout = floor === 0 ? houseLayout.floor0 : houseLayout.floor1;
        if (!layout) return false;
        
        const corners = [
          [x + radius, z + radius],
          [x + radius, z - radius],
          [x - radius, z + radius],
          [x - radius, z - radius],
        ];
        
        for (const [cx, cz] of corners) {
          const gx = Math.round(cx / CELL_SIZE) + 5;
          const gz = Math.round(cz / CELL_SIZE) + 5;
          if (gz >= 0 && gz < layout.length && gx >= 0 && gx < layout[gz].length) {
            const char = layout[gz][gx];
            if (char === '1') return true;
            if (floor === 1 && char === 'H') return true;
          }
        }
        return false;
      };

      let canMoveX = !checkHouseCollision(newPos.x, bot.position.y, bot.position.z);
      let canMoveZ = !checkHouseCollision(bot.position.x, bot.position.y, newPos.z);

      if (canMoveX) bot.position.x = newPos.x;
      else velocity.current.x = 0;
      
      if (canMoveZ) bot.position.z = newPos.z;
      else velocity.current.z = 0;
      
      bot.position.y = newPos.y;
    }

    const dist = new THREE.Vector3(bot.position.x, bot.position.y, bot.position.z).distanceTo(new THREE.Vector3(camera.position.x, camera.position.y - 2, camera.position.z));
    if (dist < 2.5) {
      const store = useGameStore.getState();
      if (!store.isJumpscare && store.gameState === 'playing') {
        store.triggerJumpscare();
      }
    }
  });

  const walkAudioRef = useRef<THREE.PositionalAudio>(null);
  const runAudioRef = useRef<THREE.PositionalAudio>(null);
  const growlAudioRef = useRef<THREE.PositionalAudio>(null);

  useEffect(() => {
    if (gameState !== 'playing') {
      if (walkAudioRef.current?.isPlaying) walkAudioRef.current.stop();
      if (runAudioRef.current?.isPlaying) runAudioRef.current.stop();
      if (growlAudioRef.current?.isPlaying) growlAudioRef.current.stop();
      return;
    }

    if (isChasing) {
      if (walkAudioRef.current?.isPlaying) walkAudioRef.current.stop();
      if (!runAudioRef.current?.isPlaying) runAudioRef.current?.play();
      if (!growlAudioRef.current?.isPlaying) growlAudioRef.current?.play();
    } else {
      if (runAudioRef.current?.isPlaying) runAudioRef.current.stop();
      if (growlAudioRef.current?.isPlaying) growlAudioRef.current.stop();
      if (!walkAudioRef.current?.isPlaying) walkAudioRef.current?.play();
    }
  }, [isChasing, gameState]);

  return (
    <group ref={ref} position={[-20, 0, -20]}>
      {walkFbx && <primitive object={walkFbx} />}

      {/* ESP Box removed */}

      {/* Audio Effects */}
      <PositionalAudio
        ref={walkAudioRef}
        url="https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/heavy-steps.mp3"
        distance={10}
        loop
        autoplay={false}
      />
      <PositionalAudio
        ref={runAudioRef}
        url="https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/heavy-steps.mp3"
        distance={15}
        loop
        autoplay={false}
      />
      <PositionalAudio
        ref={growlAudioRef}
        url="https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/monster-growl.mp3"
        distance={20}
        loop
        autoplay={false}
      />
    </group>
  );
};

// Preload assets for the second monster
useFBX.preload('https://raw.githubusercontent.com/Wellers20/OcenIVATel/master/Strut%20Walking%20(1).fbx');
useFBX.preload('https://raw.githubusercontent.com/Wellers20/OcenIVATel/master/Walk%20With%20Rifle.fbx');
useLoader.preload(THREE.AudioLoader, 'https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/heavy-steps.mp3');
