import { MathUtils } from 'three';
import type { Body } from './drive-physics.ts';
import type { TUNE } from './drive-tune.ts';

type PoseTuning = Pick<typeof TUNE, 'poseYaw' | 'poseRoll' | 'poseYawLimit' | 'poseRelease' | 'poseFullSpeed' | 'skidSpeed' | 'poseDive'>;

/**
 * Pitch of the road under a car pointing at `yaw`, from the ground below its front and rear axles
 * (`halfBase` metres from the centre): positive climbing. `limit` keeps noisy terrain from flipping it.
 */
export function groundPitch(groundAt: (x: number, y: number) => number, x: number, y: number, yaw: number, halfBase: number, limit: number) {
  const dx = Math.cos(yaw) * halfBase, dy = Math.sin(yaw) * halfBase;
  const rise = groundAt(x + dx, y + dy) - groundAt(x - dx, y - dy);
  return MathUtils.clamp(Math.atan2(rise, 2 * halfBase), -limit, limit);
}

// Shares of the pose values for the related ones. At the defaults they give the earlier separate values exactly:
// 85 ms to lean in and 40 ms to swap sides (poseRelease 170 ms), no pose below 2 m/s, a 6° lift (dive 8°).
export const POSE_ATTACK=.085/.17,POSE_REVERSE=.04/.17,POSE_MIN_SPEED=2/10,POSE_LIFT=6/8;

export function makeDrivePose(tune: PoseTuning) {
  let yaw = 0, roll = 0, pitch = 0;

  function damp(current: number, target: number, dt: number) {
    const time = tune.poseRelease * (target === 0 ? 1 : current * target < 0 ? POSE_REVERSE : POSE_ATTACK);
    return MathUtils.lerp(current, target, -Math.expm1(-Math.LN10 * dt / time));
  }

  return {
    get yaw() { return yaw; },
    get roll() { return roll; },
    get pitch() { return pitch; },
    reset() { yaw = roll = pitch = 0; },
    release(dt: number) {
      yaw = damp(yaw, 0, dt);
      roll = damp(roll, 0, dt);
      pitch = damp(pitch, 0, dt);
    },
    update(body: Pick<Body, 'h' | 'vx' | 'vy'>, steer: number, dt: number, driveLoad: number) {
      const cos = Math.cos(body.h), sin = Math.sin(body.h);
      const forward = body.vx * cos + body.vy * sin;
      const side = body.vy * cos - body.vx * sin;
      const slip = Math.abs(side);
      const speed = Math.hypot(forward, side);
      const minSpeed = tune.poseFullSpeed * POSE_MIN_SPEED;
      const weight = MathUtils.smoothstep(speed, minSpeed, tune.poseFullSpeed);
      const factor = steer * weight * (.5 + .5 * Math.min(1, slip / tune.skidSpeed));
      yaw = damp(yaw, factor * tune.poseYaw, dt);
      roll = damp(roll, -factor * tune.poseRoll, dt);
      pitch = damp(pitch, driveLoad * tune.poseDive * (driveLoad >= 0 ? POSE_LIFT : 1), dt);
      if (speed > minSpeed) {
        const angle = Math.atan2(-side, forward);
        // Limit the added angle without undoing physical slip after a contact.
        yaw = MathUtils.clamp(yaw, Math.min(0, -tune.poseYawLimit - angle), Math.max(0, tune.poseYawLimit - angle));
      }
      return slip;
    }
  };
}
