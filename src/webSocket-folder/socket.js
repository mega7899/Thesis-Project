// Browser side: connects to the ws server that vite.config.js starts.
const protocol = location.protocol === "https:" ? "wss" : "ws";
const socket = new WebSocket(`${protocol}://${location.host}/ws`);

socket.addEventListener("open", () => console.log("Client's connected"));

socket.onmessage = (event) => {
  try {
    console.log(JSON.parse(event.data));
  } catch (error) {
    return;
  }
};

socket.addEventListener("close", () => console.log("Client's disconnected"));

// Use this from anywhere:  sendToServer("hello");
export function sendToServer(message) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(message);
  }
}
