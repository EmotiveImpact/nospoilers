import {test} from 'vitest';
import {assuranceApiCases} from './assurance-api-cases.ts';
for(const [name,run] of assuranceApiCases)test(name,run);
