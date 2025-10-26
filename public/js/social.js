// js/social.js

import { API_BASE_URL, getAuthHeaders } from './utils.js';
import * as Auth from './auth.js';

let liveFeedInterval = null; // Guarda a referência ao setInterval

// Função para renderizar uma única mensagem de chat no HTML
function renderChatMessage(msg) {
    const roleClass = `role-${msg.role || 'affiliate'}`;
    const avatar = msg.avatar || '👤';
    const username = msg.username || 'Utilizador';
    const messageText = msg.message || '';
    const escapedMessage = messageText.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const messageIdAttribute = msg._id ? ` data-message-id="${msg._id}"` : ''; // Usa _id do MongoDB

    // Removido atributo data-pending, pois a lógica mudou
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

// Busca os dados do feed (chat e apostas) e atualiza a UI
async function fetchLiveFeed(source = 'interval') { // Mantém source para erro
    const token = Auth.JWT_TOKEN;
    if (!token) return;

    try {
        const response = await fetch(`${API_BASE_URL}/live-feed`, { headers: getAuthHeaders(token) });

        if (!response.ok) {
            // Mantém erro se a resposta não for OK
            console.error(`[fetchLiveFeed from ${source}] Erro resposta GET:`, response.status);
            return;
        }

        const data = await response.json();

        if (data.success && data.chat && data.bets) {
            const chatContainer = document.getElementById('chat-messages');
            const betsContainer = document.getElementById('bets-feed');

            if (chatContainer) {
                const shouldScroll = chatContainer.scrollTop + chatContainer.clientHeight >= chatContainer.scrollHeight - 50;
                // Renderiza na ordem recebida (antiga -> nova) - SEM reverse()
                chatContainer.innerHTML = data.chat.map(msg => renderChatMessage(msg)).join('');
                if (shouldScroll) {
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }
            } else {
                 // Pode manter como warn se quiser saber se o elemento sumir
                 // console.warn(`[fetchLiveFeed from ${source}] Container do chat (#chat-messages) não encontrado.`);
            }

            if (betsContainer) {
                betsContainer.innerHTML = data.bets.map(renderBetEntry).join('');
            } else {
                 // console.warn(`[fetchLiveFeed from ${source}] Container de apostas (#bets-feed) não encontrado.`);
            }
        } else {
             // Mantém erro se API retornar falha
            console.error(`[fetchLiveFeed from ${source}] API retornou data.success = false ou dados em falta.`);
        }
    } catch (error) {
         // Mantém erro de rede/processamento
        console.error(`[fetchLiveFeed from ${source}] Erro rede/processamento GET:`, error);
    }
    // Remove log 'Finalizado'
}

// Envia uma nova mensagem de chat (VERSÃO FINAL - Usa resposta do POST diretamente)
async function sendChatMessage(e) {
    e.preventDefault();
    // Remove logs iniciais

    const token = Auth.JWT_TOKEN;
    const input = document.getElementById('chat-input');
    if (!input) { console.error("Input #chat-input não encontrado!"); return; }
    const message = input.value.trim();

    if (!token || !message) {
        return; // Sai silenciosamente
    }

    // Remove log 'Enviando'
    input.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: 'POST',
            headers: getAuthHeaders(token),
            body: JSON.stringify({ message })
        });

        // Remove log 'Resposta POST'

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.chat && data.chat.length > 0) {
                // Remove log 'Nova mensagem recebida'
                input.value = '';

                const chatContainer = document.getElementById('chat-messages');
                if (chatContainer) {
                    const newMessageHTML = renderChatMessage(data.chat[0]);
                    chatContainer.insertAdjacentHTML('beforeend', newMessageHTML);
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                    // Remove log 'Nova mensagem adicionada'
                } else {
                     console.warn("[sendChatMessage] Container do chat não encontrado para adicionar msg."); // Mantém warn?
                }
            } else {
                 console.warn("[sendChatMessage] POST OK, mas resposta não continha a nova mensagem."); // Mantém warn?
                 input.value = '';
            }
        } else {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            // Mantém erro
            console.error("[sendChatMessage] Erro resposta POST:", response.status, errorData.message || 'Erro desconhecido');
            alert(`Erro ao enviar: ${errorData.message || 'Erro desconhecido'}`);
        }
    } catch (error) {
        // Mantém erro de rede
        console.error("[sendChatMessage] Erro rede POST:", error);
        alert("Erro de rede ao enviar. Tente novamente.");
    } finally {
        input.disabled = false;
        // Remove log 'Finalizado'
    }
}


// Função para controlar o botão de minimizar/expandir
function setupChatToggle() {
    // Remove logs iniciais

    const toggleBtn = document.getElementById('toggle-chat-btn');
    const sidebar = document.getElementById('social-sidebar');
    const header = sidebar ? sidebar.querySelector('.sidebar-header') : null;

    // Remove log 'Elementos encontrados'

    if (!toggleBtn || !sidebar || !header) {
        // Mantém erro crítico
        console.error("ERRO: Elementos do chat toggle não encontrados!");
        return;
    }

    const updateButtonIcon = () => {
        if (!toggleBtn) return;
        if (sidebar.classList.contains('minimized')) {
            toggleBtn.textContent = '＋';
        } else {
            toggleBtn.textContent = '−';
        }
    };

    header.addEventListener('click', () => {
        // Remove log 'CLIQUE no HEADER'
        sidebar.classList.toggle('minimized');
        updateButtonIcon();
    });

    if (window.innerWidth < 1250) {
        if (!sidebar.classList.contains('minimized')) {
             // Remove log 'Forçando estado inicial'
            sidebar.classList.add('minimized');
        }
    }
    updateButtonIcon();
    // Remove log 'setupChatToggle Concluído'
}

// Inicializa todas as funcionalidades sociais
export function initializeSocialFeatures() {
    const socialSidebar = document.getElementById('social-sidebar');
    if (!socialSidebar) {
        // Mantém erro crítico
        console.error("ERRO: Sidebar social (#social-sidebar) não encontrada!");
        return;
    }

    // Remove log inicial

    if (Auth.JWT_TOKEN) {
        // Remove log 'Mostrando sidebar'
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
        } else {
            console.warn("Abas do chat não encontradas ou incompletas."); // Mantém warn?
        }

        const chatForm = socialSidebar.querySelector('#chat-form');
        if (chatForm) {
            chatForm.addEventListener('submit', sendChatMessage);
             // Remove log 'Listener adicionado'
        } else {
             // Mantém erro crítico
            console.error("ERRO: Formulário #chat-form não encontrado!");
        }

        setupChatToggle();

        if (!liveFeedInterval && Auth.JWT_TOKEN) {
             // Remove log 'Iniciando intervalo'
            liveFeedInterval = setInterval(fetchLiveFeed, 5000);
            fetchLiveFeed('initial_load');
        }

    } else {
        // Remove log 'Utilizador não logado'
        socialSidebar.style.display = 'none';
    }
     // Remove log 'Finalizado'
}

// Para a atualização do feed (ex: ao fazer logout)
export function stopLiveFeed() {
    if (liveFeedInterval) {
        clearInterval(liveFeedInterval);
        liveFeedInterval = null;
         // Remove log 'Intervalo parado'
    }
    const socialSidebar = document.getElementById('social-sidebar');
    if(socialSidebar) {
        socialSidebar.style.display = 'none';
         // Remove log 'Sidebar escondida'
    }
}