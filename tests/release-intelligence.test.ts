import { test } from 'vitest';
import { registerIntelligenceTests } from './release-intelligence-cases.ts';
registerIntelligenceTests((name, fn) => test(name, fn));
