// backend/models/User.js

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },
    username: {
        type: String,
        required: true,
        unique: true
    },
    passwordHash: {
        type: String,
        required: true
    },
    balance: {
        type: Number,
        required: true,
        default: 1000.00
    },

    // O saldo agora é dividido em dois
    balance: { type: Number, default: 0.00 }, // Saldo Real (sacável)
    bonusBalance: { type: Number, default: 0.00 }, // Saldo de Bónus (não sacável)
    
    affiliateId: {
        type: String,
        default: null
    },
    commissionBalance: {
        type: Number,
        required: true,
        default: 0.00
    },
    hasGeneratedCPA: {
        type: Boolean,
        default: false
    },
    // NOVIDADE CRÍTICA: Campo para Papéis (Roles)
    role: {
        type: String,
        enum: ['affiliate', 'influencer', 'admin'], // Apenas estes valores são permitidos
        default: 'affiliate' // Novos usuários serão 'affiliate' por padrão
    },
    lastLogin: { type: Date, default: Date.now },

     // NOVOS CAMPOS PARA CONTROLO DE BÓNUS E ROLLOVER
    wageringTarget: { type: Number, default: 0 }, // Meta de apostas para cumprir
    wageringProgress: { type: Number, default: 0 }, // Quanto já foi apostado

    // NOVOS CAMPOS PARA O PERFIL DO UTILIZADOR
    email: { type: String, default: '' },
    isEmailVerified: { type: Boolean, default: false },
    avatar: { type: String, default: '👤' } // Avatar padrão

}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);