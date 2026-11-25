import { readPilotEdits, type PilotBase, type PilotEdits } from '../data/pilot-edits.ts';

export function makeEditHistory(base: PilotBase){
  let current: PilotEdits = { version: 1, base: base.hash, footprints: [], props: [] };
  const past: PilotEdits[] = [], future: PilotEdits[] = [];

  function step(from: PilotEdits[], to: PilotEdits[]){
    const next = from.pop();
    if (!next) return false;
    to.push(current);
    current = next;
    return true;
  }

  return {
    get current(){ return current; },
    get canUndo(){ return past.length > 0; },
    get canRedo(){ return future.length > 0; },
    commit(next: PilotEdits){
      const valid = readPilotEdits(base,next);
      if (JSON.stringify(valid) === JSON.stringify(current)) return false;
      past.push(current);
      future.length = 0;
      current = valid;
      return true;
    },
    undo: () => step(past,future),
    redo: () => step(future,past)
  };
}
