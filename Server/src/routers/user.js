const express = require("express");
const gravatar = require("gravatar");
const User = require("../models/user");
const auth = require("../middleware/auth");
const router = new express.Router();
const nodemailer = require("nodemailer");
const _ = require("lodash");
require("dotenv").config();
const multer = require("multer");
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

let code = undefined;
let un_email = null;
let ver_email = null;
let timer;

//Register new user (Test: Passed )
router.post("/user/register", async (req, res) => {
  try {
    let data = req.body;

    let avatar =
      "https://" +
      gravatar
        .url(data.email, {
          s: 400,
          r: "pg",
          d: "mm",
        })
        .slice(2);

    data = { ...data, avatar };
    const user = new User(data);
    await user.save();
    const token = await user.generateAuthToken();
    res.status(201).send({ user, token });
  } catch (e) {
    console.log(e.message);
    res.status(401).send(e);
  }
});

//send code on Email (Test: Passed )
router.post("/verify/email", auth, async (req, res) => {
  try {
    const email = req.user.email;

    const otp = Math.floor(Math.random() * 1000000);
    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.PROJECT_EMAIL_ADDRESS,
        pass: process.env.PROJECT_EMAIL_PASSWD,
      },
    });

    let mail = {
      from: process.env.PROJECT_EMAIL_ADDRESS,
      to: email,
      subject: "Email Verification Code",
      text: `Your InnerCircle verification code is, ${otp}. This code is only valid for 5 minutes`,
    };
    await transporter.sendMail(mail, (error, data) => {
      if (data) {
        code = String(otp);
        un_email = email;
      }
      if (error) {
        throw new Error(error);
      }
    });
    // timer = setTimeout(() => {
    //   code = undefined;
    // }, 5 * 60 * 100);
    await res.send(mail);
  } catch (e) {
    res.status(500).send(e);
  }
});

//match the code (Test: Passed )
router.post("/verify/code", auth, async (req, res) => {
  try {
    if (un_email === req.user.email) {
      console.log(code);
      if (code === req.body.otp) {
        ver_email = un_email;
        code = undefined;
        // if (timer) {
        //   clearTimeout(timer);
        // }
      } else {
        throw new Error("Wrong OTP");
      }
      if (code !== req.body.otp) {
      }
    } else {
      throw new Error(" User Mismatch ");
    }
    await res.status(200).send(ver_email);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

//Update Password (Test: Passed )
router.patch("/user/passwd", auth, async (req, res) => {
  try {
    // console.log(req.body.password);
    const new_passwd = req.body.password;
    const user = ver_email
      ? await User.findOne({ email: ver_email })
      : undefined;

    user["password"] = req.body["password"];

    await user.save();
    res.status(200).send(user);
  } catch (e) {
    res.status(400).send(e.message);
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

//Get User History (Test: Passed )
router.get("/user/history", auth, async (req, res) => {
  res.send(req.user.history);
});

//Update User Profile (Test: Passed )
router.patch("/users/me", auth, async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = ["name", "email", "avatar", "password"];
  const isValidOperation = updates.every((update) =>
    allowedUpdates.includes(update)
  );

  if (!isValidOperation) {
    return res.status(400).send({ error: "Invalid updates!" });
  }

  try {
    updates.forEach((update) => (req.user[update] = req.body[update]));
    await req.user.save();
    res.send(req.user);
  } catch (e) {
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
    //Remove Posts
    //Remove Bids
    //Remove Comments

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
    res.send(user);
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
