const express = require("express");
const Feedback = require("../models/feedback");
const auth = require("../middleware/auth");
const router = new express.Router();

//(Test: Passed )
router.post("/feedback/new", async (req, res) => {
  console.log(req.body);
  const feedback = new Feedback(req.body);

  try {
    await feedback.save();
    const feedbacks = await Feedback.find({});
    res.status(201).send(feedbacks);
  } catch (e) {
    console.log(e.message);
    res.status(400).send(e);
  }
});

//(Test: Passed )
router.get("/feedbacks", auth, async (req, res) => {
  if (!req.user.admin) {
    res.status(401).send({});
  }
  try {
    const feedbacks = await Feedback.find({});
    res.send(feedbacks);
  } catch (e) {
    res.status(400).send(e);
  }
});

router.get("/feedback/:id", auth, async (req, res) => {
  if (!req.user.admin) {
    res.status(401).send({});
  }
  try {
    const feedbacks = await Feedback.findById(req.params.id);
    res.send(feedbacks);
  } catch (e) {
    res.status(400).send(e);
  }
});

//Set Reviewed
router.patch("/feedbacks/:id", auth, async (req, res) => {
  if (!req.user.admin) {
    res.status(401).send({});
  }
  try {
    const feedbacks = await Feedback.findById(req.params.id);
    feedbacks.reviewed = true;
    feedbacks.save();
    res.send(feedbacks);
  } catch (e) {
    res.status(400).send(e);
  }
});

router.delete("/feedback/:id", auth, async (req, res) => {
  if (!req.user.admin) {
    res.status(404).send({});
  }
  try {
    const _id = req.params.id;
    const feedback = await Feedback.findByIdAndDelete(_id);
    const feedbacks = await Feedback.find({});
    res.send(feedbacks);
  } catch (e) {
    res.status(400).send(e);
  }
});

module.exports = router;
