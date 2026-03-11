import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from './store';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

let socket: Socket | null = null;

export const MultiplayerManager = () => {
  const map = useGameStore(state => state.map);
  const [otherPlayers, setOtherPlayers] = useState<Record<string, any>>({});

  useEffect(() => {
    // Connect to the same host
    socket = io();

    socket.on('currentPlayers', (players: any[]) => {
      const playersObj: Record<string, any> = {};
      players.forEach(p => {
        if (p.id !== socket?.id) playersObj[p.id] = p;
      });
      setOtherPlayers(playersObj);
    });

    socket.on('playerJoined', (player: any) => {
      if (player.id !== socket?.id) {
        setOtherPlayers(prev => ({ ...prev, [player.id]: player }));
      }
    });

    socket.on('playerMoved', (player: any) => {
      if (player.id !== socket?.id) {
        setOtherPlayers(prev => ({ ...prev, [player.id]: player }));
      }
    });

    socket.on('playerLeft', (id: string) => {
      setOtherPlayers(prev => {
        const newPlayers = { ...prev };
        delete newPlayers[id];
        return newPlayers;
      });
    });

    return () => {
      if (socket) {
        socket.disconnect();
        socket = null;
      }
    };
  }, []);

  // We need a way to send our position. 
  // We can export a function or attach it to window for the Player component to call.
  useEffect(() => {
    (window as any).sendPlayerPosition = (pos: [number, number, number], rot: [number, number, number]) => {
      if (socket && socket.connected) {
        socket.emit('updatePosition', { position: pos, rotation: rot, map });
      }
    };
    return () => { delete (window as any).sendPlayerPosition; };
  }, [map]);

  return (
    <>
      {Object.values(otherPlayers).map(player => {
        if (player.map !== map) return null; // Only show players on the same map
        return <OtherPlayer key={player.id} data={player} />;
      })}
    </>
  );
};

const OtherPlayer = ({ data }: { data: any }) => {
  // Simple representation for now: a capsule with a flashlight
  return (
    <group position={data.position} rotation={data.rotation}>
      <mesh position={[0, 1, 0]}>
        <capsuleGeometry args={[0.4, 1, 4, 8]} />
        <meshStandardMaterial color="#4444ff" roughness={0.7} />
      </mesh>
      
      {/* Flashlight representation */}
      <spotLight
        position={[0, 1.5, 0]}
        angle={Math.PI / 6}
        penumbra={0.3}
        intensity={5}
        distance={30}
        color="#fff5e6"
        castShadow
      />
      {/* A small glowing sphere to represent the flashlight bulb */}
      <mesh position={[0, 1.5, -0.5]}>
        <sphereGeometry args={[0.05]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
};
