import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });
  const PORT = process.env.PORT || 3000;

  // Multiplayer State
  const players = new Map();

  io.on("connection", (socket) => {
    console.log("Player connected:", socket.id);
    
    // Default player state
    players.set(socket.id, { 
      id: socket.id, 
      position: [0, 2, 0], 
      rotation: [0, 0, 0],
      map: 'maze' // Keep track of which map they are on
    });

    // Send current players to the new player
    socket.emit("currentPlayers", Array.from(players.values()));
    
    // Tell others about the new player
    socket.broadcast.emit("playerJoined", players.get(socket.id));

    socket.on("updatePosition", (data) => {
      if (players.has(socket.id)) {
        const player = players.get(socket.id);
        player.position = data.position;
        player.rotation = data.rotation;
        player.map = data.map;
        // Broadcast to everyone else
        socket.broadcast.emit("playerMoved", player);
      }
    });

    socket.on("disconnect", () => {
      console.log("Player disconnected:", socket.id);
      players.delete(socket.id);
      io.emit("playerLeft", socket.id);
    });
  });

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", players: players.size });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve static files from dist
    app.use(express.static("dist"));
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
