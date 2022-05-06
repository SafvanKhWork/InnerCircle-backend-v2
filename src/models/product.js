const mongoose = require("mongoose");
const User = require("./user");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    product_name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    model: {
      type: String,
      default: "MTY",
      trim: true,
    },
    catagory: {
      type: String,
      required: true,
      trim: true,
      ref: "Catagory",
    },
    images: [
      {
        type: String,
      },
    ],
    description: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
    },
    quantity: {
      type: Number,
      default: 1,
    },
    like: [
      {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "User",
      },
    ],
    likes: {
      type: Number,
    },
    bids: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        bid: {
          type: Number,
          required: true,
        },
      },
    ],
    comments: [
      {
        user: { type: String },
        value: { type: String },
      },
    ],
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

productSchema.pre("save", async function (next) {
  const product = this;

  product.product_name = await product.product_name
    .split(" ")
    .join("_")
    .toLowerCase();

  next();
});

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
