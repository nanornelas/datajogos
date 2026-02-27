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
const GameLog = require('./models/GameLog'); 
const ChatMessage = require('./models/ChatMessage'); 
const PublicBet = require('./models/PublicBet');   
const authMiddleware = require('./middleware/auth');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');

// --- NOVAS IMPORTAÇÕES PARA O MULTIPLAYER ---
const http = require('http');
const { Server } = require('socket.io');

dotenv.config(); 

const app = express();
const PORT = process.env.PORT || 3000; 

// --- ENVELOPANDO O EXPRESS COM O SERVIDOR HTTP E SOCKET.IO ---
const server = http.createServer(app);
const io = new Server(server, { 
    cors: { origin: '*', methods: ['GET', 'POST', 'PUT'] } 
});

const PAYOUTS = { 'RED': 2, 'BLUE': 2, 'GREEN': 14, 'ODD': 2, 'EVEN': 2 };
const BONUS_ROLLOVER_MULTIPLIER = 5;
const INFLUENCER_NGR_WIN_RATE = 0.03; 
const INFLUENCER_NGR_LOSS_RATE = 0.05; 
const AFFILIATE_CPA_VALUE = 5.00; 

// =================================================================================
// 2. O CORAÇÃO DO MULTIPLAYER (ESTADO GLOBAL DO JOGO)
// =================================================================================
let globalGameState = 'BETTING'; // Pode ser 'BETTING' ou 'ROLLING'
let globalTimeLeft = 15; // 15 segundos para apostar
let globalCurrentResult = null;

// 🟢 A NOVA MEMÓRIA DO SERVIDOR
const MAX_HISTORY = 50; // Quantas rodadas vamos lembrar
let gameHistory = []; // O array que guarda tudo

// Função que roda o relógio do Cassino 24/7
function startGlobalGameLoop() {
    console.log("⏰ Relógio Global do Cassino Iniciado!");
    
    setInterval(async () => {
        if (globalGameState === 'BETTING') {
            globalTimeLeft--;
            // Grita para todos os jogadores no site: "O tempo está passando!"
            io.emit('game_timer', { state: globalGameState, time: globalTimeLeft });

            if (globalTimeLeft <= 0) {
                globalGameState = 'ROLLING';
                globalTimeLeft = 5; // 5 segundos de animação da roleta
                globalCurrentResult = await generateNewResult(); 
                // 🟢 GUARDA O RESULTADO NA MEMÓRIA!
                gameHistory.push(globalCurrentResult);
                // Se passar do limite, apaga a bolinha mais velha (para não travar o servidor)
                if (gameHistory.length > MAX_HISTORY) {
                    gameHistory.shift(); 
                }
                // Grita para todos os jogadores: "A roleta girou! Eis o resultado!"
                io.emit('game_roll', { result: globalCurrentResult });
            }
        } else if (globalGameState === 'ROLLING') {
            globalTimeLeft--;
            io.emit('game_timer', { state: globalGameState, time: globalTimeLeft });

            if (globalTimeLeft <= 0) {
                globalGameState = 'BETTING';
                globalTimeLeft = 15;
                globalCurrentResult = null;
                
                // Grita para todos os jogadores: "Nova rodada! Façam as apostas!"
                io.emit('game_new_round');
            }
        }
    }, 1000); // Roda a cada 1 segundo (1000ms)
}

// Quando um jogador abre o site, ele se conecta aqui:
io.on('connection', (socket) => {
    console.log(`🔌 Novo jogador conectado na sala: ${socket.id}`);
    
    // Assim que ele entra, mandamos o tempo atual para a tela dele não ficar travada
    socket.emit('game_sync', { state: globalGameState, time: globalTimeLeft });

    socket.on('disconnect', () => {
        console.log(`❌ Jogador saiu da sala: ${socket.id}`);
    });
});

// =================================================================================
// 3. CONEXÃO COM A BASE DE DADOS
// =================================================================================
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB Atlas conectado com sucesso!');
        
        const defaultPasswordHash = await bcrypt.hash('teste123', 10); 
        await User.findOneAndUpdate( { userId: 'user_1' }, { userId: 'user_1', username: 'TEST_USER', passwordHash: defaultPasswordHash, balance: 1000.00, role: 'admin' }, { upsert: true, new: true, setDefaultsOnInsert: true } );
        
        const influencerPasswordHash = await bcrypt.hash('influencer123', 10);
        await User.findOneAndUpdate( { username: 'TEST_INFLUENCER' }, { $set: { userId: 'influencer_1', username: 'TEST_INFLUENCER', passwordHash: influencerPasswordHash, balance: 1000.00, role: 'influencer' } }, { upsert: true, new: true, setDefaultsOnInsert: true } );
        
        // ATENÇÃO: Agora iniciamos o 'server' (que tem o Socket.io) em vez do 'app'
        server.listen(PORT, () => {
            console.log(`\n======================================================`);
            console.log(`| Servidor MultiPlayer a rodar na porta: ${PORT}       |`);
            console.log(`| Pressione CTRL+C para sair.                          |`);
            console.log(`======================================================\n`);
            
            // Liga o relógio assim que o servidor subir
            startGlobalGameLoop();
        });
    } catch (err) {
        console.error('❌ ERRO NA CONEXÃO COM O MONGODB:', err.message);
        process.exit(1); 
    }
};

// =================================================================================
// 4. MIDDLEWARES E LÓGICA DE SORTEIO
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
    
    let finalNumber, finalParity, finalTranslatedParity;
    if (color === 'GREEN') {
        finalNumber = '?'; 
        finalParity = null; 
        finalTranslatedParity = null; 
    } else {
        finalNumber = num; 
        finalParity = (num % 2 === 0) ? 'EVEN' : 'ODD'; 
        finalTranslatedParity = (finalParity === 'EVEN' ? 'PAR' : 'ÍMPAR'); 
    }

    const translatedColor = (color === 'RED' ? 'VERMELHO' : (color === 'BLUE' ? 'AZUL' : 'VERDE'));

    return { color, number: finalNumber, parity: finalParity, translatedColor, translatedParity: finalTranslatedParity, overridden: isOverridden };
}

// =================================================================================
// 5. ROTAS (Endpoints da API)
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

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
            return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
        }
        user.lastLogin = new Date();
        await user.save();
        
        const token = jwt.sign({ userId: user.userId, username: user.username, role: user.role, avatar: user.avatar }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.json({ success: true, token, userId: user.userId, username: user.username, balance: user.balance.toFixed(2), role: user.role });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro interno.' });
    }
});

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
            
            // 🟢 A MÁGICA: O servidor agora usa EXATAMENTE a última bola que foi sorteada no histórico global!
            if (gameHistory.length === 0) {
                return res.status(400).json({ success: false, message: "Aguarde o primeiro sorteio da rodada." });
            }
            const finalResult = gameHistory[gameHistory.length - 1]; 
            
            let isWin = false;
        if (betType === 'COLOR') { 
            isWin = (betValue === finalResult.color); 
        } 
        else if (betType === 'PARITY') { 
            if (finalResult.color === 'GREEN') {
                isWin = false; 
            } else {
                isWin = (betValue === finalResult.parity); 
            }
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
        io.emit('new_bet', { username, avatar, betValue, amount, isWin, winnings });
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
        // Se a memória estiver vazia (porque o servidor acabou de ser ligado), 
        // gera 10 rodadas rápidas para o site não ficar em branco para o primeiro jogador.
        if (gameHistory.length === 0) {
            for(let i = 0; i < 10; i++) {
                const result = await generateNewResult();
                gameHistory.push(result);
            }
        }
        
        // 🟢 Devolve o histórico real completo!
        res.json({ success: true, history: gameHistory });
    } catch (error) {
        console.error("Erro ao enviar histórico inicial:", error);
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

app.post('/api/withdraw', authMiddleware, async (req, res) => {
    const { userId } = req.user; 
    const { amount, pixKey } = req.body; 

    if (!amount || amount <= 0 || isNaN(amount)) {
        return res.status(400).json({ success: false, message: 'Valor de saque inválido.' });
    }

    try {
        const user = await User.findOne({ userId });

        if (!user) {
            return res.status(404).json({ success: false, message: 'Utilizador não encontrado.' });
        }

        if (user.balance < amount) {
            return res.status(400).json({ 
                success: false, 
                message: `Saldo insuficiente. O seu saldo sacável é R$ ${user.balance.toFixed(2)}` 
            });
        }

        user.balance -= amount;

        await FinancialTransaction.create({ 
            userId: user.userId, 
            username: user.username, 
            type: 'WITHDRAWAL', 
            amount: amount, 
            initiatedBy: 'USER', 
        });

        await user.save();

        res.json({ 
            success: true, 
            message: `Saque via PIX de R$ ${amount.toFixed(2)} solicitado com sucesso!`, 
            newBalance: user.balance 
        });

    } catch (error) {
        console.error("Erro ao processar saque:", error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
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

// ===== ROTAS DE PERFIL E CARTEIRA DO UTILIZADOR =====

// 1. Busca os dados para preencher as abas do painel
app.get('/api/user/profile-data', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.user;
        // ATUALIZAÇÃO: Adicionado 'cpf' na lista do select para enviar ao front-end
        const user = await User.findOne({ userId }).select('username email avatar cpf role'); 
        const gameHistory = await GameLog.find({ userId }).sort({ createdAt: -1 }).limit(500);
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'Utilizador não encontrado.' });
        }
        res.json({ success: true, profile: user, history: gameHistory });
    } catch (error) {
        console.error("Erro ao buscar dados do perfil:", error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 2. Atualiza o perfil (Avatar, Email e CPF)
app.put('/api/user/profile', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.user;
        // ATUALIZAÇÃO: Extrai o CPF do request
        const { avatar, email, cpf } = req.body; 
        
        const userToUpdate = await User.findOne({ userId });
        if (!userToUpdate) {
            return res.status(404).json({ success: false, message: 'Utilizador não encontrado.' });
        }
        
        if (avatar) userToUpdate.avatar = avatar;
        if (email !== undefined) userToUpdate.email = email;
        if (cpf !== undefined) userToUpdate.cpf = cpf; // Atualiza o CPF
        
        await userToUpdate.save();
        res.json({ success: true, message: 'Perfil atualizado com sucesso.' });
    } catch (error) {
        console.error("Erro ao atualizar perfil:", error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 3. Extrato Financeiro (Aba Carteira)
app.get('/api/user/wallet-history', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.user;
        const transactions = await FinancialTransaction.find({ userId })
            .sort({ createdAt: -1 })
            .limit(20);
            
        res.json({ success: true, transactions });
    } catch (error) {
        console.error("Erro ao buscar histórico da carteira:", error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// ===== ROTAS SOCIAIS =====
app.post('/api/chat', authMiddleware, async (req, res) => {
    const { userId, username, avatar, role } = req.user;
    const { message } = req.body;
    if (!message || message.trim() === '' || message.length > 200) { return res.status(400).json({ success: false, message: 'Mensagem inválida.' }); }
    try {
        const newMessage = await ChatMessage.create({ userId, username, avatar, role, message: message.trim() });
        io.emit('chat_message', newMessage);
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
    if (req.user.role !== 'influencer' && req.user.role !== 'admin' && req.user.role !== 'affiliate') { 
    return res.status(403).json({ success: false, message: 'Acesso negado.' }); 
}
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