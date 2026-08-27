/**
 * @file components/CanvasStage.tsx
 * Canvas display stage component with pointer & touch event forwarding,
 * HiDPI Retina support, direct touch dragging, multi-touch action tapping,
 * and toggleable hardware-accelerated CRT scanline/vignette overlay.
 */

'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import type { GameEngine } from '@/game/types';

interface CanvasStageProps {
  engineRef: React.MutableRefObject<GameEngine | null>;
  width?: number;
  height?: number;
  enableCrtFilter?: boolean;
}

export const CanvasStage: React.FC<CanvasStageProps> = ({
  engineRef,
  width = 800,
  height = 700,
  enableCrtFilter = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const touchStartTimeRef = useRef<number>(0);
  const touchStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Convert client viewport coordinates to canonical 800x700 canvas space
  const getCanvasCoordinates = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 400, y: 350 };

      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return { x: 400, y: 350 };

      const scaleX = width / rect.width;
      const scaleY = height / rect.height;

      const x = Math.max(0, Math.min(width, (clientX - rect.left) * scaleX));
      const y = Math.max(0, Math.min(height, (clientY - rect.top) * scaleY));

      return { x, y };
    },
    [width, height]
  );

  // Pointer / Mouse Event Handlers
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { x } = getCanvasCoordinates(e.clientX, e.clientY);
      engineRef.current?.inputManager?.setPointerX(x);
    },
    [getCanvasCoordinates, engineRef]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button === 0) {
        engineRef.current?.inputManager?.handlePrimaryAction();
      }
    },
    [engineRef]
  );

  // Direct Touch Event Handlers
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const { x, y } = getCanvasCoordinates(touch.clientX, touch.clientY);
        touchStartTimeRef.current = Date.now();
        touchStartPosRef.current = { x, y };

        engineRef.current?.inputManager?.setPointerX(x);
      } else if (e.touches.length > 1) {
        // Multi-touch: secondary touch triggers instant action / laser fire
        engineRef.current?.inputManager?.handlePrimaryAction();
      }
    },
    [getCanvasCoordinates, engineRef]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const { x } = getCanvasCoordinates(touch.clientX, touch.clientY);
        engineRef.current?.inputManager?.setPointerX(x);
      }
    },
    [getCanvasCoordinates, engineRef]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      // Tap detection: short duration (< 250ms) and minimal movement (< 15px)
      const elapsed = Date.now() - touchStartTimeRef.current;
      if (e.changedTouches.length > 0 && elapsed < 250) {
        const touch = e.changedTouches[0];
        const { x, y } = getCanvasCoordinates(touch.clientX, touch.clientY);
        const dx = Math.abs(x - touchStartPosRef.current.x);
        const dy = Math.abs(y - touchStartPosRef.current.y);

        if (dx < 15 && dy < 15) {
          engineRef.current?.inputManager?.handlePrimaryAction();
        }
      }
    },
    [getCanvasCoordinates, engineRef]
  );

  // Attach Canvas element to GameEngine on mount with HiDPI support
  useEffect(() => {
    const canvas = canvasRef.current;
    const currentEngine = engineRef.current;
    if (!canvas) return;

    const setupCanvas = () => {
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;

      const ctx = canvas.getContext('2d', { alpha: false });
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.imageSmoothingEnabled = false; // Crisp pixel/retro rendering
      }

      if (currentEngine) {
        currentEngine.mountCanvas(canvas, ctx);
      }
    };

    setupCanvas();

    window.addEventListener('resize', setupCanvas);
    return () => {
      window.removeEventListener('resize', setupCanvas);
      currentEngine?.unmountCanvas();
    };
  }, [width, height, engineRef]);

  return (
    <div className="relative w-full h-full aspect-[800/700] overflow-hidden select-none touch-none">
      <canvas
        ref={canvasRef}
        role="region"
        aria-label="Arkanoid Game Screen"
        tabIndex={0}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{ width: '100%', height: '100%' }}
        className="block w-full h-full cursor-crosshair focus:outline-none select-none touch-none"
      />

      {/* CRT Scanline & Barrel Distortion Vignette Overlay */}
      {enableCrtFilter && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 crt-scanlines crt-vignette crt-beam"
        />
      )}
    </div>
  );
};
