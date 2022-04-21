const mongoose = require("mongoose");

mongoose
  .connect("mongodb://127.0.0.1:27017/commnity-market-api", {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected"))
  .catch((e) => console.log(e));
