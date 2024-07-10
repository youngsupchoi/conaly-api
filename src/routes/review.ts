import express from "express";

// import review from "../controllers/reviewController";

const review = require("../controllers/reviewController");

const router = express.Router();

router.get("/test", review.test);

router.get("/userinfo/:username", review.getReviewSummaryByUsername);

router.get("/user/:username", review.getReviewsByUsername);

router.get("/useractivitytrend/:username", review.getUserActivityTrend);

module.exports = router;
