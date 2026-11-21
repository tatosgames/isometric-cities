// Frame-cadence policy for the render resolution. No browser or renderer dependencies:
// feed it requestAnimationFrame times while the view is moving, and apply the scale it returns.
// After the policy of superstudiorecover/app/src/engine/AdaptiveResolution.ts, with scales
// relative to the device's base pixel ratio so that a phone capped at ratio 1 can still step down.
const WINDOW=30, SLOW_MEDIAN=33, FAST_P75=20, SLOW_WINDOWS=2, FAST_WINDOWS=6, MAX_FAST_WINDOWS=48;

export function makeAdaptiveResolution(levels=[1,.85,.7]){
  const samples: number[]=[];
  let index=0,previous=0,slow=0,fast=0,need=FAST_WINDOWS,raised=false;
  function suspend(){previous=0;samples.length=0;slow=fast=0;}
  return {
    get scale(){return levels[index];},
    // Forget the cadence without changing the level: call when frames stop being continuous.
    suspend,
    // Back to full resolution. Returns true when the scale changed.
    reset(){
      const changed=index!==0;
      index=0;need=FAST_WINDOWS;raised=false;suspend();
      return changed;
    },
    // Returns the new scale when the level changes, otherwise null.
    sample(time: number){
      if(!Number.isFinite(time))return null;
      if(!previous){previous=time;return null;}
      const interval=time-previous;previous=time;
      // The caller suspends when the view rests, so a long interval here is a real stall and counts
      // as one slow sample. One sample after a hidden tab cannot move a median of thirty.
      if(interval<=0)return null;
      samples.push(interval);
      if(samples.length<WINDOW)return null;
      samples.sort((a,b)=>a-b);
      const median=(samples[WINDOW/2-1]+samples[WINDOW/2])/2,p75=samples[Math.ceil(WINDOW*.75)-1];
      samples.length=0;
      slow=median>SLOW_MEDIAN?slow+1:0;
      fast=p75<FAST_P75?fast+1:0;
      if(slow>=SLOW_WINDOWS && index<levels.length-1){
        // Stepping down right after a step up means that level does not hold: wait longer next time.
        if(raised)need=Math.min(MAX_FAST_WINDOWS,need*2);
        index++;slow=fast=0;raised=false;
        return levels[index];
      }
      if(fast>=need && index>0){
        index--;slow=fast=0;raised=true;
        return levels[index];
      }
      return null;
    }
  };
}
