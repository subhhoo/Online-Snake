import { io } from 'socket.io-client';

class GameClient {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.socket = io('http://localhost:3000'); // Ensure this URL matches your server
    this.players = new Map();
    this.foods = new Set();
    this.camera = { x: 0, y: 0 };
    this.playerSnake = null;
    this.FOOD_SIZE = 10;
    this.GRID_SIZE = 50;
    this.WORLD_SIZE = 5000;

    this.setupEventListeners();
    this.setupNetworkHandlers();
    this.startGameLoop();

    this.socket.on('connect', () => console.log('Connected to server'));
    this.socket.on('disconnect', () => console.log('Disconnected from server'));
    this.socket.on('connect_error', (err) => console.error('Connection error:', err));
  }

  setupEventListeners() {
    window.addEventListener('mousemove', (e) => {
      if (!this.playerSnake) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const angle = Math.atan2(y - this.canvas.height / 2, x - this.canvas.width / 2);
      this.socket.emit('direction', angle);
    });
  }

  setupNetworkHandlers() {
    this.socket.on('gameState', (state) => {
      this.players = new Map(state.players);
      this.foods = new Set(state.foods);
    });

    this.socket.on('playerAssigned', (id) => {
      this.playerSnake = id;
      console.log(`Player assigned: ${this.playerSnake}`);
    });
  }

  startGameLoop() {
    const gameLoop = () => {
      this.update();
      this.render();
      requestAnimationFrame(gameLoop);
    };
    gameLoop();
  }

  update() {
    if (!this.playerSnake || !this.players.has(this.playerSnake)) return;
    const player = this.players.get(this.playerSnake);
    this.camera.x = player.segments[0].x - this.canvas.width / 2;
    this.camera.y = player.segments[0].y - this.canvas.height / 2;
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.renderGrid();
    this.renderFood();
    this.renderPlayers();
  }

  renderGrid() {
    this.ctx.strokeStyle = '#2a2a2a';
    this.ctx.lineWidth = 1;

    const startX = -this.camera.x % this.GRID_SIZE;
    const startY = -this.camera.y % this.GRID_SIZE;

    for (let x = startX; x < this.canvas.width; x += this.GRID_SIZE) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }

    for (let y = startY; y < this.canvas.height; y += this.GRID_SIZE) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }
  }

  renderFood() {
    this.ctx.fillStyle = '#f1c40f';
    for (const food of this.foods) {
      const screenX = food.x - this.camera.x;
      const screenY = food.y - this.camera.y;
      this.ctx.beginPath();
      this.ctx.arc(screenX, screenY, this.FOOD_SIZE / 2, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  renderPlayers() {
    for (const player of this.players.values()) {
      this.ctx.fillStyle = player.color;
      for (const segment of player.segments) {
        const screenX = segment.x - this.camera.x;
        const screenY = segment.y - this.camera.y;
        this.ctx.beginPath();
        this.ctx.arc(screenX, screenY, segment.radius, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }
}

export default GameClient;
