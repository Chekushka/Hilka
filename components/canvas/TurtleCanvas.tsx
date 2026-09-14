'use client';

/**
 * One renderer draws both the student's result and the target, so they are
 * guaranteed to share scale, theme and coordinate system. The target sits
 * underneath as a translucent outline: a geometric mistake becomes visible
 * before any message appears — seen, not explained.
 *
 * Flat 2D canvas, no library. The classroom machine has integrated graphics.
 */
import { useEffect, useRef } from 'react';
import type { Segment } from '@/lib/runner';

interface TurtleCanvasProps {
  drawing: Segment[];
  target?: Segment[];
  width?: number;
  height?: number;
  label?: string;
}

const PADDING = 20;

function bounds(segments: Segment[]): [number, number, number, number] {
  const xs = segments.flatMap((s) => [s.x1, s.x2]);
  const ys = segments.flatMap((s) => [s.y1, s.y2]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export function TurtleCanvas({ drawing, target = [], width = 360, height = 300, label }: TurtleCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Crisp on the projector and on a scaled-up school display.
    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const all = [...target, ...drawing];
    if (all.length === 0) return;

    // Both drawings share one transform, or the comparison would lie.
    const [minX, minY, maxX, maxY] = bounds(all);
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const scale = Math.min((width - 2 * PADDING) / spanX, (height - 2 * PADDING) / spanY);
    const offsetX = (width - spanX * scale) / 2;
    const offsetY = (height - spanY * scale) / 2;
    const toX = (x: number) => offsetX + (x - minX) * scale;
    // Canvas y grows downward; turtle's grows up.
    const toY = (y: number) => height - offsetY - (y - minY) * scale;

    // Tokens, resolved. If a custom property is ever missing, the element's own
    // inherited colour is the right fallback — a literal hex here would be a
    // colour that no theme chose.
    const styles = getComputedStyle(canvas);
    const ink = styles.getPropertyValue('--ink').trim() || styles.color;
    const muted = styles.getPropertyValue('--ink-muted').trim() || styles.color;

    function stroke(segments: Segment[], color: string, lineWidth: number, dash: number[]) {
      ctx!.save();
      ctx!.setLineDash(dash);
      ctx!.lineCap = 'round';
      ctx!.lineJoin = 'round';
      for (const s of segments) {
        ctx!.beginPath();
        ctx!.strokeStyle = s.color === 'black' ? color : s.color;
        ctx!.lineWidth = Math.max(1, s.width) * lineWidth;
        ctx!.moveTo(toX(s.x1), toY(s.y1));
        ctx!.lineTo(toX(s.x2), toY(s.y2));
        ctx!.stroke();
      }
      ctx!.restore();
    }

    if (target.length > 0) {
      // Faint enough to read as a guide, strong enough to survive a washed-out
      // school monitor seen at an angle. The dash carries the distinction too,
      // so the overlay does not depend on the contrast alone.
      ctx.globalAlpha = 0.5;
      stroke(target, muted, 1, [7, 5]);
      ctx.globalAlpha = 1;
    }
    stroke(drawing, ink, 1.5, []);
  }, [drawing, target, width, height]);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={label}
      style={{ width, height }}
      className="rounded-md border border-line bg-code-bg"
    />
  );
}
