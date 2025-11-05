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
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref'); // Procura por ?ref=...

        if (refCode) {
            // Guarda o código do link no localStorage
            localStorage.setItem('referralCodeFromLink', refCode);
            console.log("Código de referência capturado do URL:", refCode);

            // Opcional: Limpa o URL para que o ?ref=... não fique visível
            // window.history.replaceState(null, '', window.location.pathname);
        }
    } catch (error) {
        console.error("Erro ao processar URL de referência:", error);
    }

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

    // Substitua o seu 'registerLink.addEventListener' por este:

    const registerLink = document.getElementById('show-register-link');
    if (registerLink) {
        registerLink.addEventListener('click', (e) => {
            e.preventDefault();
            const button = document.getElementById('login-submit-button'); 
            const isLogin = button.dataset.action === 'login';
            const groupConfirmPass = document.getElementById('group-confirm-password');
            const groupAffiliateCode = document.getElementById('group-affiliate-code');

            if (isLogin) {
                // A mudar para a tela de REGISTO
                button.dataset.action = 'register';
                button.textContent = 'Registar-se';
                e.target.textContent = 'Voltar para Login';
                if (groupConfirmPass) groupConfirmPass.style.display = 'flex';

                // --- LÓGICA DE REFERÊNCIA ADICIONADA ---
                // Verifica se um código de link está guardado
                const codeFromLink = localStorage.getItem('referralCodeFromLink');
                if (codeFromLink) {
                    // Se veio do link, ESCONDE o campo de código manual
                    if (groupAffiliateCode) groupAffiliateCode.style.display = 'none';
                    console.log("A registar com código de link. Campo manual escondido.");
                } else {
                    // Se NÃO veio do link, MOSTRA o campo de código manual
                    if (groupAffiliateCode) groupAffiliateCode.style.display = 'flex';
                }
                // --- FIM DA LÓGICA ---

            } else {
                // A mudar de volta para LOGIN
                button.dataset.action = 'login';
                button.textContent = 'Entrar';
                e.target.textContent = 'Criar Conta';
                if (groupConfirmPass) groupConfirmPass.style.display = 'none';
                if (groupAffiliateCode) groupAffiliateCode.style.display = 'none'; // Esconde no login
            }
            document.getElementById('auth-error-message').textContent = '';
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
// --- LÓGICA DOS BOTÕES + E - DA APOSTA (STEPPER) ---
    const betAmountInput = document.getElementById('bet-amount');
    const betDecreaseBtn = document.getElementById('bet-decrease');
    const betIncreaseBtn = document.getElementById('bet-increase');

    if (betAmountInput && betDecreaseBtn && betIncreaseBtn) {

        // Função para atualizar o estado dos botões (desabilitar '-' se o valor for 1)
        const updateStepperButtons = () => {
            const currentValue = parseInt(betAmountInput.value, 10);
            const minValue = parseInt(betAmountInput.min, 10) || 1;
            betDecreaseBtn.disabled = (currentValue <= minValue);
        };

        // Listener para o botão '-' (Diminuir)
        betDecreaseBtn.addEventListener('click', () => {
            let currentValue = parseInt(betAmountInput.value, 10);
            const minValue = parseInt(betAmountInput.min, 10) || 1;
            // Usa Math.max para garantir que não fique abaixo do mínimo
            betAmountInput.value = Math.max(minValue, currentValue - 1); 
            updateStepperButtons();
        });

        // Listener para o botão '+' (Aumentar)
        betIncreaseBtn.addEventListener('click', () => {
            let currentValue = parseInt(betAmountInput.value, 10);
            const minValue = parseInt(betAmountInput.min, 10) || 1;
            if (isNaN(currentValue) || currentValue < minValue) {
                currentValue = minValue; // Reseta se for inválido
            } else {
                currentValue += 1;
            }
            betAmountInput.value = currentValue;
            updateStepperButtons();
        });

        // Atualiza botões se o utilizador digitar manualmente
        betAmountInput.addEventListener('input', updateStepperButtons);
        
        // Define o estado inicial dos botões no carregamento
        updateStepperButtons(); 
    }

    // Inicializa APENAS os eventos do modal de configurações aqui
    Auth.initializeSettingsModal(); // Chama a função de Auth

    // Não chama mais initializeSocialFeatures() aqui, pois é chamado por auth.js
    // // initializeSocialFeatures(); // <-- REMOVIDA/COMENTADA
}

// Inicia a aplicação quando o DOM está pronto
document.addEventListener('DOMContentLoaded', initializeApp);