import { renderMap } from './map.js';

let heroes = [];
let enemies = [];
let heroCooldowns = {};
let buffs = { heroes: {}, enemies: {} };
let turnQueue = [];
let turnIndex = 0;
let isSelectingTarget = false;
let selectedSkill = null;
let selectedUser = null;

export function enterBattle(enemyGroup) {
  document.getElementById('game').style.display = 'none';
  document.getElementById('battle-screen').style.display = 'block';

  fetch('data/characters.json')
    .then(res => res.json())
    .then(data => {
      heroes = data.characters;
      heroCooldowns = {};
      buffs.heroes = {};
      heroes.forEach(hero => {
        heroCooldowns[hero.id] = Array(hero.skills.length).fill(0);
        buffs.heroes[hero.id] = [];
      });

      fetch('data/enemies.json')
        .then(res => res.json())
        .then(edata => {
          enemies = enemyGroup.map(id => {
            const enemy = edata.enemies.find(e => e.id === id);
            return JSON.parse(JSON.stringify(enemy));
          });

          buffs.enemies = {};
          enemies.forEach(enemy => {
            buffs.enemies[enemy.id] = [];
          });

          turnQueue = [...heroes, ...enemies];
          turnIndex = 0;

          renderBattleScene();
        })
        .catch(() => {
          console.error('Failed to load enemy data. Please refresh the page.');
        });
    })
    .catch(() => {
      console.error('Failed to load character data. Please refresh the page.');
    });
}

function renderBattleScene() {
  const allySprites = document.getElementById('ally-sprites');
  const enemySprites = document.getElementById('enemy-sprites');
  const allyHud = document.getElementById('ally-hud');
  const enemyHud = document.getElementById('enemy-hud');

  allySprites.innerHTML = '';
  enemySprites.innerHTML = '';
  allyHud.innerHTML = '';
  enemyHud.innerHTML = '';

  const activeUnit = turnQueue[turnIndex];

  heroes.forEach(hero => {
    const img = document.createElement('img');
    img.src = hero.sprite;
    if (hero === activeUnit) img.classList.add('active-turn');
    allySprites.appendChild(img);

    const hud = document.createElement('p');
    hud.textContent = `${hero.name}: ${hero.hp} HP`;
    if (hero === activeUnit) hud.classList.add('active-hud');
    allyHud.appendChild(hud);
  });

  enemies.forEach(enemy => {
    const img = document.createElement('img');
    img.src = enemy.sprite;
    if (enemy === activeUnit) img.classList.add('active-turn');
    enemySprites.appendChild(img);

    const hud = document.createElement('p');
    hud.textContent = `${enemy.name}: ${enemy.hp} HP`;
    if (enemy === activeUnit) hud.classList.add('active-hud');
    enemyHud.appendChild(hud);
  });

  if (heroes.includes(activeUnit)) {
    renderSkillUI(activeUnit);
  }
}

function applySkill(user, skill, target) {
  const log = [];

  if (skill.type === 'heal') {
  const userAtk = getModifiedStat(user, "atk", buffs, heroes, enemies);
  const amount = Math.floor(skill.power * userAtk);
    target.hp = Math.min(target.maxHp, target.hp + amount);
    log.push(`${user.name} heals ${target.name} for ${amount} HP.`);
  }

  if (skill.type === 'damage') {
  const userAtk = getModifiedStat(user, "atk", buffs, heroes, enemies);
  const targetDef = getModifiedStat(target, "def", buffs, heroes, enemies);
  const rawDamage = Math.floor((skill.power / 100) * userAtk);
    const reducedDamage = Math.max(0, rawDamage - targetDef);
    target.hp = Math.max(0, target.hp - reducedDamage);
    log.push(`${user.name} hits ${target.name} for ${reducedDamage} damage.`);

    if (skill.lifesteal) {
      const heal = reducedDamage;
      user.hp = Math.min(user.maxHp, user.hp + heal);
      log.push(`${user.name} heals for ${heal} HP.`);
    }

    if (skill.selfDamage) {
      const cost = Math.floor(user.hp * skill.selfDamage);
      user.hp = Math.max(1, user.hp - cost);
      log.push(`${user.name} loses ${cost} HP in recoil.`);
    }
  }

  if (skill.type === 'buff') {
    const team = heroes.includes(target) ? buffs.heroes : buffs.enemies;
    team[target.id] = team[target.id] || [];
    team[target.id].push({
      stat: skill.stat,
      amount: skill.amount,
      turns: skill.turns
    });
    log.push(`${target.name}'s ${skill.stat} increased by ${skill.amount}% for ${skill.turns} turns.`);
  }

  if (heroes.includes(user)) {
    const index = user.skills.findIndex(s => s.name === skill.name);
    heroCooldowns[user.id][index] = skill.cooldown || 0;
  }

  log.forEach(msg => logMessage(msg));

  if (!checkBattleEnd()) {
    renderBattleScene();
  }
}

function nextTurn() {
  turnIndex = (turnIndex + 1) % turnQueue.length;
  let current = turnQueue[turnIndex];

  while (current.hp <= 0) {
    turnIndex = (turnIndex + 1) % turnQueue.length;
    current = turnQueue[turnIndex];
  }

  const allBuffs = [...heroes, ...enemies];
  allBuffs.forEach(unit => {
    const team = heroes.includes(unit) ? buffs.heroes : buffs.enemies;
    const unitBuffs = team[unit.id];
    if (unitBuffs) {
      team[unit.id] = unitBuffs.filter(buff => --buff.turns > 0);
    }
  });

  if (heroes.includes(current)) {
    const cds = heroCooldowns[current.id];
    for (let i = 0; i < cds.length; i++) {
      if (cds[i] > 0) cds[i]--;
    }
  }

  if (enemies.includes(current)) {
    const validSkills = current.skills.filter(s => !s.cooldown || s.cooldown === 0);
    const skill = validSkills[Math.floor(Math.random() * validSkills.length)];
    const target = heroes.find(h => h.hp > 0);
    applySkill(current, skill, target);
    setTimeout(nextTurn, 1000);
  } else {
    renderBattleScene();
  }
}

function checkBattleEnd() {
  const allEnemiesDead = enemies.every(e => e.hp <= 0);
  const allHeroesDead = heroes.every(h => h.hp <= 0);

  if (allEnemiesDead) {
    logMessage('🎉 Victory! All enemies defeated.');
    endBattle(true);
    return true;
  }

  if (allHeroesDead) {
    logMessage('💀 Defeat... Your party has fallen.');
    endBattle(false);
    return true;
  }

  return false;
}

function renderSkillUI(user) {
  const skillTitle = document.getElementById('skill-user-name');
  const skillButtons = document.getElementById('skill-buttons');
  skillTitle.textContent = `${user.name}'s Skills`;
  skillButtons.innerHTML = '';

  const cooldowns = heroCooldowns[user.id];

  user.skills.forEach((skill, index) => {
    const button = document.createElement('button');
    button.textContent = `${skill.name} (${skill.type})`;
    button.className = 'skill-button';

    const isOnCooldown = cooldowns[index] > 0;
    if (isOnCooldown) {
      button.disabled = true;
      button.textContent += ` - ${cooldowns[index]} turns`;
    }

    button.addEventListener('click', () => {
      isSelectingTarget = true;
      selectedSkill = skill;
      selectedUser = user;
      setupTargetListeners(skill);
    });

    skillButtons.appendChild(button);
  });
}

function setupTargetListeners(skill) {
  const targets = skill.target === 'ally' ? heroes : enemies;
  const containerId = skill.target === 'ally' ? 'ally-sprites' : 'enemy-sprites';
  const container = document.getElementById(containerId);
  const imgs = container.querySelectorAll('img');

  imgs.forEach((img, index) => {
    const target = targets[index];
    img.style.outline = '2px solid gold';
    img.style.cursor = 'pointer';

    img.addEventListener('click', () => {
      if (!isSelectingTarget) return;
      isSelectingTarget = false;

      imgs.forEach(i => {
        i.style.outline = 'none';
        i.style.cursor = 'default';
      });

      applySkill(selectedUser, selectedSkill, target);
      nextTurn();
    }, { once: true });
  });
}

export function logMessage(msg) {
  const log = document.getElementById('log-messages');
  const entry = document.createElement('div');
  entry.textContent = msg;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

export function endBattle(victory) {
  document.getElementById('battle-screen').style.display = 'none';
  const victoryScreen = document.getElementById('victory-screen');
  victoryScreen.style.display = victory ? 'block' : 'none';

  document.getElementById('continue-button').onclick = () => {
    victoryScreen.style.display = 'none';
    document.getElementById('game').style.display = 'grid';
    renderMap();
  };
}

export function getModifiedStat(unit, stat, buffsData, heroList, enemyList) {
  let base = unit[stat];
  const isHero = heroList.includes(unit);
  const teamBuffs = isHero ? buffsData.heroes : buffsData.enemies;
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
