import { Request, Response } from "express";
import Product from "../models/Product";
import Review from "../models/Review";

exports.test = (req: Request, res: Response) => {
  console.log("test");
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

export const getReviewSummaryByUsername = async (
  req: Request,
  res: Response
) => {
  try {
    const username = req.params.username;

    // 기본 매치 조건
    const matchConditions: any = {
      "author.username": username,
    };

    // 리뷰 요약 정보 조회
    const reviewSummary = await Review.aggregate([
      { $match: matchConditions },
      {
        $group: {
          _id: "$author.username",
          reviewCount: { $sum: 1 },
          averageRating: { $avg: "$rating" },
          totalRecommendations: { $sum: "$recommCnt" },
        },
      },
    ]);

    if (reviewSummary.length === 0) {
      return res
        .status(404)
        .json({ message: "No reviews found for the username" });
    }

    res.json(reviewSummary[0]);
  } catch (error) {
    const err = error as Error; // 'Error' 타입으로 캐스팅
    res.status(500).json({ message: err.message });
  }
};
export const getUserActivityTrend = async (req: Request, res: Response) => {
  try {
    const username = req.params.username;

    const today = new Date();
    const monthEnds = [];
    for (let i = 0; i < 6; i++) {
      const endOfMonth = new Date(
        today.getFullYear(),
        today.getMonth() - i + 1,
        0
      );
      monthEnds.push(endOfMonth);
    }

    const reviews = await Review.aggregate([
      { $match: { "author.username": username } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          "_id.year": -1,
          "_id.month": -1,
        },
      },
    ]);

    // Initialize review counts with zero
    const reviewCounts = monthEnds.map((date) => ({
      date,
      count: 0,
    }));

    // Accumulate review counts for each month
    reviews.forEach((review) => {
      const reviewDate = new Date(review._id.year, review._id.month - 1);
      reviewCounts.forEach((reviewCount) => {
        if (reviewDate <= reviewCount.date) {
          reviewCount.count += review.count;
        }
      });
    });

    // Accumulate counts to be cumulative
    for (let i = reviewCounts.length - 1; i > 0; i--) {
      reviewCounts[i - 1].count += reviewCounts[i].count;
    }

    res.json(
      reviewCounts.map((reviewCount, index) => ({
        month: 7 - index,
        date: reviewCount.date,
        count: reviewCount.count,
      }))
    );
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ message: err.message });
  }
};

export const getReviewsByProductName = async (req: Request, res: Response) => {
  try {
    const productName = req.params.productName;
    const reviews = await Review.find({ name: productName }).exec();
    res.json(reviews);
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ message: err.message });
  }
};
export const getProductActivityTrend = async (req: Request, res: Response) => {
  try {
    const { productName } = req.body;

    console.log("Received productName:", productName); // 입력된 productName 확인

    // productName을 기반으로 상품 정보 조회
    const product = await Product.findOne({ name: productName }).exec();
    if (!product) {
      console.log("Product not found for productName:", productName); // 상품이 없는 경우 로그
      return res.status(404).json({ message: "Product not found" });
    }

    const productId = product._id;
    const reviewCount = product.reviewCount;

    console.log("Found productId:", productId); // 조회된 productId 확인
    console.log("Total reviewCount:", reviewCount); // 조회된 reviewCount 확인

    // 오늘 날짜를 기준으로 이전 6개월의 말일과 그 이전 1일을 계산
    const today = new Date();
    const monthEnds = [];
    for (let i = 0; i < 6; i++) {
      const endOfMonth = new Date(
        today.getFullYear(),
        today.getMonth() - i + 1,
        0
      );
      const startOfMonth = new Date(
        today.getFullYear(),
        today.getMonth() - i,
        1
      );
      monthEnds.push({ startOfMonth, endOfMonth });
      console.log(`Start of month ${i + 1}:`, startOfMonth); // 계산된 각 월의 첫 날 확인
      console.log(`End of month ${i + 1}:`, endOfMonth); // 계산된 각 월의 마지막 날 확인
    }

    // 각 월의 시작 날짜와 마지막 날짜를 기준으로 리뷰 수를 집계
    const monthlyReviewCounts = await Promise.all(
      monthEnds.map(async (month) => {
        const reviewCount = await Review.countDocuments({
          productId,
          createdAt: { $gte: month.startOfMonth, $lte: month.endOfMonth },
        }).exec();
        console.log(
          `Review count for ${month.startOfMonth} to ${month.endOfMonth}:`,
          reviewCount
        ); // 각 월의 리뷰 수 확인
        return { date: month.endOfMonth, count: reviewCount };
      })
    );

    res.json({ productId, reviewCount, monthlyReviewCounts });
  } catch (error) {
    const err = error as Error;
    console.log("Error occurred:", err.message); // 에러 메시지 로그
    res.status(500).json({ message: err.message });
  }
};
