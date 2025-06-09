// =============================
// GAME.JS - With Notations
// =============================

import { showError } from './modules/utils.js';

// DOM references
const gameContainer = document.getElementById("game");
const toggleGrid = document.getElementById("toggle-grid");
const endBattleButton = document.getElementById("end-battle");

// Global game state
let currentMap = null;
let playerPosition = { x: 0, y: 0 };
let heroes = [];
let enemies = [];
let heroCooldowns = {}; // cooldowns per hero per skill
let buffs = { heroes: {}, enemies: {} }; // active buffs
let turnQueue = [];
let turnIndex = 0;
let isSelectingTarget = false;
let selectedSkill = null;

let selectedUser = null;


// Load the map JSON and render it
fetch("data/maps.json")
  .then(res => res.json())
  .then(data => {
    currentMap = data.maps[0]; // load first map
    playerPosition = { ...data.start };
    renderMap();
  })
  .catch(() => {
    showError("Failed to load map data. Please refresh the page.");
  });

// Show or hide grid lines
toggleGrid.addEventListener("change", () => {
  gameContainer.classList.toggle("grid-lines", toggleGrid.checked);
});

// Allow players to exit the current battle manually
endBattleButton.addEventListener("click", () => {
  endBattle(false);
  document.getElementById("game").style.display = "grid";
  renderMap();
});

// Render the map based on currentMap and playerPosition
function renderMap() {
  const mapContainer = document.getElementById("game");
  mapContainer.innerHTML = ""; // Clear the grid before re-rendering

  // Apply or remove grid lines based on checkbox
  const gridToggle = document.getElementById("toggle-grid");
  mapContainer.classList.toggle("grid-lines", gridToggle.checked);

  // Loop over each row (Y = vertical)
  for (let y = 0; y < currentMap.height; y++) {
    // Loop over each column in that row (X = horizontal)
    for (let x = 0; x < currentMap.width; x++) {
      const tile = document.createElement("div");
      tile.classList.add("tile");

      // Get the tile's raw value (could be number or object)
      const value = currentMap.tiles[y][x];

      // === Determine how this tile should be rendered ===
      if (x === playerPosition.x && y === playerPosition.y) {
        // Render the player
        tile.classList.add("player");

        const img = document.createElement("img");
        img.src = "assets/snealer_chibi.png"; // Adjust for your hero
        img.alt = "Player";
        tile.appendChild(img);
      } else if (value === 1 || value === "tree") {
        // Tree (non-walkable)
        tile.classList.add("tree");
        tile.textContent = "T";
      } else if (value === "water") {
        // Water (non-walkable)
        tile.classList.add("water");
        tile.textContent = "~";
      } else if (typeof value === "object" && value.type === "battle") {
        // Enemy/battle tile
        tile.classList.add("enemy");
        tile.textContent = "E";
      } else {
        // Default grass tile
        tile.classList.add("grass");
        tile.textContent = ".";
      }

      // === Add click movement support ===
      tile.dataset.x = x;
      tile.dataset.y = y;

      // Let players tap or click a tile to move
      tile.addEventListener("click", () => {
        handleTileClick(x, y); // Will only move if valid
      });

      // Append the tile to the map grid
      mapContainer.appendChild(tile);
    }
  }
}


function handleTileClick(targetX, targetY) {
  // Calculate how far the target tile is from the player
  const dx = Math.abs(targetX - playerPosition.x);
  const dy = Math.abs(targetY - playerPosition.y);

  // Allow only orthogonal 1-tile steps (no diagonal, no big jumps)
  const isAdjacent = (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
  if (!isAdjacent) {
    console.log("Cannot move — tile is not adjacent.");
    return;
  }

  // Get what's in the tile (terrain or battle object)
  const tile = currentMap.tiles[targetY][targetX];
  // Block movement on trees and water
  if (tile === 1 || tile === "tree" || tile === "water") {
    console.log("Cannot move — terrain is blocking.");
    return;
  }

  // Move the player to the new location
  playerPosition.x = targetX;
  playerPosition.y = targetY;

  console.log(`Player moved to: (${targetX}, ${targetY})`);

  // === Trigger battle if it's a battle tile ===
  if (typeof tile === "object" && tile.type === "battle") {
    // Optionally show the zone name (like "Shardfang Nest")
    if (tile.name) {
      showZoneInfo(tile.name);
    }

    // Start the battle using the listed enemy group
    enterBattle(tile.group);

    // Clear the battle tile so it's not triggered again
    currentMap.tiles[targetY][targetX] = "grass";
  }

  // Refresh the map view to reflect the move
  renderMap();
}



// Movement via WASD or Arrow Keys
window.addEventListener("keydown", e => {
  const dir = { x: 0, y: 0 };
  if (e.key === "w" || e.key === "ArrowUp") dir.y = -1;
  if (e.key === "s" || e.key === "ArrowDown") dir.y = 1;
  if (e.key === "a" || e.key === "ArrowLeft") dir.x = -1;
  if (e.key === "d" || e.key === "ArrowRight") dir.x = 1;

  const newX = playerPosition.x + dir.x;
  const newY = playerPosition.y + dir.y;

  if (newX < 0 || newX >= currentMap.width || newY < 0 || newY >= currentMap.height) return;

  const targetTile = currentMap.tiles[newY][newX];

  if (targetTile === 1 || targetTile === "tree" || targetTile === "water") return; // blocked terrain

  playerPosition = { x: newX, y: newY };

  // Handle battle tile with zone info
  if (typeof targetTile === "object" && targetTile.type === "battle") {
    if (targetTile.name) showZoneInfo(targetTile.name);
    enterBattle(targetTile.group);
    currentMap.tiles[newY][newX] = "grass";
  }

  renderMap();
});

// Display zone name as a temporary popup
function showZoneInfo(name) {
  const zone = document.getElementById("zone-info");
  zone.textContent = name;
  zone.style.display = "block";
  setTimeout(() => zone.style.display = "none", 3000);
}

// =============================
// Battle Initialization
// =============================

// Starts a battle with a list of enemy IDs
function enterBattle(enemyGroup) {
  // Hide the overworld map
  document.getElementById("game").style.display = "none";
  // Show the battle screen
  document.getElementById("battle-screen").style.display = "block";

  // Load hero data (this assumes it's loaded or defined elsewhere)
  fetch("data/characters.json")
    .then(res => res.json())
    .then(data => {
      heroes = data.characters;

      // Initialize cooldowns and buffs
      heroCooldowns = {};
      buffs.heroes = {};
      heroes.forEach(hero => {
        heroCooldowns[hero.id] = Array(hero.skills.length).fill(0);
        buffs.heroes[hero.id] = [];
      });

      // Load enemy data for this battle
      fetch("data/enemies.json")
        .then(res => res.json())
        .then(edata => {
          enemies = enemyGroup.map(id => {
            const enemy = edata.enemies.find(e => e.id === id);
            return JSON.parse(JSON.stringify(enemy)); // deep clone
          });

          // Initialize enemy buffs
          buffs.enemies = {};
          enemies.forEach(enemy => {
            buffs.enemies[enemy.id] = [];
          });

          // Set turn queue: heroes first, then enemies
          turnQueue = [...heroes, ...enemies];
          turnIndex = 0;

          // Render the battle UI
          renderBattleScene();
        })
        .catch(() => {
          showError("Failed to load enemy data. Please refresh the page.");
        });
    })
    .catch(() => {
      showError("Failed to load character data. Please refresh the page.");
    });
}

// =============================
// Battle Scene Rendering
// =============================

function renderBattleScene() {
  // Get DOM elements
  const allySprites = document.getElementById("ally-sprites");
  const enemySprites = document.getElementById("enemy-sprites");
  const allyHud = document.getElementById("ally-hud");
  const enemyHud = document.getElementById("enemy-hud");

  // Clear previous visuals
  allySprites.innerHTML = "";
  enemySprites.innerHTML = "";
  allyHud.innerHTML = "";
  enemyHud.innerHTML = "";

  // Highlight the current unit's turn
  const activeUnit = turnQueue[turnIndex];

  // Render hero sprites and HUD
  heroes.forEach(hero => {
    const img = document.createElement("img");
    img.src = hero.sprite;
    img.alt = hero.name;
    if (hero === activeUnit) img.classList.add("active-turn");
    allySprites.appendChild(img);

    const hud = document.createElement("p");
    hud.textContent = `${hero.name}: ${hero.hp} HP`;
    if (hero === activeUnit) hud.classList.add("active-hud");
    allyHud.appendChild(hud);
  });

  // Render enemy sprites and HUD
  enemies.forEach(enemy => {
    const img = document.createElement("img");
    img.src = enemy.sprite;
    img.alt = enemy.name;
    if (enemy === activeUnit) img.classList.add("active-turn");
    enemySprites.appendChild(img);

    const hud = document.createElement("p");
    hud.textContent = `${enemy.name}: ${enemy.hp} HP`;
    if (enemy === activeUnit) hud.classList.add("active-hud");
    enemyHud.appendChild(hud);
  });

  // Show skills if it's a hero's turn
  if (heroes.includes(activeUnit)) {
    renderSkillUI(activeUnit);
  }
}

// =============================
// Skill Application Logic
// =============================

// Handles skill logic when a unit uses a skill on a target
function applySkill(user, skill, target) {
  const log = [];

  // Check if the skill is healing
  if (skill.type === "heal") {
    const amount = Math.floor(skill.power * user.atk);
    target.hp = Math.min(target.maxHp, target.hp + amount);
    log.push(`${user.name} heals ${target.name} for ${amount} HP.`);
  }

  // Check if the skill is damaging
  if (skill.type === "damage") {
    const rawDamage = Math.floor((skill.power / 100) * user.atk);
    const reducedDamage = Math.max(0, rawDamage - target.def);
    target.hp = Math.max(0, target.hp - reducedDamage);
    log.push(`${user.name} hits ${target.name} for ${reducedDamage} damage.`);

    // Life steal: user heals a portion of damage dealt
    if (skill.lifesteal) {
      const heal = reducedDamage;
      user.hp = Math.min(user.maxHp, user.hp + heal);
      log.push(`${user.name} heals for ${heal} HP.`);
    }

    // Self-damage: sacrifice HP for power
    if (skill.selfDamage) {
      const cost = Math.floor(user.hp * skill.selfDamage);
      user.hp = Math.max(1, user.hp - cost);
      log.push(`${user.name} loses ${cost} HP in recoil.`);
    }
  }

  // Check for buffs
  if (skill.type === "buff") {
    buffs.heroes[target.id] = buffs.heroes[target.id] || [];
    buffs.heroes[target.id].push({
      stat: skill.stat,
      amount: skill.amount,
      turns: skill.turns
    });
    log.push(`${target.name}'s ${skill.stat} increased by ${skill.amount}% for ${skill.turns} turns.`);
  }

  // Handle cooldowns if applicable (for heroes only)
  if (heroes.includes(user)) {
    const index = user.skills.findIndex(s => s.name === skill.name);
    heroCooldowns[user.id][index] = skill.cooldown || 0;
  }

  // Log messages
  log.forEach(msg => logMessage(msg));

  // After action: check for end state or continue
  if (!checkBattleEnd()) {
    renderBattleScene();
  }
}

// =============================
// Turn Management Logic
// =============================

function nextTurn() {
  // Move to the next unit in the turn queue
  turnIndex = (turnIndex + 1) % turnQueue.length;
  const current = turnQueue[turnIndex];

  // Skip dead units
  while (current.hp <= 0) {
    turnIndex = (turnIndex + 1) % turnQueue.length;
    current = turnQueue[turnIndex];
  }

  // Decrease all buffs' remaining turns and remove expired buffs
  const allBuffs = [...heroes, ...enemies];
  allBuffs.forEach(unit => {
    const team = heroes.includes(unit) ? buffs.heroes : buffs.enemies;
    const unitBuffs = team[unit.id];
    if (unitBuffs) {
      team[unit.id] = unitBuffs.filter(buff => --buff.turns > 0);
    }
  });

  // Decrease cooldowns for current hero
  if (heroes.includes(current)) {
    const cds = heroCooldowns[current.id];
    for (let i = 0; i < cds.length; i++) {
      if (cds[i] > 0) cds[i]--;
    }
  }

  // If it's an enemy, choose a random skill and target
  if (enemies.includes(current)) {
    const validSkills = current.skills.filter(s => !s.cooldown || s.cooldown === 0);
    const skill = validSkills[Math.floor(Math.random() * validSkills.length)];
    const target = heroes.find(h => h.hp > 0);
    applySkill(current, skill, target);
    setTimeout(nextTurn, 1000);
  } else {
    // If it's a hero, show the skill UI
    renderBattleScene();
  }
}

// =============================
// Victory / Defeat Check Logic
// =============================

function checkBattleEnd() {
  const allEnemiesDead = enemies.every(e => e.hp <= 0);
  const allHeroesDead = heroes.every(h => h.hp <= 0);

  if (allEnemiesDead) {
    logMessage("🎉 Victory! All enemies defeated.");
    endBattle(true);
    return true;
  }

  if (allHeroesDead) {
    logMessage("💀 Defeat... Your party has fallen.");
    endBattle(false);
    return true;
  }

  return false; // continue the battle
}

// =============================
// Skill UI Rendering
// =============================

function renderSkillUI(user) {
  const skillTitle = document.getElementById("skill-user-name");
  const skillButtons = document.getElementById("skill-buttons");
  skillTitle.textContent = `${user.name}'s Skills`;
  skillButtons.innerHTML = "";

  // Get current cooldowns for the user
  const cooldowns = heroCooldowns[user.id];

  user.skills.forEach((skill, index) => {
    const button = document.createElement("button");
    button.textContent = `${skill.name} (${skill.type})`;
    button.className = "skill-button";

    const isOnCooldown = cooldowns[index] > 0;
    if (isOnCooldown) {
      button.disabled = true;
      button.textContent += ` - ${cooldowns[index]} turns`;
    }

    // Handle skill click to select a target
    button.addEventListener("click", () => {
      isSelectingTarget = true;
      selectedSkill = skill;
      selectedUser = user;
      setupTargetListeners(skill);
    });

    skillButtons.appendChild(button);
  });
}

// =============================
// Target Selection Setup
// =============================

function setupTargetListeners(skill) {
  const targets = skill.target === "ally" ? heroes : enemies;

  // Get the sprite container based on target type
  const containerId = skill.target === "ally" ? "ally-sprites" : "enemy-sprites";
  const container = document.getElementById(containerId);
  const imgs = container.querySelectorAll("img");

  imgs.forEach((img, index) => {
    const target = targets[index];

    // Highlight potential target
    img.style.outline = "2px solid gold";
    img.style.cursor = "pointer";

    img.addEventListener("click", () => {
      if (!isSelectingTarget) return;
      isSelectingTarget = false;

      // Reset outlines
      imgs.forEach(i => {
        i.style.outline = "none";
        i.style.cursor = "default";
      });

      applySkill(selectedUser, selectedSkill, target);
      nextTurn();
    }, { once: true });
  });
}

// =============================
// Battle Log Messaging
// =============================

// Displays a message in the battle log panel
function logMessage(msg) {
  const log = document.getElementById("log-messages");
  const entry = document.createElement("div");
  entry.textContent = msg;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight; // auto-scroll to latest
}

// =============================
// Battle End Handling
// =============================

function endBattle(victory) {
  // Hide battle screen
  document.getElementById("battle-screen").style.display = "none";

  // Show victory or defeat screen based on result
  const victoryScreen = document.getElementById("victory-screen");
  victoryScreen.style.display = victory ? "block" : "none";

  // Optional: update UI or save game state here

  // Set up continue button to resume map
  document.getElementById("continue-button").onclick = () => {
    victoryScreen.style.display = "none";
    document.getElementById("game").style.display = "grid";
    renderMap();
  };
}

// =============================
// Stat Calculation with Buffs
// =============================

import { getModifiedStat } from './modules/battle.js';

// =============================
// All battle functions documented!
// - getModifiedStat()
// - enterBattle()
// - renderBattleScene()
// - applySkill()
// - nextTurn()
// - checkBattleEnd()
// - renderSkillUI()
// - setupTargetListeners()
// - getModifiedStat()
// - logMessage()
// - endBattle()

// If you want to continue, we can annotate each of these one by one.
