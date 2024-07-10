import { Request, Response } from "express";
import Product from "../models/Product";
import Review from "../models/Review";

exports.test = (req: Request, res: Response) => {
  console.log("test");
  return res.status(200).send({ message: "Product not found" });
};

exports.userInfo = async (req: Request, res: Response) => {
  console.log("userInfo");
  // const product = await Product.findById("oliveyoung.co.kr:A000000202771");

  const products = await Product.find().limit(10);
  console.log("🚀 ~ exports.userInfo= ~ product:", products);
  return res.status(200).send({ message: "Product not found" });
};

// 특정 username을 가진 모든 리뷰와 해당 상품 정보를 가져오는 함수
type SortOptions = "latest" | "oldest" | "highestRating" | "lowestRating";

const getSortCondition = (sortOption: SortOptions): Record<string, 1 | -1> => {
  switch (sortOption) {
    case "latest":
      return { createdAt: -1 };
    case "oldest":
      return { createdAt: 1 };
    case "highestRating":
      return { rating: -1 };
    case "lowestRating":
      return { rating: 1 };
    default:
      return { createdAt: -1 }; // 기본값: 최신순
  }
};

// 특정 username을 가진 모든 리뷰와 해당 상품 정보를 가져오는 함수
export const getReviewsByUsername = async (req: Request, res: Response) => {
  try {
    const username = req.params.username;
    const sortOption = (req.query.sort as SortOptions) || "최신순"; // 'SortOptions' 타입으로 캐스팅

    // 기본 매치 조건
    const matchConditions: any = {
      "author.username": username,
    };

    const sortCondition = getSortCondition(sortOption);

    let reviews = await Review.aggregate([
      { $match: matchConditions },
      {
        $lookup: {
          from: "Product",
          localField: "productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      { $sort: sortCondition },
    ]);

    if (reviews.length === 0) {
      return res
        .status(404)
        .json({ message: "No reviews found for the username" });
    }

    const formattedReviews = reviews.map((review) => ({
      reviewId: review._id,
      username: review.author.username,
      rating: review.rating,
      content: review.content,
      createdAt: review.createdAt,
      platform: review.platform,
      productName: review.product.name,
      productAverageRating: review.product.averageRating,
      productReviewCount: review.product.reviewCount,
    }));

    res.json(formattedReviews);
  } catch (error) {
    const err = error as Error; // 'Error' 타입으로 캐스팅
    res.status(500).json({ message: err.message });
  }
};
