const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema({
  feedback: {
    type: String,
    required: true,
  },
  reviewed: {
    type: Boolean,
    default: false,
  },
});

const Feedback = mongoose.model("Feedback", feedbackSchema);

module.exports = Feedback;
