import { WebSocketServer } from "ws";
import { randomUUID } from "crypto";

const PORT = process.env.PORT || 8080;

const wss = new WebSocketServer({
  port: PORT,
  host: "0.0.0.0"   // IMPORTANT for Railway / Docker
});

const rooms = new Map(); // roomCode -> { players: Map(ws,id), lastState }

function makeRoomCode(){
  return Math.random().toString(36).substring(2,7).toUpperCase();
}

function send(ws, data){
  if(ws.readyState === ws.OPEN){
    ws.send(JSON.stringify(data));
  }
}

function broadcast(room, data){
  for(const ws of room.players.keys()){
    send(ws, data);
  }
}

function joinRoom(ws, code){
  const room = rooms.get(code);
  if(!room){
    send(ws,{type:"error",message:"Room not found"});
    return;
  }

  if(room.players.size >= 10){
    send(ws,{type:"error",message:"Room full"});
    return;
  }

  leaveRoom(ws);

  room.players.set(ws, ws.id);
  ws.room = code;

  send(ws,{type:"joined",room:code,id:ws.id});
  broadcast(room,{type:"players",count:room.players.size});
}

function leaveRoom(ws){
  if(!ws.room) return;

  const room = rooms.get(ws.room);
  if(!room) return;

  room.players.delete(ws);

  if(room.players.size === 0){
    rooms.delete(ws.room);
  } else {
    broadcast(room,{type:"players",count:room.players.size});
  }

  ws.room = null;
}

wss.on("connection", ws => {
  ws.id = randomUUID();
  ws.room = null;
  ws.isAlive = true;

  send(ws,{type:"connected",id:ws.id});

  ws.on("pong",()=> ws.isAlive = true);

  ws.on("message", raw=>{
    let msg;
    try{
      msg = JSON.parse(raw.toString());
    }catch{
      return;
    }

    if(msg.type === "create"){
      const code = makeRoomCode();
      rooms.set(code,{
        players:new Map(),
        lastState:null
      });
      joinRoom(ws, code);
      send(ws,{type:"room_created",room:code});
    }

    else if(msg.type === "join"){
      joinRoom(ws, msg.room);
    }

    else if(msg.type === "state"){
      if(!ws.room) return;
      const room = rooms.get(ws.room);
      if(!room) return;

      room.lastState = msg;

      broadcast(room,{
        type:"state",
        snakes: msg.snakes,
        food: msg.food
      });
    }

    else if(msg.type === "leave"){
      leaveRoom(ws);
    }
  });

  ws.on("close",()=>{
    leaveRoom(ws);
  });
});

/* Heartbeat – remove dead connections */
setInterval(()=>{
  for(const ws of wss.clients){
    if(ws.isAlive === false){
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 15000);

console.log("🐍 Snake WebSocket server running on port", PORT);
