import {it,expect} from 'vitest';
import {evaluateGate,gatePolicy,DEFAULT_GATE} from '../src/release-intelligence/gate.ts';
import {fixture} from './release-intelligence-fixtures.ts';
it('uses canonical pre-deploy states, freshness and build scope without treating missing decisions as passes',()=>{
  const now=Date.now(),e=fixture(1,{scannedAt:new Date(now-1000).toISOString(),readiness:'ready'});
  expect(evaluateGate(e,e.digest,DEFAULT_GATE,now).readiness).toBe('ready');
  for(const readiness of ['blocked','review','unknown'] as const)expect(evaluateGate({...e,readiness},e.digest,DEFAULT_GATE,now).readiness).toBe(readiness);
  expect(evaluateGate({...e,readiness:undefined},e.digest,DEFAULT_GATE,now).readiness).toBe('unknown');
  expect(evaluateGate({...e,source:'website:1'},e.digest,DEFAULT_GATE,now).readiness).toBe('unknown');
  expect(evaluateGate({...e,scannedAt:new Date(now-25*3600000).toISOString()},e.digest,DEFAULT_GATE,now).overridable).toBe(false);
  expect(evaluateGate({...e,readiness:'blocked',held:true},e.digest,DEFAULT_GATE,now).overridable).toBe(false);
  expect(evaluateGate(null,e.digest,DEFAULT_GATE,now).readiness).toBe('unknown');
  expect(evaluateGate(e,'f'.repeat(64),DEFAULT_GATE,now).readiness).toBe('unknown');
});
it('bounds adopted settings',()=>{
  expect(gatePolicy('warn',24)).toEqual({mode:'warn',maxAgeHours:24});
  for(const hours of [0,169,1.5,'24'])expect(()=>gatePolicy('enforce',hours)).toThrow();
  expect(()=>gatePolicy('automatic',24)).toThrow();
});
