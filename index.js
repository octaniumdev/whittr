/*
Name: "Whittr",
Description: "Whittr is a free, privacy-centric and open source chatting web-application where no users are required to sign up, all you need to do is create a room and share the Pin with your friends to begin chatting!"
Version: "0.0.0"
Build: "0.0.0-Beta"
Owner: "Cob:web"
HTTPS: "TRUE"
.ENV: "TRUE"
*/

var crypto = require("crypto"),
    express = require("express"),
    fs = require("fs"),
    sio = require("socket.io"),
    moment = require('moment'),
http = require("http");

var app = express();
var server = http.createServer(app);
var io = sio(server)
var secret = crypto.randomBytes(41);
var aeshash = crypto.randomBytes(32);
var IV = crypto.randomBytes(16);

class UserID {
constructor () {
    this.users = [];
};

addUser (id, name, room, ip) {
    var user = {id, name, room, ip};
    this.users.push(user);
    return user;
};

removeUser (id) {
    var user = this.getUser(id);
    if (user) {
    this.users = this.users.filter((user) => user.id !== id);
    };
    return user;
};

getUser (id) {
    return this.users.filter((user) => user.id === id)[0]
};

getUserList (room) {
    var users = this.users.filter((user) => user.room === room);
    var namesArray = users.map((user) => user.name);
    return namesArray;
};
};
var users = new UserID();

var generateMessage = (from, text) => {
return {
    from,
    text,
    createdAt: moment().valueOf()
    };
};

var isRealString = (str) => {
    return typeof str === 'string' && str.trim().length > 0;
};

var dehashenc = ((val, hash) => {
    let cipher = crypto.createCipheriv("aes-256-cbc", aeshash, IV);
    let encrypted = cipher.update(val, "utf8", "base64");
    encrypted += cipher.final("base64");
    return encrypted;
});

var encrypt = ((val) => {
    let cipher = crypto.createCipheriv("aes-256-cbc", aeshash, IV);
    let encrypted = cipher.update(val, "utf8", "base64");
    encrypted += cipher.final("base64");
    return encrypted;
});
  
var decrypt = ((encrypted) => {
    let decipher = crypto.createDecipheriv("aes-256-cbc", aeshash, IV);
    let decrypted = decipher.update(encrypted, "base64", "utf8");
    return (decrypted + decipher.final("utf8"));
});

app.use(express.static("./public"));

io.on("connection", (socket) => {
var id = crypto.createHmac("sha512", secret).update(socket.id).digest("hex");
socket.on("join", (req, res) => {
    if (!isRealString(req.name) || !isRealString(req.room)) {
    return res("Name and room pin are required.");
    } else {
    if (req.name.length > 16) {
    return res("Name cannot be more than 16 characters.");
    } else {
    if (req.room.length > 8) {
    return res("Room pin cant be more than 8 digits.");
    } else {
    var room = crypto.createHmac("sha512", secret).update(req.room).digest("hex");
    socket.join(room);
    users.removeUser(id);
    users.addUser(id, req.name, room);
    io.to(room).emit("updateUserList", users.getUserList(room));
    socket.emit("newMessage", generateMessage("Server", "Welcome to Whittr!"));
    var opening = ["has entered the arena!", "is here to fight!", "is here to chew gum and fight crime!", "has stolen your pizza!", "just joined the chat, glhf!", "just joined, everyone pretend you're busy!", "joined your party.", "We have been expecting you ( ͡° ͜ʖ ͡°)", "has brought pizza!", "please leave your weapons by the door.", "has appeared.", "just slid into the chat ( ͡° ͜ʖ ͡°)", "has just landed.", "needs to be nerfed", "is here to slide into your DMs"];
    var randomOpening = opening[Math.floor(Math.random() * opening.length)];
    socket.broadcast.to(room).emit("newMessage", generateMessage("Server - Welcome", `"${req.name}" ${randomOpening}`));
    res();
    };
    };
    };
    return res("An error has occured.");
});

socket.on("createMessage", (request, res) => {
    if(request.text.length >= 256) {
        socket.emit("newMessage", generateMessage("Server", "Your message cannot be more then 256 characters."));
    } else {
    var user = users.getUser(id);
    if(user && isRealString(request.text)) {
    const req = dehashenc(`${request.text}`, `${aeshash}`);
    var reqraw = decrypt(req);
    io.to(user.room).emit("newMessage", generateMessage(`${user.name}`, reqraw));
    };
    };
    res();
});


socket.on("disconnect", () => {
    var user = users.removeUser(id);
    if (user) {
    io.to(user.room).emit("updateUserList", users.getUserList(user.room));
    const leave = ["got grumpy and left.", "was done with this chat.", "did unspeakable things and had to leave...", "regrets not saying goodbye.", "has to apologise for something!", "stole your pizza and got away with it.", "is eating your pizza", "has stolen the princess!", "is a titan!", "is not ready for this groupchat just yet.", "is too full to eat anymore cake."];
    const randomLeave = leave[Math.floor(Math.random() * leave.length)];
    io.to(user.room).emit("newMessage", generateMessage("Server - Leave", `"${user.name}" ${randomLeave}`));
    }
    });
});
const port = process.env.port || 3000
server.listen(3000, () => {
  console.log(`Server is up on 3000`);
});
