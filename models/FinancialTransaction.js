const mongoose = require('mongoose');

const financialTransactionSchema = new mongoose.Schema({
    // Usuário que realizou a transação
    userId: { type: String, required: true, index: true },
    username: { type: String, required: true },

    // Tipo de transação
    type: {
        type: String,
        enum: ['DEPOSIT', 'WITHDRAWAL'],
        required: true
    },

    // Valor da transação
    amount: {
        type: Number,
        required: true
    },

    // Método (como a transação foi feita)
    method: {
        type: String,
        enum: ['ADMIN_ADJUSTMENT', 'GATEWAY'], // Prepara para futuros gateways de pagamento
        default: 'ADMIN_ADJUSTMENT'
    },
    
    // Quem iniciou a transação (útil para auditoria)
    initiatedBy: {
        type: String, // Armazenará o ID do admin
        default: null
    }

}, { timestamps: true }); // O campo 'createdAt' registrará a data da transação

module.exports = mongoose.model('FinancialTransaction', financialTransactionSchema);

