import { test } from 'vitest';
import { registerIntelligenceCliTests } from './release-intelligence-cli-cases.ts';
registerIntelligenceCliTests((name, fn) => test(name, fn));
