// --- 1. ADICIONAR IMPORTAÇÃO ---
// Importa as funções necessárias dos outros módulos
import * as Auth from './auth.js'; // Já existente
import { handleBet } from './game.js'; // Já existente
// openSettingsModal e initializeSettingsModal já vêm de Auth
import { initializeSocialFeatures, stopLiveFeed } from './social.js'; // Já existente

// Importa a função para esconder o modal de autenticação
import { hideAuthModal } from './auth.js'; // <-- ADICIONAR ESTA LINHA

function initializeApp() {
    // Esta função (do auth.js) agora decide se mostra o modal ou inicia o app
    Auth.initializeUI();

    // --- LISTENERS EXISTENTES (MANTÊM-SE) ---
    const loginButton = document.getElementById('login-submit-button');
    if (loginButton) {
        loginButton.addEventListener('click', Auth.handleAuth);
    }

    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            Auth.handleLogout();
            // stopLiveFeed(); // stopLiveFeed agora é chamado DENTRO de handleLogout
        });
    }

    const settingsLink = document.getElementById('settings-link');
    if (settingsLink) {
        settingsLink.addEventListener('click', (e) => {
            e.preventDefault();
            Auth.openSettingsModal(); // Chama a função de Auth
        });
    }

    const registerLink = document.getElementById('show-register-link');
    if (registerLink) {
        registerLink.addEventListener('click', (e) => {
            e.preventDefault();
            const button = document.getElementById('login-submit-button');
            const groupConfirmPass = document.getElementById('group-confirm-password');
            const groupAffiliateCode = document.getElementById('group-affiliate-code');
            const errorMessageEl = document.getElementById('auth-error-message'); // Adicionado para limpar erro

            // Verifica se o botão e outros elementos existem antes de acessá-los
            if (button && groupConfirmPass && groupAffiliateCode && e.target) {
                const isLogin = button.dataset.action === 'login';
                if (isLogin) {
                    button.dataset.action = 'register';
                    button.textContent = 'Registar-se';
                    e.target.textContent = 'Voltar para Login';
                    groupConfirmPass.style.display = 'flex';
                    groupAffiliateCode.style.display = 'flex';
                } else {
                    button.dataset.action = 'login';
                    button.textContent = 'Entrar';
                    e.target.textContent = 'Criar Conta';
                    groupConfirmPass.style.display = 'none';
                    groupAffiliateCode.style.display = 'none';
                }
                if (errorMessageEl) errorMessageEl.textContent = ''; // Limpa erro ao trocar
            }
        });
    }

    // --- 2. ADICIONAR LISTENERS DO MODAL DE AUTENTICAÇÃO ---
    // Listener para o botão fechar (X) - Opcional, adicione se você colocou o botão no HTML
    const closeButtonAuth = document.getElementById('auth-modal-close-btn');
    if (closeButtonAuth) {
        closeButtonAuth.addEventListener('click', hideAuthModal); // Chama a função importada de auth.js
    }

    // Listener para fechar ao clicar FORA do conteúdo do modal (no overlay escuro)
    const overlayAuth = document.getElementById('auth-modal-overlay');
    if (overlayAuth) {
        overlayAuth.addEventListener('click', (e) => {
            // Verifica se o clique foi diretamente no overlay
            if (e.target === overlayAuth) {
                hideAuthModal(); // Chama a função importada de auth.js
            }
        });
    }
    // --- FIM DOS LISTENERS DO MODAL DE AUTENTICAÇÃO ---


    // Listener dos botões de aposta (Mantém-se)
    document.querySelectorAll('.bet-button').forEach(button => {
        // Adiciona verificação para garantir que handleBet existe
        if (typeof handleBet === 'function') {
           button.addEventListener('click', (e) => handleBet(e));
        } else {
           console.error("Função handleBet não encontrada/importada corretamente.");
        }
    });

    // Inicializa APENAS os eventos do modal de configurações aqui
    Auth.initializeSettingsModal(); // Chama a função de Auth

    // Não chama mais initializeSocialFeatures() aqui, pois é chamado por auth.js
    // // initializeSocialFeatures(); // <-- REMOVIDA/COMENTADA
}

// Inicia a aplicação quando o DOM está pronto
document.addEventListener('DOMContentLoaded', initializeApp);