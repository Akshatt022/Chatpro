const express = require('express');
const path = require('path');
const app = express();
const IndexRouter = require('./router/IndexRouter')

// Handling socket.io 
const http = require('http');
const SocketIO = require('socket.io');
const server = http.createServer(app);
const io = SocketIO(server);

let waitinguser = [];
let rooms = {};
let userRooms = {}; // Track which room each user is in
let activeCallsInRoom = {}; // Track active call states per room

io.on("connection", (socket) => {
 

  // Handle user joining the room
  socket.on("joinroom", () => {
    if (waitinguser.length > 0) {
      // Pair the current user with the waiting user
      let partner = waitinguser.shift();
      const roomname = `${socket.id}-${partner.id}`;
      console.log("A room connected: ", roomname);

      // Join both users to the room
      socket.join(roomname);
      partner.join(roomname);

      // Track which room each user is in
      userRooms[socket.id] = roomname;
      userRooms[partner.id] = roomname;

      // Notify both users they have joined
      io.to(roomname).emit("joined", roomname);
    } else {
      // If no one is waiting, add the user to the waiting list
      waitinguser.push(socket);
    }
  });

  // Handle messages
  socket.on("message", (data) => {
    socket.broadcast.to(data.room).emit("message", data.message);
  });

  // Handling signaling message
  socket.on("signalingMessage",(data)=>{
    socket.broadcast.to(data.room).emit("signalingMessage",data.message);
  })
  // Handling the starting of the video call
  socket.on("startVideoCall",({room})=>{
    activeCallsInRoom[room] = 'pending';
    socket.broadcast.to(room).emit("IncomingCall");
  })
  socket.on("rejectedCall",({room})=>{
    delete activeCallsInRoom[room];
    socket.broadcast.to(room).emit("CallRejected");
  })
  
  // Handle call cancellation
  socket.on("cancelCall",({room})=>{
    delete activeCallsInRoom[room];
    socket.broadcast.to(room).emit("CallCancelled");
  })
  
// Handling the accept call 
  socket.on("acceptCall",({room})=>{
    // Only allow accept if call is still pending
    if (activeCallsInRoom[room] === 'pending') {
      activeCallsInRoom[room] = 'active';
      socket.broadcast.to(room).emit("CallAccepted");
    } else {
      // Call was cancelled or already active
      socket.emit("CallCancelled");
    }
  })
  
  // Handle manual room leaving
  socket.on("leaveRoom", ({ room }) => {
    console.log("User leaving room manually:", socket.id, "from room:", room);
    
    // Notify partner about disconnection
    socket.to(room).emit("partnerDisconnected");
    
    // Leave the room
    socket.leave(room);
    
    // Clean up room tracking
    delete userRooms[socket.id];
    
    // Remove partner's room tracking
    Object.keys(userRooms).forEach(userId => {
      if (userRooms[userId] === room && userId !== socket.id) {
        delete userRooms[userId];
      }
    });
  });
  
  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("User disconnected: ", socket.id);

    // Remove from waiting list if user was waiting
    let index = waitinguser.findIndex((waituser) => waituser.id == socket.id);
    if (index !== -1) {
      waitinguser.splice(index, 1);
    }

    // Check if user was in a room
    const roomName = userRooms[socket.id];
    if (roomName) {
      console.log("User was in room:", roomName);
      // Notify other users in the room about disconnection
      socket.to(roomName).emit("partnerDisconnected");
      
      // Clean up room tracking
      delete userRooms[socket.id];
      delete activeCallsInRoom[roomName]; // Clean up call state
      
      // Remove partner's room tracking if they're the only one left
      Object.keys(userRooms).forEach(userId => {
        if (userRooms[userId] === roomName && userId !== socket.id) {
          // Partner is still in the room, but now alone
          setTimeout(() => {
            // Clean up after a delay to ensure message is sent
            if (userRooms[userId] === roomName) {
              delete userRooms[userId];
            }
          }, 1000);
        }
      });
    }
  });
});


app.set("view engine","ejs");
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(express.static(path.join(__dirname, "public")));

app.use('/',IndexRouter);

server.listen(3000);