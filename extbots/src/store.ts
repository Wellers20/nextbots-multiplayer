import { create } from 'zustand';
import * as THREE from 'three';

export const globalMonsterPos = new THREE.Vector3(0, -1000, 0);

interface GameState {
  joystick: { x: number; y: number };
  keys: { w: boolean; a: boolean; s: boolean; d: boolean; shift: boolean };
  lookDelta: { x: number; y: number };
  setJoystick: (x: number, y: number) => void;
  setKey: (key: 'w' | 'a' | 's' | 'd' | 'shift', value: boolean) => void;
  addLookDelta: (x: number, y: number) => void;
  resetLookDelta: () => void;
  gameState: 'menu' | 'intro' | 'playing' | 'gameover' | 'paused' | 'win';
  setGameState: (state: 'menu' | 'intro' | 'playing' | 'gameover' | 'paused' | 'win') => void;
  map: 'maze' | 'house';
  setMap: (map: 'maze' | 'house') => void;
  resetGame: () => void;
  exitToMenu: () => void;
  speed: number;
  setSpeed: (speed: number) => void;
  dialog: { speaker: string; text: string } | null;
  setDialog: (dialog: { speaker: string; text: string } | null) => void;
  hasGun: boolean;
  setHasGun: (has: boolean) => void;
  isZooming: boolean;
  setIsZooming: (val: boolean) => void;
  isShotgunDropped: boolean;
  shotgunPosition: [number, number, number] | null;
  setShotgunDropped: (dropped: boolean, pos?: [number, number, number]) => void;
  canPickUpShotgun: boolean;
  setCanPickUpShotgun: (can: boolean) => void;
  ammo: number;
  setAmmo: (ammo: number) => void;
  isReloading: boolean;
  setIsReloading: (val: boolean) => void;
  isJumpscare: boolean;
  triggerJumpscare: () => void;
  triggerIntroJumpscare: () => void;
  notesCollected: number;
  activeNotes: { id: string; position: [number, number, number] }[];
  setNotes: (notes: { id: string; position: [number, number, number] }[]) => void;
  pickUpNote: (id: string) => void;
}

export const useGameStore = create<GameState>((set) => ({
  joystick: { x: 0, y: 0 },
  keys: { w: false, a: false, s: false, d: false, shift: false },
  lookDelta: { x: 0, y: 0 },
  setJoystick: (x, y) => set({ joystick: { x, y } }),
  setKey: (key, value) => set((state) => ({ keys: { ...state.keys, [key]: value } })),
  addLookDelta: (x, y) => set((state) => ({ lookDelta: { x: state.lookDelta.x + x, y: state.lookDelta.y + y } })),
  resetLookDelta: () => set({ lookDelta: { x: 0, y: 0 } }),
  gameState: 'menu',
  setGameState: (state) => set({ gameState: state }),
  map: 'maze',
  setMap: (map) => set({ map }),
  resetGame: () => set({ gameState: 'intro', joystick: { x: 0, y: 0 }, keys: { w: false, a: false, s: false, d: false, shift: false }, lookDelta: { x: 0, y: 0 }, speed: 0, dialog: null, hasGun: false, isShotgunDropped: false, shotgunPosition: null, ammo: 2, isReloading: false, notesCollected: 0, activeNotes: [] }),
  exitToMenu: () => set({ gameState: 'menu', joystick: { x: 0, y: 0 }, keys: { w: false, a: false, s: false, d: false, shift: false }, lookDelta: { x: 0, y: 0 }, speed: 0, dialog: null, hasGun: false, isShotgunDropped: false, shotgunPosition: null, ammo: 2, isReloading: false, notesCollected: 0, activeNotes: [] }),
  speed: 0,
  setSpeed: (speed) => set({ speed }),
  dialog: null,
  setDialog: (dialog) => set({ dialog }),
  hasGun: false,
  setHasGun: (hasGun) => set({ hasGun }),
  isShotgunDropped: false,
  shotgunPosition: null,
  setShotgunDropped: (dropped, pos) => set({ isShotgunDropped: dropped, shotgunPosition: pos || null }),
  canPickUpShotgun: false,
  setCanPickUpShotgun: (can) => set({ canPickUpShotgun: can }),
  ammo: 2,
  setAmmo: (ammo) => set({ ammo }),
  isReloading: false,
  setIsReloading: (val) => set({ isReloading: val }),
  isZooming: false,
  setIsZooming: (val) => set({ isZooming: val }),
  isJumpscare: false,
  triggerJumpscare: () => {
    set({ isJumpscare: true });
    const audio = new Audio('https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/fvfyfyfyv.mp3');
    audio.volume = 1.0;
    audio.play().catch(e => console.error("Jumpscare audio failed:", e));
    setTimeout(() => {
      set({ isJumpscare: false, gameState: 'gameover' });
    }, 2000);
  },
  triggerIntroJumpscare: () => {
    set({ isJumpscare: true });
    const audio = new Audio('https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/fvfyfyfyv.mp3');
    audio.volume = 1.0;
    audio.play().catch(e => console.error("Jumpscare audio failed:", e));
    setTimeout(() => {
      set({ isJumpscare: false, gameState: 'playing' });
    }, 2000);
  },
  notesCollected: 0,
  activeNotes: [],
  setNotes: (notes) => set({ activeNotes: notes }),
  pickUpNote: (id) => set((state) => {
    const newNotes = state.activeNotes.filter(n => n.id !== id);
    const collected = state.notesCollected + 1;
    if (collected >= 8) {
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
      return { activeNotes: newNotes, notesCollected: collected, gameState: 'win' };
    }
    return { activeNotes: newNotes, notesCollected: collected };
  }),
}));
