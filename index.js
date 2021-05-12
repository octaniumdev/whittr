/*
##      ## ##     ## #### ######## ######## ########  
##  ##  ## ##     ##  ##     ##       ##    ##     ## 
##  ##  ## ##     ##  ##     ##       ##    ##     ## 
##  ##  ## #########  ##     ##       ##    ########  
##  ##  ## ##     ##  ##     ##       ##    ##   ##   
##  ##  ## ##     ##  ##     ##       ##    ##    ##  
 ###  ###  ##     ## ####    ##       ##    ##     ## 
                by Cob:web Devlopment
*/
// See the LICENSE file for license information.

// Require modules.
const crypto = require("crypto"),
  express = require("express"),
  fs = require("fs"),
  sio = require("socket.io"),
  path = require("path"),
  http = require("http"),
  moment = require("moment");

// Define some constants.
const publicPath = path.join(__dirname, "/public");
const secret = crypto.randomBytes(41),
  aeshash = crypto.randomBytes(32),
  IV = crypto.randomBytes(16);

const opening = [
  "has entered the arena!",
  "is here to fight!",
  "is here to chew gum and fight crime!",
  "has stolen your pizza!",
  "just joined the chat, glhf!",
  "just joined, everyone pretend you're busy!",
  "joined your party.",
  "We have been expecting you ( ͡° ͜ʖ ͡°)",
  "has brought pizza!",
  "please leave your weapons by the door.",
  "has appeared.",
  "just slid into the chat ( ͡° ͜ʖ ͡°)",
  "has just landed.",
  "needs to be nerfed",
  "is here to slide into your DMs"
];

// Some helpers.
const isRealString = str => typeof str === "string" && str.trim().length > 0;
function generateMessage(from, text) {
  return {
    from,
    text,
    createdAt: moment().valueOf()
  };
}
const getRandomFromArray = a => a[Math.floor(Math.random() * a.length)];

// Create our app and server.
const app = express();
const server = http.createServer(app);
const io = sio(server);

// Serve the frontend files.
app.use(express.static(publicPath, { extensions: ["html"] }));
app.use(function (req, res, next) {
  res.sendFile(publicPath + "/404.html");
});

// Backend stuff begins.

// Crypto helpers.
function dehashenc(val, hash) {
  let cipher = crypto.createCipheriv("aes-256-cbc", aeshash, IV);
  let encrypted = cipher.update(val, "utf8", "base64");
  encrypted += cipher.final("base64");
  return encrypted;
}

function encrypt(val) {
  let cipher = crypto.createCipheriv("aes-256-cbc", aeshash, IV);
  let encrypted = cipher.update(val, "utf8", "base64");
  encrypted += cipher.final("base64");
  return encrypted;
}

function decrypt(encrypted) {
  let decipher = crypto.createDecipheriv("aes-256-cbc", aeshash, IV);
  let decrypted = decipher.update(encrypted, "base64", "utf8");
  return decrypted + decipher.final("utf8");
}

// Manages a list of connected users across the app.
class UsersModel {
  constructor() {
    this.users = [];
  }

  addUser(id, name, room) {
    this.users.push({
      id,
      name,
      room
    });
    return;
  }

  removeUser(id) {
    const user = this.getUser(id);
    if (user) {
      this.users = this.users.filter(user => user.id !== id);
    }
    return user;
  }

  getUser(id) {
    return this.users.filter(user => user.id === id)[0];
  }

  getUserList(room) {
    const users = this.users.filter(user => user.room === room);
    const namesArray = users.map(user => user.name);
    return namesArray;
  }
}

// Create a global UsersModel for users connected to the app.
let onlineUsers = new UsersModel();

io.on("connection", socket => {
  // Create a hashed version of the socket's id.
  const id = crypto
    .createHmac("sha512", secret)
    .update(socket.id)
    .digest("hex");

  socket.on("join", (req, res) => {
    // Vaildate the name and room pin.
    if (!isRealString(req.name) || !isRealString(req.room)) {
      return res("Name and room pin are required.");
    } else {
      if (req.name.length > 16) {
        return res("Name cannot be more than 16 characters.");
      } else {
        if (req.room.length > 8) {
          return res("Room pin cant be more than 8 digits.");
        } else {
          // Create a hashed room pin and join that.
          const room = crypto
            .createHmac("sha512", secret)
            .update(req.room)
            .digest("hex");
          socket.join(room);

          // Remove the user from the list of online users, and add them back with the correct room.
          onlineUsers.removeUser(id);
          onlineUsers.addUser(id, req.name, room);

          // Emit the updated online users list for the room to all users in the room.
          io.to(room).emit("updateUserList", onlineUsers.getUserList(room));
          // Send a welcome message to the user.
          socket.emit(
            "newMessage",
            generateMessage(
              "Server",
              `Welcome to Whittr, your room code is ${req.room}.`
            )
          );
          socket.emit("updateROOMID", `${req.room}`);
          // Send a "joined" message to all users in the room.
          const randomOpening = getRandomFromArray(opening);
          socket.broadcast
            .to(room)
            .emit(
              "newMessage",
              generateMessage(
                "Server - Welcome",
                `"${req.name}" ${randomOpening}`
              )
            );

          res();
        }
      }
    }
    return res("An error has occured.");
  });

  // When a message is sent in a room:
  socket.on("createMessage", (request, res) => {
    // Validate the message.
    if (request.text.length >= 200) {
      socket.emit(
        "newMessage",
        generateMessage(
          "Server",
          "Your message cannot be more then 200 characters."
        )
      );
    } else {
      var user = onlineUsers.getUser(id);
      if (user && isRealString(request.text)) {
        // TODO : What does this do? Comment.
        const req = dehashenc(`${request.text}`, `${aeshash}`);
        var reqraw = decrypt(req);
        // Send the unencrypted message to users in the room.
        io.to(user.room).emit(
          "newMessage",
          generateMessage(`${user.name}`, reqraw)
        );
      }
    }
    res();
  });

  socket.on("disconnect", () => {
    // Remove the disconnected users from the online users list.
    var user = onlineUsers.removeUser(id);
    if (user) {
      //
      io.to(user.room).emit(
        "updateUserList",
        onlineUsers.getUserList(user.room)
      );
      const leave = [
        "got grumpy and left.",
        "was done with this chat.",
        "did unspeakable things and had to leave...",
        "regrets not saying goodbye.",
        "has to apologise for something!",
        "stole your pizza and got away with it.",
        "is eating your pizza",
        "has stolen the princess!",
        "is a titan!",
        "is not ready for this groupchat just yet.",
        "is too full to eat anymore cake."
      ];
      const randomLeave = leave[Math.floor(Math.random() * leave.length)];
      io.to(user.room).emit(
        "newMessage",
        generateMessage("Server - Leave", `"${user.name}" ${randomLeave}`)
      );
    }
  });
});

const port = process.env.PORT || 3000;

server.listen(port, () => {
  console.log(`✨ Whittr is running on port ${port}!`);
});
