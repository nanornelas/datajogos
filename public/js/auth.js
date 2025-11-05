import { initializeGameCycle, updateGameUI, stopGameCycle, processWinLoss } from './game.js'; 

// Funções necessárias do módulo de utilidades (sem switchPage)
import { API_BASE_URL, getAuthHeaders } from './utils.js';

// Funções necessárias do módulo social (adicionado initializeSocialFeatures)
import { initializeSocialFeatures, stopLiveFeed } from './social.js';

// Variáveis de estado global
export let JWT_TOKEN = localStorage.getItem('jwtToken'); 
export let CURRENT_USER_ID = localStorage.getItem('userId');
export let USER_ROLE = localStorage.getItem('userRole'); 
export let currentBalance = 0.00;
export let currentBonusBalance = 0.00;
let currentBet = { type: null, value: null, amount: 0 };

// --- FUNÇÕES PARA CONTROLAR O MODAL DE AUTENTICAÇÃO ---
const authModal = document.getElementById('auth-modal-overlay');

function showAuthModal() {
    if (authModal) {
        // Limpa mensagens de erro antigas
        const errorMsg = authModal.querySelector('#auth-error-message');
        if (errorMsg) errorMsg.textContent = '';
        // Reseta para o estado de Login (caso estivesse em Registo)
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
         if(loginForm) loginForm.reset(); // Limpa campos

        // Mostra o modal com animação
        authModal.style.display = 'flex'; // Torna visível primeiro
        setTimeout(() => authModal.classList.add('active'), 10); // Adiciona classe para animar
        console.log("Modal de autenticação mostrado.");
    } else {
        console.error("Overlay do modal de autenticação não encontrado!");
    }
}

export function hideAuthModal() {
    if (authModal) {
        authModal.classList.remove('active'); // Remove classe para animar saída
        // Espera a animação terminar antes de esconder com display: none
        setTimeout(() => {
            authModal.style.display = 'none'; 
            console.log("Modal de autenticação escondido.");
        }, 300); // Tempo igual à transição do overlay
    }
}
// --- FIM DAS FUNÇÕES DO MODAL ---
// --- NOVA FUNÇÃO REUTILIZÁVEL ---
// Atualiza o header (dropdown, nome, links de role)
function updateUserUI(username, userRole) {
    const userDropdown = document.getElementById('user-dropdown');
    const userDisplayName = document.getElementById('user-display-name');
    const adminLink = document.getElementById('admin-panel-link');
    const influencerLink = document.getElementById('influencer-panel-link');
    const affiliateLink = document.getElementById('affiliate-panel-link');

    // Garante que os elementos existem antes de tentar aceder-lhes
    if (!userDropdown || !userDisplayName) return; 

    // Esconde links específicos por padrão
    [adminLink, influencerLink, affiliateLink].forEach(link => { if(link) link.style.display = 'none'; });

    if (username) { // Se está logado
        userDisplayName.textContent = `Olá, ${username}!`; 
        userDropdown.style.display = 'block'; // Mostra o dropdown

        // Mostra links baseados no role
        if (userRole === 'admin' && adminLink) adminLink.style.display = 'block';
        if ((userRole === 'admin' || userRole === 'influencer') && influencerLink) influencerLink.style.display = 'block';
        if (userRole === 'affiliate' && affiliateLink) affiliateLink.style.display = 'block';
    } else { // Se não está logado
        userDropdown.style.display = 'none'; // Esconde o dropdown
    }
}
// --- FIM DA NOVA FUNÇÃO ---

// ===== LÓGICA DO MODAL DE CONFIGURAÇÕES =====

const AVATARS = ['👤', '👨', '👩', '🧑', '👽', '🤖', '👾', '🎃', '😈', '👻'];
let selectedAvatar = '';

// Abre o modal e busca os dados do utilizador
export async function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.style.display = 'flex';
    
    // Preenche a grelha de avatares (apenas na primeira vez que o modal é aberto)
    const avatarGrid = document.getElementById('avatar-grid');
    if (avatarGrid.childElementCount === 0) {
        avatarGrid.innerHTML = AVATARS.map(avatar => 
            `<span class="avatar-option" data-avatar="${avatar}">${avatar}</span>`
        ).join('');
        
        // Adiciona eventos de clique aos avatares
        document.querySelectorAll('.avatar-option').forEach(option => {
            option.addEventListener('click', () => {
                document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
                option.classList.add('selected');
                selectedAvatar = option.dataset.avatar;
                document.getElementById('current-avatar-display').textContent = selectedAvatar;
            });
        });
    }

    // Busca e preenche os dados do perfil e histórico
    try {
        const response = await fetch(`${API_BASE_URL}/user/profile-data`, { headers: getAuthHeaders(JWT_TOKEN) });
        const data = await response.json();
        if(data.success) {
            // Preenche a aba de Perfil
            document.getElementById('profile-email').value = data.profile.email || '';
            document.getElementById('current-avatar-display').textContent = data.profile.avatar;
            selectedAvatar = data.profile.avatar;
            
            // Marca o avatar atual como selecionado
            document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
            const currentAvatarEl = document.querySelector(`.avatar-option[data-avatar="${selectedAvatar}"]`);
            if (currentAvatarEl) currentAvatarEl.classList.add('selected');

            // Preenche a aba de Histórico
            const historyBody = document.getElementById('game-history-body');
            if (data.history.length > 0) {
                historyBody.innerHTML = data.history.map(log => `
                    <tr>
                        <td>${new Date(log.createdAt).toLocaleString('pt-BR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'})}</td>
                        <td>R$ ${log.amount.toFixed(2)} em ${log.betValue}</td>
                        <td>${log.gameResult.color} (${log.gameResult.number})</td>
                        <td class="${log.isWin ? 'bet-won' : 'bet-lost'}">
                            ${log.isWin ? '+' : '-'} R$ ${log.isWin ? log.winnings.toFixed(2) : log.amount.toFixed(2)}
                        </td>
                    </tr>
                `).join('');
            } else {
                historyBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Nenhum jogo registado.</td></tr>';
            }
        }
    } catch (error) {
        console.error("Erro ao carregar dados de configurações:", error);
    }
}

// Fecha o modal
function closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.style.display = 'none';
}

// Salva as alterações do perfil (avatar e email)
async function saveProfileChanges() {
    const email = document.getElementById('profile-email').value;
    const statusEl = document.getElementById('profile-status');
    statusEl.textContent = 'A salvar...';
    statusEl.style.color = '#FFEB3B';
    try {
        const response = await fetch(`${API_BASE_URL}/user/profile`, {
            method: 'PUT',
            headers: getAuthHeaders(JWT_TOKEN),
            body: JSON.stringify({ avatar: selectedAvatar, email: email })
        });
        const data = await response.json();
        if(data.success) {
            statusEl.textContent = 'Perfil salvo com sucesso!';
            statusEl.style.color = '#4CAF50';
            setTimeout(() => {
                closeSettingsModal();
                statusEl.textContent = '';
                window.location.reload(); // Recarrega para que o novo avatar apareça no token
            }, 1500);
        } else { throw new Error(data.message); }
    } catch (error) {
        statusEl.textContent = `Erro: ${error.message}`;
        statusEl.style.color = '#E53935';
    }
}

// Inicializa todos os eventos do modal (chamado pelo main.js)
export function initializeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if(!modal) return;
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


// ===== FUNÇÕES EXISTENTES =====

export function getCurrentBalance() { return currentBalance; }
export function setCurrentBet(betObject) { currentBet = betObject; }
export function getCurrentBet() { return currentBet; }

export function setCurrentBalance(newBalance, newBonusBalance = -1) {
    currentBalance = newBalance;
    if (newBonusBalance !== -1) {
        currentBonusBalance = newBonusBalance;
    }
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
    } else {
        container.style.display = 'none';
    }
 }

 

 export function handleLogout() {
    console.log("A fazer logout...");
    JWT_TOKEN = null;
    CURRENT_USER_ID = null;
    USER_ROLE = null; 
    currentBalance = 0.00; 
    currentBonusBalance = 0.00;
    localStorage.clear(); 

    updateUserUI(null, null); // Esconde o dropdown
    updateRolloverUI(0, 0); 
    updateGameUI.updateBalanceDisplay(0, 0); 
    updateGameUI.updateStatus('Faça login para começar a apostar.'); 

    stopLiveFeed(); // Pára o chat
    stopGameCycle(); // Pára o jogo

    // Reseta o formulário de autenticação para o estado de Login
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

    // Mostra o modal de login
    const authModal = document.getElementById('auth-modal-overlay');
    showAuthModal();
    // Não recarrega mais a página
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
            initializeGameCycle(); // Inicia o JOGO
            initializeSocialFeatures(); // Inicia o CHAT
            initializeSettingsModal();
        } else { console.error("Erro ao buscar saldo:", data.message); }
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
    const authModal = document.getElementById('auth-modal-overlay');

     errorMessageEl.textContent = ''; 
     if (!username || !password) { errorMessageEl.textContent = 'Preencha utilizador e senha.'; return; }
     
    const requestBody = { username, password };
     if (action === 'register') {
        const confirmPassword = document.getElementById('confirm-password').value;
        if (password !== confirmPassword) {
            errorMessageEl.textContent = 'As senhas não coincidem.'; return;
        }
         const codeFromLink = localStorage.getItem('referralCodeFromLink');
         const codeFromInput = document.getElementById('affiliate-code').value;
         const affiliateCode = codeFromLink || codeFromInput;
         if (affiliateCode) { requestBody.affiliateCode = affiliateCode;
         console.log("A registar com o código de afiliado:", affiliateCode);
 }
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
                // --- LOGIN BEM-SUCEDIDO ---
                 console.log("Login bem-sucedido:", data.username);
                JWT_TOKEN = data.token;
                 CURRENT_USER_ID = data.userId;
                 USER_ROLE = data.role;
                const loggedInUsername = data.username; 

                 localStorage.setItem('jwtToken', data.token);
                 localStorage.setItem('userId', data.userId);
                 localStorage.setItem('userRole', data.role);
                 localStorage.setItem('username', loggedInUsername);

                hideAuthModal();
                updateUserUI(loggedInUsername, USER_ROLE); // Atualiza o header

                fetchBalance(); // Busca saldo (que iniciará o jogo/chat/settings)

                // Não precisa mais recarregar a página
             } else {
                // --- REGISTO BEM-SUCEDIDO ---
                 console.log("Registo bem-sucedido.");
                document.getElementById('login-form').reset(); 
                document.getElementById('show-register-link').click(); // Volta para login
                 errorMessageEl.style.color = '#4CAF50';
                 errorMessageEl.textContent = 'Registo bem-sucedido! Faça o login para jogar.';
             }
         } else {
            // --- ERRO NO LOGIN/REGISTO ---
            errorMessageEl.style.color = '#E53935';
            errorMessageEl.textContent = data.message || `Erro ao ${action}.`;
         }
     } catch (error) {
        // --- ERRO DE REDE ---
        errorMessageEl.style.color = '#E53935';
         errorMessageEl.textContent = 'Erro de conexão com o servidor.';
        console.error(`Erro em ${action}:`, error);
     }
 }

 export function initializeUI() {
     JWT_TOKEN = localStorage.getItem('jwtToken'); 
     CURRENT_USER_ID = localStorage.getItem('userId');
     USER_ROLE = localStorage.getItem('userRole'); 
    const username = localStorage.getItem('username'); // Pega o username guardado
    const authModal = document.getElementById('auth-modal-overlay'); // Referência ao modal
     
     if (JWT_TOKEN && CURRENT_USER_ID && username) {
        // --- UTILIZADOR LOGADO ---
        console.log("Utilizador já logado:", username);
        if (authModal) authModal.style.display = 'none'; // Garante que o modal está escondido

        updateUserUI(username, USER_ROLE); // Atualiza o header

         fetchBalance(); // Busca o saldo (que iniciará o jogo e chat/settings no SUCESSO)

        // As inicializações de chat/settings foram movidas para DENTRO do fetchBalance/sucesso do login
        // para garantir que só rodem quando os dados estão prontos.

         return true; 
     } else {
        // --- UTILIZADOR NÃO LOGADO ---
        console.log("Utilizador não logado. Mostrando modal.");
        updateUserUI(null, null); 
        showAuthModal(); // <-- Chama a função para mostrar com reset/animação
        return false;
     }
 }

