// Load the static data the Sim needs from disk (Node). The browser fetches the same files.
import fs from 'node:fs';
import path from 'node:path';
import { makeRects } from '../shared/leveldata.js';

export function loadSimData(root) {
  const rd = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
  const level = rd('assets/level.json');
  return { level, rects: makeRects(rd('assets/sprites.json')), jobsJson: rd('data/jobs.json'), contents: rd('data/contents.json') };
}
