// backend/reset_db.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User'); // Certifique-se que o caminho está correto: ./models/User

dotenv.config();

const USER_ID = 'user_1'; 
const NEW_BALANCE = 5000.00; // Valor que você deseja

async function resetBalance() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        // Encontra o usuário e atualiza o saldo
        const result = await User.findOneAndUpdate(
            { userId: USER_ID }, 
            { balance: NEW_BALANCE },
            { new: true } // Retorna o documento atualizado
        );

        if (result) {
            console.log(`✅ Saldo do usuário ${USER_ID} resetado para R$ ${result.balance.toFixed(2)}.`);
        } else {
            console.log(`❌ Usuário ${USER_ID} não encontrado. Verifique o ID.`);
        }
        
    } catch (error) {
        console.error('❌ Erro ao resetar o saldo:', error);
    } finally {
        mongoose.connection.close(); // Fecha a conexão
    }
}

resetBalance();