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
    socket.broadcast.to(room).emit("IncomingCall");
  })
  socket.on("rejectedCall",({room})=>{
    socket.broadcast.to(room).emit("CallRejected");
  })
// Handling the accept call 
  socket.on("acceptCall",({room})=>{
    socket.broadcast.to(room).emit("CallAccepted");
  })
  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("User disconnected: ", socket.id);

    // Remove from waiting list if user was waiting
    let index = waitinguser.findIndex((waituser) => waituser.id == socket.id);
    if (index !== -1) {
      waitinguser.splice(index, 1);
    }
  });
});


app.set("view engine","ejs");
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(express.static(path.join(__dirname, "public")));

app.use('/',IndexRouter);

server.listen(3000);