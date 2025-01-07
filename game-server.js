import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

// Manually define __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Set up the game server logic
class GameServer {
  constructor(httpServer, port = 3000) {
    this.io = new Server(httpServer, {
      cors: { origin: '*' },
    });
    this.players = new Map();
    this.foods = new Set();
    this.WORLD_SIZE = 5000;  // World size for the game
    this.FOOD_COUNT = 100;   // Number of food items to generate
    this.gameStarted = false;

    this.setupSocketHandlers();
    this.startGameLoop();
    this.generateFood();

    httpServer.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  }

  // Setup socket event listeners
  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      const player = this.createPlayer(socket.id);
      this.players.set(socket.id, player);
      socket.emit('playerAssigned', socket.id);

      // Handle direction change (using arrow keys) from client
      socket.on('moveDirection', (direction) => {
        const player = this.players.get(socket.id);
        if (player) {
          player.direction = direction;  // Store the new direction
        }
      });

      // Handle game start
      socket.on('startGame', () => {
        this.gameStarted = true;
        console.log('Game started!');
      });

      // Remove player when disconnected
      socket.on('disconnect', () => {
        this.players.delete(socket.id);
      });
    });
  }

  // Create a new player object
  createPlayer(id) {
    return {
      id,
      segments: [
        { x: 250, y: 250, radius: 5 }, // Initial position
        { x: 240, y: 250, radius: 5 },
        { x: 230, y: 250, radius: 5 },
      ],
      direction: 'RIGHT',  // Start direction (RIGHT, LEFT, UP, DOWN)
      speed: 2,  // Reduced speed for better control
      score: 0,
      color: `hsl(${Math.random() * 360}, 100%, 50%)`, // Random color for each player
      name: `Player ${id.slice(0, 4)}`, // Short player name (first 4 characters of ID)
    };
  }

  // Generate random food positions on the map
  generateFood() {
    while (this.foods.size < this.FOOD_COUNT) {
      this.foods.add({
        x: Math.random() * this.WORLD_SIZE,
        y: Math.random() * this.WORLD_SIZE,
      });
    }
  }

  // Main game loop
  startGameLoop() {
    setInterval(() => {
      if (this.gameStarted) {
        this.update();
        this.checkCollisions();
        this.broadcastGameState();
      }
    }, 1000 / 60); // Run at 60 FPS
  }

  // Update game state (move the snake based on direction)
  update() {
    for (const player of this.players.values()) {
      const head = player.segments[0];
      let dx = 0;
      let dy = 0;

      // Update direction based on arrow keys
      if (player.direction === 'UP') dy = -player.speed;
      if (player.direction === 'DOWN') dy = player.speed;
      if (player.direction === 'LEFT') dx = -player.speed;
      if (player.direction === 'RIGHT') dx = player.speed;

      // Update head position based on direction with canvas looping
      head.x = (head.x + dx + this.WORLD_SIZE) % this.WORLD_SIZE;
      head.y = (head.y + dy + this.WORLD_SIZE) % this.WORLD_SIZE;

      // Move the body (all segments except the head)
      for (let i = player.segments.length - 1; i > 0; i--) {
        player.segments[i] = { ...player.segments[i - 1] };
      }
      player.segments[0] = { ...head };
    }
  }

  // Check for collisions between snake and food or with other snakes
  checkCollisions() {
    for (const player of this.players.values()) {
      const head = player.segments[0];

      // Check for collision with food
      for (const food of this.foods) {
        const dx = head.x - food.x;
        const dy = head.y - food.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < head.radius) {
          this.foods.delete(food);  // Remove the food item
          this.generateFood();      // Generate new food
          player.score += 10;       // Increase score
          player.segments.push({ ...player.segments[player.segments.length - 1] }); // Grow snake
          this.io.emit('scoreUpdate', player.score);  // Emit updated score to client
        }
      }

      // Check for collision with self (snake body)
      for (let i = 1; i < player.segments.length; i++) {
        const segment = player.segments[i];
        if (head.x === segment.x && head.y === segment.y) {
          this.killPlayer(player.id);  // Kill player if they hit themselves
        }
      }

      // Check for collision with other players
      for (const otherPlayer of this.players.values()) {
        if (otherPlayer.id === player.id) continue;

        for (let i = 0; i < otherPlayer.segments.length; i++) {
          const segment = otherPlayer.segments[i];
          if (head.x === segment.x && head.y === segment.y) {
            this.killPlayer(player.id);  // Kill player if they hit another player
          }
        }
      }
    }
  }

  // Kill player (end the game for that player)
  killPlayer(playerId) {
    this.players.delete(playerId);  // Remove player from the game
    this.io.emit('playerDied', playerId);  // Notify clients that the player died
  }

  // Broadcast the game state (players and food) to all connected clients
  broadcastGameState() {
    this.io.emit('gameState', {
      players: Array.from(this.players.entries()),
      foods: Array.from(this.foods),
    });
  }
}

// Start the game server
const gameServer = new GameServer(httpServer, 3000);
