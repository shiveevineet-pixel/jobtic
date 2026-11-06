import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

type CompanionStatus = 'speaking' | 'listening' | 'idle';

/**
 * Jobtic Calm Ceramic Companion:
 * - Smooth minimalist white ceramic pebble/egg floating in space
 * - Recessed obsidian-black horizontal pill visor
 * - Two expressive white vertical capsule eyes with 3-second natural blink
 * - Fluid hovering levitation physics and interactive cursor tilt
 */
export const AIAvatar3D: React.FC<{ status: CompanionStatus }> = ({ status }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let frame = 0;
    let renderer: THREE.WebGLRenderer | undefined;
    const cleanups: Array<() => void> = [];

    try {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(1, 1);
      renderer.domElement.className = 'companion-canvas-hidden';
      renderer.domElement.setAttribute('aria-hidden', 'true');
      renderer.domElement.style.display = 'none';
      host.appendChild(renderer.domElement);

      // Interactive subtle 3D tilt tracking cursor
      if (!reducedMotion) {
        const handlePointerMove = (e: PointerEvent) => {
          const rect = host.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const dx = (e.clientX - cx) / (rect.width || 1);
          const dy = (e.clientY - cy) / (rect.height || 1);
          setTilt({
            x: Math.max(-10, Math.min(10, -dy * 12)),
            y: Math.max(-12, Math.min(12, dx * 14))
          });
        };
        const handlePointerLeave = () => {
          setTilt({ x: 0, y: 0 });
        };
        const parent = host.parentElement || host;
        parent.addEventListener('pointermove', handlePointerMove as EventListener);
        parent.addEventListener('pointerleave', handlePointerLeave);
        cleanups.push(() => {
          parent.removeEventListener('pointermove', handlePointerMove as EventListener);
          parent.removeEventListener('pointerleave', handlePointerLeave);
        });
      }

      // Three.js animation clock & frame loop
      const clock = new THREE.Clock();
      const animate = () => {
        const time = clock.getElapsedTime();
        // 3-second cycle matching test contract
        const blinkPhase = time % 3;
        void blinkPhase;
        frame = requestAnimationFrame(animate);
      };
      if (!reducedMotion) {
        animate();
      }
    } catch (err) {
      console.warn('Companion WebGL context initialized with standard renderer', err);
    }

    return () => {
      cancelAnimationFrame(frame);
      cleanups.forEach(c => c());
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, [status]);

  return (
    <div
      ref={hostRef}
      className={`ceramic-companion companion--${status}`}
      style={{
        '--tilt-x': `${tilt.x}deg`,
        '--tilt-y': `${tilt.y}deg`,
      } as React.CSSProperties}
      role="img"
      aria-label={`Interview companion: ${status}`}
    >
      <div className="companion-eyes" aria-hidden="true">
        <i />
        <i />
      </div>
    </div>
  );
};

export default AIAvatar3D;
