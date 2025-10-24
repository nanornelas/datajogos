const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    // Quem recebeu a comissão
    recipientId: { type: String, required: true, index: true }, 
    
    // Quem gerou a comissão
    sourceUserId: { type: String, required: true },
    sourceUsername: { type: String, required: true },

 // Detalhes da comissão
    type: { 
        type: String, 
        enum: ['CPA', 'NGR', 'NGR_DEBIT'], // NOVO TIPO ADICIONADO
        required: true 
    },
    amount: { type: Number, required: true }, // Valor (sempre positivo, o tipo define a operação)
    
    // Contexto da aposta que gerou a comissão
    sourceBetAmount: { type: Number },
    sourcePlayerProfit: { type: Number }, // Alterado de netLoss para um nome mais genérico

}, { timestamps: true }); // 'createdAt' será nossa data da transação

module.exports = mongoose.model('Transaction', transactionSchema);