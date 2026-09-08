import { test } from 'node:test';
import { registerIntelligenceTests } from '../tests/release-intelligence-cases.ts';
import { registerIntelligenceApiTests } from '../tests/release-intelligence-api-cases.ts';
import { registerIntelligenceCliTests } from '../tests/release-intelligence-cli-cases.ts';
registerIntelligenceTests(test);
registerIntelligenceApiTests(test);
registerIntelligenceCliTests(test);
