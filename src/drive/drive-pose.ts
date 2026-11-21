import { MathUtils } from 'three';
import type { Body } from './drive-physics.ts';
import type { TUNE } from './drive.ts';

type PoseTuning = Pick<typeof TUNE, 'poseYaw' | 'poseRoll' | 'poseYawLimit' | 'poseAttack' | 'poseRelease' | 'poseReverse' | 'poseMinSpeed' | 'poseFullSpeed' | 'skidSpeed'>;

export function makeDrivePose(tune: PoseTuning) {
  let yaw = 0, roll = 0;

  function damp(current: number, target: number, dt: number) {
    const time = target === 0 ? tune.poseRelease : current * target < 0 ? tune.poseReverse : tune.poseAttack;
    return MathUtils.lerp(current, target, -Math.expm1(-Math.LN10 * dt / time));
  }

  return {
    get yaw() { return yaw; },
    get roll() { return roll; },
    reset() { yaw = roll = 0; },
    release(dt: number) {
      yaw = damp(yaw, 0, dt);
      roll = damp(roll, 0, dt);
    },
    update(body: Pick<Body, 'h' | 'vx' | 'vy'>, steer: number, dt: number) {
      const cos = Math.cos(body.h), sin = Math.sin(body.h);
      const forward = body.vx * cos + body.vy * sin;
      const side = body.vy * cos - body.vx * sin;
      const slip = Math.abs(side);
      const speed = Math.hypot(forward, side);
      const weight = MathUtils.smoothstep(speed, tune.poseMinSpeed, tune.poseFullSpeed);
      const factor = steer * weight * (.5 + .5 * Math.min(1, slip / tune.skidSpeed));
      yaw = damp(yaw, factor * tune.poseYaw, dt);
      roll = damp(roll, -factor * tune.poseRoll, dt);
      if (speed > tune.poseMinSpeed) {
        const angle = Math.atan2(-side, forward);
        // Limit the added angle without undoing physical slip after a contact.
        yaw = MathUtils.clamp(yaw, Math.min(0, -tune.poseYawLimit - angle), Math.max(0, tune.poseYawLimit - angle));
      }
      return slip;
    }
  };
}
