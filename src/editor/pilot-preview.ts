import { applyPilotEdits, loadPilotBase, readPilotFile } from '../data/pilot-edits.ts';
import { makeProp } from './props.ts';
import type { Altitude } from '../data/types.ts';

export async function loadEditedPilot(status: HTMLElement) {
  status.lang = 'en';
  status.textContent = 'Loading…';
  const base = await loadPilotBase();
  const input = document.createElement('input');
  input.type = 'file';
  input.id = 'pilot-edits-file';
  input.accept = '.json,application/json';
  const label = document.createElement('label'), message = document.createElement('span');
  label.htmlFor = input.id;
  label.textContent = 'Load pilot map edits';
  status.replaceChildren(label,document.createElement('br'),input,document.createElement('br'),message);
  const edits = await new Promise<Awaited<ReturnType<typeof readPilotFile>>>(resolve => {
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      input.disabled = true;
      try { resolve(await readPilotFile(base,file)); }
      catch (error) {
        message.textContent = error instanceof Error ? error.message : 'Invalid file.';
        input.value = '';
        input.disabled = false;
      }
    };
  });
  status.textContent = 'Loading…';
  return { data: applyPilotEdits(base.data,edits), props: (altitude: Altitude) => edits.props.map(prop => makeProp(prop,altitude)) };
}
