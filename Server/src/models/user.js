const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Product = require("./product");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      lowercase: true,
      validate(value) {
        if (!validator.isEmail(value)) {
          throw new Error("Email is invalid");
        }
      },
    },
    avatar: {
      type: String,
    },
    notifications: [
      {
        seen: { type: Boolean, default: false },
        message: String,
      },
    ],

    username: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      trim: true,
      validate(value) {
        if (value.toLowerCase().includes("password")) {
          throw new Error('Password cannot contain "password"');
        }
      },
    },
    history: [
      {
        act: { type: String },
        itemID: {
          type: mongoose.Schema.Types.ObjectId,

          ref: "Product",
        },
        description: {
          type: String,

          trim: true,
        },
        name: {
          type: String,
        },
        value: {
          type: Number,
        },
        model: {
          type: String,

          trim: true,
        },
        catagory: {
          type: String,

          trim: true,
        },
        from: {
          type: Date,
        },
        to: {
          type: Date,
        },
        duration: {
          type: Number,
        },
        image: {
          data: Buffer,
          contentType: String,
        },
        user2: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
    friendRequest: [
      {
        type: String,
        required: true,
      },
    ],
    sentFriendRequest: [
      {
        type: String,
        required: true,
      },
    ],
    circle: [
      {
        type: String,
        required: true,
      },
    ],
    recommandation: [
      {
        product: {
          type: String,
          required: true,
        },
        recommandedby: [
          {
            type: String,
            required: true,
          },
        ],
      },
    ],
    tokens: [
      {
        token: {
          type: String,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

userSchema.methods.toJSON = function () {
  const user = this;
  const userObject = user.toObject();

  delete userObject.password;
  delete userObject.tokens;

  return userObject;
};

userSchema.methods.generateAuthToken = async function () {
  const user = this;
  const token = jwt.sign({ _id: user._id.toString() }, "firstDemoProject");

  user.tokens = user.tokens.concat({ token });
  await user.save();

  return token;
};

userSchema.statics.findByCredentials = async (email, password) => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new Error("Unable to login");
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw new Error("Unable to login");
  }

  return user;
};

// Hash the plain text password before saving
userSchema.pre("save", async function (next) {
  const user = this;

  if (user.isModified("password")) {
    user.password = await bcrypt.hash(user.password, 8);
  }
  user.username = user.username.split(" ").join("");

  user.name = user.name.toLowerCase();

  next();
});

// Delete user tasks when user is removed
userSchema.pre("remove", async function (next) {
  const user = this;
  await Product.deleteMany({ owner: user._id });
  next();
});

const User = mongoose.model("User", userSchema);

module.exports = User;
