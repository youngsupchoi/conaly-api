import { Request, Response } from "express";
import Product from "../models/Product";
import Review from "../models/Review";
export const getProductListByName = async (req: Request, res: Response) => {
  try {
    const productName = req.body.productName;
    const platform = req.body.platform;
    const page = parseInt(req.body.page) || 1; // 페이지 번호를 쿼리 파라미터에서 가져옴, 기본값은 1
    const pageSize = 20; // 한 페이지당 20개의 결과

    let changedPlatform = null;
    if (platform === "쿠팡") {
      changedPlatform = "coupang.com";
    }
    if (platform === "네이버") {
      changedPlatform = "brand.naver.com";
    }
    if (platform === "올리브영") {
      changedPlatform = "oliveyoung.co.kr";
    }

    const query: any = {
      name: { $regex: productName, $options: "i" },
      brand: { $exists: true },
    };

    if (changedPlatform && changedPlatform !== null) {
      query.platform = { $regex: changedPlatform, $options: "i" };
    }

    // 전체 문서 수 계산
    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / pageSize); // 전체 페이지 수 계산

    const products = await Product.find(query, {
      _id: 1,
      name: 1,
      platform: 1,
      brand: 1,
      price: 1,
      reviewCount: 1,
      averageRating: 1,
      breadcrumbs: 1,
      images: 1,
      evaluations: 1,
    })
      .skip((page - 1) * pageSize) // 해당 페이지의 앞선 데이터 건수는 건너뜀
      .limit(pageSize); // 한 페이지당 20개의 데이터만 가져옴

    console.log("🚀 ~ getProductListByName ~ products:", products);

    if (products.length === 0) {
      return res.status(404).json({ message: "Products not found" });
    }

    const result = {
      products: products.map((product) => ({
        _id: product._id,
        name: product.name,
        platform: product.platform,
        brand: product.brand,
        price: product.price,
        reviewCount: product.reviewCount,
        averageRating: product.averageRating,
        breadCrumb: product.breadcrumbs,
        images: product.images,
        evaluations: product.evaluations,
      })),
      totalPages: totalPages, // 전체 페이지 수 추가
      currentPage: page, // 현재 페이지 번호 추가
    };

    res.json(result);
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ message: err.message });
  }
};

export const getProductByName = async (req: Request, res: Response) => {
  try {
    const productName = req.body.productName;
    const product = await Product.findOne(
      {
        name: productName,
        brand: { $exists: true },
      },
      {
        _id: 1,
        name: 1, // 상품명
        platform: 1, // 판매채널
        brand: 1, // 브랜드
        price: 1, // 가격
        reviewCount: 1, // 리뷰 수
        averageRating: 1, // 평균 별점
        breadcrumbs: 1, // 카테고리 경로
        images: 1, // 상품 이미지 URL 목록
        evaluations: 1, // 상품 평가 항목
      }
    );
    console.log("🚀 ~ getProductByName ~ product:", product);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const result = {
      _id: product._id,
      name: product.name,
      platform: product.platform,
      brand: product.brand,
      price: product.price,
      reviewCount: product.reviewCount,
      averageRating: product.averageRating,
      breadCrumb: product.breadcrumbs,
      images: product.images,
      evaluations: product.evaluations,
    };

    res.json(result);
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ message: err.message });
  }
};

export const getReviewsByProductName = async (req: Request, res: Response) => {
  try {
    const productName = req.params.productName;

    const reviews = await Review.aggregate([
      {
        $lookup: {
          from: "products", // products 컬렉션과 조인
          localField: "productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" }, // 배열을 개별 문서로 펼침
      { $match: { "product.name": productName } }, // 제품 이름으로 필터링
      {
        $project: {
          reviewId: "$_id",
          username: "$author.username",
          rating: "$rating",
          content: "$content",
          createdAt: "$createdAt",
          platform: "$platform",
          productName: "$product.name",
          productAverageRating: "$product.averageRating",
          productReviewCount: "$product.reviewCount",
        },
      },
    ]);

    if (reviews.length === 0) {
      return res
        .status(404)
        .json({ message: "No reviews found for the product name" });
    }

    res.json(reviews);
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ message: err.message });
  }
};

// 워드 클라우드 데이터 생성 함수
// 워드 클라우드 데이터 생성 함수
export const generateWordCloudData = async (req: Request, res: Response) => {
  try {
    const productId = req.params.productId;
    const batchSize = 1000; // 한 번에 처리할 리뷰 수

    // Define the type for the word frequency object
    const wordFreq: { [key: string]: number } = {};

    // 리뷰 데이터를 스트리밍으로 배치 처리
    let skip = 0;
    let reviewsBatch;

    do {
      reviewsBatch = await Review.find({ productId })
        .skip(skip)
        .limit(batchSize)
        .exec();
      reviewsBatch.forEach((review) => {
        const text = review.content;
        if (text) {
          text.split(/\s+/).forEach((word) => {
            word = word.toLowerCase().replace(/[^\w\s]/gi, ""); // Remove punctuation
            if (!wordFreq[word]) wordFreq[word] = 0;
            wordFreq[word]++;
          });
        }
      });
      skip += batchSize;
    } while (reviewsBatch.length === batchSize);

    const wordFreqArray = Object.keys(wordFreq).map((word) => ({
      text: word,
      value: wordFreq[word],
    }));

    res.json(wordFreqArray);
  } catch (error) {
    res.status(500).json({ message: (error as Error).message });
  }
};
