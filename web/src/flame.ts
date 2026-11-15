export type Ctx2D = CanvasRenderingContext2D;

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// 1 g for the first 700 ms, then a smooth fall to 0 g over the next 2400 ms.
export function dropG(elapsedMs: number, reduced: boolean): number {
  if (reduced) return 0;
  return 1 - ease(Math.min(1, Math.max(0, (elapsedMs - 700) / 2400)));
}

type Colour = [number, number, number, number];

function mix(from: Colour, to: Colour, t: number): string {
  const [r, g, b] = [0, 1, 2].map((i) => Math.round(lerp(from[i], to[i], t)));
  return `rgba(${r},${g},${b},${lerp(from[3], to[3], t).toFixed(2)})`;
}

// At g = 0 the outline is a sphere centred on the droplet. At g = 1 it is a teardrop sitting on it.
export function flamePoints(cx: number, by: number, R: number, g: number, sway: number, flick: number) {
  const u0 = lerp(0.5, 0.08, g);
  const H = lerp(2 * R, 3.5 * R, g) * flick;
  const bottom = by + u0 * H;
  const N = 56;
  const profile = (u: number) =>
    lerp(
      2 * R * Math.sqrt(u * (1 - u)),
      1.1 * R * Math.sin(Math.PI * Math.pow(u, 0.6)) * Math.pow(1 - u, 0.3),
      g,
    );
  const front: { x: number; y: number }[] = [];
  const back: { x: number; y: number }[] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const y = bottom - u * H;
    front.push({ x: cx + sway * u * u + profile(u), y });
    back.unshift({ x: cx + sway * u * u - profile(u), y });
  }
  return [...front, ...back];
}

const LAYERS: { scale: number; from: Colour; to: Colour }[] = [
  { scale: 1, from: [40, 100, 230, 0.5], to: [255, 110, 30, 0.55] },
  { scale: 0.66, from: [90, 160, 255, 0.85], to: [255, 175, 50, 0.9] },
  { scale: 0.34, from: [190, 225, 255, 1], to: [255, 240, 190, 1] },
];

function paintFlame(ctx: Ctx2D, cx: number, by: number, R: number, g: number, sway: number, flick: number) {
  const points = flamePoints(cx, by, R, g, sway, flick);
  const ys = points.map((p) => p.y);
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  for (const layer of LAYERS) {
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = cx + (p.x - cx) * layer.scale;
      const y = cy + (p.y - cy) * layer.scale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = mix(layer.from, layer.to, g);
    ctx.fill();
  }
}

function paintDroplet(ctx: Ctx2D, x: number, y: number) {
  ctx.fillStyle = "#8a93a6";
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c4cbd8";
  ctx.beginPath();
  ctx.arc(x - 2, y - 2, 2, 0, Math.PI * 2);
  ctx.fill();
}

export function drawScene(ctx: Ctx2D, width: number, height: number, elapsedMs: number, reduced: boolean): void {
  ctx.clearRect(0, 0, width, height);
  const by = height * 0.62;
  const gravity = [1, dropG(elapsedMs, reduced)];
  const xs = [width * 0.27, width * 0.73];
  gravity.forEach((g, i) => {
    const R = lerp(0.17, 0.115, g) * height;
    const flick = reduced ? 1 : 1 + (Math.sin(elapsedMs * 0.012 + i) * 0.035 + Math.sin(elapsedMs * 0.031 + i) * 0.015) * g;
    const sway = reduced ? 0 : Math.sin(elapsedMs * 0.004 + i * 2) * R * 0.12 * g;
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(xs[i], by);
    ctx.lineTo(xs[i], height);
    ctx.stroke();
    paintDroplet(ctx, xs[i], by);
    paintFlame(ctx, xs[i], by, R, g, sway, flick);
    paintDroplet(ctx, xs[i], by);
    ctx.fillStyle = "rgba(233,238,251,0.85)";
    ctx.font = `600 ${Math.round(Math.max(14, width * 0.036))}px "Bricolage Grotesque Variable", system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(i === 0 ? "1 g" : g < 0.005 ? "about 0 g" : `${g.toFixed(2)} g`, xs[i], height * 0.1);
  });
  ctx.textAlign = "start";
}
