import * as T from 'three';
import { carVisualScale } from './car-model.ts';


const deg=T.MathUtils.degToRad,kmh=(v: number)=>v/3.6;
// The handling comes from Rising Pixel's drift-racer, at 24.4 px per metre (610 px/s = 90 km/h), without its handbrake:
// the nose turns with the wheel, the travel follows the nose, and a held wheel loosens the grip into a slide.
const player={
  // Gears: baseSpeed is reached from standstill, topSpeed creeps in on a straight (gearAccel) and falls back while steering (gearLoss).
  baseSpeed:kmh(90),topSpeed:kmh(116),gearAccel:.6,gearLoss:.8,
  // accel below half the base speed, cruiseShare of it above; coast: loss while steering above steerPush of the base speed.
  accel:8.2,cruiseShare:.5,coast:.8,steerPush:2/3,
  // Wheel: rate at speed, extra when slow, how fast it builds and unwinds. Below steerDead a correction is not a held wheel.
  turn:deg(190),turnLow:deg(40),turnRamp:deg(600),turnRelease:5,steerDead:.25,
  // Rate at which the travel follows the nose: at first, once the wheel is held (after 1/holdRate s), and with the wheel free.
  recover:deg(70),driftRecover:deg(50),releaseRecover:deg(200),holdRate:2.2,holdRelease:10,maxSlip:deg(60),
  // Speed returned after sliding past bonusSlip for bonusLeast to bonusTime seconds; bonusRecover: grip per m/s of bonus, lost at boostFade.
  bonusSlip:deg(20),bonusLeast:.3,bonusTime:2,bonusMin:2.5,bonusMax:12.3,bonusRecover:.426,boostFade:1,
  // Side grip while rolling back from a wall.
  rollbackGrip:7.5
};
// Every gameplay number lives here. Metres, seconds, radians.
export const TUNE={
  brake:27,
  player,
  // Patrols drive the same model with a calmer wheel and a short slide, so they hold the road while chasing.
  patrol:{...player,baseSpeed:kmh(94),topSpeed:kmh(120),turn:deg(170),
    recover:deg(160),driftRecover:deg(120),maxSlip:deg(20),holdRelease:6,bonusMin:0,bonusMax:0},
  slope:{deadZone:.02,gain:6,limit:.6,response:.18},
  deflect:4.5,
  // Juice: visual only, no effect on collisions.
  roll:.035, tailSwing:.3, hop:.5, playerHop:.9, playerHopGain:.085, dive:.09, skidSpeed:4,
  poseYaw:deg(21), poseRoll:deg(28), poseYawLimit:deg(45),
  poseLift:deg(6), poseDive:deg(8),
  poseMinSpeed:2, poseFullSpeed:10, poseAttack:.085, poseRelease:.17, poseReverse:.04,
  puffSlip:2.5,puffRearm:1.5,puffLife:.22,
  // Hit-stop: seconds of held simulation per event, the wall impact that earns one and the least gap between two.
  stopImpact:11, stopWall:.11, stopArrive:.1, stopCaught:.22, stopGap:.6,
  // Camera kick: launch speed of a full hit (m/s), spring back to rest, hard limit in metres.
  kick:36, kickStiff:220, kickDamp:22, kickMax:1.2,
  // Camera: slow, small and never driven by single hits, so it reads as breathing rather than pumping.
  zoomSpeed:.1, zoomThreat:.08, zoomCaught:.14, zoomRate:1.1, paceRate:.7, leadRate:2.4, followRate:9,
  // The three views of the drive: pitch above the ground, zoom, and how far ahead of the car the frame sits.
  cameraModes:{fixed:{pitch:0,zoom:1,framing:0},high:{pitch:deg(65),zoom:1,framing:.055},chase:{pitch:deg(48),zoom:1.22,framing:.13}},
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
