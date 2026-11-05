"use client";

import { useEffect, useRef } from "react";
import { AREA_MASK, type LoginArea, type LoginEffect } from "@/lib/login-theme";

interface Props {
  effect: LoginEffect;
  color: string;
  /** 1 a 10 */
  speed: number;
  /** 1 a 10 */
  intensity: number;
  area?: LoginArea;
}

const GRID = 64;

/**
 * Fundo animado da página de login, desenhado num canvas que ocupa o
 * elemento pai. "linhas": grade discreta com feixes de luz correndo pelas
 * linhas; "constelacao": pontos que se movem e se ligam quando próximos.
 * Respeita "reduzir movimento" do sistema (mostra um quadro parado).
 */
export function LoginBackdrop({ effect, color, speed, intensity, area = "toda" }: Props) {
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
    type Streak = { x: number; y: number; len: number; v: number; a: number; wdt: number };
    type Wave = { y: number; amp: number; len: number; phase: number; v: number; a: number };
    type Orb = { x: number; y: number; r: number; vx: number; vy: number; a: number; tw: number };
    let beams: Beam[] = [];
    let dots: Dot[] = [];
    let streaks: Streak[] = [];
    let waves: Wave[] = [];
    let orbs: Orb[] = [];
    let t0 = 0;
    // Linhas passando: sobem da esquerda para a direita, inclinadas.
    const ANG = -0.42;
    const [ux, uy] = [Math.cos(ANG), Math.sin(ANG)];
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

    const newStreak = (anywhere: boolean): Streak => {
      const len = 120 + Math.random() * 260;
      // Começa fora da tela, na borda esquerda ou de baixo.
      const fromLeft = Math.random() < h / (w + h);
      const x = anywhere ? Math.random() * w : fromLeft ? -len : Math.random() * w;
      const y = anywhere ? Math.random() * h : fromLeft ? Math.random() * h : h + len;
      return { x, y, len, v: velocity * (1 + Math.random() * 1.2), a: 0.35 + Math.random() * 0.55, wdt: Math.random() < 0.3 ? 2 : 1.2 };
    };
    const newOrb = (anywhere: boolean, big = false): Orb => {
      const r = big ? Math.max(w, h) * (0.25 + Math.random() * 0.2) : 8 + Math.random() * 46;
      const v = big ? velocity / 4 : velocity / 5;
      return {
        x: Math.random() * w,
        y: anywhere ? Math.random() * h : h + r,
        r,
        vx: (Math.random() - 0.5) * v,
        vy: big ? (Math.random() - 0.5) * v : -(0.3 + Math.random()) * v,
        a: big ? 0.18 + Math.random() * 0.16 : 0.18 + Math.random() * 0.3,
        tw: Math.random() * Math.PI * 2,
      };
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
      streaks = Array.from({ length: Math.max(8, Math.round(intensity * 4 * Math.sqrt(area))) }, () => newStreak(true));
      const nWaves = 2 + Math.round(intensity / 2);
      waves = Array.from({ length: nWaves }, (_, i) => ({
        y: h * (0.45 + (0.45 * i) / Math.max(1, nWaves - 1)),
        amp: 18 + Math.random() * 42,
        len: 380 + Math.random() * 520,
        phase: Math.random() * Math.PI * 2,
        v: (0.25 + Math.random() * 0.35) * (0.4 + speed / 5),
        a: 0.18 + (i / nWaves) * 0.35,
      }));
      orbs =
        effect === "aurora"
          ? Array.from({ length: 3 + Math.round(intensity / 4) }, () => newOrb(true, true))
          : Array.from({ length: Math.max(14, Math.round(intensity * 4 * area)) }, () => newOrb(true));
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

    const drawStreaks = (dt: number) => {
      for (let i = 0; i < streaks.length; i++) {
        const s = streaks[i];
        s.x += ux * s.v * dt;
        s.y += uy * s.v * dt;
        const tx = s.x - ux * s.len;
        const ty = s.y - uy * s.len;
        if (tx > w + 20 || ty < -20) {
          streaks[i] = newStreak(false);
          continue;
        }
        const g = ctx.createLinearGradient(tx, ty, s.x, s.y);
        g.addColorStop(0, rgba(0));
        g.addColorStop(1, rgba(Math.min(1, s.a * (0.6 + intensity * 0.06))));
        ctx.strokeStyle = g;
        ctx.lineWidth = s.wdt;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
      }
    };

    const drawWaves = (dt: number) => {
      ctx.lineWidth = 1.5;
      for (const wv of waves) {
        wv.phase += wv.v * dt * 2;
        for (const off of [0, 14]) {
          ctx.strokeStyle = rgba(wv.a * (off ? 0.45 : 1) * (0.5 + intensity * 0.06));
          ctx.beginPath();
          for (let x = -10; x <= w + 10; x += 8) {
            const y =
              wv.y + off +
              Math.sin((x / wv.len) * Math.PI * 2 + wv.phase + off / 30) * wv.amp +
              Math.sin((x / (wv.len * 0.47)) * Math.PI * 2 - wv.phase * 0.7) * wv.amp * 0.25;
            if (x === -10) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
    };

    const drawOrbs = (dt: number, now: number) => {
      const big = effect === "aurora";
      if (big) ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < orbs.length; i++) {
        const o = orbs[i];
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        if (big) {
          if (o.x < -o.r * 0.5 || o.x > w + o.r * 0.5) o.vx *= -1;
          if (o.y < -o.r * 0.5 || o.y > h + o.r * 0.5) o.vy *= -1;
        } else if (o.y < -o.r - 10) {
          orbs[i] = newOrb(false);
          continue;
        }
        const pulse = 0.75 + 0.25 * Math.sin(now / 900 + o.tw);
        const alpha = o.a * pulse * (big ? 0.6 + intensity * 0.06 : 0.5 + intensity * 0.07);
        const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        g.addColorStop(0, rgba(Math.min(1, alpha)));
        g.addColorStop(big ? 1 : 0.7, rgba(big ? 0 : alpha * 0.35));
        if (!big) g.addColorStop(1, rgba(0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      if (!t0) t0 = now;
      if (effect === "linhas") {
        drawGrid();
        drawBeams(dt);
      } else if (effect === "fluxo") drawStreaks(dt);
      else if (effect === "ondas") drawWaves(dt);
      else if (effect === "bokeh" || effect === "aurora") drawOrbs(dt, now);
      else drawDots(dt);
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
  const mask = AREA_MASK[area];
  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
    />
  );
}
