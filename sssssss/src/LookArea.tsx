import { useEffect, useRef } from 'react';
import { useGameStore } from './store';

export const LookArea = () => {
  const addLookDelta = useGameStore((state) => state.addLookDelta);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let lastX = 0;
    let lastY = 0;
    let activeId: number | null = null;

    const handleTouchStart = (e: TouchEvent) => {
      if (activeId !== null) return;
      const touch = e.changedTouches[0];
      activeId = touch.identifier;
      lastX = touch.clientX;
      lastY = touch.clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (useGameStore.getState().gameState !== 'playing') return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === activeId) {
          const dx = touch.clientX - lastX;
          const dy = touch.clientY - lastY;
          addLookDelta(dx, dy);
          lastX = touch.clientX;
          lastY = touch.clientY;
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === activeId) {
          activeId = null;
        }
      }
    };

    // Mouse fallback for desktop testing
    let isMouseDown = false;
    const handleMouseDown = (e: MouseEvent) => {
      isMouseDown = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (useGameStore.getState().gameState !== 'playing') return;
      if (document.pointerLockElement) {
        addLookDelta(e.movementX, e.movementY);
        return;
      }
      if (!isMouseDown) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      addLookDelta(dx, dy);
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const handleMouseUp = () => {
      isMouseDown = false;
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);
    el.addEventListener('touchcancel', handleTouchEnd);

    el.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
      el.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [addLookDelta]);

  return (
    <div 
      ref={ref} 
      className="absolute top-0 right-0 w-1/2 h-full z-0 touch-none"
    />
  );
};
