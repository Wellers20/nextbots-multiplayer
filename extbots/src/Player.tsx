import { useFrame, useThree, useLoader } from '@react-three/fiber';
import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useGameStore, globalMonsterPos } from './store';
import { RigidBody, RapierRigidBody, CapsuleCollider } from '@react-three/rapier';
import { useGLTF, PositionalAudio, useFBX } from '@react-three/drei';

const WALK_SPEED = 7;
const SPRINT_SPEED = 14;
const PLAYER_RADIUS = 0.5;

export const Player = ({ spawnPos = [0, 2, 0] }: { spawnPos?: [number, number, number] }) => {
  const { camera, scene } = useThree();
  const gameState = useGameStore((state) => state.gameState);
  
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const lightRef = useRef<THREE.SpotLight>(null);
  const body = useRef<RapierRigidBody>(null);
  const bobTime = useRef(0);
  const flashlightGroup = useRef<THREE.Group>(null);
  const isZooming = useRef(false);
  
  const stamina = useRef(100);
  const isExhausted = useRef(false);
  const breathingAudioRef = useRef<THREE.PositionalAudio>(null);
  const heartbeatAudioRef = useRef<THREE.PositionalAudio>(null);
  const clickAudioRef = useRef<THREE.PositionalAudio>(null);
  const prevZoom = useRef(false);
  const hasGun = useGameStore((state) => state.hasGun);
  const ammo = useGameStore((state) => state.ammo);
  const isReloading = useGameStore((state) => state.isReloading);
  const shotgunGroup = useRef<THREE.Group>(null);
  const [isFiring, setIsFiring] = useState(false);
  const recoil = useRef(0);
  const fireAudioRef = useRef<THREE.PositionalAudio>(null);
  const reloadAudioRef = useRef<THREE.PositionalAudio>(null);
  const lastSendTime = useRef(0);

  // Random ambient sounds
  useEffect(() => {
    if (gameState !== 'playing') return;

    const ambientSounds = [
      'https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/sudden-horror-strikes-transition-sound-effect.mp3',
      'https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/sudden-crash-from-falling.mp3',
      'https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/sound-of-sudden-appearance.mp3',
      'https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/jutkiy-zvuk-vnezapnosti.mp3'
    ];

    let timeoutId: NodeJS.Timeout;

    const playRandomSound = () => {
      const randomSound = ambientSounds[Math.floor(Math.random() * ambientSounds.length)];
      const audio = new Audio(randomSound);
      audio.volume = 0.8;
      audio.play().catch(e => console.error("Ambient audio failed:", e));

      // Schedule next sound between 15 and 45 seconds
      const nextDelay = Math.random() * 30000 + 15000;
      timeoutId = setTimeout(playRandomSound, nextDelay);
    };

    // Start the first timer
    const initialDelay = Math.random() * 20000 + 10000;
    timeoutId = setTimeout(playRandomSound, initialDelay);

    return () => clearTimeout(timeoutId);
  }, [gameState]);

  const { scene: flashlightScene } = useGLTF('https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/Flashlight.glb');
  const shotgunFbx = useFBX('https://raw.githubusercontent.com/Wellers20/OcenIVATel/master/doubleburrelfbx.fbx');

  const clonedShotgun = useMemo(() => {
    const clone = shotgunFbx.clone();
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (!mesh.material || (Array.isArray(mesh.material) && mesh.material.length === 0)) {
           mesh.material = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.4, metalness: 0.8 });
        }
      }
    });
    
    // Scale it down to fit in hand
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 0.5 / maxDim; // 0.5 meters long in hand
    clone.scale.setScalar(scale);
    
    // Rotate to point forward
    clone.rotation.y = Math.PI / 2;
    
    return clone;
  }, [shotgunFbx]);

  // Make the flashlight model itself brighter
  useEffect(() => {
    flashlightScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          // Add emissive color so it glows slightly in the dark
          (mesh.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0x444444);
          (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 1;
        }
      }
    });
  }, [flashlightScene]);

  useEffect(() => {
    if (body.current) {
      body.current.setTranslation({ x: spawnPos[0], y: spawnPos[1], z: spawnPos[2] }, true);
      body.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
    bobTime.current = 0;
  }, [gameState, spawnPos]);

  useEffect(() => {
    const handleFire = () => {
      const state = useGameStore.getState();
      if (!state.hasGun || state.isReloading || state.ammo <= 0 || isFiring) return;

      state.setAmmo(state.ammo - 1);
      setIsFiring(true);
      recoil.current = 1;

      if (fireAudioRef.current) {
        if (fireAudioRef.current.isPlaying) fireAudioRef.current.stop();
        fireAudioRef.current.setVolume(3.0);
        fireAudioRef.current.play();
      }

      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      window.dispatchEvent(new CustomEvent('shotgun-fire', {
        detail: { position: camera.position.clone(), direction: dir }
      }));

      setTimeout(() => setIsFiring(false), 150);
    };

    const handleReload = () => {
      const state = useGameStore.getState();
      if (!state.hasGun || state.isReloading || state.ammo >= 2) return;

      state.setIsReloading(true);
      if (reloadAudioRef.current) {
        if (reloadAudioRef.current.isPlaying) reloadAudioRef.current.stop();
        reloadAudioRef.current.setVolume(2.0);
        reloadAudioRef.current.play();
      }

      setTimeout(() => {
        useGameStore.getState().setAmmo(2);
        useGameStore.getState().setIsReloading(false);
      }, 1500);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyC') isZooming.current = true;
      if (e.code === 'KeyR') handleReload();
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyC') isZooming.current = false;
    };
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 2) isZooming.current = true; // Right click
      if (e.button === 0 && document.pointerLockElement) handleFire(); // Left click
    };
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 2) isZooming.current = false;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    
    // Expose for mobile UI
    (window as any).fireShotgun = handleFire;
    (window as any).reloadShotgun = handleReload;

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      delete (window as any).fireShotgun;
      delete (window as any).reloadShotgun;
    };
  }, [camera, isFiring]);

  useFrame((state, delta) => {
    if (gameState !== 'playing') return;

    // Zoom logic
    const isZoomingStore = useGameStore.getState().isZooming;
    const targetFov = (isZooming.current || isZoomingStore) ? 30 : 75;
    camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, delta * 15);
    camera.updateProjectionMatrix();

    const storeState = useGameStore.getState();
    const lookDelta = storeState.lookDelta;
    const joystick = storeState.joystick;
    const keys = storeState.keys;

    // Look
    if (lookDelta.x !== 0 || lookDelta.y !== 0) {
      // Reduce sensitivity when zooming
      const sensitivity = isZooming.current ? 0.002 : 0.005;
      euler.current.y -= lookDelta.x * sensitivity;
      euler.current.x -= lookDelta.y * sensitivity;
      euler.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.current.x));
      camera.quaternion.setFromEuler(euler.current);
      storeState.resetLookDelta();
    }

    // Move
    let moveZ = joystick.y;
    let moveX = joystick.x;

    if (keys.w) moveZ -= 1;
    if (keys.s) moveZ += 1;
    if (keys.a) moveX -= 1;
    if (keys.d) moveX += 1;

    const inputDir = new THREE.Vector3(moveX, 0, moveZ);
    if (inputDir.lengthSq() > 1) inputDir.normalize();
    inputDir.applyEuler(new THREE.Euler(0, euler.current.y, 0));

    // Stamina logic
    const isSprinting = keys.shift || joystick.y < -0.8; // Sprint if shift pressed or joystick pushed hard forward
    if (isSprinting && stamina.current > 0 && !isExhausted.current && inputDir.lengthSq() > 0) {
      stamina.current -= delta * 15; // Deplete in ~6.6s
      if (stamina.current <= 0) {
        stamina.current = 0;
        isExhausted.current = true;
      }
    } else {
      stamina.current += delta * 10; // Recover in 10s
      if (stamina.current >= 100) {
        stamina.current = 100;
        isExhausted.current = false;
      }
    }

    // Update stamina bar in UI directly
    const staminaBar = document.getElementById('stamina-bar');
    if (staminaBar) {
      staminaBar.style.width = `${stamina.current}%`;
      staminaBar.style.backgroundColor = isExhausted.current ? '#ef4444' : '#ffffff';
    }

    const currentMaxSpeed = (isSprinting && !isExhausted.current) ? SPRINT_SPEED : WALK_SPEED;
    inputDir.multiplyScalar(currentMaxSpeed);

    if (body.current) {
      const linvel = body.current.linvel();
      
      const targetVelX = THREE.MathUtils.lerp(linvel.x, inputDir.x, delta * 10);
      const targetVelZ = THREE.MathUtils.lerp(linvel.z, inputDir.z, delta * 10);
      
      body.current.setLinvel({ x: targetVelX, y: linvel.y, z: targetVelZ }, true);

      // Sync camera
      const pos = body.current.translation();
      
      // Head bobbing
      const speed = Math.sqrt(linvel.x * linvel.x + linvel.z * linvel.z);
      storeState.setSpeed(speed * 3.6); // Convert m/s to km/h
      
      let bobOffset = 0;
      if (speed > 0.5) {
        bobTime.current += speed * delta;
        bobOffset = Math.abs(Math.sin(bobTime.current * 1.5)) * 0.2;
      }
      
      camera.position.set(pos.x, pos.y + 0.8 + bobOffset, pos.z);
    }

    // Update flashlight properties based on zoom
    const isZoom = isZooming.current || isZoomingStore;
    
    // Play click sound on zoom toggle
    if (isZoom !== prevZoom.current) {
      if (clickAudioRef.current) {
        if (clickAudioRef.current.isPlaying) clickAudioRef.current.stop();
        clickAudioRef.current.setVolume(2.0); // Make it loud
        clickAudioRef.current.play();
      }
      prevZoom.current = isZoom;
    }

    if (lightRef.current) {
      const targetAngle = isZoom ? Math.PI / 12 : Math.PI / 4;
      const targetDistance = isZoom ? 80 : 40;
      const targetIntensity = isZoom ? 15 : 8;
      
      lightRef.current.angle = THREE.MathUtils.lerp(lightRef.current.angle, targetAngle, delta * 10);
      lightRef.current.distance = THREE.MathUtils.lerp(lightRef.current.distance, targetDistance, delta * 10);
      lightRef.current.intensity = THREE.MathUtils.lerp(lightRef.current.intensity, targetIntensity, delta * 10);
    }

    // Update fog based on zoom
    if (scene.fog && (scene.fog as THREE.Fog).isFog) {
      const fog = scene.fog as THREE.Fog;
      const targetFogFar = isZoom ? 60 : 12;
      const targetFogNear = isZoom ? 5 : 2;
      fog.far = THREE.MathUtils.lerp(fog.far, targetFogFar, delta * 10);
      fog.near = THREE.MathUtils.lerp(fog.near, targetFogNear, delta * 10);
    }

    // UPDATE FLASHLIGHT AFTER CAMERA IS POSITIONED (Fixes jittering)
    if (flashlightGroup.current) {
      flashlightGroup.current.position.copy(camera.position);
      flashlightGroup.current.quaternion.copy(camera.quaternion);
      // Offset to the right, down, and slightly forward
      flashlightGroup.current.translateX(0.3);
      flashlightGroup.current.translateY(-0.25);
      flashlightGroup.current.translateZ(-0.4);
    }

    if (shotgunGroup.current && hasGun) {
      shotgunGroup.current.position.copy(camera.position);
      shotgunGroup.current.quaternion.copy(camera.quaternion);
      // Offset to the right, down, and slightly forward (different from flashlight)
      shotgunGroup.current.translateX(0.15);
      shotgunGroup.current.translateY(-0.25);
      shotgunGroup.current.translateZ(-0.4);
      
      // Add bobbing to shotgun
      let bobOffset = 0;
      const linvel = body.current?.linvel();
      if (linvel) {
        const speed = Math.sqrt(linvel.x * linvel.x + linvel.z * linvel.z);
        if (speed > 0.5) {
          bobOffset = Math.sin(bobTime.current * 1.5) * 0.05;
        }
      }
      shotgunGroup.current.translateY(bobOffset);

      // Recoil animation
      recoil.current = THREE.MathUtils.lerp(recoil.current, 0, delta * 15);
      shotgunGroup.current.translateZ(recoil.current * 0.3); // Move back
      shotgunGroup.current.rotateX(recoil.current * 0.2); // Pitch up
    }

    if (lightRef.current) {
      if (flashlightGroup.current) {
        // Position the light exactly at the flashlight's position
        lightRef.current.position.copy(flashlightGroup.current.position);
        
        // Move the light slightly forward so it doesn't clip with the flashlight model itself
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        lightRef.current.position.addScaledVector(forward, 0.2);
      } else {
        lightRef.current.position.copy(camera.position);
      }
      
      camera.getWorldDirection(lightRef.current.target.position);
      lightRef.current.target.position.add(lightRef.current.position);
      lightRef.current.target.updateMatrixWorld();
    }

    // Breathing audio logic
    if (breathingAudioRef.current) {
      if (stamina.current < 40 || isExhausted.current) {
        if (!breathingAudioRef.current.isPlaying) breathingAudioRef.current.play();
        const vol = Math.max(0, Math.min(1, (50 - stamina.current) / 50));
        breathingAudioRef.current.setVolume(vol * 2.0); // Louder
      } else {
        if (breathingAudioRef.current.isPlaying) breathingAudioRef.current.stop();
      }
    }

    // Heartbeat audio logic
    if (heartbeatAudioRef.current) {
      const distToMonster = camera.position.distanceTo(globalMonsterPos);
      if (distToMonster < 25) {
        if (!heartbeatAudioRef.current.isPlaying) heartbeatAudioRef.current.play();
        // Volume from 0 to 1 based on distance (closer = louder)
        const vol = Math.max(0, Math.min(1, 1 - (distToMonster - 5) / 20));
        heartbeatAudioRef.current.setVolume(vol * 2.5); // Louder
        // Faster heartbeat when closer
        heartbeatAudioRef.current.setPlaybackRate(1 + vol * 0.5);
      } else {
        if (heartbeatAudioRef.current.isPlaying) heartbeatAudioRef.current.stop();
      }
    }

    // Send position to server (20 times per second)
    if (state.clock.elapsedTime - lastSendTime.current > 0.05) {
      if ((window as any).sendPlayerPosition && body.current) {
        const pos = body.current.translation();
        (window as any).sendPlayerPosition(
          [pos.x, pos.y, pos.z],
          [euler.current.x, euler.current.y, euler.current.z]
        );
      }
      lastSendTime.current = state.clock.elapsedTime;
    }
  });

  return (
    <>
      <RigidBody 
        ref={body} 
        colliders={false}
        mass={1} 
        type="dynamic" 
        position={spawnPos} 
        enabledRotations={[false, false, false]}
        ccd={true}
      >
        <CapsuleCollider args={[0.5, PLAYER_RADIUS]} />
      </RigidBody>

      <group ref={flashlightGroup}>
        {/* Rotate the model by -90 degrees around Y axis so it points forward instead of right */}
        {!hasGun && <primitive object={flashlightScene} scale={0.05} rotation={[0, -Math.PI / 2, 0]} />}
      </group>

      {hasGun && (
        <group ref={shotgunGroup}>
          <primitive object={clonedShotgun} />
          {isFiring && (
            <pointLight position={[0.8, 0.1, 0]} intensity={10} color="#ffaa00" distance={15} />
          )}
        </group>
      )}

      <ambientLight intensity={0.15} color="#fff5e6" />
      <spotLight 
        ref={lightRef} 
        intensity={8} 
        angle={Math.PI / 4} 
        penumbra={0.3} 
        distance={40} 
        decay={2} 
        color="#fff5e6" 
      />

      <PositionalAudio
        ref={breathingAudioRef}
        url="https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/4f18856ad28d62a.mp3"
        distance={1000} // High distance so it doesn't attenuate
        loop
        autoplay={false}
      />
      <PositionalAudio
        ref={heartbeatAudioRef}
        url="https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/stuk_serdca_-_zvuk_serdcebieniya.mp3"
        distance={1000} // High distance so it doesn't attenuate
        loop
        autoplay={false}
      />
      <PositionalAudio
        ref={clickAudioRef}
        url="https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/silent-click-with-echo.mp3"
        distance={1000}
        loop={false}
        autoplay={false}
      />
      <PositionalAudio
        ref={fireAudioRef}
        url="https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/sudden-crash-from-falling.mp3"
        distance={1000}
        loop={false}
        autoplay={false}
      />
      <PositionalAudio
        ref={reloadAudioRef}
        url="https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/silent-click-with-echo.mp3"
        distance={1000}
        loop={false}
        autoplay={false}
      />
    </>
  );
};

useGLTF.preload('https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/Flashlight.glb');
useFBX.preload('https://raw.githubusercontent.com/Wellers20/OcenIVATel/master/doubleburrelfbx.fbx');
useLoader.preload(THREE.AudioLoader, 'https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/4f18856ad28d62a.mp3');
useLoader.preload(THREE.AudioLoader, 'https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/stuk_serdca_-_zvuk_serdcebieniya.mp3');
useLoader.preload(THREE.AudioLoader, 'https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/silent-click-with-echo.mp3');
useLoader.preload(THREE.AudioLoader, 'https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/sudden-crash-from-falling.mp3');
