// =================================================================================
// 1. IMPORTAÇÕES E CONFIGURAÇÃO INICIAL
// =================================================================================
const GameSettings = require('./models/GameSettings');
const express = require('express');
const cors = require('cors'); 
const mongoose = require('mongoose');
const dotenv = require('dotenv');     
const User = require('./models/User');
const Transaction = require('./models/Transaction');
const FinancialTransaction = require('./models/FinancialTransaction');
const GameLog = require('./models/GameLog'); // NOVO MODELO
const ChatMessage = require('./models/ChatMessage'); // Importação Essencial
const PublicBet = require('./models/PublicBet');   // Importação Essencial
const authMiddleware = require('./middleware/auth');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');

dotenv.config(); 

const app = express();
const PORT = 3000; 

const PAYOUTS = { 'RED': 2, 'BLUE': 2, 'GREEN': 14, 'ODD': 2, 'EVEN': 2 };
const BONUS_ROLLOVER_MULTIPLIER = 5;
const INFLUENCER_NGR_WIN_RATE = 0.03; // NOVO: Taxa de 3% sobre ganhos do jogador
const INFLUENCER_NGR_LOSS_RATE = 0.05; // Taxa de 5% sobre perdas

// =================================================================================
// 2. CONEXÃO COM A BASE DE DADOS
// =================================================================================
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB Atlas conectado com sucesso!');
        
        const defaultPasswordHash = await bcrypt.hash('teste123', 10); 
        await User.findOneAndUpdate( { userId: 'user_1' }, { userId: 'user_1', username: 'TEST_USER', passwordHash: defaultPasswordHash, balance: 1000.00, role: 'admin' }, { upsert: true, new: true, setDefaultsOnInsert: true } );
        console.log(`[DB] Utilizador de teste 'user_1' garantido como ADMIN.`);

        const influencerPasswordHash = await bcrypt.hash('influencer123', 10);
        await User.findOneAndUpdate( { username: 'TEST_INFLUENCER' }, { $set: { userId: 'influencer_1', username: 'TEST_INFLUENCER', passwordHash: influencerPasswordHash, balance: 1000.00, role: 'influencer' } }, { upsert: true, new: true, setDefaultsOnInsert: true } );
        console.log(`[DB] Utilizador de teste 'TEST_INFLUENCER' garantido como INFLUENCER.`);
        
        app.listen(PORT, () => {
            console.log(`\n======================================================`);
            console.log(`| Servidor Node.js a rodar na porta: ${PORT}           |`);
            console.log(`| Pressione CTRL+C para sair.                          |`);
            console.log(`======================================================\n`);
        });
    } catch (err) {
        console.error('❌ ERRO NA CONEXÃO COM O MONGODB:', err.message);
        process.exit(1); 
    }
};

// =================================================================================
// 3. MIDDLEWARES E LÓGICA DE SORTEIO
// =================================================================================
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT'] }));
app.use(express.json());
app.use(express.static('public')); 
async function generateNewResult() {
    const settings = await GameSettings.findOneAndUpdate({ settingId: 'GLOBAL_SETTINGS' }, { $setOnInsert: { settingId: 'GLOBAL_SETTINGS' } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    let finalColor = null;
    let isOverridden = false;
    if (settings.nextColorOverride) {
        finalColor = settings.nextColorOverride;
        isOverridden = true;
        settings.nextColorOverride = null;
        await settings.save();
    } 
    let num = Math.floor(Math.random() * 100) + 1;
    let color = finalColor;
    if (!isOverridden) {
        const randomChance = Math.random();
        if (randomChance < 0.02) { color = 'GREEN'; } 
        else if (randomChance < 0.51) { color = 'BLUE'; } 
        else { color = 'RED'; }
    }
    // --- LÓGICA CORINGA PARA VERDE ---
    let finalNumber, finalParity, finalTranslatedParity;
    if (color === 'GREEN') {
        finalNumber = '?'; // Número será '?'
        finalParity = null; // Paridade é nula/indefinida
        finalTranslatedParity = null; // Tradução também
    } else {
        finalNumber = num; // Mantém o número normal para Vermelho/Azul
        finalParity = (num % 2 === 0) ? 'EVEN' : 'ODD'; 
        finalTranslatedParity = (finalParity === 'EVEN' ? 'PAR' : 'ÍMPAR'); 
    }
    // --- FIM DA LÓGICA CORINGA ---

    const translatedColor = (color === 'RED' ? 'VERMELHO' : (color === 'BLUE' ? 'AZUL' : 'VERDE'));

    // Retorna os valores finais
    return { 
        color, 
        number: finalNumber, // Usa o número final ('?' ou num)
        parity: finalParity, // Usa a paridade final (null ou EVEN/ODD)
        translatedColor, 
        translatedParity: finalTranslatedParity, // Usa a tradução final (null ou PAR/ÍMPAR)
        overridden: isOverridden 
    };
}

// =================================================================================
// 4. ROTAS (Endpoints da API)
// =================================================================================

app.post('/api/auth/register', async (req, res) => {
    const { username, password, affiliateCode } = req.body;
    try {
        if (await User.findOne({ username })) {
            return res.status(409).json({ success: false, message: 'Nome de utilizador já está em uso.' });
        }
        const passwordHash = await bcrypt.hash(password, 10);
        const newUserId = Date.now().toString();
        const affiliateId = affiliateCode || null;
        const newUser = await User.create({ userId: newUserId, username, passwordHash, affiliateId });
        res.status(201).json({ success: true, message: 'Registo realizado com sucesso!', userId: newUser.userId });
    } catch (error) {
        console.error("Erro no registo:", error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// ROTA DE LOGIN ATUALIZADA PARA INCLUIR AVATAR E ROLE NO TOKEN
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
            return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
        }
        user.lastLogin = new Date();
        await user.save();
        
        // ATUALIZAÇÃO: Adiciona avatar e role ao token para uso no chat
        const token = jwt.sign(
           { userId: user.userId, username: user.username, role: user.role, avatar: user.avatar }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1d' } 
        );
        res.json({ success: true, token, userId: user.userId, username: user.username, balance: user.balance.toFixed(2), role: user.role });
    } catch (error) {
        console.error("Erro no login:", error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// ROTA DE APOSTA ATUALIZADA com a nova lógica de Revenue Share
app.post('/api/bet', authMiddleware, async (req, res) => {
    const { userId, username, avatar } = req.user;
    const { betType, betValue, amount } = req.body;
    
    const user = await User.findOne({ userId });
    if (!user || amount <= 0 || amount > (user.balance + user.bonusBalance)) { 
        return res.status(400).json({ success: false, message: "Saldo insuficiente ou aposta inválida." });
    }

    try {
        let betFromReal = 0, betFromBonus = 0;
        if (user.balance >= amount) { user.balance -= amount; betFromReal = amount; } 
        else { betFromReal = user.balance; betFromBonus = amount - betFromReal; user.balance = 0; user.bonusBalance -= betFromBonus; }
        if (user.wageringTarget > 0) { user.wageringProgress += amount; }
        
        const finalResult = await generateNewResult();
       let isWin = false;
        if (betType === 'COLOR') { 
            isWin = (betValue === finalResult.color); 
        } 
        else if (betType === 'PARITY') { 
            // --- LÓGICA CORINGA PARA VERDE ---
            // Se a cor for VERDE, a aposta em paridade SEMPRE perde
            if (finalResult.color === 'GREEN') {
                isWin = false; 
            } else {
                // Se não for Verde, calcula a paridade normalmente
                // Nota: finalResult.parity já foi calculado em generateNewResult
                isWin = (betValue === finalResult.parity); 
            }
            // --- FIM DA LÓGICA CORINGA ---
        }
        
        let winnings = 0;
        if (isWin) {
            winnings = amount * PAYOUTS[betValue];
            if (betFromBonus > 0 && user.wageringProgress < user.wageringTarget) { user.bonusBalance += winnings; } 
            else { user.balance += winnings; }
        }
        
        if (user.wageringTarget > 0 && user.wageringProgress >= user.wageringTarget) {
            user.balance += user.bonusBalance;
            user.bonusBalance = 0;
            user.wageringTarget = 0;
            user.wageringProgress = 0;
        }

        await GameLog.create({ userId, betType, betValue, amount, isWin, winnings, gameResult: { color: finalResult.color, number: finalResult.number } });
        await PublicBet.create({ userId, username, avatar, betValue, amount, isWin, winnings });

        // NOVO: Guarda a aposta pública para o feed
        await PublicBet.create({
            userId, username, avatar,
            betValue, amount, isWin, winnings
        });

        const partner = user.affiliateId ? await User.findOne({ userId: user.affiliateId }) : null;
        if (partner) {
            if (!user.hasGeneratedCPA) {
                partner.commissionBalance += AFFILIATE_CPA_VALUE;
                user.hasGeneratedCPA = true;
                await Transaction.create({ recipientId: partner.userId, sourceUserId: user.userId, sourceUsername: user.username, type: 'CPA', amount: AFFILIATE_CPA_VALUE, sourceBetAmount: amount });
            }
            if (partner.role === 'influencer') {
                if (isWin) {
                    const playerProfit = winnings - amount;
                    if (playerProfit > 0) {
                        const commissionDebit = playerProfit * INFLUENCER_NGR_WIN_RATE;
                        partner.commissionBalance -= commissionDebit;
                        await Transaction.create({ recipientId: partner.userId, sourceUserId: user.userId, sourceUsername: user.username, type: 'NGR_DEBIT', amount: commissionDebit, sourceBetAmount: amount, sourcePlayerProfit: playerProfit });
                    }
                } else {
                    const netLoss = amount;
                    const ngrCommission = netLoss * INFLUENCER_NGR_LOSS_RATE;
                    partner.commissionBalance += ngrCommission;
                    await Transaction.create({ recipientId: partner.userId, sourceUserId: user.userId, sourceUsername: user.username, type: 'NGR', amount: ngrCommission, sourceBetAmount: amount, sourcePlayerProfit: -netLoss });
                }
            }
            await partner.save();
        }

        await user.save();
        return res.json({ 
            success: true, isWin, winnings, 
            newBalance: user.balance, newBonusBalance: user.bonusBalance,
            wageringProgress: user.wageringProgress, wageringTarget: user.wageringTarget,
            gameResult: finalResult 
        });
    } catch (error) {
        console.error("Erro ao processar a aposta:", error);
        res.status(500).json({ success: false, message: "Erro interno do servidor." });
    }
});

app.get('/api/initial-draw', async (req, res) => {
    try {
        const initialDraw = await generateNewResult();
        res.json({ success: true, gameResult: initialDraw });
    } catch (error) {
        console.error("Erro ao gerar sorteio inicial:", error);
        res.status(500).json({ success: false, message: "Erro interno do servidor." });
    }
});

app.get('/api/balance/:userId', authMiddleware, async (req, res) => {
    if (req.user.userId !== req.params.userId) { return res.status(403).json({ success: false, message: 'Acesso negado.' }); }
    try {
        const user = await User.findOne({ userId: req.params.userId }); 
        if (!user) { return res.status(404).json({ success: false, message: "Utilizador não encontrado." }); }
        res.json({ 
            success: true, 
            balance: user.balance.toFixed(2), 
            bonusBalance: user.bonusBalance.toFixed(2),
            wageringProgress: user.wageringProgress,
            wageringTarget: user.wageringTarget
        });
    } catch (err) {
        res.status(500).json({ success: false, message: "Erro interno do servidor." });
    }
});


// ===== ROTAS DO PAINEL DE ADMIN =====
app.post('/api/admin/set-draw', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') { return res.status(403).json({ success: false, message: 'Acesso negado. Apenas administradores.' }); }
    const { color } = req.body;
    if (!color) { return res.status(400).json({ success: false, message: 'O campo "color" é obrigatório.' }); }
    try {
        await GameSettings.findOneAndUpdate({ settingId: 'GLOBAL_SETTINGS' }, { nextColorOverride: color });
        res.json({ success: true, message: `Próximo sorteio definido para ${color}. Gatilho ativo!` });
    } catch (error) {
        console.error("Erro ao definir o override:", error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.get('/api/admin/stats', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') { return res.status(403).json({ success: false, message: 'Acesso negado.' }); }
    try {
        const totalUsers = await User.countDocuments();
        const balanceData = await User.aggregate([ { $group: { _id: null, totalBalance: { $sum: "$balance" }, totalCommissions: { $sum: "$commissionBalance" } } } ]);
        res.json({
            success: true,
            totalUsers: totalUsers,
            totalPlatformBalance: balanceData.length > 0 ? balanceData[0].totalBalance.toFixed(2) : '0.00',
            totalCommissionsPaid: balanceData.length > 0 ? balanceData[0].totalCommissions.toFixed(2) : '0.00'
        });
    } catch (error) {
        console.error("Erro ao buscar estatísticas do admin:", error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.get('/api/admin/users', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') { return res.status(403).json({ success: false, message: 'Acesso negado.' }); }
    try {
        const users = await User.find({}).sort({ createdAt: -1 }).select('-passwordHash');
        res.json({ success: true, users: users });
    } catch (error) {
        console.error("Erro ao listar utilizadores:", error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.put('/api/admin/user/:userId', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') { return res.status(403).json({ success: false, message: 'Acesso negado.' }); }
    try {
        const { userId } = req.params;
        const { role } = req.body;
        const userToUpdate = await User.findOne({ userId: userId });
        if (!userToUpdate) { return res.status(404).json({ success: false, message: 'Utilizador não encontrado.' }); }
        if (role) { userToUpdate.role = role; }
        await userToUpdate.save();
        res.json({ success: true, message: 'Role do utilizador atualizada com sucesso.' });
    } catch (error) {
        console.error("Erro ao atualizar role do utilizador:", error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.post('/api/admin/transaction', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') { return res.status(403).json({ success: false, message: 'Acesso negado.' }); }
    const { userId, type, amount, addBonus } = req.body;
    const adminId = req.user.userId;
    if (!userId || !type || !amount || amount <= 0) { return res.status(400).json({ success: false, message: 'Dados da transação inválidos.' }); }
    try {
        const user = await User.findOne({ userId: userId });
        if (!user) { return res.status(404).json({ success: false, message: 'Utilizador não encontrado.' }); }
        if (type === 'DEPOSIT') {
            user.balance += amount;
            if (addBonus) {
                const bonusAmount = amount;
                user.bonusBalance += bonusAmount;
                user.wageringTarget += bonusAmount * BONUS_ROLLOVER_MULTIPLIER;
            }
            await FinancialTransaction.create({ userId: user.userId, username: user.username, type: 'DEPOSIT', amount: amount, initiatedBy: adminId });
        } else if (type === 'WITHDRAWAL') {
            if (user.balance < amount) { return res.status(400).json({ success: false, message: `Saldo sacável insuficiente. Saldo real: R$ ${user.balance.toFixed(2)}` }); }
            user.balance -= amount;
            await FinancialTransaction.create({ userId: user.userId, username: user.username, type: 'WITHDRAWAL', amount: amount, initiatedBy: adminId });
        }
        await user.save();
        res.json({ success: true, message: `${type} de R$ ${amount.toFixed(2)} registado com sucesso.`, newBalance: user.balance, newBonusBalance: user.bonusBalance });
    } catch (error) {
        console.error(`Erro ao registar transação para ${userId}:`, error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.get('/api/admin/financial-summary', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') { return res.status(403).json({ success: false, message: 'Acesso negado.' }); }
    try {
        const daysToTrack = 30;
        const labels = [];
        const dataMap = new Map();
        for (let i = 0; i < daysToTrack; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const formattedDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            labels.unshift(formattedDate);
            dataMap.set(formattedDate, { deposits: 0, withdrawals: 0, activeUsers: Math.floor(Math.random() * (200 - 50 + 1)) + 50 + (30 - i) });
        }
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - daysToTrack);
        const transactions = await FinancialTransaction.find({ createdAt: { $gte: thirtyDaysAgo } });
        transactions.forEach(tx => {
            const txDate = tx.createdAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            if (dataMap.has(txDate)) {
                const dayData = dataMap.get(txDate);
                if (tx.type === 'DEPOSIT') { dayData.deposits += tx.amount; } 
                else if (tx.type === 'WITHDRAWAL') { dayData.withdrawals += tx.amount; }
            }
        });
        const depositsData = labels.map(label => dataMap.get(label).deposits);
        const withdrawalsData = labels.map(label => dataMap.get(label).withdrawals * -1);
        const activeUsersData = labels.map(label => dataMap.get(label).activeUsers);
        res.json({ success: true, labels, datasets: { deposits: depositsData, withdrawals: withdrawalsData, activeUsers: activeUsersData } });
    } catch (error) {
        console.error("Erro ao gerar resumo financeiro:", error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});


// ===== NOVAS ROTAS DE PERFIL DO UTILIZADOR =====
app.get('/api/user/profile-data', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.user;
        const user = await User.findOne({ userId }).select('username email avatar');
        const gameHistory = await GameLog.find({ userId }).sort({ createdAt: -1 }).limit(20);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Utilizador não encontrado.' });
        }
        res.json({ success: true, profile: user, history: gameHistory });
    } catch (error) {
        console.error("Erro ao buscar dados do perfil:", error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.put('/api/user/profile', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.user;
        const { avatar, email } = req.body;
        const userToUpdate = await User.findOne({ userId });
        if (!userToUpdate) {
            return res.status(404).json({ success: false, message: 'Utilizador não encontrado.' });
        }
        if (avatar) userToUpdate.avatar = avatar;
        if (email !== undefined) userToUpdate.email = email;
        await userToUpdate.save();
        res.json({ success: true, message: 'Perfil atualizado com sucesso.' });
    } catch (error) {
        console.error("Erro ao atualizar perfil:", error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// ===== NOVAS ROTAS SOCIAIS =====
app.post('/api/chat', authMiddleware, async (req, res) => {
    const { userId, username, avatar, role } = req.user;
    const { message } = req.body;
    if (!message || message.trim() === '' || message.length > 200) { return res.status(400).json({ success: false, message: 'Mensagem inválida.' }); }
    try {
        const newMessage = await ChatMessage.create({ userId, username, avatar, role, message: message.trim() });
        res.status(201).json({ 
            success: true, 
            chat: [newMessage]});
    } catch (error) {
        console.error("Erro ao enviar mensagem de chat:", error);
        res.status(500).json({ success: false, message: 'Erro ao enviar mensagem.' });
    }
});

app.get('/api/live-feed', authMiddleware, async (req, res) => {
    try {
        const chatMessages = await ChatMessage.find().sort({ createdAt: -1 }).limit(30);
        const publicBets = await PublicBet.find().sort({ createdAt: -1 }).limit(20);
        res.json({ success: true, chat: chatMessages.reverse(), bets: publicBets });
    } catch (error) {
        console.error("Erro ao buscar live feed:", error);
        res.status(500).json({ success: false, message: 'Erro ao buscar feed de atividades.' });
    }
});

// ===== ROTAS DE AFILIADO / INFLUENCER =====
app.get('/api/affiliate/dashboard', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.user;
        const affiliateUser = await User.findOne({ userId });
        if (!affiliateUser) { return res.status(404).json({ success: false, message: 'Utilizador afiliado não encontrado.' }); }
        const referralCount = await User.countDocuments({ affiliateId: userId });
        res.json({ success: true, referralCode: affiliateUser.userId, commissionBalance: affiliateUser.commissionBalance.toFixed(2), referralCount: referralCount });
    } catch (error) {
        console.error("Erro ao buscar dados do dashboard de afiliado:", error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.get('/api/influencer/statement', authMiddleware, async (req, res) => {
    if (req.user.role !== 'influencer' && req.user.role !== 'admin') { return res.status(403).json({ success: false, message: 'Acesso negado.' }); }
    try {
        const { userId } = req.user;
        const transactions = await Transaction.find({ recipientId: userId }).sort({ createdAt: -1 });
        res.json({ success: true, statement: transactions });
    } catch (error) {
        console.error("Erro ao buscar extrato do influencer:", error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// =================================================================================
// 5. INICIALIZAÇÃO
// =================================================================================
connectDB();

