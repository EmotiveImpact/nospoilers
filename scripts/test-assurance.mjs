import {test} from 'node:test';
import {assuranceCases} from '../tests/assurance-cases.ts';
import {assuranceApiCases} from '../tests/assurance-api-cases.ts';
for(const [name,run] of [...assuranceCases,...assuranceApiCases])test(name,run);
