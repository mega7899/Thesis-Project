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
      const wss = new WebSocketServer({ noServer: true });

      // Somebody connected.
      wss.on("connection", (socket) => {
        console.log("[ws] client connected. Total:", wss.clients.size);

        // Somebody sent a message -> pass it to everyone else.
        socket.on("message", (data, isBinary) => {
          for (const client of wss.clients) {
            if (client !== socket && client.readyState === 1) {
              client.send(data, { binary: isBinary });
            }
          }
        });

        socket.on("close", () => {
          console.log("[ws] client left. Total:", wss.clients.size);
        });

        socket.send("Connected to the ws server!");
      });

      // The browser asks to "upgrade" a normal HTTP request into a WebSocket.
      // Only accept the path /ws, so Vite's own hot-reload socket keeps working.
      viteServer.httpServer.on("upgrade", (request, socket, head) => {
        if (request.url !== "/ws") return;

        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit("connection", ws, request);
        });
      });

      // Clean shutdown when Vite stops.
      viteServer.httpServer.on("close", () => wss.close());
    },
  };
}

export default defineConfig({
  plugins: [websocketPlugin()],
});
