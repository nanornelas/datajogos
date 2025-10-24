const mongoose = require('mongoose');

const gameLogSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    betType: { type: String, required: true },
    betValue: { type: String, required: true },
    amount: { type: Number, required: true },
    isWin: { type: Boolean, required: true },
    winnings: { type: Number, required: true },
    gameResult: {
        color: String,
        number: Number
    }
}, { timestamps: true });

module.exports = mongoose.model('GameLog', gameLogSchema);