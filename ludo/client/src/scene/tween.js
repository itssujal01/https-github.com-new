const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Run fn(t) with eased t in [0,1] every frame for `ms`, resolving when done. */
export function tween(world, ms, fn, ease = easeInOut) {
  return new Promise((resolve) => {
    const start = performance.now();
    const stop = world.onTick((_dt, now) => {
      const t = Math.min(1, (now - start) / ms);
      fn(ease(t));
      if (t >= 1) {
        stop();
        resolve();
      }
    });
  });
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
