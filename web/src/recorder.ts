// A fake 2D canvas context for tests: it records every method call and every property set.
export type Recorder = {
  ctx: CanvasRenderingContext2D;
  calls: { name: string; args: unknown[] }[];
  sets: { name: string; value: unknown }[];
};

export function makeRecorder(): Recorder {
  const calls: Recorder["calls"] = [];
  const sets: Recorder["sets"] = [];
  const ctx = new Proxy(
    {},
    {
      get: (_target, name: string) => (...args: unknown[]) => {
        calls.push({ name, args });
      },
      set: (_target, name: string, value) => {
        sets.push({ name, value });
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, calls, sets };
}

export const texts = (recorder: Recorder) => recorder.calls.filter((c) => c.name === "fillText").map((c) => c.args[0]);
