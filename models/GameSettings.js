// backend/models/GameSettings.js

const mongoose = require('mongoose');

// Este schema armazenará as configurações globais do jogo.
const GameSettingsSchema = new mongoose.Schema({
    settingId: {
        type: String,
        required: true,
        default: 'GLOBAL_SETTINGS'
    },
    // Campo para a cor de override (Ex: 'RED', 'BLUE', ou 'null' se aleatório)
    nextColorOverride: {
        type: String,
        enum: ['RED', 'BLUE', 'GREEN', null], // Apenas cores válidas ou nulo
        default: null 
    }
});

module.exports = mongoose.model('GameSettings', GameSettingsSchema);