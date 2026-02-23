import * as Auth from './auth.js'; 
import { handleBet, initializeGameCycle } from './game.js'; 
import { initializeSocialFeatures, stopLiveFeed } from './social.js'; 
import { loadAffiliateData, setupCopyButton, setupCopyLinkButton } from './afiliado.js';
import { hideAuthModal, openSettingsModal, initializeSettingsModal } from './auth.js'; 
import { API_BASE_URL, getAuthHeaders } from './utils.js'; 

// ==========================================
// FUNÇÕES DE SAQUE PIX (ISOLAMENTO TOTAL + MÁSCARA FINANCEIRA)
// ==========================================

window.openWithdrawModal = () => {
    // Remove qualquer versão antiga que tenha ficado presa no HTML
    const oldModal = document.getElementById('withdraw-modal-blindado');
    if (oldModal) oldModal.remove();

    // Cria a janela blindada com input type="text"
    const modalHtml = `
        <div id="withdraw-modal-blindado" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: rgba(0, 0, 0, 0.85); z-index: 2147483647; display: flex; justify-content: center; align-items: center; pointer-events: auto; backdrop-filter: blur(5px);">
            <div style="background-color: #1A1A1D; border: 1px solid #00BCD4; border-radius: 12px; padding: 30px; width: 90%; max-width: 400px; box-shadow: 0 10px 40px rgba(0, 188, 212, 0.3); text-align: center; position: relative;">
                <button id="close-blindado-btn" style="position: absolute; top: 15px; right: 20px; background: none; border: none; font-size: 2em; color: #888; cursor: pointer; padding: 0; line-height: 1;">&times;</button>
                <h2 style="color: #00BCD4; margin-top: 0; margin-bottom: 10px;">Saque via PIX</h2>
                <p style="color: #aaa; font-size: 0.9em; margin-bottom: 25px;">O dinheiro cai na sua conta em segundos.</p>
                
                <form id="form-blindado">
                    <div style="margin-bottom: 15px; text-align: left;">
                        <label style="color: #B0B0B0; font-size: 0.9em; font-weight: bold;">Valor (R$)</label>
                        <input type="text" inputmode="numeric" id="amount-blindado" placeholder="0,00" required style="width: 100%; padding: 12px; margin-top: 8px; background: #111; border: 1px solid #444; color: white; border-radius: 6px; box-sizing: border-box; font-size: 1.2em; font-weight: bold;">
                    </div>
                    <div style="margin-bottom: 20px; text-align: left;">
                        <label style="color: #B0B0B0; font-size: 0.9em; font-weight: bold;">Chave PIX</label>
                        <input type="text" id="pix-blindado" placeholder="CPF, Email ou Celular" required style="width: 100%; padding: 12px; margin-top: 8px; background: #111; border: 1px solid #444; color: white; border-radius: 6px; box-sizing: border-box; font-size: 1em;">
                    </div>
                    
                    <div id="status-blindado" style="min-height: 20px; font-weight: bold; margin-bottom: 15px;"></div>
                    
                    <button type="submit" style="width: 100%; padding: 14px; background-color: #00BCD4; color: #121212; border: none; border-radius: 6px; font-weight: bold; font-size: 1.1em; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
                        Solicitar Saque
                    </button>
                </form>
            </div>
        </div>
    `;
    
    // Injeta a janela no corpo da página
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // MÁSCARA FINANCEIRA (Centavos e Milhares em Tempo Real)
    const amountInput = document.getElementById('amount-blindado');
    amountInput.addEventListener('input', function (e) {
        // 1. Pega apenas os números digitados (remove letras, vírgulas e pontos velhos)
        let value = e.target.value.replace(/\D/g, '');
        
        // 2. Se apagar tudo, deixa vazio
        if (value === '') {
            e.target.value = '';
            return;
        }

        // 3. Converte para inteiro para remover zeros à esquerda irrelevantes
        value = parseInt(value, 10).toString();

        // 4. Preenche com zeros à esquerda se tiver menos de 3 dígitos (ex: digita '5' -> '005')
        value = value.padStart(3, '0');

        // 5. Separa os centavos da parte inteira
        let decimal = value.slice(-2);
        let integer = value.slice(0, -2);

        // 6. Coloca o ponto a cada 3 casas na parte inteira (ex: 1000 -> 1.000)
        integer = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

        // 7. Junta tudo com a vírgula brasileira
        e.target.value = integer + ',' + decimal;
    });

    // Adiciona as funções de fechar
    const blindadoModal = document.getElementById('withdraw-modal-blindado');
    document.getElementById('close-blindado-btn').onclick = (e) => { e.preventDefault(); blindadoModal.remove(); };
    blindadoModal.onclick = (e) => { if (e.target === blindadoModal) blindadoModal.remove(); };

    // Lógica de Envio para o Back-end
    document.getElementById('form-blindado').onsubmit = async (e) => {
        e.preventDefault();
        const statusEl = document.getElementById('status-blindado');
        const token = localStorage.getItem('jwtToken');
        
        // TRADUTOR FINANCEIRO: Transforma "1.020,50" -> "1020.50" pro servidor entender
        let rawInputValue = document.getElementById('amount-blindado').value;
        let sanitizedValue = rawInputValue.replace(/\./g, '').replace(',', '.');
        const amount = parseFloat(sanitizedValue);
        
        const pixKey = document.getElementById('pix-blindado').value;
        
        // Validação básica
        if (amount < 10) {
            statusEl.textContent = "O valor mínimo de saque é R$ 10,00.";
            statusEl.style.color = '#E53935';
            return;
        }

        if (!token) return statusEl && (statusEl.textContent = "Sessão expirada. Faça login.", statusEl.style.color = '#E53935');
        if (statusEl) { statusEl.style.color = 'white'; statusEl.textContent = 'Processando...'; }

        try {
            const response = await fetch(`${API_BASE_URL}/withdraw`, {
                method: 'POST',
                headers: getAuthHeaders(token),
                body: JSON.stringify({ amount, pixKey })
            });
            const data = await response.json();

            if (data.success) {
                if (statusEl) { statusEl.style.color = '#4CAF50'; statusEl.textContent = data.message; }
                Auth.setCurrentBalance(data.newBalance); 
                setTimeout(() => blindadoModal.remove(), 2000);
            } else {
                if (statusEl) { statusEl.style.color = '#E53935'; statusEl.textContent = data.message; }
            }
        } catch (error) {
            if (statusEl) { statusEl.style.color = '#E53935'; statusEl.textContent = "Erro de conexão."; }
        }
    };
};

// ==========================================
// ESCUTA DE CLIQUES NO MENU E CARTEIRA
// ==========================================
document.addEventListener('click', (e) => {
    const clickedLink = e.target.closest('#withdraw-link');
    if (clickedLink) {
        e.preventDefault();
        
        // Esconde a lista suspensa com suavidade
        const dropdown = document.getElementById('user-dropdown-menu');
        if (dropdown) {
            dropdown.style.opacity = '0';
            dropdown.style.visibility = 'hidden';
            setTimeout(() => {
                dropdown.style.opacity = '';
                dropdown.style.visibility = '';
            }, 300); 
        }
        
        window.openWithdrawModal();
    }
});

async function initializeApp() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref');
        if (refCode) localStorage.setItem('referralCodeFromLink', refCode);
    } catch (error) {}

    const isLoggedIn = await Auth.initializeUI(); 

    const loginButton = document.getElementById('login-submit-button');
    if (loginButton) loginButton.addEventListener('click', Auth.handleAuth);
    
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
                groupAffiliateCode.style.display = localStorage.getItem('referralCodeFromLink') ? 'none' : 'flex';
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
    if (closeButtonAuth) closeButtonAuth.addEventListener('click', hideAuthModal); 

    const overlayAuth = document.getElementById('auth-modal-overlay');
    if (overlayAuth) {
        overlayAuth.addEventListener('click', (e) => {
            if (e.target === overlayAuth) hideAuthModal();
        });
    }

    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) logoutButton.addEventListener('click', () => { Auth.handleLogout(); });

    const settingsLink = document.getElementById('settings-link');
    if (settingsLink) {
        settingsLink.addEventListener('click', (e) => {
            e.preventDefault();
            Auth.openSettingsModal(); 
        });
    }

    const currentPath = window.location.pathname;

    if (currentPath.includes('afiliado.html')) {
        if (isLoggedIn) loadAffiliateData(); 
        setupCopyButton();
        setupCopyLinkButton();
        setupWithdrawalModal();
    } else if (currentPath.includes('admin.html')) {
        // Scripts do Admin
    } else {
        Auth.initializeSettingsModal(); 

        document.querySelectorAll('.bet-button').forEach(button => {
            if (typeof handleBet === 'function') {
                button.addEventListener('click', (e) => handleBet(e));
            }
        });

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
                betAmountInput.value = isNaN(currentValue) || currentValue < minValue ? minValue : currentValue + 1;
                updateStepperButtons();
            });
            betAmountInput.addEventListener('input', updateStepperButtons);
            updateStepperButtons(); 
        }
        
        if (isLoggedIn) {
            initializeGameCycle();
            initializeSocialFeatures();
        }
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);