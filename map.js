export let currentMap = null;
export let playerPosition = { x: 0, y: 0 };

import { enterBattle } from './battle.js';

export function setMapData(map, start) {
  currentMap = map;
  playerPosition = { ...start };
}

export function renderMap() {
  const mapContainer = document.getElementById('game');
  mapContainer.innerHTML = '';

  const gridToggle = document.getElementById('toggle-grid');
  mapContainer.classList.toggle('grid-lines', gridToggle.checked);

  for (let y = 0; y < currentMap.height; y++) {
    for (let x = 0; x < currentMap.width; x++) {
      const tile = document.createElement('div');
      tile.classList.add('tile');
      const value = currentMap.tiles[y][x];

      if (x === playerPosition.x && y === playerPosition.y) {
        tile.classList.add('player');
        const img = document.createElement('img');
        img.src = 'assets/snealer_chibi.png';
        img.alt = 'Player';
        tile.appendChild(img);
      } else if (value === 1 || value === 'tree') {
        tile.classList.add('tree');
        tile.textContent = 'T';
      } else if (value === 'water') {
        tile.classList.add('water');
        tile.textContent = '~';
      } else if (typeof value === 'object' && value.type === 'battle') {
        tile.classList.add('enemy');
        tile.textContent = 'E';
      } else {
        tile.classList.add('grass');
        tile.textContent = '.';
      }

      tile.dataset.x = x;
      tile.dataset.y = y;
      tile.addEventListener('click', () => {
        handleTileClick(x, y);
      });

      mapContainer.appendChild(tile);
    }
  }
}

export function handleTileClick(targetX, targetY) {
  const dx = Math.abs(targetX - playerPosition.x);
  const dy = Math.abs(targetY - playerPosition.y);
  const isAdjacent = (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
  if (!isAdjacent) return;

  const tile = currentMap.tiles[targetY][targetX];
  if (tile === 1 || tile === 'tree' || tile === 'water') return;

  playerPosition.x = targetX;
  playerPosition.y = targetY;

  if (typeof tile === 'object' && tile.type === 'battle') {
    if (tile.name) showZoneInfo(tile.name);
    enterBattle(tile.group);
    currentMap.tiles[targetY][targetX] = 'grass';
  }

  renderMap();
}

export function setupKeyboardControls() {
  window.addEventListener('keydown', e => {
    const dir = { x: 0, y: 0 };
    if (e.key === 'w' || e.key === 'ArrowUp') dir.y = -1;
    if (e.key === 's' || e.key === 'ArrowDown') dir.y = 1;
    if (e.key === 'a' || e.key === 'ArrowLeft') dir.x = -1;
    if (e.key === 'd' || e.key === 'ArrowRight') dir.x = 1;

    const newX = playerPosition.x + dir.x;
    const newY = playerPosition.y + dir.y;

    if (newX < 0 || newX >= currentMap.width || newY < 0 || newY >= currentMap.height) return;

    const targetTile = currentMap.tiles[newY][newX];
    if (targetTile === 1 || targetTile === 'tree' || targetTile === 'water') return;

    playerPosition = { x: newX, y: newY };

    if (typeof targetTile === 'object' && targetTile.type === 'battle') {
      if (targetTile.name) showZoneInfo(targetTile.name);
      enterBattle(targetTile.group);
      currentMap.tiles[newY][newX] = 'grass';
    }

    renderMap();
  });
}

export function showZoneInfo(name) {
  const zone = document.getElementById('zone-info');
  zone.textContent = name;
  zone.style.display = 'block';
  setTimeout(() => zone.style.display = 'none', 3000);
}
