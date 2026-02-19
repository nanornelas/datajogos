import { API_BASE_URL, getAuthHeaders } from './utils.js';
import * as Auth from './auth.js';
import { socket } from './game.js'; // Importamos o "Rádio" do Cassino

// Função para renderizar uma única mensagem de chat no HTML
function renderChatMessage(msg) {
    const roleClass = `role-${msg.role || 'affiliate'}`;
    const avatar = msg.avatar || '👤';
    const username = msg.username || 'Utilizador';
    const messageText = msg.message || '';
    const escapedMessage = messageText.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const messageIdAttribute = msg._id ? ` data-message-id="${msg._id}"` : '';

    return `
        <div class="chat-message"${messageIdAttribute}>
            <span class="username ${roleClass}">${avatar} ${username}:</span>
            <span class="message-text">${escapedMessage}</span>
        </div>
    `;
}

// Função para renderizar uma única entrada de aposta no HTML
function renderBetEntry(bet) {
    const resultClass = bet.isWin ? 'bet-won' : 'bet-lost';
    const resultSign = bet.isWin ? '+' : '-';
    const resultAmount = (typeof bet.winnings === 'number' && bet.isWin) ? bet.winnings : (typeof bet.amount === 'number' ? bet.amount : 0);
    const betAmountDisplay = typeof bet.amount === 'number' ? bet.amount.toFixed(2) : '0.00';
    const betValueDisplay = bet.betValue || '?';
    const avatar = bet.avatar || '👤';
    const username = bet.username || 'Utilizador';

    return `
        <div class="bet-entry">
            <span class="avatar">${avatar}</span>
            <div style="flex-grow: 1;">
                <span class="username">${username}</span> apostou R$ ${betAmountDisplay} em
                <span class="bet-color-${betValueDisplay}">${betValueDisplay}</span>
            </div>
            <span class="${resultClass}">${resultSign} R$ ${resultAmount.toFixed(2)}</span>
        </div>
    `;
}

// Busca o histórico inicial APENAS UMA VEZ ao carregar a página
async function loadInitialFeed() {
    const token = Auth.JWT_TOKEN;
    if (!token) return;

    try {
        const response = await fetch(`${API_BASE_URL}/live-feed`, { headers: getAuthHeaders(token) });
        if (!response.ok) return;

        const data = await response.json();
        if (data.success && data.chat && data.bets) {
            const chatContainer = document.getElementById('chat-messages');
            const betsContainer = document.getElementById('bets-feed');

            if (chatContainer) {
                chatContainer.innerHTML = data.chat.map(msg => renderChatMessage(msg)).join('');
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
            if (betsContainer) {
                betsContainer.innerHTML = data.bets.map(renderBetEntry).join('');
            }
        }
    } catch (error) {
        console.error("[loadInitialFeed] Erro ao carregar histórico:", error);
    }
}

// Envia uma nova mensagem de chat para o servidor
async function sendChatMessage(e) {
    e.preventDefault();
    const token = Auth.JWT_TOKEN;
    const input = document.getElementById('chat-input');
    if (!input) return;
    
    const message = input.value.trim();
    if (!token || !message) return;

    input.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: 'POST',
            headers: getAuthHeaders(token),
            body: JSON.stringify({ message })
        });

        if (response.ok) {
            // Limpa o input imediatamente. A mensagem vai aparecer quando o servidor gritar de volta pelo Socket!
            input.value = ''; 
        } else {
            alert('Erro ao enviar mensagem.');
        }
    } catch (error) {
        console.error("[sendChatMessage] Erro rede:", error);
    } finally {
        input.disabled = false;
        input.focus();
    }
}

function setupChatToggle() {
    const toggleBtn = document.getElementById('toggle-chat-btn');
    const sidebar = document.getElementById('social-sidebar');
    const header = sidebar ? sidebar.querySelector('.sidebar-header') : null;

    if (!toggleBtn || !sidebar || !header) return;

    const updateButtonIcon = () => {
        if (!toggleBtn) return;
        toggleBtn.textContent = sidebar.classList.contains('minimized') ? '＋' : '−';
    };

    header.addEventListener('click', () => {
        sidebar.classList.toggle('minimized');
        updateButtonIcon();
    });

    if (window.innerWidth < 1250 && !sidebar.classList.contains('minimized')) {
        sidebar.classList.add('minimized');
    }
    updateButtonIcon();
}

// ==========================================
// OUVIDOS DO MULTIPLAYER (SOCKET.IO)
// ==========================================
// 1. Ouve novas mensagens de chat
socket.on('chat_message', (msg) => {
    const chatContainer = document.getElementById('chat-messages');
    if (chatContainer) {
        const shouldScroll = chatContainer.scrollTop + chatContainer.clientHeight >= chatContainer.scrollHeight - 50;
        chatContainer.insertAdjacentHTML('beforeend', renderChatMessage(msg));
        if (shouldScroll) chatContainer.scrollTop = chatContainer.scrollHeight;
    }
});

// 2. Ouve novas apostas no feed
socket.on('new_bet', (bet) => {
    const betsContainer = document.getElementById('bets-feed');
    if (betsContainer) {
        // Coloca a nova aposta no TOPO da lista (afterbegin)
        betsContainer.insertAdjacentHTML('afterbegin', renderBetEntry(bet));
        // Remove a mais antiga se passar de 30 itens para não pesar o site
        if (betsContainer.children.length > 30) {
            betsContainer.removeChild(betsContainer.lastChild);
        }
    }
});
// ==========================================

export function initializeSocialFeatures() {
    const socialSidebar = document.getElementById('social-sidebar');
    if (!socialSidebar) return;

    if (Auth.JWT_TOKEN) {
        socialSidebar.style.display = 'flex';

        const tabButtons = socialSidebar.querySelectorAll('.social-tab-btn');
        const tabPanes = socialSidebar.querySelectorAll('.social-tab-pane');
        if (tabButtons.length > 0 && tabPanes.length > 0) {
            tabButtons.forEach(button => {
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    tabButtons.forEach(btn => btn.classList.remove('active'));
                    tabPanes.forEach(pane => pane.classList.remove('active'));
                    button.classList.add('active');
                    const targetPane = socialSidebar.querySelector(`#social-tab-${button.dataset.tab}`);
                    if (targetPane) targetPane.classList.add('active');
                });
            });
        }

        const chatForm = socialSidebar.querySelector('#chat-form');
        if (chatForm) chatForm.addEventListener('submit', sendChatMessage);

        setupChatToggle();

        // Carrega o histórico APENAS UMA VEZ na entrada
        loadInitialFeed();
    } else {
        socialSidebar.style.display = 'none';
    }
}

export function stopLiveFeed() {
    const socialSidebar = document.getElementById('social-sidebar');
    if(socialSidebar) socialSidebar.style.display = 'none';
}