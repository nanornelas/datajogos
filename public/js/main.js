import * as Auth from './auth.js'; 
import { handleBet, initializeGameCycle } from './game.js'; // Importa initializeGameCycle
import { initializeSocialFeatures, stopLiveFeed } from './social.js'; 
import { loadAffiliateData, setupCopyButton, setupCopyLinkButton } from './afiliado.js';

// Importa funções do modal de Auth
import { hideAuthModal, openSettingsModal, initializeSettingsModal } from './auth.js'; 

async function initializeApp() {
    
    // --- 1. LÓGICA DE ARRANQUE GLOBAL (Executa em TODAS as páginas) ---

    // Captura o código de referência (se existir no URL)
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref');
        if (refCode) {
            localStorage.setItem('referralCodeFromLink', refCode);
            console.log("Código de referência capturado do URL:", refCode);
            // window.history.replaceState(null, '', window.location.pathname);
        }
    } catch (error) {
        console.error("Erro ao processar URL de referência:", error);
    }

    // Inicializa a UI de Autenticação (mostra modal OU dados do user no header)
    // ESTA FUNÇÃO AGORA CHAMA 'fetchBalance' INTERNAMENTE SE ESTIVER LOGADO
    // E RETORNA 'true' SE ESTIVER LOGADO, 'false' SE NÃO.
    const isLoggedIn = await Auth.initializeUI(); 

    // --- 2. LISTENERS GLOBAIS (Elementos que existem em TODAS as páginas) ---

    // Listeners do Modal de Autenticação (o modal existe em todas as páginas)
    const loginButton = document.getElementById('login-submit-button');
    if (loginButton) {
        loginButton.addEventListener('click', Auth.handleAuth);
    }
    
    const registerLink = document.getElementById('show-register-link');
    if (registerLink) {
        registerLink.addEventListener('click', (e) => {
            e.preventDefault();
            const button = document.getElementById('login-submit-button'); 
            const isLogin = button.dataset.action === 'login';
            const groupConfirmPass = document.getElementById('group-confirm-password');
            const groupAffiliateCode = document.getElementById('group-affiliate-code');
            const errorMessageEl = document.getElementById('auth-error-message');

            if (!button || !groupConfirmPass || !groupAffiliateCode || !e.target) return; 

            if (isLogin) {
                button.dataset.action = 'register';
                button.textContent = 'Registar-se';
                e.target.textContent = 'Voltar para Login';
                groupConfirmPass.style.display = 'flex';
                const codeFromLink = localStorage.getItem('referralCodeFromLink');
                if (codeFromLink) {
                    groupAffiliateCode.style.display = 'none';
                } else {
                    groupAffiliateCode.style.display = 'flex';
                }
            } else {
                button.dataset.action = 'login';
                button.textContent = 'Entrar';
                e.target.textContent = 'Criar Conta';
                groupConfirmPass.style.display = 'none';
                groupAffiliateCode.style.display = 'none';
            }
            if (errorMessageEl) errorMessageEl.textContent = '';
        });
    }

    const closeButtonAuth = document.getElementById('auth-modal-close-btn');
    if (closeButtonAuth) {
        closeButtonAuth.addEventListener('click', hideAuthModal); 
    }

    const overlayAuth = document.getElementById('auth-modal-overlay');
    if (overlayAuth) {
        overlayAuth.addEventListener('click', (e) => {
            if (e.target === overlayAuth) {
                hideAuthModal();
            }
        });
    }

    // Listeners da Barra de Navegação (Globais)
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            Auth.handleLogout();
            // stopLiveFeed() é chamado dentro de handleLogout
        });
    }

    const settingsLink = document.getElementById('settings-link');
    if (settingsLink) {
        settingsLink.addEventListener('click', (e) => {
            e.preventDefault();
            Auth.openSettingsModal(); 
        });
    }
    
    // --- 3. LÓGICA ESPECIALIZADA (Depende da página atual) ---
    
    const currentPath = window.location.pathname;

    if (currentPath.includes('afiliado.html')) {
        // --- SE ESTIVER NA PÁGINA DE AFILIADO ---
        console.log("A carregar scripts do Painel de Afiliado...");
        if (isLoggedIn) {
            loadAffiliateData(); // Carrega os dados se estiver logado
        }
        // Configura os botões (eles existem nesta página)
        setupCopyButton();
        setupCopyLinkButton();
        
    } else if (currentPath.includes('admin.html')) {
        // --- SE ESTIVER NA PÁGINA DE ADMIN (Exemplo futuro) ---
        // console.log("A carregar scripts do Painel de Admin...");
        // if (isLoggedIn) { loadAdminData(); }
        
    } else {
        // --- SE ESTIVER NA PÁGINA PRINCIPAL (JOGO) ---
        console.log("A carregar scripts do Jogo...");
        
        // Inicializa o Modal de Configurações (SÓ existe na página do jogo)
        Auth.initializeSettingsModal(); // <-- MOVIDO PARA AQUI

        // Configura listeners dos botões de aposta
        document.querySelectorAll('.bet-button').forEach(button => {
            if (typeof handleBet === 'function') {
                button.addEventListener('click', (e) => handleBet(e));
            } else {
                console.error("Função handleBet não encontrada.");
            }
        });

        // Configura listeners do Stepper (+/-)
        const betAmountInput = document.getElementById('bet-amount');
        const betDecreaseBtn = document.getElementById('bet-decrease');
        const betIncreaseBtn = document.getElementById('bet-increase');

        if (betAmountInput && betDecreaseBtn && betIncreaseBtn) {
            const updateStepperButtons = () => {
                const currentValue = parseInt(betAmountInput.value, 10);
                const minValue = parseInt(betAmountInput.min, 10) || 1;
                betDecreaseBtn.disabled = (currentValue <= minValue);
            };
            betDecreaseBtn.addEventListener('click', () => {
                let currentValue = parseInt(betAmountInput.value, 10);
                const minValue = parseInt(betAmountInput.min, 10) || 1;
                betAmountInput.value = Math.max(minValue, currentValue - 1); 
                updateStepperButtons();
            });
            betIncreaseBtn.addEventListener('click', () => {
                let currentValue = parseInt(betAmountInput.value, 10);
                const minValue = parseInt(betAmountInput.min, 10) || 1;
                if (isNaN(currentValue) || currentValue < minValue) {
                    currentValue = minValue; 
                } else {
                    currentValue += 1;
                }
                betAmountInput.value = currentValue;
                updateStepperButtons();
            });
            betAmountInput.addEventListener('input', updateStepperButtons);
            updateStepperButtons(); 
        }
        
        // Se estiver logado na página do jogo, inicia o jogo e o chat
        if (isLoggedIn) {
            console.log("Utilizador logado na página do jogo. A iniciar Jogo e Chat...");
            initializeGameCycle();
            initializeSocialFeatures();
        }
    }
}

// Inicia a aplicação quando o DOM está pronto
document.addEventListener('DOMContentLoaded', initializeApp);