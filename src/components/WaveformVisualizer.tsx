import React, { useRef, useEffect, useCallback } from 'react';

interface WaveformVisualizerProps {
  status: 'speaking' | 'listening' | 'idle';
  analyserNode?: React.MutableRefObject<AnalyserNode | null>;
}

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const BAR_COUNT = 48;
const BAR_GAP = 3;
const MIN_BAR_HEIGHT = 3;

// Colors per state
const STATE_CONFIG = {
  speaking: {
    colorA: '#858585',
    colorB: '#555555',
    glowColor: 'transparent',
    label: 'AI Speaking',
    fallback: true,
  },
  listening: {
    colorA: '#aaaaaa',
    colorB: '#777777',
    glowColor: 'transparent',
    label: 'Listening…',
    fallback: false,
  },
  idle: {
    colorA: '#777777',
    colorB: '#777777',
    glowColor: 'transparent',
    label: '',
    fallback: true,
  },
};

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  status,
  analyserNode,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const phaseRef = useRef(0); // for smooth idle / fallback sine animation

  const cfg = STATE_CONFIG[status];

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const logicalW = canvas.width / dpr;
    const logicalH = canvas.height / dpr;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, logicalW, logicalH);

    // ── Try to get REAL microphone frequency data ─────────────────────────
    let dataArray: Uint8Array | null = null;
    const analyser = analyserNode?.current;
    if (analyser && status === 'listening') {
      dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
    }

    const totalBarWidth = (logicalW - (BAR_COUNT - 1) * BAR_GAP) / BAR_COUNT;
    phaseRef.current += status === 'idle' ? 0.03 : 0.06;

    for (let i = 0; i < BAR_COUNT; i++) {
      let normalizedHeight: number;

      if (dataArray && status === 'listening') {
        // ── REAL mic data: map frequency bins to bars ──────────────────────
        const binIndex = Math.floor((i / BAR_COUNT) * dataArray.length * 0.6); // use lower 60% of spectrum (voice range)
        normalizedHeight = dataArray[binIndex] / 255;
        // Boost for visibility
        normalizedHeight = Math.pow(normalizedHeight, 0.7);
      } else if (status === 'listening') {
        // ── Smooth animated wave for listening (cyan theme) ─────────────────
        const wave1 = Math.sin(i * 0.25 - phaseRef.current * 1.5) * 0.35;
        const wave2 = Math.cos(i * 0.45 + phaseRef.current * 0.8) * 0.2;
        normalizedHeight = 0.15 + Math.max(0, wave1 + wave2);
      } else if (status === 'speaking') {
        // ── Smooth animated wave (AI speaking) ────────────────────────────
        const wave1 = Math.sin(i * 0.3 + phaseRef.current) * 0.4;
        const wave2 = Math.sin(i * 0.15 + phaseRef.current * 1.3 + 1) * 0.25;
        const wave3 = Math.sin(i * 0.5 + phaseRef.current * 0.7 + 2) * 0.15;
        normalizedHeight = 0.2 + Math.max(0, wave1 + wave2 + wave3);
      } else {
        // ── Idle: very small flat pulse ────────────────────────────────────
        normalizedHeight = 0.04 + Math.sin(i * 0.5 + phaseRef.current) * 0.02;
      }

      const barH = Math.max(MIN_BAR_HEIGHT, normalizedHeight * (logicalH - 8));
      const x = i * (totalBarWidth + BAR_GAP);
      const y = (logicalH - barH) / 2;

      // Gradient per bar
      const gradient = ctx.createLinearGradient(x, y, x, y + barH);
      gradient.addColorStop(0, cfg.colorA);
      gradient.addColorStop(1, cfg.colorB);

      // Glow
      if (status !== 'idle' && normalizedHeight > 0.15) {
        ctx.shadowBlur = 8;
        ctx.shadowColor = cfg.glowColor;
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, y, Math.max(1, totalBarWidth), barH, totalBarWidth / 2);
      ctx.fill();
    }

    ctx.restore();
    if (status !== 'idle' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) animFrameRef.current = requestAnimationFrame(draw);
  }, [status, analyserNode, cfg]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

  // Resize observer to keep canvas pixel-perfect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(entry.contentRect.width * dpr);
        canvas.height = Math.round(entry.contentRect.height * dpr);
        if (status === 'idle' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) draw();
      }
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [draw, status]);

  return (
    <div className="waveform-wrapper">
      <canvas
        aria-hidden="true"
        ref={canvasRef}
        className="waveform-canvas"
        style={{ width: '100%', height: '44px', display: 'block' }}
      />
    </div>
  );
};

export default WaveformVisualizer;
