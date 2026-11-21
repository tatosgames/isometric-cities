import { required } from '../required.ts';

export function element(id: string): HTMLElement {
  return required(document.getElementById(id), '#' + id);
}
