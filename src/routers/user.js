const express = require("express");
const gravatar = require("gravatar");
const User = require("../models/user");
const Product = require("../models/product");
const Feedback = require("../models/feedback");
const Catagory = require("../models/catagory");
const auth = require("../middleware/auth");
const router = new express.Router();
const nodemailer = require("nodemailer");
var randomstring = require("randomstring");
const _ = require("lodash");
require("dotenv").config();
const multer = require("multer");
const { cloudinary } = require("../utils/cloudinary");
const uploadDestination = "../uploads/";
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDestination);
  },
  filename: function (req, file, cb) {
    cb(null, new Date().toISOString() + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  cb(null, file.mimetype === "image/jpeg" || file.mimetype === "image/png");
};

const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 10,
  },
  fileFilter,
});

const transporter = nodemailer.createTransport({
  host: "smtp.mailtrap.io",
  port: 2525,
  auth: {
    user: "1f589ade6c75ab",
    pass: "9eac1c4858e791",
  },
});

//Register new user (Test: Passed )
router.post("/user/register", async (req, res) => {
  try {
    let data = req.body;

    const password = randomstring.generate(12);
    const username = data.name.split(" ").join("") + String(Date.now());
    let avatar =
      "https://" +
      gravatar
        .url(data.email, {
          s: 400,
          r: "pg",
          d: "mm",
        })
        .slice(2);
    data = { ...data, avatar, password, username, admin: false };
    const user = new User(data);
    await user.save();

    let mail = {
      from: process.env.PROJECT_EMAIL_ADDRESS,
      to: data.email,
      subject: "Welcome to InnerCircle.",
      text: `Your InnerCircle Account was created successfully with temporary username and password, please change these once you login. You can login using following credentials: [email: ${data.email}, password: ${password}].`,
    };
    await transporter.sendMail(mail, (error, data) => {});
    console.log({ password });
    res.status(201).send(user);
  } catch (e) {
    console.log({ error: e.message });
    res.status(400).send(e);
  }
});

//DashBoard
router.get("/admin/dash", auth, async (req, res) => {
  try {
    if (!req.user.admin) {
      res.status(404).send({});
    }
    const users = await User.find({});
    const products = await Product.find({}).populate("owner");
    const feedbacks = await Feedback.find({});
    const catagories = await Catagory.find({});

    res.status(200).send({
      users,
      products,
      feedbacks,
      catagories,
      counts: {
        users: users.length,
        products: products.length,
        feedbacks: feedbacks.length,
        catagories: catagories.length,
      },
    });
  } catch (error) {
    console.log(error.message);
    res.status(400).send(error.message);
  }
});

//Admin Edit
router.patch("/admin/type/:id", auth, async (req, res) => {
  try {
    if (!req.user.admin) {
      res.status(404).send({ error: "Access Denied!" });
    }
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).send({ error: "User Not Found" });
    }
    user.admin = !user.admin;
    await user.save();
    res.status(200).send(user);
  } catch (e) {
    console.log(e.message);
    res.status(400).send(e);
  }
});
//Admin Delete
router.delete("/admin/users/:id", auth, async (req, res) => {
  if (!req.user.admin) {
    res.status(404).send({});
  }
  const itemuser = await User.findById(req.params.id);
  try {
    //Remove from Circle
    console.log(itemuser.circle);
    itemuser.circle.forEach(async (username) => {
      const user = await User.findOne({ username });
      const present = user?.circle.findIndex(
        (friend) => friend == itemuser.username
      );
      if (present !== -1) {
        user.circle.splice(present, 1);
        user.save();
      }
    });

    //Remove from friendRequest
    itemuser.friendRequest.forEach(async (username) => {
      const user = await User.findOne({ username });
      const present = user?.friendRequest?.findIndex(
        (friend) => friend === itemuser.username
      );
      if (present !== -1) {
        user?.friendRequest?.splice(present, 1);
        user.save();
      }
    });

    //Remove from sentFriendRequest
    itemuser.sentFriendRequest.forEach(async (username) => {
      const user = await User.findOne({ username });
      const present = user?.sentFriendRequest?.findIndex(
        (friend) => friend == itemuser?.username
      );
      if (present !== -1) {
        user?.sentFriendRequest?.splice(present, 1);
        user.save();
      }
    });
    const avatarId = itemuser.avatar
      .split("/")
      .slice(-2)
      .join("/")
      .split(".")
      .slice(-4, -1)
      .join(".");
    if (avatarId) {
      await cloudinary.v2.uploader.destroy(avatarId);
    }
    await itemuser.remove();
    res.send(itemuser);
  } catch (e) {
    console.log(e.message);
    res.status(500).send();
  }
});

//Forgot Password on Email (Test: Passed )
router.post("/verify/email", async (req, res) => {
  try {
    const email = req.body.email;

    const user = (await User.findOne({ email })) || {};

    const tempPasswd = randomstring.generate(12);
    user["password"] = tempPasswd;
    await user.save();

    let mail = {
      from: process.env.PROJECT_EMAIL_ADDRESS,
      to: email,
      subject: "Verification Email for your InnerCircle Account.",
      text: `Your Temporary InnerCircle Password is, ${tempPasswd}. please change this password once you login.`,
    };
    await transporter.sendMail(mail, (error, data) => {});
    console.log({ tempPasswd });
    await res.send(mail);
  } catch (e) {
    console.log(e.message);
    res.status(500).send(e);
  }
});

//Admin Change Email
router.post("/admin/query/:id", auth, async (req, res) => {
  try {
    if (!req.user.admin) {
      res.status(404).send({});
    }
    const email = req.body.email;
    const user = await User.findById(req.params.id);
    user.email = email;
    const tempPasswd = randomstring.generate(12);
    user["password"] = tempPasswd;
    await user.save();

    let mail = {
      from: process.env.PROJECT_EMAIL_ADDRESS,
      to: email,
      subject: "Email Changed in your InnerCircle Account.",
      text: `Hii ${user.name}, Email address associated with your InnerCircle Account (@${user.username}) was changed to ${email}, your Temporery Password is ${tempPasswd}. please change this password once you login.`,
    };
    await transporter.sendMail(mail, (error, data) => {});
    user.tokens = [];
    await user.save();
    console.log({ tempPasswd });
    await res.send(mail);
  } catch (e) {
    console.log(e.message);
    res.status(500).send(e);
  }
});

//Login User (Test: Passed )
router.post("/user/login", async (req, res) => {
  try {
    const user = await User.findByCredentials(
      req.body.email,
      req.body.password
    );
    const token = await user.generateAuthToken();
    res.send({ user, token });
  } catch (e) {
    res.status(400).send(e.message);
  }
});

//Google login
router.post("/google", async (req, res) => {
  try {
    let user0 = await User.find({ email: req.body.email });
    let user = user0.length !== 0 ? user0[0] : undefined;
    let token;
    if (user) {
      token = await user.generateAuthToken();
    } else {
      let data = req.body;
      const password = randomstring.generate(12);
      const username = data.name.split(" ").join("") + String(Date.now());
      data = {
        email: data.email,
        avatar: data.imageUrl,
        name: data.name,
        password,
        username,
        admin: false,
      };
      user = new User(data);
      token = await user.generateAuthToken();
    }

    res.send({ user, token });
  } catch (e) {
    res.status(400).send(e.message);
  }
});

//Logout User (Test: Passed )
router.post("/user/logout", auth, async (req, res) => {
  try {
    req.user.tokens = req.user.tokens.filter((token) => {
      return token.token !== req.token;
    });
    await req.user.save();
    res.status(200).send();
  } catch (e) {
    res.status(500).send(e.message);
  }
});

//Hard Logout (Test: Passed )
router.post("/users/logout/all", auth, async (req, res) => {
  try {
    req.user.tokens = [];
    await req.user.save();
    res.send(req.user.tokens);
  } catch (e) {
    res.status(500).send();
  }
});

//current devices (Test: Passed )
router.get("/me/current", auth, async (req, res) => {
  try {
    res.send(`Currently LoggedIn in ${req.user.tokens.length} device(s).`);
  } catch (e) {
    res.status(500).send();
  }
});

//Mark All Notifications as Seen
router.patch("/user/notifications/seen", auth, async (req, res) => {
  try {
    req.user.notifications = req.user.notifications.map((notification) => {
      notification.seen = true;
      return notification;
    });

    req.user.save();
    res.send(req.user.notifications);
  } catch (error) {
    console.log(error.message);
  }
});

//Get User Profile (Test: Passed )
router.get("/user/me", auth, async (req, res) => {
  try {
    res.send(req.user);
  } catch (error) {
    console.log(error.message);
  }
});

router.get("/", async (req, res) => {
  try {
    res.send({ message: "Welcome to InnerCircle." });
  } catch (error) {
    console.log(error.message);
  }
});
//Get User History (Test: Passed )
router.get("/user/history", auth, async (req, res) => {
  res.send(req.user.history);
});

//Update User Profile (Test: Passed )
router.patch("/users/me", auth, async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = ["name", "username", "avatar", "password"];
  const isValidOperation = updates.every((update) =>
    allowedUpdates.includes(update)
  );

  if (!isValidOperation) {
    return res.status(403).send({ error: "Invalid updates!" });
  }

  try {
    updates.forEach((update) => (req.user[update] = req.body[update]));
    await req.user.save();
    res.send(req.user);
  } catch (e) {
    console.log(e.message);
    res.status(400).send(e);
  }
});

//Remove Friend (Test: Passed)
router.delete("/unfriend/:uname", auth, async (req, res) => {
  try {
    const username = req.params.uname;
    const friend = await User.findOne({ username });
    const present = req.user.circle.findIndex((friend) => friend == username);
    const presentFriend = friend.circle.findIndex(
      (friend) => friend == req.user.username
    );
    if (present !== -1) {
      req.user.circle.splice(present, 1);
      req.user.save();
    }
    if (presentFriend !== -1) {
      friend.circle.splice(presentFriend, 1);
      friend.save();
    }
    res.send(req.user.circle);
  } catch (e) {
    res.status(400).send(e);
  }
});

//Delete User (Test: Passed )
router.delete("/users/me", auth, async (req, res) => {
  try {
    //Remove from Circle
    req.user.circle.forEach(async (username) => {
      const user = await User.findOne({ username });
      const present = user.circle.findIndex(
        (friend) => friend == req.user.username
      );
      if (present !== -1) {
        user.circle.splice(present, 1);
        user.save();
      }
    });

    //Remove from friendRequest
    req.user.friendRequest.forEach(async (username) => {
      const user = await User.findOne({ username });
      const present = user.friendRequest.findIndex(
        (friend) => friend === req.user.username
      );
      if (present !== -1) {
        user.friendRequest.splice(present, 1);
        user.save();
      }
    });

    //Remove from sentFriendRequest
    req.user.sentFriendRequest.forEach(async (username) => {
      const user = await User.findOne({ username });
      const present = user.sentFriendRequest.findIndex(
        (friend) => friend == req.user.username
      );
      if (present !== -1) {
        user.sentFriendRequest.splice(present, 1);
        user.save();
      }
    });
    const avatarId = req.user.avatar
      .split("/")
      .slice(-2)
      .join("/")
      .split(".")
      .slice(-4, -1)
      .join(".");
    await cloudinary.v2.uploader.destroy(avatarId);
    await req.user.remove();
    res.send(req.user);
  } catch (e) {
    res.status(500).send();
  }
});

//Get User by ID (Test: Passed )
router.get("/user/id/:id", auth, async (req, res) => {
  const _id = req.params.id;

  try {
    const user = await User.findOne({ _id });
    if (!user) {
      return res.status(404).send();
    }
    res.status(200).send(user);
  } catch (e) {
    res.status(500).send();
  }
});

//Add Friend (Test: Passed)
router.post("/add-friend/:uname", auth, async (req, res) => {
  const username = req.params.uname;

  try {
    const user = await User.findOne({ username });
    if (
      !user ||
      user.username === req.user.username ||
      req.user.circle.includes(user.username) ||
      req.user.sentFriendRequest.includes(user.username)
    ) {
      return res.status(404).send();
    }
    user.friendRequest.push(req.user.username);
    user.friendRequest = [...new Set(user.friendRequest)];
    req.user.sentFriendRequest.push(user.username);
    req.user.sentFriendRequest = [...new Set(req.user.sentFriendRequest)];
    user.save();
    req.user.save();
    res.status(200).send(req.user.sentFriendRequest);
  } catch (e) {
    res.status(500).send();
  }
});

//Accept friendRequest (Test: Passed)
router.patch("/accept-friend-request/:uname", auth, async (req, res) => {
  const username = req.params.uname;

  try {
    const user = await User.findOne({ username }); //find sender

    if (!user) {
      return res.status(404).send();
    }

    const atRequest = req.user.friendRequest.indexOf(username); //find sender in users req-list
    const atSent = user.sentFriendRequest.indexOf(req.user.username); // find user in sender sent-req-list

    if (atRequest !== -1 && atSent !== -1) {
      req.user.friendRequest.splice(atRequest, 1); //User
      user.sentFriendRequest.splice(atSent, 1); //Sender
      user.circle.push(req.user.username); // add in senders circle
      user.circle = [...new Set(user.circle)]; //remove repitations at sender
      req.user.circle.push(user.username); // add in user circle
      req.user.circle = [...new Set(req.user.circle)]; //remove repitations at user
      req.user.save();
      user.save();
    }

    res.status(200).send(req.user.circle);
  } catch (e) {
    res.status(500).send();
  }
});

//Reject Friend Request (Test: Passed)
router.delete("/reject-friend-request/:uname", auth, async (req, res) => {
  try {
    const username = req.params.uname;
    const user = await User.findOne({ username });
    const present = req.user.friendRequest.findIndex(
      (friend) => friend == username
    );
    console.log(username);
    if (present !== -1) {
      req.user.friendRequest.splice(present, 1);
      req.user.save();
    }

    if (user !== null) {
      const presentAt = user.sentFriendRequest.findIndex(
        (friend) => friend == req.user.username
      );
      if (presentAt !== -1) {
        user.sentFriendRequest.splice(present, 1);
        user.save();
      }
    }

    res.send(req.user.friendRequest);
  } catch (error) {
    res.status(404).send(error.message);
  }
});

//Get CIRCLE (Test: Passed)
router.get("/account/:field", auth, async (req, res) => {
  try {
    const field = req.params.field;
    const user = req.user;
    const value = user[field];
    res.status(200).send(value);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

//Get User By Username (Test: Passed)
router.get("/user/:uname", async (req, res) => {
  const username = req.params.uname;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      throw new Error("user not found");
    }
    res.send(user);
  } catch (e) {
    res.status(404).send();
  }
});

// Search by Name (Test: Passed)
router.get("/search/user/:query", async (req, res) => {
  const query = new RegExp(req.params.query.toLowerCase());
  const objID = [];
  try {
    let users = [
      ...(await User.find({ name: query })),
      ...(await User.find({ username: query })),
    ];
    users = users.filter((user) => {
      if (objID.includes(user.username)) {
        return false;
      }
      if (!objID.includes(user.username)) {
        objID.push(user.username);
        return true;
      }
    });
    users = users.map((user) => user.username);
    res.status(200).send(users);
  } catch (e) {
    res.status(400).send(e);
  }
});

module.exports = router;
