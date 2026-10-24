import { defineConfig } from "vite";
import { WebSocketServer } from "ws";

/* A tiny Vite plugin starts a WebSocket server,
inside the Vite dev server, so `npm run dev`can run both server. */
function websocketPlugin() {
  return {
    name: "ws-server",

    // Vite runs it's server and also configurate it's own server.
    configureServer(viteServer) {
      // No http server (middleware mode) -> nothing to attach to.
      if (!viteServer.httpServer) return;

      // This will let ws share Vite's port instead of opening its own.
      const socketServer = new WebSocketServer({ noServer: true });

      // Somebody connected.
      socketServer.on("connection", (clientSocket) => {
        console.log("[ws] client connected. Total:", socketServer.clients.size);

        // Somebody sent a message -> pass it to everyone else.
        clientSocket.on("message", (messageData, isBinary) => {
          for (const otherClient of socketServer.clients) {
            if (otherClient !== clientSocket && otherClient.readyState === 1) {
              otherClient.send(messageData, { binary: isBinary });
            }
          }
        });

        clientSocket.on("close", () => {
          console.log("[ws] client left. Total:", socketServer.clients.size);
        });

        clientSocket.send("Connected to the ws server!");
      });

      // The browser asks to "upgrade" a normal HTTP request into a WebSocket.
      // Only accept the path /ws, so Vite's own hot-reload socket keeps working.
      viteServer.httpServer.on("upgrade", (request, rawSocket, upgradeHead) => {
        if (request.url !== "/ws") return;

        socketServer.handleUpgrade(request, rawSocket, upgradeHead, (upgradedSocket) => {
          socketServer.emit("connection", upgradedSocket, request);
        });
      });

      // Clean shutdown when Vite stops.
      viteServer.httpServer.on("close", () => socketServer.close());
    },
  };
}

export default defineConfig({
  plugins: [websocketPlugin()],
});
