const express = require("express");
const cors = require("cors");
const path = require("path");

//

const userRouter = require("../src/routers/user");
const productRouter = require("../src/routers/product");
const catagoryRouter = require("../src/routers/catagory");

//

require("./db/mongoose");

//

const Product = require("./models/product");
const User = require("./models/user");
const Catagory = require("./models/catagory");

//

const app = express();
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Server is up on port " + port);
});
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cors());
app.use("/uploads", express.static("../uploads"));
app.use(express.json());
app.use(userRouter);
app.use(productRouter);
app.use(catagoryRouter);
