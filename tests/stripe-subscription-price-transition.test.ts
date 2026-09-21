import {expect, it} from 'vitest';
import {stripeEventPatch} from '../src/server/stripe.ts';

const prices = {soloMonthly: 'price_solo_m', soloYearly: 'price_solo_y', teamMonthly: 'price_team_m', teamYearly: 'price_team_y'};

function patch(type: string, object: Record<string, unknown>) {
  return stripeEventPatch({id: 'evt_price_boundary', created: 1_790_000_001, type, data: {object}}, prices);
}

it.each([
  ['solo', prices.teamMonthly, 'team'],
  ['team', prices.soloMonthly, 'solo'],
])('uses the current subscription price after a portal change from %s', (originalPlan, priceId, expectedPlan) => {
  const patch = stripeEventPatch({
    id: 'evt_portal_plan_changed', created: 1_790_000_000,
    type: 'customer.subscription.updated',
    data: {object: {
      id: 'sub_existing', customer: 'cus_existing', status: 'active',
      metadata: {installationId: '7', plan: originalPlan},
      items: {data: [{price: {id: priceId}}]},
    }},
  }, prices);
  expect(patch).toMatchObject({priceId, plan: expectedPlan, status: 'active', clearPlan: false});
});

it.each(['active', 'trialing'])('clears stale %s entitlements for unknown, missing, partial or conflicting current prices', status => {
  for (const items of [
    {data: [{price: {id: 'price_not_in_catalog'}}]},
    {data: [{}]},
    {data: []},
    {has_more: true, data: [{price: prices.teamMonthly}]},
    {data: [{price: prices.soloMonthly}, {price: prices.teamMonthly}]},
  ]) {
    expect(patch('customer.subscription.updated', {status, metadata: {plan: 'team'}, items})).toMatchObject({plan: null, clearPlan: true});
  }
});

it.each([prices.teamMonthly, {id: prices.teamMonthly}])('accepts current string or expanded price identifiers', price => {
  expect(patch('customer.subscription.created', {status: 'active', metadata: {plan: 'solo'}, items: {data: [{price}]}})).toMatchObject({plan: 'team', clearPlan: false});
});

it('uses the new subscription charge after a portal credit and ignores unrelated invoice items', () => {
  expect(patch('invoice.paid', {subscription: 'sub_current', metadata: {plan: 'solo'}, lines: {data: [
    {type: 'subscription', subscription: 'sub_current', amount: -1000, price: {id: prices.soloMonthly}},
    {type: 'invoiceitem', amount: 200, price: {id: 'price_addon'}},
    {type: 'subscription', subscription: 'sub_other', amount: 1000, price: {id: prices.soloMonthly}},
    {type: 'subscription', subscription: 'sub_current', amount: 9900, price: prices.teamMonthly},
  ]}})).toMatchObject({priceId: prices.teamMonthly, plan: 'team', clearPlan: false});
});

it('does not retain a plan from ambiguous, unknown or incomplete invoice prices', () => {
  for (const lines of [
    {data: [{price: 'price_unknown', amount: 1}]},
    {data: [{price: prices.soloMonthly, amount: 1}, {price: prices.teamMonthly, amount: 1}]},
    {data: [{price: prices.teamMonthly, amount: 1}], has_more: true},
  ]) expect(patch('invoice.paid', {subscription: 'sub_current', metadata: {plan: 'team'}, lines})).toMatchObject({plan: null, clearPlan: true});
});

it('uses checkout server-authored price rather than stale plan text and rejects an unrecognized price', () => {
  expect(patch('checkout.session.completed', {mode: 'subscription', metadata: {plan: 'solo', priceId: prices.teamMonthly}})).toMatchObject({plan: 'team', clearPlan: false});
  for (const priceId of ['price_unknown', undefined]) {
    expect(patch('checkout.session.completed', {mode: 'subscription', metadata: {plan: 'team', priceId}})).toMatchObject({plan: null, clearPlan: true});
  }
});
