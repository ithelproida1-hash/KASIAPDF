"use client";

import * as React from "react";

/**
 * Lightweight click-triggered fireworks.
 *
 * - Renders on a single fixed canvas above the page (pointer-events: none).
 * - Bursts at the click position, then stops the animation loop when idle.
 * - Respects `prefers-reduced-motion` and never fires inside form fields.
 */

const COLORS = ["#818cf8", "#a78bfa", "#22d3ee", "#fbbf24", "#f472b6", "#34d399"];

const PARTICLES_PER_BURST = 26;
const MAX_PARTICLES = 220;
const MIN_BURST_INTERVAL_MS = 110;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  age: number;
  ttl: number;
  color: string;
};

const SKIP_SELECTOR =
  "input, textarea, select, label, [contenteditable='true'], [data-no-fireworks]";

export function ClickFireworks() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const particlesRef = React.useRef<Particle[]>([]);
  const frameRef = React.useRef<number | null>(null);
  const lastBurstRef = React.useRef(0);
  const reducedMotionRef = React.useRef(false);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = motionQuery.matches;

    const handleMotionChange = () => {
      reducedMotionRef.current = motionQuery.matches;
    };

    motionQuery.addEventListener("change", handleMotionChange);

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * ratio);
      canvas.height = Math.floor(window.innerHeight * ratio);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const tick = () => {
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      const particles = particlesRef.current;

      context.globalCompositeOperation = "lighter";

      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index]!;

        particle.age += 1;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vx *= 0.985;
        particle.vy = particle.vy * 0.985 + 0.05;

        const alpha = Math.max(0, 1 - particle.age / particle.ttl);

        if (alpha <= 0) {
          particles.splice(index, 1);
          continue;
        }

        context.globalAlpha = alpha;
        context.fillStyle = particle.color;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        context.fill();
      }

      context.globalAlpha = 1;
      context.globalCompositeOperation = "source-over";

      if (particles.length > 0) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        frameRef.current = null;
        context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      }
    };

    const burst = (x: number, y: number) => {
      const now = performance.now();

      if (reducedMotionRef.current || now - lastBurstRef.current < MIN_BURST_INTERVAL_MS) {
        return;
      }

      lastBurstRef.current = now;

      const particles = particlesRef.current;
      const palette = COLORS[Math.floor(Math.random() * COLORS.length)]!;
      const accent = COLORS[Math.floor(Math.random() * COLORS.length)]!;

      for (let index = 0; index < PARTICLES_PER_BURST; index += 1) {
        const angle = (Math.PI * 2 * index) / PARTICLES_PER_BURST + Math.random() * 0.25;
        const speed = 1.6 + Math.random() * 3.1;

        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 1.4 + Math.random() * 1.8,
          age: 0,
          ttl: 38 + Math.random() * 36,
          color: Math.random() > 0.35 ? palette : accent,
        });
      }

      if (particles.length > MAX_PARTICLES) {
        particles.splice(0, particles.length - MAX_PARTICLES);
      }

      if (frameRef.current === null) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };

    const handleClick = (event: MouseEvent) => {
      if (event.button !== 0 || document.hidden) {
        return;
      }

      const target = event.target;

      if (target instanceof Element && target.closest(SKIP_SELECTOR)) {
        return;
      }

      burst(event.clientX, event.clientY);
    };

    window.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("resize", resize);
      motionQuery.removeEventListener("change", handleMotionChange);

      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      particlesRef.current = [];
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="click-fireworks"
      className="pointer-events-none fixed inset-0 z-40"
    />
  );
}
