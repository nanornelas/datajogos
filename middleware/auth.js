// backend/middleware/auth.js

const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    // 1. Verificar se o cabeçalho Authorization existe e começa com 'Bearer '
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // CORREÇÃO CRÍTICA: Retorna imediatamente 401 e encerra a requisição.
        return res.status(401).json({ success: false, message: 'Acesso negado. Token não fornecido.' });
    }

    // 2. Extrair o token (removendo "Bearer ")
    const token = authHeader.split(' ')[1];

    // 3. Verificar e decodificar o token
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Anexar os dados do usuário à requisição
        req.user = decoded; 

        // Se for válido, prossegue para a rota principal
        next();

    } catch (err) {
        // CORREÇÃO: Trata a falha de token e retorna imediatamente
        return res.status(401).json({ success: false, message: 'Token inválido ou expirado.' });
    }
};

module.exports = authMiddleware;