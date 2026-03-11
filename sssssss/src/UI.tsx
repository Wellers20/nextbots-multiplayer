import { useEffect, useRef, useState } from 'react';
import { useGameStore } from './store';
import { Maximize, Minimize, Mouse, Pause, Play, Home } from 'lucide-react';
import { useProgress } from '@react-three/drei';

const Joystick = () => {
  const joystickRef = useRef<HTMLDivElement>(null);
  const setJoystick = useGameStore((state) => state.setJoystick);

  useEffect(() => {
    const el = joystickRef.current;
    if (!el) return;

    let activeId: number | null = null;
    let startX = 0;
    let startY = 0;
    const maxRadius = 50;

    const handleStart = (e: TouchEvent | MouseEvent) => {
      if ('touches' in e) {
        if (activeId !== null) return;
        const touch = e.changedTouches[0];
        activeId = touch.identifier;
        const rect = el.getBoundingClientRect();
        startX = rect.left + rect.width / 2;
        startY = rect.top + rect.height / 2;
        updateJoystick(touch.clientX, touch.clientY);
      } else {
        activeId = -1;
        const rect = el.getBoundingClientRect();
        startX = rect.left + rect.width / 2;
        startY = rect.top + rect.height / 2;
        updateJoystick(e.clientX, e.clientY);
      }
    };

    const handleMove = (e: TouchEvent | MouseEvent) => {
      if (activeId === null) return;
      e.preventDefault(); // Prevent scrolling
      if ('touches' in e) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (touch.identifier === activeId) {
            updateJoystick(touch.clientX, touch.clientY);
          }
        }
      } else {
        if (activeId === -1) {
          updateJoystick(e.clientX, e.clientY);
        }
      }
    };

    const handleEnd = (e: TouchEvent | MouseEvent) => {
      if ('touches' in e) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === activeId) {
            activeId = null;
            resetJoystick();
          }
        }
      } else {
        if (activeId === -1) {
          activeId = null;
          resetJoystick();
        }
      }
    };

    const resetJoystick = () => {
      setJoystick(0, 0);
      const knob = el.querySelector('.knob') as HTMLDivElement;
      if (knob) {
        knob.style.transform = `translate(-50%, -50%)`;
      }
    };

    const updateJoystick = (x: number, y: number) => {
      let dx = x - startX;
      let dy = y - startY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > maxRadius) {
        dx = (dx / distance) * maxRadius;
        dy = (dy / distance) * maxRadius;
      }

      const knob = el.querySelector('.knob') as HTMLDivElement;
      if (knob) {
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      }

      setJoystick(dx / maxRadius, dy / maxRadius);
    };

    el.addEventListener('touchstart', handleStart, { passive: false });
    el.addEventListener('touchmove', handleMove, { passive: false });
    el.addEventListener('touchend', handleEnd);
    el.addEventListener('touchcancel', handleEnd);
    
    el.addEventListener('mousedown', handleStart);
    window.addEventListener('mousemove', handleMove, { passive: false });
    window.addEventListener('mouseup', handleEnd);

    return () => {
      el.removeEventListener('touchstart', handleStart);
      el.removeEventListener('touchmove', handleMove);
      el.removeEventListener('touchend', handleEnd);
      el.removeEventListener('touchcancel', handleEnd);
      el.removeEventListener('mousedown', handleStart);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
    };
  }, [setJoystick]);

  return (
    <div 
      ref={joystickRef}
      className="w-32 h-32 bg-white/20 rounded-full relative backdrop-blur-md border border-white/30 touch-none pointer-events-auto"
    >
      <div className="knob absolute top-1/2 left-1/2 w-12 h-12 bg-white/80 rounded-full -translate-x-1/2 -translate-y-1/2 shadow-lg" />
    </div>
  );
};

export const UI = () => {
  const setKey = useGameStore((state) => state.setKey);
  const gameState = useGameStore((state) => state.gameState);
  const setGameState = useGameStore((state) => state.setGameState);
  const resetGame = useGameStore((state) => state.resetGame);
  const exitToMenu = useGameStore((state) => state.exitToMenu);
  const dialog = useGameStore((state) => state.dialog);
  const isJumpscare = useGameStore((state) => state.isJumpscare);
  const setIsZooming = useGameStore((state) => state.setIsZooming);
  const canPickUpShotgun = useGameStore((state) => state.canPickUpShotgun);
  const isShotgunDropped = useGameStore((state) => state.isShotgunDropped);
  const hasGun = useGameStore((state) => state.hasGun);
  const ammo = useGameStore((state) => state.ammo);
  const isReloading = useGameStore((state) => state.isReloading);
  const setHasGun = useGameStore((state) => state.setHasGun);
  const setShotgunDropped = useGameStore((state) => state.setShotgunDropped);
  const notesCollected = useGameStore((state) => state.notesCollected);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { progress } = useProgress();
  const menuAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const handleFirstInteraction = () => {
      if (gameState === 'menu' && menuAudioRef.current && menuAudioRef.current.paused) {
        menuAudioRef.current.play().catch(() => {});
      }
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);
    window.addEventListener('touchstart', handleFirstInteraction);
    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'menu') {
      menuAudioRef.current?.play().catch(() => {});
    } else {
      menuAudioRef.current?.pause();
      if (menuAudioRef.current) menuAudioRef.current.currentTime = 0;
    }
  }, [gameState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(key)) setKey(key as 'w'|'a'|'s'|'d', true);
      if (key === 'shift') setKey('shift', true);
      if (key === 'j' && gameState === 'playing') {
        const store = useGameStore.getState();
        if (!store.isJumpscare) store.triggerJumpscare();
      }
      if (key === 'escape' && gameState === 'playing') setGameState('paused');
      else if (key === 'escape' && gameState === 'paused') setGameState('playing');
      
      // Pick up shotgun
      if (e.code === 'KeyE' && canPickUpShotgun && isShotgunDropped && !useGameStore.getState().hasGun) {
        setHasGun(true);
        setShotgunDropped(false);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(key)) setKey(key as 'w'|'a'|'s'|'d', false);
      if (key === 'shift') setKey('shift', false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [setKey, gameState, setGameState]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  if (progress < 100) {
    return (
      <div className="absolute inset-0 bg-black text-white flex flex-col items-center justify-center z-50">
        <h1 className="text-4xl font-bold mb-4 font-mono text-yellow-500">LOADING...</h1>
        <div className="w-64 h-4 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-yellow-500 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 font-mono">{Math.round(progress)}%</p>
      </div>
    );
  }

  if (gameState === 'menu') {
    return (
      <div className="absolute inset-0 bg-black text-red-500 flex flex-col items-center justify-center z-50 overflow-hidden">
        {/* Bloody background effects */}
        <div className="absolute inset-0 opacity-30 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle at 50% 50%, #4a0000 0%, #000000 70%)'
        }} />
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-red-900/50 to-transparent pointer-events-none" />
        
        <h1 className="text-6xl md:text-8xl font-black mb-12 text-red-600 tracking-tighter text-center drop-shadow-[0_0_15px_rgba(220,38,38,0.8)]" style={{ fontFamily: 'Impact, sans-serif' }}>
          NEXTBOTS<br/>BACKROOMS
        </h1>
        
        <div className="flex flex-col items-center gap-6 z-10">
          <div className="flex gap-4 mb-4">
            <button
              onClick={() => useGameStore.getState().setMap('maze')}
              className={`px-6 py-3 font-black text-xl rounded-sm transition-all border-2 ${useGameStore.getState().map === 'maze' ? 'bg-red-900 text-white border-red-500 shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'bg-black text-red-700 border-red-900 hover:bg-red-950/50'}`}
              style={{ fontFamily: 'Impact, sans-serif', letterSpacing: '1px' }}
            >
              THE MAZE
            </button>
            <button
              onClick={() => useGameStore.getState().setMap('house')}
              className={`px-6 py-3 font-black text-xl rounded-sm transition-all border-2 ${useGameStore.getState().map === 'house' ? 'bg-red-900 text-white border-red-500 shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'bg-black text-red-700 border-red-900 hover:bg-red-950/50'}`}
              style={{ fontFamily: 'Impact, sans-serif', letterSpacing: '1px' }}
            >
              THE HOUSE
            </button>
          </div>

          <button 
            onClick={() => {
              resetGame();
              document.body.requestPointerLock().catch(() => {});
            }}
            className="relative px-12 py-6 bg-red-900 hover:bg-red-800 text-white font-black text-3xl rounded-sm transition-all border-b-4 border-red-950 shadow-[0_0_30px_rgba(220,38,38,0.4)] hover:shadow-[0_0_50px_rgba(220,38,38,0.6)] hover:-translate-y-1 active:translate-y-1 active:border-b-0"
            style={{ fontFamily: 'Impact, sans-serif', letterSpacing: '2px' }}
          >
            START GAME
            {/* Drip effect */}
            <div className="absolute -bottom-4 left-4 w-2 h-6 bg-red-900 rounded-b-full animate-pulse" />
            <div className="absolute -bottom-6 left-12 w-1.5 h-8 bg-red-900 rounded-b-full animate-pulse delay-75" />
            <div className="absolute -bottom-3 right-8 w-2 h-5 bg-red-900 rounded-b-full animate-pulse delay-150" />
          </button>
        </div>
        
        <p className="mt-12 text-red-400/70 max-w-md text-center font-mono text-sm">
          Use W,A,S,D or Joystick to move. Swipe or use Mouse to look around.
          <br/><br/>
          <span className="text-red-500 font-bold text-lg">DON'T LET IT CATCH YOU.</span>
        </p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-4">
      {gameState !== 'intro' && (
        <div className="flex justify-between pointer-events-auto gap-2">
          <button 
            onClick={() => setGameState('paused')}
            className="p-2 bg-black/50 rounded-full text-white backdrop-blur-sm"
            title="Pause Game"
          >
            <Pause size={24} />
          </button>

          <div className="flex gap-2">
            <button 
              onClick={() => {
                document.body.requestPointerLock().catch(err => {
                  console.log(`Error attempting to enable pointer lock: ${err.message}`);
                });
              }}
              className="p-2 bg-black/50 rounded-full text-white backdrop-blur-sm hidden sm:block"
              title="Lock Mouse"
            >
              <Mouse size={24} />
            </button>
            <button 
              onClick={() => {
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen().catch(err => {
                    console.log(`Error attempting to enable fullscreen: ${err.message}`);
                  });
                } else {
                  document.exitFullscreen();
                }
              }}
              className="p-2 bg-black/50 rounded-full text-white backdrop-blur-sm"
            >
              {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
            </button>
          </div>
        </div>
      )}

      {gameState === 'paused' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 pointer-events-auto backdrop-blur-md z-50">
          <div className="absolute inset-0 opacity-20 pointer-events-none" style={{
            backgroundImage: 'radial-gradient(circle at 50% 50%, #4a0000 0%, transparent 70%)'
          }} />
          <div className="text-center text-red-500 flex flex-col gap-6 relative z-10">
            <h1 className="text-6xl font-black mb-8 text-red-600 uppercase tracking-tighter drop-shadow-[0_0_15px_rgba(220,38,38,0.8)]" style={{ fontFamily: 'Impact, sans-serif' }}>
              PAUSED
            </h1>
            <button 
              onClick={() => setGameState('playing')}
              className="px-10 py-4 bg-red-900 text-white font-black rounded-sm text-2xl hover:bg-red-800 transition-all border-b-4 border-red-950 hover:-translate-y-1 active:translate-y-1 active:border-b-0 flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(220,38,38,0.3)]"
              style={{ fontFamily: 'Impact, sans-serif', letterSpacing: '1px' }}
            >
              <Play size={28} /> RESUME
            </button>
            <button 
              onClick={exitToMenu}
              className="px-10 py-4 bg-black text-red-600 font-black rounded-sm text-xl hover:bg-red-950 transition-all border border-red-900 flex items-center justify-center gap-3"
              style={{ fontFamily: 'Impact, sans-serif', letterSpacing: '1px' }}
            >
              <Home size={24} /> EXIT TO MENU
            </button>
          </div>
        </div>
      )}

      {gameState === 'gameover' && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-950/90 pointer-events-auto backdrop-blur-md z-50">
          {/* Blood splatters */}
          <div className="absolute inset-0 pointer-events-none opacity-50">
             <div className="absolute top-0 left-1/4 w-32 h-64 bg-red-900 rounded-b-full blur-xl" />
             <div className="absolute top-0 right-1/3 w-48 h-48 bg-red-900 rounded-b-full blur-xl" />
             <div className="absolute bottom-0 left-1/2 w-64 h-64 bg-red-900 rounded-t-full blur-2xl" />
          </div>
          
          <div className="text-center text-white flex flex-col gap-6 relative z-10">
            <h1 className="text-8xl font-black mb-2 text-red-600 uppercase tracking-tighter drop-shadow-[0_0_30px_rgba(220,38,38,1)]" style={{ fontFamily: 'Impact, sans-serif' }}>
              WASTED
            </h1>
            <p className="text-2xl mb-8 text-red-300 font-mono font-bold tracking-widest">YOU DIED</p>
            
            <button 
              onClick={resetGame}
              className="relative px-12 py-6 bg-red-800 text-white font-black rounded-sm text-3xl hover:bg-red-700 transition-all border-b-4 border-red-950 shadow-[0_0_30px_rgba(220,38,38,0.5)] hover:-translate-y-1 active:translate-y-1 active:border-b-0"
              style={{ fontFamily: 'Impact, sans-serif', letterSpacing: '2px' }}
            >
              TRY AGAIN
              <div className="absolute -bottom-4 right-4 w-2 h-6 bg-red-800 rounded-b-full animate-pulse" />
              <div className="absolute -bottom-5 left-8 w-1.5 h-7 bg-red-800 rounded-b-full animate-pulse delay-100" />
            </button>
            
            <button 
              onClick={exitToMenu}
              className="px-8 py-4 bg-transparent text-red-500 font-black rounded-sm text-xl hover:bg-red-950/50 transition-all border border-red-900/50 mt-4"
              style={{ fontFamily: 'Impact, sans-serif', letterSpacing: '1px' }}
            >
              MAIN MENU
            </button>
          </div>
        </div>
      )}

      {/* Win Screen */}
      {gameState === 'win' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 pointer-events-auto backdrop-blur-md z-50">
          <div className="text-center text-white flex flex-col gap-6 relative z-10">
            <h1 className="text-7xl font-black mb-2 text-emerald-500 uppercase tracking-tighter drop-shadow-[0_0_30px_rgba(16,185,129,0.5)]" style={{ fontFamily: 'Impact, sans-serif' }}>
              YOU ESCAPED
            </h1>
            <p className="text-xl mb-8 text-gray-300 font-mono max-w-md mx-auto">
              You collected all 8 notes and survived the nightmare.
            </p>
            
            <button 
              onClick={exitToMenu}
              className="px-12 py-6 bg-emerald-600 text-white font-black rounded-sm text-2xl hover:bg-emerald-500 transition-all border-b-4 border-emerald-800 shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:-translate-y-1 active:translate-y-1 active:border-b-0"
              style={{ fontFamily: 'Impact, sans-serif', letterSpacing: '2px' }}
            >
              MAIN MENU
            </button>
          </div>
        </div>
      )}

      {/* Jumpscare Overlay */}
      {isJumpscare && (
        <div className="absolute inset-0 z-[100] pointer-events-none flex items-center justify-center overflow-hidden">
          {/* Violent flashing, but transparent so we see the 3D monster */}
          <div className="w-full h-full bg-red-600 animate-ping absolute inset-0 mix-blend-color-burn opacity-60" style={{ animationDuration: '0.1s' }} />
          <div className="w-full h-full bg-black animate-pulse absolute inset-0 mix-blend-overlay opacity-40" style={{ animationDuration: '0.05s' }} />
        </div>
      )}

      {/* Crosshair */}
      {gameState !== 'intro' && (
        <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 bg-white/80 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none mix-blend-difference" />
      )}

      {/* Ammo Display */}
      {gameState === 'playing' && hasGun && (
        <div className="absolute bottom-8 right-8 text-white font-mono text-4xl font-bold bg-black/50 p-4 rounded-lg border border-white/20 pointer-events-none">
          {isReloading ? 'RELOADING...' : `${ammo} / 2`}
        </div>
      )}

      {/* Notes Counter */}
      {gameState === 'playing' && (
        <div className="absolute top-8 left-8 text-white font-mono text-2xl font-bold bg-black/50 p-4 rounded-lg border border-white/20 pointer-events-none flex items-center gap-3">
          <span className="text-3xl">📄</span>
          {notesCollected} / 8
        </div>
      )}

      {/* Interaction Prompt */}
      {gameState === 'playing' && canPickUpShotgun && isShotgunDropped && !useGameStore.getState().hasGun && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 mt-8 flex flex-col items-center pointer-events-auto z-50">
          <button
            onPointerDown={(e) => {
              e.stopPropagation();
              setHasGun(true);
              setShotgunDropped(false);
            }}
            className="px-6 py-3 bg-black/80 text-white font-bold rounded-lg border-2 border-white/30 hover:bg-white/20 transition-all backdrop-blur-sm cursor-pointer"
          >
            Взять дробовик (E)
          </button>
        </div>
      )}

      {/* Dialog UI */}
      {dialog && (
        <div 
          className="absolute bottom-32 left-1/2 -translate-x-1/2 bg-black/80 text-white p-6 rounded-lg border-2 border-white/20 w-[600px] max-w-[90vw] pointer-events-auto cursor-pointer z-40 flex flex-col items-center active:scale-95 transition-transform"
          onClick={() => {
            if ((window as any).advanceDogDialog) {
              (window as any).advanceDogDialog();
            }
          }}
        >
          <div className="text-yellow-400 font-bold mb-2 text-xl w-full text-left">{dialog.speaker}</div>
          <div className="text-2xl w-full text-left">{dialog.text}</div>
          <div className="text-gray-400 text-sm mt-4 animate-pulse">Нажмите 'E' или коснитесь здесь, чтобы продолжить</div>
        </div>
      )}

      {/* Stamina Bar */}
      {gameState === 'playing' && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-64 h-2 bg-black/50 rounded-full overflow-hidden border border-white/20 pointer-events-none">
          <div id="stamina-bar" className="h-full bg-white transition-all duration-75" style={{ width: '100%' }} />
        </div>
      )}

      {gameState === 'playing' && (
        <div className="flex justify-between items-end pb-8 px-4 pointer-events-none">
          <Joystick />
          
          <div className="flex gap-4">
            {/* Mobile Fire/Reload Buttons */}
            {hasGun && (
              <>
                <button 
                  className="w-16 h-16 bg-blue-500/50 rounded-full backdrop-blur-md border border-blue-500/50 pointer-events-auto flex items-center justify-center text-white font-bold active:bg-blue-500/80"
                  onTouchStart={() => (window as any).reloadShotgun?.()}
                  onMouseDown={() => (window as any).reloadShotgun?.()}
                >
                  RELOAD
                </button>
                <button 
                  className="w-20 h-20 bg-red-500/50 rounded-full backdrop-blur-md border border-red-500/50 pointer-events-auto flex items-center justify-center text-white font-bold active:bg-red-500/80"
                  onTouchStart={() => (window as any).fireShotgun?.()}
                  onMouseDown={() => (window as any).fireShotgun?.()}
                >
                  FIRE
                </button>
              </>
            )}

            {/* Mobile Zoom Button */}
            <button 
              className="w-16 h-16 bg-white/20 rounded-full backdrop-blur-md border border-white/30 pointer-events-auto flex items-center justify-center text-white font-bold active:bg-white/40"
              onTouchStart={() => setIsZooming(true)}
              onTouchEnd={() => setIsZooming(false)}
              onMouseDown={() => setIsZooming(true)}
              onMouseUp={() => setIsZooming(false)}
              onMouseLeave={() => setIsZooming(false)}
            >
              ZOOM
            </button>
            
            {/* Mobile Sprint Button */}
            <button 
              className="w-20 h-20 bg-white/20 rounded-full backdrop-blur-md border border-white/30 pointer-events-auto flex items-center justify-center text-white font-bold active:bg-white/40"
              onTouchStart={() => setKey('shift', true)}
              onTouchEnd={() => setKey('shift', false)}
              onMouseDown={() => setKey('shift', true)}
              onMouseUp={() => setKey('shift', false)}
              onMouseLeave={() => setKey('shift', false)}
            >
              SPRINT
            </button>
          </div>
        </div>
      )}
      
      <audio ref={menuAudioRef} src="https://raw.githubusercontent.com/Wellers20/OcenIVATel/main/menu.mp3?v=2" loop />
    </div>
  );
};
