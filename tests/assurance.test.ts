import {test} from 'vitest';
import {assuranceCases} from './assurance-cases.ts';
for(const [name,run] of assuranceCases)test(name,run);
