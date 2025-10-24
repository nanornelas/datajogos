const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    username: { type: String, required: true },
    avatar: { type: String, required: true },
    role: { type: String, default: 'affiliate' },
    message: { type: String, required: true, maxlength: 200 } // Limita o tamanho da mensagem
}, { timestamps: true });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
