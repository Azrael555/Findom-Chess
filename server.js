const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { Chess } = require("chess.js");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "*", 
    methods: ["GET", "POST"],
  },
});

const games = {}; // Store active games

// Middleware
app.use(cors());
app.use(express.json());

// Root route for testing
app.get("/", (req, res) => {
  res.send("Chess Server is Running!");
});

io.on("connection", (socket) => {
  console.log("New player connected:", socket.id);

  socket.on("joinGame", (gameId) => {
    if (!games[gameId]) {
      games[gameId] = {
        chess: new Chess(),
        players: { white: null, black: null },
      };
    }

    const game = games[gameId];

    if (!game.players.white) {
      game.players.white = socket.id;
      socket.emit("playerColor", "w");
    } else if (!game.players.black) {
      game.players.black = socket.id;
      socket.emit("playerColor", "b");
    } else {
      socket.emit("spectator");
    }

    socket.join(gameId);
    socket.emit("gameState", game.chess.fen());
  });

  socket.on("move", ({ gameId, move, playerColor }) => {
    const game = games[gameId];
    if (!game) return;

    const { chess, players } = game;

    if (
      (playerColor === "w" && socket.id !== players.white) ||
      (playerColor === "b" && socket.id !== players.black)
    ) {
      return;
    }

    const result = chess.move(move);
    if (result) {
      io.to(gameId).emit("gameState", chess.fen());

      if (chess.isCheckmate()) {
        io.to(gameId).emit("gameOver", { winner: playerColor });
      } else if (chess.isDraw()) {
        io.to(gameId).emit("gameOver", { winner: "draw" });
      }
    }
  });

  socket.on("chatMessage", ({ gameId, user, text }) => {
    io.to(gameId).emit("chatMessage", { user, text });
  });

  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);
  });
});

// Use process.env.PORT for Render
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
