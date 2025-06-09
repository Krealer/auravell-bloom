import { setMapData, renderMap, setupKeyboardControls } from './map.js';
import { endBattle } from './battle.js';

const gameContainer = document.getElementById('game');
const toggleGrid = document.getElementById('toggle-grid');
const endBattleButton = document.getElementById('end-battle');
const errorMessage = document.getElementById('error-message');

function showError(msg) {
  if (errorMessage) {
    errorMessage.textContent = msg;
    errorMessage.style.display = 'block';
  }
  console.error(msg);
}

fetch('data/maps.json')
  .then(res => res.json())
  .then(data => {
    setMapData(data.maps[0], data.start);
    renderMap();
    setupKeyboardControls();
  })
  .catch(() => {
    showError('Failed to load map data. Please refresh the page.');
  });

toggleGrid.addEventListener('change', () => {
  gameContainer.classList.toggle('grid-lines', toggleGrid.checked);
});

endBattleButton.addEventListener('click', () => {
  endBattle(false);
  document.getElementById('game').style.display = 'grid';
  renderMap();
});
