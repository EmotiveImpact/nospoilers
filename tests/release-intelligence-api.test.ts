import { test } from 'vitest';
import { registerIntelligenceApiTests } from './release-intelligence-api-cases.ts';
registerIntelligenceApiTests((name, fn) => test(name, fn));
