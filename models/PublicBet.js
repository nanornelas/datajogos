const mongoose = require('mongoose');

const publicBetSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    username: { type: String, required: true },
    avatar: { type: String, required: true },
    
    betValue: { type: String, required: true }, // Cor ou paridade
    amount: { type: Number, required: true },
    
    isWin: { type: Boolean, required: true },
    winnings: { type: Number, required: true }
}, { timestamps: true });

module.exports = mongoose.model('PublicBet', publicBetSchema);