/**
 * The screen shake of demolitions, in the lab and in the drive: hits add up to 1.6, which fades in about a third
 * of a second. `offset(dt)` is how far, in metres, to move the view this frame, in a random direction.
 */
export function makeShake() {
  let amount = 0;
  return {
    add(value: number) { amount = Math.min(1.6, amount + value); },
    offset(dt: number) {
      if (amount < .01) { amount = 0; return 0; }
      const now = amount * 1.4;
      amount *= Math.exp(-9 * Math.max(dt, 1 / 120));
      return now;
    },
    clear() { amount = 0; }
  };
}
