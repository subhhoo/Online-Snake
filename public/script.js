import GameClient from './game-client.js';

document.getElementById('startGame').addEventListener('click', () => {
  const playerName = document.getElementById('playerName').value.trim();
  if (playerName === '') {
    alert('Please enter your name.');
    return;
  }

  document.getElementById('menu').style.display = 'none';
  const canvas = document.getElementById('gameCanvas');
  canvas.style.display = 'block';

  const gameClient = new GameClient('gameCanvas');
  console.log(`Game started for player: ${playerName}`);
});
