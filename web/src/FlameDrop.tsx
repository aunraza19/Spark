import { useEffect, useRef } from "react";
import { CAPTIONS, ILLUSTRATION_LABEL } from "./content";
import { drawScene } from "./flame";

const DESCRIPTION =
  "Illustration of two flames side by side. On the left, a tall teardrop flame under Earth gravity. " +
  "On the right, a flame that rounds into a dim sphere as gravity drops to zero.";

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function FlameDrop() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const start = useRef(0);
  const reduced = prefersReducedMotion();

  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext("2d");
    if (!element || !ctx) return;
    start.current = performance.now();
    let width = 0;
    let height = 0;
    let frame = 0;
    const size = () => {
      const ratio = window.devicePixelRatio || 1;
      width = element.clientWidth;
      height = element.clientHeight;
      element.width = Math.round(width * ratio);
      element.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const draw = () => {
      drawScene(ctx, width, height, performance.now() - start.current, reduced);
      if (!reduced) frame = requestAnimationFrame(draw);
    };
    const resize = () => {
      size();
      if (reduced) draw();
    };
    size();
    draw();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [reduced]);

  return (
    <figure className="flame-drop">
      <canvas ref={canvas} role="img" aria-label={DESCRIPTION} />
      <p className="illustration-label">{ILLUSTRATION_LABEL}</p>
      <div className="captions">
        <p className="caption earth">{CAPTIONS.earth}</p>
        <p className="caption iss">{CAPTIONS.iss}</p>
      </div>
      {!reduced && (
        <button type="button" className="button" onClick={() => (start.current = performance.now())}>
          Replay the drop
        </button>
      )}
    </figure>
  );
}
