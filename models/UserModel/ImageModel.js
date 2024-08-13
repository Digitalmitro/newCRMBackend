const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },

  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "register user",
    required: true,
  },
});

const ImageModel = mongoose.model("image", imageSchema);

module.exports = { ImageModel };
