const path = require('path');
const http = require('http');
const express = require('express');
const socketIO = require('socket.io');
const crypto = require('crypto');

const {generateMessage, generateLocationMessage} = require('./utils/message');
const {isRealString} = require('./utils/validation');
const {Users} = require('./utils/users');

const publicPath = path.join(__dirname, '../public');
const port = process.env.PORT || 3000;
var app = express();
var server = http.createServer(app);
var io = socketIO(server);
var users = new Users();

app.use(express.static(publicPath));

io.on('connection', (socket) => {
console.log("A new user has joined Whittr!")
var socketsh = crypto.createHash('sha512').update(socket.id).digest('hex');

  socket.on('join', (params, callback) => {
    if (!isRealString(params.name) || !isRealString(params.room)) {
      return callback('Name and room name are required.');
    }

    if (params.name.length > 16) {
      return callback('Name cannot be more than 16 characters.');
    }

    var roomsh = crypto.createHash('sha512').update(params.room).digest('hex');
    socket.join(roomsh);
    users.removeUser(socketsh);
    console.log(socketsh);
    console.log(socketsh);
    users.addUser(socketsh, params.name, roomsh);
    io.to(roomsh).emit('updateUserList', users.getUserList(roomsh));
    socket.emit('newMessage', generateMessage('Server', 'Welcome to Whittr!'));
    const opening = ["has entered the arena!", "is here to fight!", "is here to chew gum and fight crime!", "has stolen your pizza!", "just joined the chat, glhf!", "just joined, everyone pretend you're busy!", "joined your party.", "We have been expecting you ( ͡° ͜ʖ ͡°)", "has brought pizza!", "please leave your weapons by the door.", "has appeared.", "just slid into the chat ( ͡° ͜ʖ ͡°)", "has just landed.", "needs to be nerfed", "is here to slide into your DMs"];
    const randomOpening = opening[Math.floor(Math.random() * opening.length)];
    socket.broadcast.to(roomsh).emit('newMessage', generateMessage('Server - Welcome', `"${params.name}" ${randomOpening}`));
    callback();
  });

  socket.on('createMessage', (message, callback) => {
    var user = users.getUser(socketsh);
    if (user && isRealString(message.text)) {
      io.to(user.room).emit('newMessage', generateMessage(user.name, message.text));
    }
    callback();
  });

  socket.on('disconnect', () => {
    var user = users.removeUser(socketsh);

    if (user) {
      io.to(user.room).emit('updateUserList', users.getUserList(user.room));
      
      const leave = ["got grumpy and left.", "was done with this chat.", "did unspeakable things and had to leave...", "regrets not saying goodbye.", "has to apologise for something!", "stole your pizza and got away with it.", "is eating your pizza", "has stolen the princess!", "is a titan!", "is not ready for this groupchat just yet.", "is too full to eat anymore cake."];
    const randomLeave = leave[Math.floor(Math.random() * leave.length)];
      io.to(user.room).emit('newMessage', generateMessage('Server - Leave', `"${user.name}" ${randomLeave}`));
    }
  });
});

server.listen(port, () => {
  console.log(`Server is up on ${port}`);
});
