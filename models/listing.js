const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./review");

const imageSchema = new Schema(
    {
        filename: String,
        url: String,
    },
    { _id: false }
);

const listingSchema = new Schema({
    title: {
        type: String,
        required: true,
    },
    description: String,
    // image: imageSchema,
    images: {
        type: [imageSchema],
        default: [],
    },
    price: Number,
    ratingAverage: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
        index: true,
    },
    ratingCount: {
        type: Number,
        default: 0,
        min: 0,
        index: true,
    },
    category: {
        type: String,
        enum: ["villa", "apartment", "farmhouse", "room", "hotel"],
        default: "apartment",
        index: true,
    },
    location: String,
    country: String,
    geometry: {
        type: {
            type: String,
            enum: ["Point"],
        },
        coordinates: {
            type: [Number],
        },
    },
    status: {
        type: String,
        enum: ["active", "inactive"],
        default: "active",
        index: true,
    },
    owner: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },
    blockedDates: [
        {
            booking: {
                type: Schema.Types.ObjectId,
                ref: "Booking",
            },
            start: {
                type: Date,
                required: true,
            },
            end: {
                type: Date,
                required: true,
            },
        },
    ],
    reviews: [
        {
            type: Schema.Types.ObjectId,
            ref:"Review"             
        }
    ]
})

listingSchema.index({ geometry: "2dsphere" });
listingSchema.index({ price: 1 });
listingSchema.index({ category: 1, price: 1 });
listingSchema.index({ ratingAverage: -1, price: 1 });
listingSchema.index({ title: "text", location: "text" });
listingSchema.index({ "images.filename": 1 });
listingSchema.index({ "blockedDates.booking": 1 });

// listingSchema.pre("save", function normalizeLegacyImage() {
//     if ((!Array.isArray(this.images) || this.images.length === 0) && this.image?.url) {
//         this.images = [{
//             url: this.image.url,
//             filename: this.image.filename || "",
//         }];
//     }

//     if (Array.isArray(this.images) && this.images.length > 0) {
//         this.image = {
//             url: this.images[0].url,
//             filename: this.images[0].filename || "",
//         };
//     }

// });
listingSchema.index({ "blockedDates.start": 1, "blockedDates.end": 1 });

//Mongoose middleware
listingSchema.post("findOneAndDelete", async (listing) => {
    if (listing) {
        await Review.deleteMany({ _id: { $in: listing.reviews } }); // this will delete the review stored in array of listing after deleting the listing
    }
});

const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;