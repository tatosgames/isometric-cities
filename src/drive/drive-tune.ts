import * as T from 'three';
import { carVisualScale } from './car-model.ts';


// Every gameplay number lives here. Metres, seconds, radians.
export const TUNE={
  accel:11.574,accelTaperStart:60/3.6,accelTaperEnd:63/3.6,brake:27,brakeGrip:2.2,turn:2.6,grip:7.5,driftGrip:3.2,
  player:{maxSpeed:90/3.6,cruiseAccel:1.957,driftDrag:.035,turnStart:.35,turnRamp:.14,releaseGrip:9.5,gripReleaseRate:10},
  patrol:{maxSpeed:94/3.6,cruiseAccel:2.240,driftDrag:.0525,turn:.8,gripReleaseRate:6},
  slope:{deadZone:.02,gain:6,limit:.6,response:.18},
  deflect:4.5,
  // Juice: visual only, no effect on collisions.
  roll:.035, tailSwing:.3, hop:.5, playerHop:.9, playerHopGain:.085, dive:.09, skidSpeed:4,
  poseYaw:T.MathUtils.degToRad(21), poseRoll:T.MathUtils.degToRad(28), poseYawLimit:T.MathUtils.degToRad(45),
  poseLift:T.MathUtils.degToRad(6), poseDive:T.MathUtils.degToRad(8),
  poseMinSpeed:2, poseFullSpeed:10, poseAttack:.085, poseRelease:.17, poseReverse:.04,
  puffSlip:2.5,puffRearm:1.5,puffLife:.22,
  // Hit-stop: seconds of held simulation per event, the wall impact that earns one and the least gap between two.
  stopImpact:11, stopWall:.055, stopArrive:.05, stopCaught:.11, stopGap:.6,
  // Camera kick: launch speed of a full hit (m/s), spring back to rest, hard limit in metres.
  kick:36, kickStiff:220, kickDamp:22, kickMax:1.2,
  // Camera: slow, small and never driven by single hits, so it reads as breathing rather than pumping.
  zoomSpeed:.1, zoomThreat:.08, zoomCaught:.14, zoomRate:1.1, paceRate:.7, leadRate:2.4, followRate:9,
  radius:1.15, treeRadius:.3, treeClearance:4.5, bounce:.3, wallLoss:.6, visualScale:carVisualScale,
  scrapeRatio:.5, scrapeFriction:.12, sparkSpeed:5, sparkGap:.075, sparkLife:.16,
  catchSpeed:4.5, catchReach:4, grace:2.5,
  chaserEvery:18, chaserSight:45, chaserLost:170, wreckImpact:11.5, wreckTime:3, stuckTime:2,
  coinStep:8, coinReach:2.6, magnet:6, coinPullSpeed:25, arriveReach:16, arriveBonus:10, wreckBonus:2,
  viewSpanCompact:62, viewSpanWide:95
};
export const SKIDS=600, DUST=48, COINS=220;
export const CAPTURE={speed:.3,coast:1,maxSpeed:6,grade:.85,summary:.3,actions:.6};
export { wrapAngle as wrap } from '../geometry.ts';
