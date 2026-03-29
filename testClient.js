import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

let currentRoom = null;

socket.on("connect", () => {
  console.log("Connected:", socket.id);
  socket.emit("find_match");
});

socket.on("match_found", ({ roomId }) => {
  console.log("MATCH FOUND:", roomId);
  currentRoom = roomId;
});

socket.on("game_update", (data) => {
  console.log("GAME:", data.message);

  if (data.green) {
    // simulate reaction (random delay)
    const reactionDelay = Math.random() * 200 + 50;

    setTimeout(() => {
      console.log("CLICKING!");
      socket.emit("click", { roomId: currentRoom });
    }, reactionDelay);
  }
});

socket.on("game_result", (data) => {
  console.log("RESULT:", data);

   if (data.final) {
    console.log("MATCH OVER");
  }
});

setInterval(() => {}, 1000);