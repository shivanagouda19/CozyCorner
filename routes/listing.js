const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const wrapAsync = require("../utils/wrapAsync.js");
const Listing = require("../models/listing.js");
const {isLoggedIn, isOwner, validateListing} = require("../middleware.js");
const listingController = require("../controllers/listings.js")
const redirectListingNotFound = (req, res) => {
    req.flash("error", "Listing does not exist.");
    return res.redirect("/listings");
};



//index route
router.get("/", wrapAsync(listingController.index))

//new route
router.get("/new",isLoggedIn, (req, res) => {
    res.render("listings/new.ejs");
});

//show route
router.get("/:id", wrapAsync(async (req, res) => {
    let { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return redirectListingNotFound(req, res);
    }

    const listing = await Listing.findById(id)
        .populate({path :"reviews" , populate : { path : "author"}})
        .populate("owner");
    if (!listing) {
        return redirectListingNotFound(req, res);
    }

    res.render("listings/show.ejs", { listing });
}))
// create route
router.post("/",isLoggedIn, validateListing, wrapAsync(async (req, res, next) => {
    // let {title, description, image, price, country, location} = req.body;// req.body; returns objest which contains data from from
    // let listing = {
    //     title: title, 
    //     description: description,
    //     image: image,
    //     price: price, 
    //     country: country,
    //     location:location
    // }

    // console.log(req.body);
    const newListing = new Listing(req.body.listing);
    newListing.owner = req.user._id;
    await newListing.save();
    req.flash("success", "New Listing Created!");
    res.redirect("/listings");


}))
//edit route
router.get("/:id/edit",isLoggedIn, isOwner, wrapAsync(async (req, res) => {
    let { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return redirectListingNotFound(req, res);
    }

    const listing = await Listing.findById(id);
    if (!listing) {
        return redirectListingNotFound(req, res);
    }

    res.render("listings/edit.ejs", { listing })
}))
//Update Route
router.put("/:id", isLoggedIn, isOwner, validateListing, wrapAsync(async (req, res) => {
    let { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return redirectListingNotFound(req, res);
    }

    const updatedListing = await Listing.findByIdAndUpdate(id, { ...req.body.listing });
    if (!updatedListing) {
        return redirectListingNotFound(req, res);
    }

    res.redirect(`/listings/${id}`);
}));
//delete route
router.delete("/:id",isLoggedIn, isOwner, wrapAsync(async (req, res) => {
    let { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return redirectListingNotFound(req, res);
    }

    const deletedListing = await Listing.findByIdAndDelete(id);
    if (!deletedListing) {
        return redirectListingNotFound(req, res);
    }

    req.flash("success", "Listing deleted successfully!");
    res.redirect(`/listings`);
}))

module.exports = router;