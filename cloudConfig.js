const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const config = require("./config");

cloudinary.config({
  cloud_name: config.integrations.cloudinary.cloudName,
  api_key: config.integrations.cloudinary.apiKey,
  api_secret: config.integrations.cloudinary.apiSecret,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: config.app.isProduction ? "wanderlust_prod" : "wanderlust_dev",
    allowed_formats: ["png", "jpg", "jpeg", "webp"],
  },
});

module.exports = { cloudinary, storage };