import gplay from "google-play-scraper";
import fs from "fs";
import winston from "winston";

// Set constants
const appId = "com.telkom.mwallet";
const maxScore = 5;
const replyKeywords = ["terima kasih", "terimakasih", "makasih"];

// Inisialisasi logger Winston
const colorize = winston.format.colorize();
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.printf((info) =>
    colorize.colorize(
      info.level,
      `${info.timestamp} - [${info.level}]: ${info.message}`
    )
  )
);

const logger = winston.createLogger({
  level: "warn", // "error", "warn", "info", "http", "verbose", "debug", "silly
  format: logFormat,
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "app-logs.log" }),
  ],
});

// Get nextPaginationToken from file
let nextPaginationToken;
try {
  nextPaginationToken = fs.readFileSync(
    `${appId}-nextPaginationToken.txt`,
    "utf-8"
  );
} catch (err) {
  logger.error(
    `Gagal mendapatkan ${appId}-nextPaginationToken.txt: ${err.message}`
  );
}

// Read existing reviews from file
let existingReviews = [];
try {
  const existingReviewsData = fs.readFileSync(`${appId}.json`, "utf-8");
  existingReviews = JSON.parse(existingReviewsData);
} catch (err) {
  logger.error(`Gagal mendapatkan data ${appId}.json: ${err.message}`);
}

// Set params for gplay.reviews
const params = {
  appId,
  sort: gplay.sort.NEWEST,
  paginate: true,
  nextPaginationToken: nextPaginationToken || undefined,
};

// Get reviews from gplay
gplay
  .reviews(params)
  .then((response) => {
    // Filter and map reviews with selected keys
    const newReviews = response.data
      .filter((review) => {
        const scoreCondition = review.score <= maxScore;
        const keywordCondition =
          replyKeywords.length > 0
            ? replyKeywords.some((keyword) =>
                review.text.toLowerCase().includes(keyword.toLowerCase())
              )
            : true;

        return scoreCondition && keywordCondition;
      })
      .map((review) => {
        // Select only specific keys
        const selectedKeys = [
          "userName",
          "date",
          "score",
          "title",
          "text",
          "replyDate",
          "replyText",
        ];
        return Object.fromEntries(
          Object.entries(review).filter(([key]) => selectedKeys.includes(key))
        );
      });

    // Combine existing and new reviews
    const allReviews = [...existingReviews, ...newReviews];

    // Save reviews array to JSON file
    fs.writeFile(`${appId}.json`, JSON.stringify(allReviews), (err) => {
      if (err) {
        logger.error(
          `Gagal menyimpan data ke file ${appId}.json: ${err.message}`
        );
      } else {
        logger.info(`Berhasil menyimpan data ke file ${appId}.json`);
      }
    });

    // Save nextPaginationToken to file
    fs.writeFile(
      `${appId}-nextPaginationToken.txt`,
      response.nextPaginationToken,
      (err) => {
        if (err) {
          logger.error(
            `Gagal menyimpan ${appId}-nextPaginationToken.txt: ${err.message}`
          );
        } else {
          logger.info(`Berhasil menyimpan ${appId}-nextPaginationToken.txt`);
        }
      }
    );
  })
  .catch((err) => {
    logger.error(`Gagal mendapatkan data aplikasi ${appId}: ${err.message}`);
  });
