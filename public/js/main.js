import * as Auth from './auth.js'; 
import { handleBet } from './game.js'; 
import { initializeSocialFeatures, stopLiveFeed } from './social.js'; 
import { loadAffiliateData, setupCopyButton, setupCopyLinkButton } from './afiliado.js';

// Importa a função para esconder o modal de autenticação
import { hideAuthModal, openSettingsModal, initializeSettingsModal } from './auth.js'; // <-- Importações de Auth consolidadas

function initializeApp() {
    // 1. Captura de Link de Referência (Executa em todas as páginas)
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref'); // Procura por ?ref=...

        if (refCode) {
            localStorage.setItem('referralCodeFromLink', refCode);
            console.log("Código de referência capturado do URL:", refCode);
            // window.history.replaceState(null, '', window.location.pathname);
        }
    } catch (error) {
        console.error("Erro ao processar URL de referência:", error);
    }

    // 2. Inicializa a UI Base (Header, Modal Auth) (Executa em todas as páginas)
    Auth.initializeUI();

    // 3. Listeners Globais (para elementos que existem em TODAS as páginas com o header/modal)
    
    // Listeners do Modal de Autenticação
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
            const errorMessageEl = document.getElementById('auth-error-message'); // Adicionado para limpar

            if (!button || !groupConfirmPass || !groupAffiliateCode || !e.target) return; // Segurança

            if (isLogin) {
                // A mudar para a tela de REGISTO
                button.dataset.action = 'register';
                button.textContent = 'Registar-se';
                e.target.textContent = 'Voltar para Login';
                groupConfirmPass.style.display = 'flex';

                // Lógica de Referência
                const codeFromLink = localStorage.getItem('referralCodeFromLink');
                if (codeFromLink) {
                    groupAffiliateCode.style.display = 'none';
                } else {
                    groupAffiliateCode.style.display = 'flex';
                }
            } else {
                // A mudar de volta para LOGIN
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
    
    // Inicializa o Modal de Configurações (Global)
    Auth.initializeSettingsModal();


    // 4. Lógica Específica da Página
    const currentPath = window.location.pathname;

    if (currentPath.includes('afiliado.html')) {
        // --- SE ESTIVER NA PÁGINA DE AFILIADO ---
        console.log("A carregar scripts do Painel de Afiliado...");
        loadAffiliateData();
        setupCopyButton();
        setupCopyLinkButton();
        
    } else if (currentPath.includes('admin.html')) {
        // --- SE ESTIVER NA PÁGINA DE ADMIN (Exemplo futuro) ---
        // console.log("A carregar scripts do Painel de Admin...");
        // loadAdminData(); 
        
    } else if (currentPath.includes('influencer.html')) {
        // --- SE ESTIVER NA PÁGINA DE INFLUENCER (Exemplo futuro) ---
        // console.log("A carregar scripts do Painel de Influencer...");
        // loadInfluencerData();

    } else {
        // --- SE ESTIVER NA PÁGINA PRINCIPAL (JOGO) ---
        console.log("A carregar scripts do Jogo...");
        
        // Listener dos botões de aposta
        document.querySelectorAll('.bet-button').forEach(button => {
            if (typeof handleBet === 'function') {
                button.addEventListener('click', (e) => handleBet(e));
            } else {
                console.error("Função handleBet não encontrada.");
            }
        });

        // Lógica dos botões + e - da aposta (Stepper)
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
        // (initializeSocialFeatures é chamado pelo auth.js após login, por isso não precisa estar aqui)
    }
}

// Inicia a aplicação quando o DOM está pronto
document.addEventListener('DOMContentLoaded', initializeApp);