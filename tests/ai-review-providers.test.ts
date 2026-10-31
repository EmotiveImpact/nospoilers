import {it,expect} from 'vitest';
import {aiReviewConfigFromEnv,assertProviderAllowed,blockedHost,ProviderPolicyError,type ProviderSettings} from '../src/server/ai-review/providers.ts';

const base:ProviderSettings={kind:'openai-compatible',tier:'triage',model:'mistral-small-latest',apiKey:'k',baseUrl:'https://api.mistral.ai/v1',region:'eu',zeroDataRetention:true};

it('stays off unless explicitly switched on, even with an API key present',()=>{
  expect(aiReviewConfigFromEnv({ANTHROPIC_API_KEY:'sk-ant-x'})).toBeNull();
});

it('accepts a zero-retention Claude reasoning tier and an EU or US triage tier',()=>{
  const config=aiReviewConfigFromEnv({NOSPOILERS_AI_REVIEW:'on',ANTHROPIC_API_KEY:'sk-ant-x',NOSPOILERS_AI_REASONING_REGION:'us',NOSPOILERS_AI_REASONING_ZERO_DATA_RETENTION:'attested',
    NOSPOILERS_AI_TRIAGE_PROVIDER:'openai-compatible',NOSPOILERS_AI_TRIAGE_BASE_URL:'https://api.mistral.ai/v1',NOSPOILERS_AI_TRIAGE_MODEL:'mistral-small-latest',NOSPOILERS_AI_TRIAGE_API_KEY:'m',NOSPOILERS_AI_TRIAGE_REGION:'eu',NOSPOILERS_AI_TRIAGE_ZERO_DATA_RETENTION:'attested'})!;
  expect(config.reasoning).toMatchObject({kind:'anthropic',model:'claude-opus-5-5',region:'us'});
  expect(config.triage).toMatchObject({model:'mistral-small-latest',region:'eu'});
});

it('refuses China-hosted APIs, uncensored models, missing retention attestation, unknown regions and plain HTTP',()=>{
  for(const host of ['api.deepseek.com','open.bigmodel.cn','dashscope.aliyuncs.com','api.moonshot.ai','ark.cn-beijing.volces.com','api.z.ai'])expect(blockedHost(host)).toBe(true);
  expect(blockedHost('api.mistral.ai')).toBe(false);
  expect(()=>assertProviderAllowed({...base,baseUrl:'https://api.deepseek.com/v1'})).toThrow(ProviderPolicyError);
  expect(()=>assertProviderAllowed({...base,model:'llama-3-70b-abliterated'})).toThrow(/uncensored/);
  expect(()=>assertProviderAllowed({...base,model:'dolphin-mixtral'})).toThrow(ProviderPolicyError);
  expect(()=>assertProviderAllowed({...base,zeroDataRetention:false})).toThrow(/zero data retention/);
  expect(()=>assertProviderAllowed({...base,region:'cn'})).toThrow(/us or eu/);
  expect(()=>assertProviderAllowed({...base,baseUrl:'http://example.com/v1'})).toThrow(/HTTPS/);
  expect(()=>assertProviderAllowed({...base,baseUrl:'http://127.0.0.1:8000/v1'})).not.toThrow();
  expect(()=>aiReviewConfigFromEnv({NOSPOILERS_AI_REVIEW:'on',ANTHROPIC_API_KEY:'x',NOSPOILERS_AI_REASONING_REGION:'us'})).toThrow(/zero data retention/);
});
