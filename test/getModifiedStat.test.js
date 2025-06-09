import test from 'node:test';
import assert from 'node:assert';
import { getModifiedStat } from '../battle.js';

test('returns base stat when no buffs', () => {
  const hero = { id: 'h1', atk: 10 };
  const buffs = { heroes: {}, enemies: {} };
  const result = getModifiedStat(hero, 'atk', buffs, [hero], []);
  assert.strictEqual(result, 10);
});

test('applies buff percentage', () => {
  const hero = { id: 'h1', atk: 10 };
  const buffs = { heroes: { h1: [{ stat: 'atk', amount: 50, turns: 1 }] }, enemies: {} };
  const result = getModifiedStat(hero, 'atk', buffs, [hero], []);
  assert.strictEqual(result, 15);
});

test('clamps evasion to 60', () => {
  const hero = { id: 'h1', eva: 50 };
  const buffs = { heroes: { h1: [{ stat: 'eva', amount: 50, turns: 1 }] }, enemies: {} };
  const result = getModifiedStat(hero, 'eva', buffs, [hero], []);
  assert.strictEqual(result, 60);
});
