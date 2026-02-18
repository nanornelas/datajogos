import { initializeGameCycle, updateGameUI, stopGameCycle, processWinLoss } from './game.js'; 
import { API_BASE_URL, getAuthHeaders } from './utils.js';
import { initializeSocialFeatures, stopLiveFeed } from './social.js';

export let JWT_TOKEN = localStorage.getItem('jwtToken'); 
export let CURRENT_USER_ID = localStorage.getItem('userId');
export let USER_ROLE = localStorage.getItem('userRole'); 
export let currentBalance = 0.00;
export let currentBonusBalance = 0.00;
let currentBet = { type: null, value: null, amount: 0 };

const authModal = document.getElementById('auth-modal-overlay');

function showAuthModal() {
    if (authModal) {
        const errorMsg = authModal.querySelector('#auth-error-message');
        if (errorMsg) errorMsg.textContent = '';
        const button = authModal.querySelector('#login-submit-button');
        const registerLink = authModal.querySelector('#show-register-link');
        const groupConfirmPass = authModal.querySelector('#group-confirm-password');
        const groupAffiliateCode = authModal.querySelector('#group-affiliate-code');
        if (button && button.dataset.action === 'register') {
            button.dataset.action = 'login';
            button.textContent = 'Entrar';
            if(registerLink) registerLink.textContent = 'Criar Conta';
            if (groupConfirmPass) groupConfirmPass.style.display = 'none';
            if (groupAffiliateCode) groupAffiliateCode.style.display = 'none';
        }
        const loginForm = authModal.querySelector('#login-form');
        if(loginForm) loginForm.reset(); 

        authModal.style.display = 'flex'; 
        setTimeout(() => authModal.classList.add('active'), 10); 
    }
}

export function hideAuthModal() {
    if (authModal) {
        authModal.classList.remove('active'); 
        setTimeout(() => { authModal.style.display = 'none'; }, 300); 
    }
}

function updateUserUI(username, userRole) {
    const userDropdown = document.getElementById('user-dropdown');
    const userDisplayName = document.getElementById('user-display-name');
    const adminLink = document.getElementById('admin-panel-link');
    const influencerLink = document.getElementById('influencer-panel-link');
    const affiliateLink = document.getElementById('affiliate-panel-link');

    if (!userDropdown || !userDisplayName) return; 

    [adminLink, influencerLink, affiliateLink].forEach(link => { if(link) link.style.display = 'none'; });

    if (username) { 
        userDisplayName.textContent = `Olá, ${username}!`; 
        userDropdown.style.display = 'block'; 

        if (userRole === 'admin' && adminLink) adminLink.style.display = 'block';
        if ((userRole === 'admin' || userRole === 'influencer') && influencerLink) influencerLink.style.display = 'block';
        if (userRole === 'affiliate' && affiliateLink) affiliateLink.style.display = 'block';
    } else { 
        userDropdown.style.display = 'none'; 
    }
}

const AVATARS = ['👤', '👨', '👩', '🧑', '👽', '🤖', '👾', '🎃', '😈', '👻'];
let selectedAvatar = '';

export async function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.style.display = 'flex';
    
    const avatarGrid = document.getElementById('avatar-grid');
    if (avatarGrid.childElementCount === 0) {
        avatarGrid.innerHTML = AVATARS.map(avatar => `<span class="avatar-option" data-avatar="${avatar}">${avatar}</span>`).join('');
        document.querySelectorAll('.avatar-option').forEach(option => {
            option.addEventListener('click', () => {
                document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
                option.classList.add('selected');
                selectedAvatar = option.dataset.avatar;
                document.getElementById('current-avatar-display').textContent = selectedAvatar;
            });
        });
    }

    // Atualiza saldo na tela da Carteira
    const realEl = document.getElementById('wallet-modal-real');
    const bonusEl = document.getElementById('wallet-modal-bonus');
    if(realEl) realEl.textContent = `R$ ${currentBalance.toFixed(2)}`;
    if(bonusEl) bonusEl.textContent = `R$ ${currentBonusBalance.toFixed(2)}`;

    // Botão de Sacar dentro da Carteira
    const walletWithdrawBtn = document.getElementById('wallet-btn-withdraw');
    if (walletWithdrawBtn) {
        walletWithdrawBtn.onclick = () => {
            closeSettingsModal(); 
            // Usa a função blindada que definimos no main.js
            if (typeof window.openWithdrawModal === 'function') {
                window.openWithdrawModal();
            }
        };
    }
    const walletDepositBtn = document.getElementById('wallet-btn-deposit');
    if (walletDepositBtn) {
        walletDepositBtn.onclick = () => { alert("Sistema de Depósitos PIX será implementado na Fase 4.1!"); };
    }

    try {
        const headers = getAuthHeaders(JWT_TOKEN);
        const [profileRes, walletRes] = await Promise.all([
            fetch(`${API_BASE_URL}/user/profile-data`, { headers }),
            fetch(`${API_BASE_URL}/user/wallet-history`, { headers })
        ]);

        const profileData = await profileRes.json();
        const walletData = await walletRes.json();

        if(profileData.success) {
            document.getElementById('profile-email').value = profileData.profile.email || '';
            document.getElementById('profile-cpf').value = profileData.profile.cpf || '';
            document.getElementById('current-avatar-display').textContent = profileData.profile.avatar;
            selectedAvatar = profileData.profile.avatar;
            
            document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
            const currentAvatarEl = document.querySelector(`.avatar-option[data-avatar="${selectedAvatar}"]`);
            if (currentAvatarEl) currentAvatarEl.classList.add('selected');

            const historyBody = document.getElementById('game-history-body');
            if (profileData.history.length > 0) {
                historyBody.innerHTML = profileData.history.map(log => `
                    <tr>
                        <td>${new Date(log.createdAt).toLocaleString('pt-BR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'})}</td>
                        <td>R$ ${log.amount.toFixed(2)} em ${log.betValue}</td>
                        <td>${log.gameResult.color} (${log.gameResult.number})</td>
                        <td class="${log.isWin ? 'bet-won' : 'bet-lost'}">${log.isWin ? '+' : '-'} R$ ${log.isWin ? log.winnings.toFixed(2) : log.amount.toFixed(2)}</td>
                    </tr>
                `).join('');
            } else { historyBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Nenhum jogo registado.</td></tr>'; }
        }

        if(walletData.success) {
            const walletHistoryBody = document.getElementById('wallet-history-body');
            if (walletData.transactions.length > 0) {
                walletHistoryBody.innerHTML = walletData.transactions.map(tx => {
                    const isWithdraw = tx.type === 'WITHDRAWAL';
                    const typeLabel = isWithdraw ? 'Saque' : 'Depósito';
                    const typeClass = isWithdraw ? 'tx-type-withdraw' : 'tx-type-deposit';
                    const signal = isWithdraw ? '-' : '+';
                    return `
                    <tr>
                        <td>${new Date(tx.createdAt).toLocaleString('pt-BR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'})}</td>
                        <td class="${typeClass}">${typeLabel}</td>
                        <td><span class="tx-status-completed">Concluído</span></td>
                        <td class="${typeClass}">${signal} R$ ${tx.amount.toFixed(2)}</td>
                    </tr>
                `}).join('');
            } else { walletHistoryBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Nenhuma transação financeira ainda.</td></tr>'; }
        }
    } catch (error) { console.error("Erro ao carregar configurações:", error); }
}

export function closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.style.display = 'none';
}

async function saveProfileChanges() {
    const email = document.getElementById('profile-email').value;
    const cpf = document.getElementById('profile-cpf').value;
    const statusEl = document.getElementById('profile-status');
    statusEl.textContent = 'A salvar...';
    statusEl.style.color = '#FFEB3B';
    try {
        const response = await fetch(`${API_BASE_URL}/user/profile`, {
            method: 'PUT',
            headers: getAuthHeaders(JWT_TOKEN),
            // ATUALIZE O BODY PARA ENVIAR O CPF:
            body: JSON.stringify({ avatar: selectedAvatar, email: email, cpf: cpf }) 
        });
        const data = await response.json();
        if(data.success) {
            statusEl.textContent = 'Perfil salvo com sucesso!';
            statusEl.style.color = '#4CAF50';
            setTimeout(() => {
                closeSettingsModal();
                statusEl.textContent = '';
                window.location.reload(); 
            }, 1500);
        } else { throw new Error(data.message); }
    } catch (error) {
        statusEl.textContent = `Erro: ${error.message}`;
        statusEl.style.color = '#E53935';
    }
}

export function initializeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if(!modal) return;
// --- NOVA MÁSCARA DE CPF ---
    const cpfInput = document.getElementById('profile-cpf');
    if (cpfInput) {
        cpfInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, ''); // Remove letras
            if (value.length > 11) value = value.slice(0, 11); // Limite de 11 números
            // Aplica a formatação XXX.XXX.XXX-XX
            value = value.replace(/(\d{3})(\d)/, '$1.$2');
            value = value.replace(/(\d{3})(\d)/, '$1.$2');
            value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
            e.target.value = value;
        });
    }

    document.getElementById('settings-modal-close-btn').addEventListener('click', closeSettingsModal);
    document.getElementById('save-profile-btn').addEventListener('click', saveProfileChanges);
    const tabButtons = document.querySelectorAll('.settings-tab-btn');
    const tabPanes = document.querySelectorAll('.settings-tab-pane');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(`tab-${button.dataset.tab}`).classList.add('active');
        });
    });
}

export function getCurrentBalance() { return currentBalance; }
export function setCurrentBet(betObject) { currentBet = betObject; }
export function getCurrentBet() { return currentBet; }

export function setCurrentBalance(newBalance, newBonusBalance = -1) {
    currentBalance = newBalance;
    if (newBonusBalance !== -1) { currentBonusBalance = newBonusBalance; }
    updateGameUI.updateBalanceDisplay(currentBalance, currentBonusBalance); 
}

export function updateRolloverUI(progress, target) {
    const container = document.getElementById('rollover-progress-container');
    const bar = document.getElementById('rollover-progress-bar');
    if (!container || !bar) return;
    if (target > 0 && progress < target) {
        const percentage = Math.min((progress / target) * 100, 100);
        bar.style.width = `${percentage}%`;
        container.title = `Progresso do Rollover: R$ ${progress.toFixed(2)} / R$ ${target.toFixed(2)}`;
        container.style.display = 'flex';
    } else { container.style.display = 'none'; }
}

export function handleLogout() {
    JWT_TOKEN = null;
    CURRENT_USER_ID = null;
    USER_ROLE = null; 
    currentBalance = 0.00; 
    currentBonusBalance = 0.00;
    localStorage.clear(); 

    updateUserUI(null, null); 
    updateRolloverUI(0, 0); 
    updateGameUI.updateBalanceDisplay(0, 0); 
    updateGameUI.updateStatus('Faça login para começar a apostar.'); 

    stopLiveFeed(); 
    stopGameCycle(); 

    const button = document.getElementById('login-submit-button'); 
    const registerLink = document.getElementById('show-register-link');
    const groupConfirmPass = document.getElementById('group-confirm-password');
    const groupAffiliateCode = document.getElementById('group-affiliate-code');
    if (button && button.dataset.action === 'register') {
        button.dataset.action = 'login';
        button.textContent = 'Entrar';
        if(registerLink) registerLink.textContent = 'Criar Conta';
        if (groupConfirmPass) groupConfirmPass.style.display = 'none';
        if (groupAffiliateCode) groupAffiliateCode.style.display = 'none';
    }
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.reset(); 
    const errorMessageEl = document.getElementById('auth-error-message');
    if(errorMessageEl) errorMessageEl.textContent = '';

    showAuthModal();
}

export async function fetchBetResult(bet) {
    if (!JWT_TOKEN || !CURRENT_USER_ID) { handleLogout(); return; }
    try {
        const response = await fetch(`${API_BASE_URL}/bet`, {
            method: 'POST',
            headers: getAuthHeaders(JWT_TOKEN),
            body: JSON.stringify({ userId: CURRENT_USER_ID, betType: bet.type, betValue: bet.value, amount: bet.amount })
        });
        if (response.status === 401) { handleLogout(); return; }
        const data = await response.json();
        if (data.success) {
            setCurrentBalance(parseFloat(data.newBalance), parseFloat(data.newBonusBalance)); 
            updateRolloverUI(data.wageringProgress, data.wageringTarget);
            await processWinLoss(data.gameResult, data.isWin, data.winnings);
        } else {
            updateGameUI.updateStatus(data.message, '#E53935');
            fetchBalance();
        }
    } catch (error) {
        updateGameUI.updateStatus("Erro de rede ao processar aposta.", '#E53935');
        console.error("Erro ao processar aposta:", error);
    }
}

export async function fetchBalance() {
    if (!JWT_TOKEN || !CURRENT_USER_ID) return;
    try {
        const response = await fetch(`${API_BASE_URL}/balance/${CURRENT_USER_ID}`, { headers: getAuthHeaders(JWT_TOKEN) });
        if (response.status === 401) { handleLogout(); return; }
        const data = await response.json();
        if (data.success) {
            setCurrentBalance(parseFloat(data.balance), parseFloat(data.bonusBalance));
            updateRolloverUI(data.wageringProgress, data.wageringTarget);
        } 
    } catch (error) { console.error("Erro de rede ao buscar saldo:", error); }
}

export async function handleAuth(event) {
     event.preventDefault(); 
     const button = event.currentTarget; 
     const action = button.dataset.action;
     const usernameInput = document.getElementById('login-username');
     const username = usernameInput.value;
     const password = document.getElementById('login-password').value;
     const errorMessageEl = document.getElementById('auth-error-message');
    
     errorMessageEl.textContent = ''; 
     if (!username || !password) { errorMessageEl.textContent = 'Preencha utilizador e senha.'; return; }
     
    const requestBody = { username, password };
     if (action === 'register') {
        const confirmPassword = document.getElementById('confirm-password').value;
        if (password !== confirmPassword) { errorMessageEl.textContent = 'As senhas não coincidem.'; return; }
         const codeFromLink = localStorage.getItem('referralCodeFromLink');
         const codeFromInput = document.getElementById('affiliate-code').value;
         const affiliateCode = codeFromLink || codeFromInput;
         if (affiliateCode) requestBody.affiliateCode = affiliateCode;
     }

     try {
         const response = await fetch(`${API_BASE_URL}/auth/${action}`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(requestBody)
         });
         const data = await response.json();

         if (data.success) {
             if (action === 'login') {
                 JWT_TOKEN = data.token;
                 CURRENT_USER_ID = data.userId;
                 USER_ROLE = data.role;
                const loggedInUsername = data.username; 
                 localStorage.setItem('jwtToken', data.token);
                 localStorage.setItem('userId', data.userId);
                 localStorage.setItem('userRole', data.role);
                 localStorage.setItem('username', loggedInUsername);

                hideAuthModal();
                updateUserUI(loggedInUsername, USER_ROLE); 
                fetchBalance(); 
                updateGameUI.updateStatus('Aguardando próxima rodada...', '#4CAF50');
                 initializeGameCycle();
                 initializeSocialFeatures();
             } else {
                 document.getElementById('login-form').reset(); 
                document.getElementById('show-register-link').click(); 
                 errorMessageEl.style.color = '#4CAF50';
                 errorMessageEl.textContent = 'Registo bem-sucedido! Faça o login para jogar.';
             }
         } else {
            errorMessageEl.style.color = '#E53935';
            errorMessageEl.textContent = data.message || `Erro ao ${action}.`;
         }
     } catch (error) {
        errorMessageEl.style.color = '#E53935';
         errorMessageEl.textContent = 'Erro de conexão com o servidor.';
     }
}

export function initializeUI() {
     JWT_TOKEN = localStorage.getItem('jwtToken'); 
     CURRENT_USER_ID = localStorage.getItem('userId');
     USER_ROLE = localStorage.getItem('userRole'); 
    const username = localStorage.getItem('username'); 
    const authModal = document.getElementById('auth-modal-overlay'); 
     
     if (JWT_TOKEN && CURRENT_USER_ID && username) {
        if (authModal) authModal.style.display = 'none'; 
        updateUserUI(username, USER_ROLE); 
         fetchBalance(); 
         return true; 
     } else {
        updateUserUI(null, null); 
        showAuthModal(); 
        return false;
     }
}