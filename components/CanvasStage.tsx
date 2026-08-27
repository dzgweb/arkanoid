'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import type { GameEngine } from '@/game/types';

interface CanvasStageProps {
  engineRef: React.MutableRefObject<GameEngine | null>;
  width?: number;
  height?: number;
}

export const CanvasStage: React.FC<CanvasStageProps> = ({
  engineRef,
  width = 800,
  height = 700,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Convert client viewport coordinates to canonical 800x700 canvas space
  const getCanvasCoordinates = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? width / rect.width : 1;
    const scaleY = rect.height > 0 ? height / rect.height : 1;

    const x = Math.max(0, Math.min(width, (clientX - rect.left) * scaleX));
    const y = Math.max(0, Math.min(height, (clientY - rect.top) * scaleY));

    return { x, y };
  }, [width, height]);

  // Pointer Event Handlers
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x } = getCanvasCoordinates(e.clientX, e.clientY);
    engineRef.current?.inputManager?.setPointerX(x);
  }, [getCanvasCoordinates, engineRef]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0) { // Primary click: launch or laser fire
      engineRef.current?.inputManager?.handlePrimaryAction();
    }
  }, [engineRef]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      const { x } = getCanvasCoordinates(touch.clientX, touch.clientY);
      engineRef.current?.inputManager?.setPointerX(x);
    }
  }, [getCanvasCoordinates, engineRef]);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      const { x } = getCanvasCoordinates(touch.clientX, touch.clientY);
      engineRef.current?.inputManager?.setPointerX(x);
      engineRef.current?.inputManager?.handlePrimaryAction();
    }
  }, [getCanvasCoordinates, engineRef]);

  // Attach Canvas element to GameEngine on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Support Retina / HiDPI screens
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.imageSmoothingEnabled = false; // Crisp pixel/retro rendering
    }

    if (engineRef.current) {
      engineRef.current.mountCanvas(canvas, ctx);
    }

    return () => {
      engineRef.current?.unmountCanvas();
    };
  }, [width, height, engineRef]);

  return (
    <canvas
      ref={canvasRef}
      role="region"
      aria-label="Arkanoid Game Screen"
      tabIndex={0}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onTouchMove={handleTouchMove}
      onTouchStart={handleTouchStart}
      style={{ width: '100%', height: '100%', aspectRatio: `${width} / ${height}` }}
      className="block w-full h-full cursor-crosshair focus:outline-none select-none touch-none"
    />
  );
};
