export function getModifiedStat(unit, stat, heroes, enemies, buffs) {
  let base = unit[stat];
  const isHero = heroes.includes(unit);
  const teamBuffs = isHero ? buffs.heroes : buffs.enemies;
  const unitBuffs = teamBuffs[unit.id] || [];
  unitBuffs.forEach(buff => {
    if (buff.stat === stat) {
      base += Math.floor(unit[stat] * (buff.amount / 100));
    }
  });
  if (stat === 'eva') {
    base = Math.min(base, 60);
  }
  return base;
}
