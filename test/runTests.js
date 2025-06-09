import assert from 'assert';
import { getModifiedStat } from '../modules/battle.js';

function testGetModifiedStat() {
  const hero = { id: 1, atk: 10, eva: 20 };
  const heroes = [hero];
  const enemies = [];
  const buffs = { heroes: { 1: [{ stat: 'atk', amount: 50, turns: 2 }] }, enemies: {} };
  const result = getModifiedStat(hero, 'atk', heroes, enemies, buffs);
  assert.strictEqual(result, 15);
}

function run() {
  testGetModifiedStat();
  console.log('All tests passed.');
}

run();
