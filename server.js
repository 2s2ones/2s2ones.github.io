const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 8080 });

let lastState=null;

wss.on("connection",ws=>{
console.log("Client connected");

ws.on("message",msg=>{
lastState=msg;
wss.clients.forEach(c=>{
if(c.readyState===WebSocket.OPEN) c.send(msg);
});
});
});

console.log("WebSocket running on ws://localhost:8080");
