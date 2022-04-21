const express = require("express");
const { removeAllMatching } = require("array-of-objects-functions");
const router = new express.Router();
const { cloudinary } = require("../utils/cloudinary");
const path = require("path");
const { ObjectID } = require("mongodb");
const multer = require("multer");
const Product = require("../models/product");
const Catagory = require("../models/catagory");
const User = require("../models/user");
const auth = require("../middleware/auth");
const { Console } = require("console");
const { findById } = require("../models/user");
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

// add images to product (Test: Passed)
router.post(
  "/:id/add-image",
  auth,
  upload.single("image"),
  async (req, res) => {
    // req.params.id
    // req.file.path
    try {
      const product = await Product.findById(req.params.id);
      if (
        String(req.user._id) === String(product?.owner) &&
        req.file.path != null
      ) {
        await product.images.push(req.file.path.slice(2));
        await product.save();
      }
      product.images = product.images.filter(
        (image) => image !== null || image !== undefined
      );
      await product.save();
      res.status(201).send(product);
    } catch (e) {
      res.status(400).send(e);
    }
  }
);

//upload image on cloudanary
// router.post("/product-image", auth, async (req, res) => {
//   try {
//     const fileStr = req.body.data;
//     const uploadedResponse = await cloudinary.uploader.upload(fileStr, {
//       upload_preset: "ml_default",
//     });
//     res.status(200).send(fileStr);
//   } catch (error) {
//     console.log("Error Uploading Image on Cloudinary", error.message);
//     res.status(400).send(error.message);
//   }
// });

//add new product (Test: Passed)

// router.post("/product/new", auth, upload.single("image"), async (req, res) => {
//   try {
//     const product = new Product({
//       ...req.body,
//       product_name: `at${Date.now()}by${req.user.username}`.split(" ").join(""),
//       owner: req.user._id,
//       images:
//         req.file?.path &&
//         req.file?.path !== null &&
//         req.file?.path === undefined
//           ? [req.file?.path.slice(2)]
//           : [],
//     });

//     await product.save();
//     res.status(201).send(product);
//   } catch (e) {
//     res.status(401).send(e);
//   }
// });

router.post("/product/new", auth, upload.single("image"), async (req, res) => {
  try {
    const product = new Product({
      ...req.body,
      product_name: `at${Date.now()}by${req.user.username}`.split(" ").join(""),
      owner: req.user._id,
      images: req.file?.path ? [req.file?.path.slice(2)] : [],
    });

    Catagory.exists({ name: req.body.name }, function (e) {
      if (e) {
        throw new Error(e);
      }
    });
    product.save();
    res.status(201).send(product);
  } catch (e) {
    res.status(400).send(e);
  }
});

//get all products (Test: Passed)
router.get("/products", async (req, res) => {
  try {
    const product = await Product.find({}).populate("owner");
    res.send(product.sort((a, b) => b.createdAt - a.createdAt));
  } catch (e) {
    res.status(500).send();
  }
});

//get most liked products (Test: Passed)
router.get("/products/popular", auth, async (req, res) => {
  try {
    const product = await Product.find({}).sort({ likes: -1 });
    res.send(product);
  } catch (e) {
    res.status(500).send();
  }
});

//get recent products (Test: Passed)
router.get("/products/recent", async (req, res) => {
  try {
    const product = await Product.find({}).sort({ createdAt: -1 });
    res.send(product);
  } catch (e) {
    res.status(500).send();
  }
});

//Recommand the Product (Test: Passed)
router.patch("/recommand", auth, async (req, res) => {
  let visited = false;
  try {
    const product = await Product.findById(req.body.product);
    const user = await User.findById(req.body.user);

    if (!product || !user) {
      throw new Error("Some Thing Went Wrong!");
    }
    const recommandation = user.recommandation;

    recommandation.forEach((element) => {
      if (String(element.product) === String(product.product_name)) {
        element.recommandedby.push(req.user.username);
        element.recommandedby = [...new Set(element.recommandedby)];
        visited = true;
      }
    });

    if (!visited) {
      const obj = {};
      obj["product"] = product.product_name;
      obj["recommandedby"] = [];

      obj.recommandedby.push(req.user.username);
      recommandation.push(obj);
    }
    user.save();

    res.status(201).send(user);
  } catch (e) {
    res.status(400).send(e.message);
  }
});

//get all product with given type (Test: Passed)
router.get("/products/catagory/:catagory", async (req, res) => {
  try {
    const catagory = req.params.catagory;
    const product = await Product.find({ catagory });

    res.send(product);
  } catch (e) {
    res.status(500).send();
  }
});

//Get By OwnerId (Test: Passed)
router.get("/products/owner/:user", async (req, res) => {
  try {
    const _id = req.params.user;
    const products = await Product.find({});
    const prods = products.filter((el) => String(el.owner) === String(_id));
    res.send(prods);
  } catch (e) {
    res.status(500).send();
  }
});

//fetch Posts from friends (Work in Progress)
router.get("/feed", auth, async (req, res) => {
  let feed = [];
  try {
    if (req.user.circle.length !== 0) {
      await req.user.circle.forEach(async (friend, i) => {
        const products = await Product.find({}).populate("owner");
        const posts = await products.filter(
          (product) => product.owner.username === friend
        );
        feed.push(...posts);
        if (req.user.circle.length === i + 1) {
          const postFeed = [...feed].sort((a, b) => b.createdAt - a.createdAt);
          res.status(200).send(postFeed);
        }
        // else {
        //   res.status(200).send([]);
        // }
      });
    } else {
      res.status(200).send([]);
    }
  } catch (error) {
    res.status(400).send(error.message);
  }
});

//Get Recommanded product (Test: Passed)~~~~
router.get("/recommanded", auth, async (req, res) => {
  try {
    const user = req.user;
    const recommanders = {};
    const promises = await user.recommandation.map(async (item) => {
      const product = await Product.findOne({
        product_name: item.product,
      }).populate("owner");
      recommanders[item.product] = item.recommandedby;
      return product;
    });
    const resolved = await Promise.all(promises);
    res.status(200).send([resolved.filter((item) => item), recommanders]);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

//get all product with same modal number (Test: Passed)
router.get("/products/model/:model", async (req, res) => {
  try {
    const model = req.params.model;
    const product = await Product.find({ model }).populate("owner");
    res.send(product);
  } catch (e) {
    res.status(500).send();
  }
});

// get products by id (Test: Passed)
router.get("/products/id/:id", async (req, res) => {
  const _id = req.params.id;

  try {
    const product = await Product.findOne({ _id }).populate("owner");

    if (!product) {
      return res.status(404).send();
    }

    res.send(product);
  } catch (e) {
    res.status(500).send();
  }
});

//Get product by given product_name (Test: Passed)
router.get("/product/:product", async (req, res) => {
  const product_name = req.params.product;

  try {
    const product = await Product.findOne({ product_name }).populate("owner");

    if (!product) {
      return res.status(404).send();
    }

    res.send(product);
  } catch (e) {
    res.status(500).send();
  }
});

//Update the product with given id (Test: Passed)
router.patch("/products/:id", auth, async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = ["description", "name"];
  const isValidOperation = updates.every((update) =>
    allowedUpdates.includes(update)
  );

  if (!isValidOperation) {
    return res.status(400).send({ Error: "Invalid updates!" });
  }
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!product) {
      return res.status(404).send();
    }

    updates.forEach((update) => (product[update] = req.body[update]));
    await product.save();
    res.send(product);
  } catch (e) {
    res.status(400).send(e);
  }
});

//Like the product (Test: Passed)
router.patch("/like/:id", auth, async (req, res) => {
  const _id = req.params.id;
  try {
    const product = await Product.findOne({
      _id,
    });
    if (!product) {
      return res.status(404).send();
    }
    const owner = await User.findById(product.owner);
    const lk = product.like;

    const ur = req.user;
    if (lk.includes(req.user._id)) {
      const present = lk.findIndex((like) => String(like) == String(ur._id));
      if (present !== -1) {
        lk.splice(present, 1);
      }
      if (owner) {
        owner.notifications = await removeAllMatching(
          owner.notifications,
          "message",
          `@${req.user.username} liked your post with title '${product.name}'.`
        );
      }
    } else {
      lk.push({ _id: ur._id });
      if (owner) {
        owner.notifications.push({
          message: `@${req.user.username} liked your post with title '${product.name}'.`,
        });
      }
    }

    product.like = lk;
    product.likes = lk.length;
    await owner.save();
    await product.save();
    res.send(product.like);
  } catch (e) {
    res.status(400).send(e);
  }
});

// Bid on product (Test: Passed)
router.patch("/bid/:id", auth, async (req, res) => {
  const _id = req.params.id;
  let exists = false;
  try {
    const product = await Product.findOne({
      _id,
    });

    if (!product) {
      return res.status(404).send();
    }
    const owner = await User.findById(product.owner);
    const bids = product.bids;
    const bid = {
      user: req.user._id,
      bid: req.body.bid,
    };

    bids.forEach((el, index) => {
      if (String(el.user) === String(bid.user)) {
        if (owner) {
          owner.notifications.push({
            message: `@${req.user.username} changed their offer of Rs.${el.bid} to Rs.${bid.bid} for product you posted with title '${product.name}'. `,
          });
        }
        el.bid = bid.bid;
        exists = true;
      }
    });

    if (!exists) {
      product.bids.push(bid);
      if (owner) {
        owner.notifications.push({
          message: `@${req.user.username} offered Rs.${bid.bid} for product you posted with title '${product.name}'. `,
        });
      }
    }
    await product.save();
    await owner.save();
    res.send(product.bids);
  } catch (e) {
    res.status(400).send(e.message);
  }
});

//Comment on product (Test: Passed)
router.patch("/comment/:product", auth, async (req, res) => {
  const _id = req.params.product;

  try {
    const product = await Product.findById(_id);

    if (!product) {
      return res.status(404).send();
    }
    const cm = product.comments;
    const ur = req.user;
    cm.push({
      user: ur.username,
      value: req.body.value,
    });
    const owner = await User.findById(product.owner);
    if (owner) {
      owner.notifications.push({
        message: `@${req.user.username} commented '${req.body.value}' on your post with title '${product.name}'. `,
      });
    }
    product.comments = cm;
    await product.save();
    await owner.save();
    res.send(product);
  } catch (e) {
    res.status(400).send(e);
  }
});

//View Comments (Test: Passed)
router.get("/comments/:id", async (req, res) => {
  const _id = req.params.id;
  try {
    const product = await Product.findById(_id);
    if (!product) {
      return res.status(404).send();
    }

    res.status(200).send(product.comments);
  } catch (e) {
    res.status(500).send();
  }
});

//Item sold (Test: Passed )
router.patch("/products/sold/:id", auth, async (req, res) => {
  const _id = req.params.id;

  try {
    const product = await Product.findOne({
      _id,
    });

    const soldBy = req.user;
    const soldTo = await User.findOne({
      _id: req.body.soldTo,
    });

    if (!product || !soldTo || !soldBy) {
      return res.status(404).send();
    }
    soldTo.history.push({
      act: "bought",
      itemID: product._id,
      description: product.description,
      name: product.name,
      value: req.body.value,
      model: product.model,
      catagory: product.catagory,
      image: product.image,
      user2: product.owner,
    });
    soldBy.history.push({
      act: "sold",
      itemID: product._id,
      description: product.description,
      name: product.name,
      value: req.body.value,
      model: product.model,
      catagory: product.catagory,
      image: product.image,
      user2: soldTo._id,
    });

    await soldTo.save();
    await soldBy.save();
    await Product.findOneAndDelete({
      _id: product._id,
    });
    res.send(soldBy.history);
  } catch (e) {
    res.status(400).send(e);
  }
});

//Item rented (Test: Passed )
router.patch("/products/rented/:id", auth, async (req, res) => {
  const _id = req.params.id;

  try {
    const product = await Product.findOne({
      _id,
    });

    const rentedBy = req.user;
    const rentedTo = await User.findOne({
      _id: req.body.rentedTo,
    });

    if (!product || !rentedTo || !rentedBy) {
      return res.status(404).send();
    }
    const duration = String(req.body.duration) * 24 * 60 * 60 * 100;
    const from = String(new Date().getTime());
    const to = String(Number(from) + Number(duration));
    rentedTo.history.push({
      act: "borrowed",
      itemID: product._id,
      description: product.description,
      name: product.name,
      value: req.body.value,
      model: product.model,
      from: from,
      to: to,
      duration: duration,
      catagory: product.catagory,
      image: product.image,
      user2: product.owner,
    });
    rentedBy.history.push({
      act: "rented",
      itemID: product._id,
      description: product.description,
      name: product.name,
      value: req.body.value,
      from: from,
      to: to,
      duration: duration,
      model: product.model,
      catagory: product.catagory,
      image: product.image,
      user2: rentedTo._id,
    });

    await rentedTo.save();
    await rentedBy.save();
    await Product.findOneAndDelete({
      _id: product._id,
    });
    res.send(rentedBy.history);
  } catch (e) {
    res.status(400).send(e);
  }
});

//Delete the product with given id (Test: Passed )
router.delete("/products/:id", auth, async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!product) {
      res.status(404).send();
    }
    res.send(product);
  } catch (e) {
    res.status(500).send();
  }
});

module.exports = router;
