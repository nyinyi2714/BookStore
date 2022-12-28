const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    rating: {
        type: Number,
        required: true,
    },
    price: {
        type: Number,
        required: true,
    },
    bookCover: {
        type: String,
        required: true,
    }
})

module.exports = mongoose.model('Book', bookSchema)