import * as T from 'three';
import { carVisualScale } from './car-model.ts';


const deg=T.MathUtils.degToRad,kmh=(v: number)=>v/3.6;
// The handling comes from Rising Pixel's drift-racer, at 24.4 px per metre (610 px/s = 90 km/h), without its handbrake:
// the nose turns with the wheel, the travel follows the nose, and a held wheel loosens the grip into a slide.
const player={
  // Gears: baseSpeed is reached from standstill, topSpeed creeps in on a straight (gearAccel).
  baseSpeed:kmh(90),topSpeed:kmh(116),gearAccel:.6,
  // accel below half the base speed, cruiseShare of it above. coast: speed lost while steering above steerPush
  // of the base speed, and the rate at which the gear falls back towards the base one while steering.
  accel:8.2,cruiseShare:.5,coast:.8,steerPush:2/3,
  // Wheel: rate at speed, extra when slow, how fast it builds and unwinds. Below steerDead a correction is not a held wheel.
  turn:deg(190),turnLow:deg(40),turnRamp:deg(600),turnRelease:5,steerDead:.25,
  // Rate at which the travel follows the nose while steering and with the wheel free.
  recover:deg(54),releaseRecover:deg(200),maxSlip:deg(60),
  // Speed returned after sliding past bonusSlip for bonusLeast to bonusTime seconds, up to bonusMax (a fifth of it
  // for the shortest slide); bonusRecover: extra grip per m/s of bonus, fading in about a second.
  bonusSlip:deg(20),bonusLeast:.3,bonusTime:2,bonusMax:12.3,bonusRecover:.426,
  // Side grip while rolling back from a wall.
  rollbackGrip:7.5
};
// Every gameplay number lives here. Metres, seconds, radians.
export const TUNE={
  brake:27,
  player,
  // Patrols drive the same model with a calmer wheel and a short slide, so they hold the road while chasing.
  patrol:{...player,baseSpeed:kmh(94),topSpeed:kmh(120),turn:deg(170),
    recover:deg(135),maxSlip:deg(20),bonusMax:0},
  slope:{deadZone:.02,gain:6,limit:.6,response:.18},
  // Off the asphalt: shares of the speeds and acceleration (speed) and of the grip that pulls a slide back in
  // (grip, which also lets the slide open wider), and how much the body shakes (rumble, visual only).
  // Above the top speed of the surface the car sheds roughDrag × (1 − speed) m/s² more than when coasting.
  surfaces:{paving:{speed:1,grip:1,rumble:.25},grass:{speed:.72,grip:.6,rumble:1},dirt:{speed:.8,grip:.7,rumble:.8},
    sand:{speed:.85,grip:.75,rumble:.6}},
  roughDrag:32,
  deflect:4.5,
  // Juice: visual only, no effect on collisions.
  roll:.035, tailSwing:.3, hop:.5, playerHop:.9, playerHopGain:.085, dive:.09, skidSpeed:4,
  // The whole car follows the slope of the road along its nose; the player's shell leans this share further,
  // nose up on a climb and down on a descent, like the weight moving to the rear or front wheels.
  slopeLean:.5,
  // Shell pose: lean into a turn, the limit of the added yaw, the nose dive under braking (three quarters of it
  // lifting under power), the speed of the full pose (none below a fifth of it), and the time to settle when
  // released (half of it to lean in, a quarter to swap sides).
  poseYaw:deg(21), poseRoll:deg(28), poseYawLimit:deg(45), poseDive:deg(8), poseFullSpeed:10, poseRelease:.17,
  // Life of the dust puffs; sparks live 0.73 times as long.
  puffLife:.22,
  // Hit-stop: seconds of held simulation for a hard impact (about 0.9 of it on arrival, twice it when caught),
  // and the least gap between two. A hard impact (m/s into the obstacle) also wrecks a patrol.
  hardImpact:11, hitStop:.11, stopGap:.6,
  // Camera kick: launch speed of a full hit (m/s), stiffness of the spring back to rest, hard limit in metres.
  kick:36, kickStiff:220, kickMax:1.2,
  // Camera: slow, small and never driven by single hits, so it reads as breathing rather than pumping.
  // paceRate eases speed and threat into the zoom; the zoom itself follows 1.57 times faster.
  zoomSpeed:.1, zoomThreat:.08, zoomCaught:.14, paceRate:.7, leadRate:2.4, followRate:9,
  // The three views of the drive: pitch above the ground (the first keeps the map's), zoom, and how far ahead of the car the frame sits.
  cameraModes:{fixed:{zoom:1,framing:0},high:{pitch:deg(65),zoom:1,framing:.055},chase:{pitch:deg(48),zoom:1.22,framing:.13}},
  radius:1.15, treeRadius:.3, treeClearance:4.5, bounce:.3, wallLoss:.6, visualScale:carVisualScale,
  scrapeRatio:.5, scrapeFriction:.12, sparkSpeed:5, sparkGap:.075,
  catchSpeed:4.5, catchReach:4, grace:2.5,
  chaserSight:45, chaserLost:170, wreckTime:3, stuckTime:2,
  coinStep:8, coinReach:2.6, magnet:6, coinPullSpeed:25, arriveReach:16, arriveBonus:10, wreckBonus:2,
  viewSpanCompact:62, viewSpanWide:95,
  // The car's gun. Seconds between shots, speed (m/s) and reach (m) of the slug. A struck patrol or guagua is
  // thrown at `launch`/`busLaunch` m/s along the shot and `lift`/`busLift` m/s up, under `gravity`; a guagua lies
  // `busRest` s, then sinks in `busSink` s. A demolished building is rebuilt after `rebuild` s out of view.
  // A wall struck breaks outwards at `blast` m/s, fading over `blastReach` m, pushed `push` m/s along the shot:
  // the same values in the drive and in the demolition lab's gun (`shotBlast`).
  weapon:{cooldown:3, speed:55, range:120, launch:9, lift:10, busLaunch:5, busLift:7, gravity:16, busRest:3, busSink:1,
    rebuild:20, blast:22, blastReach:12, push:18}
};
/** What the wheels roll on. Asphalt is the carriageway; paving covers pavements, squares and pedestrian streets. */
export const SURFACES=['asphalt','paving','grass','dirt','sand'] as const;
export const ASPHALT=0,PAVING=1;

export const SKIDS=1500, DUST=256, COINS=220;
export const CAPTURE={speed:.3,coast:1,maxSpeed:6,grade:.85,summary:.3,actions:.6};
export { wrapAngle as wrap } from '../geometry.ts';
