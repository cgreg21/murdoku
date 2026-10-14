/// <reference lib="webworker" />
import { generatePuzzle } from './generator';

addEventListener('message', ({ data }: MessageEvent<{ level: number; seed?: number }>) => {
  postMessage(generatePuzzle(data.level, data.seed));
});
