"use client";

import { useEffect, useRef } from "react";
import type { LoginEffect } from "@/lib/login-theme";

interface Props {
  effect: LoginEffect;
  color: string;
  /** 1 a 10 */
  speed: number;
  /** 1 a 10 */
  intensity: number;
}

const GRID = 64;

/**
 * Fundo animado da página de login, desenhado num canvas que ocupa o
 * elemento pai. "linhas": grade discreta com feixes de luz correndo pelas
 * linhas; "constelacao": pontos que se movem e se ligam quando próximos.
 * Respeita "reduzir movimento" do sistema (mostra um quadro parado).
 */
export function LoginBackdrop({ effect, color, speed, intensity }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent || effect === "nenhum") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const [cr, cg, cb] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
    const rgba = (a: number) => `rgba(${cr},${cg},${cb},${a})`;
    let w = 0;
    let h = 0;
    let raf = 0;
    let last = performance.now();

    type Beam = { horizontal: boolean; line: number; pos: number; len: number; dir: 1 | -1; v: number };
    type Dot = { x: number; y: number; vx: number; vy: number };
    let beams: Beam[] = [];
    let dots: Dot[] = [];
    const velocity = 40 + speed * 28; // px/s

    const newBeam = (anywhere: boolean): Beam => {
      const horizontal = Math.random() < 0.5;
      const lines = Math.max(1, Math.floor((horizontal ? h : w) / GRID));
      const span = horizontal ? w : h;
      const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
      const len = 90 + Math.random() * 160;
      const start = dir === 1 ? -len : span + len;
      return {
        horizontal,
        line: (1 + Math.floor(Math.random() * lines)) * GRID,
        pos: anywhere ? Math.random() * span : start,
        len,
        dir,
        v: velocity * (0.6 + Math.random() * 0.8),
      };
    };
    const newDot = (): Dot => {
      const a = Math.random() * Math.PI * 2;
      const v = (velocity / 6) * (0.4 + Math.random());
      return { x: Math.random() * w, y: Math.random() * h, vx: Math.cos(a) * v, vy: Math.sin(a) * v };
    };

    const resize = () => {
      const r = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const area = (w * h) / (1440 * 900);
      beams = Array.from({ length: Math.max(3, Math.round(intensity * 2.2 * Math.sqrt(area))) }, () => newBeam(true));
      dots = Array.from({ length: Math.max(12, Math.round(intensity * 10 * area)) }, newDot);
    };

    const drawGrid = () => {
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(0.035 + intensity * 0.006);
      ctx.beginPath();
      for (let x = GRID; x < w; x += GRID) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
      }
      for (let y = GRID; y < h; y += GRID) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
      }
      ctx.stroke();
    };

    const drawBeams = (dt: number) => {
      const glow = 0.45 + intensity * 0.05;
      for (let i = 0; i < beams.length; i++) {
        const b = beams[i];
        b.pos += b.v * b.dir * dt;
        const span = b.horizontal ? w : h;
        if ((b.dir === 1 && b.pos - b.len > span) || (b.dir === -1 && b.pos + b.len < 0)) {
          beams[i] = newBeam(false);
          continue;
        }
        const head = b.pos;
        const tail = b.pos - b.len * b.dir;
        const [x1, y1, x2, y2] = b.horizontal ? [tail, b.line, head, b.line] : [b.line, tail, b.line, head];
        const g = ctx.createLinearGradient(x1, y1, x2, y2);
        g.addColorStop(0, rgba(0));
        g.addColorStop(1, rgba(glow));
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = rgba(0.9);
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(x1 + 0.5, y1 + 0.5);
        ctx.lineTo(x2 + 0.5, y2 + 0.5);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = rgba(Math.min(1, glow + 0.25));
        ctx.beginPath();
        ctx.arc(x2 + 0.5, y2 + 0.5, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawDots = (dt: number) => {
      const maxD = 150;
      for (const d of dots) {
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (d.x < -20) d.x = w + 20;
        if (d.x > w + 20) d.x = -20;
        if (d.y < -20) d.y = h + 20;
        if (d.y > h + 20) d.y = -20;
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x;
          const dy = dots[i].y - dots[j].y;
          const dist = Math.hypot(dx, dy);
          if (dist < maxD) {
            ctx.strokeStyle = rgba((1 - dist / maxD) * (0.12 + intensity * 0.03));
            ctx.beginPath();
            ctx.moveTo(dots[i].x, dots[i].y);
            ctx.lineTo(dots[j].x, dots[j].y);
            ctx.stroke();
          }
        }
      }
      ctx.fillStyle = rgba(0.35 + intensity * 0.05);
      for (const d of dots) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      if (effect === "linhas") {
        drawGrid();
        drawBeams(dt);
      } else {
        drawDots(dt);
      }
      if (!reduce) raf = requestAnimationFrame(frame);
    };

    resize();
    const ro = new ResizeObserver(() => {
      resize();
      if (reduce) frame(performance.now());
    });
    ro.observe(parent);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [effect, color, speed, intensity]);

  if (effect === "nenhum") return null;
  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0" />;
}
