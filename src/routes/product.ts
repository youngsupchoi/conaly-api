import express from "express";

const product = require("../controllers/productController");

const router = express.Router();

router.get("/info/:productName", product.getProductByName);

module.exports = router;
