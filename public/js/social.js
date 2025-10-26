// js/social.js

import { API_BASE_URL, getAuthHeaders } from './utils.js';
import * as Auth from './auth.js';

let liveFeedInterval = null; // Guarda a referência ao setInterval

// Função para renderizar uma única mensagem de chat no HTML
function renderChatMessage(msg) {
    const roleClass = `role-${msg.role || 'affiliate'}`; // Garante um role padrão
    const avatar = msg.avatar || '👤'; // Garante um avatar padrão
    const username = msg.username || 'Utilizador'; // Garante um nome padrão
    const messageText = msg.message || ''; // Garante que a mensagem existe
    
    // Escapa caracteres HTML básicos para segurança simples
    const escapedMessage = messageText.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    return `
        <div class="chat-message">
            <span class="username ${roleClass}">${avatar} ${username}:</span>
            <span class="message-text">${escapedMessage}</span> 
        </div>
    `;
}

// Função para renderizar uma única entrada de aposta no HTML
function renderBetEntry(bet) {
    const resultClass = bet.isWin ? 'bet-won' : 'bet-lost';
    const resultSign = bet.isWin ? '+' : '-';
    // Garante que winnings/amount são números antes de toFixed
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
async function fetchLiveFeed(source = 'interval') { // Adiciona source para depuração

    const token = Auth.JWT_TOKEN;
    if (!token) {
        console.log(`[fetchLiveFeed from ${source}] Sem token. Abortando.`);
        return; // Sai se não estiver logado
    }

    try {
        const response = await fetch(`${API_BASE_URL}/live-feed`, { headers: getAuthHeaders(token) });
        console.log(`[fetchLiveFeed from ${source}] Resposta GET:`, response.status, response.ok);

        if (!response.ok) {
            console.error(`[fetchLiveFeed from ${source}] Erro resposta GET:`, response.status);
            // Poderia tentar ler a mensagem de erro aqui
            return; // Sai se a busca falhar
        }

        const data = await response.json();

        if (data.success && data.chat && data.bets) { // Verifica se chat e bets existem

            const chatContainer = document.getElementById('chat-messages');
            const betsContainer = document.getElementById('bets-feed');

            if (chatContainer) {
                // Verifica se o utilizador está perto do fundo ANTES de atualizar
                const shouldScroll = chatContainer.scrollTop + chatContainer.clientHeight >= chatContainer.scrollHeight - 50; // Aumenta a margem

                // Renderiza as mensagens (servidor envia mais recentes primeiro, revertemos)
                chatContainer.innerHTML = data.chat.map(renderChatMessage).join('');

                // Rola para o fundo APENAS se o utilizador já estava perto do fundo
                if (shouldScroll) {
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }
            } else {
                 console.warn(`[fetchLiveFeed from ${source}] Container do chat (#chat-messages) não encontrado.`);
            }

            if (betsContainer) {
                // Renderiza as apostas (servidor já envia ordenado)
                betsContainer.innerHTML = data.bets.map(renderBetEntry).join('');
            } else {
                 console.warn(`[fetchLiveFeed from ${source}] Container de apostas (#bets-feed) não encontrado.`);
            }

        } else {
            console.error(`[fetchLiveFeed from ${source}] API retornou data.success = false ou dados em falta.`);
        }
    } catch (error) {
        console.error(`[fetchLiveFeed from ${source}] Erro rede/processamento GET:`, error);
    } finally {
        console.log(`--- [fetchLiveFeed from ${source}] Finalizado ---`);
    }
}

// Envia uma nova mensagem de chat (VERSÃO FINAL - Usa resposta do POST diretamente)
async function sendChatMessage(e) {
    e.preventDefault(); 

    const token = Auth.JWT_TOKEN;
    const input = document.getElementById('chat-input');
    if (!input) { console.error("Input #chat-input não encontrado!"); return; } // Segurança
    const message = input.value.trim();

    if (!token || !message) {
        return; // Sai se não houver token ou mensagem
    }

    input.disabled = true; // Desabilita enquanto envia

    try {
        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: 'POST',
            headers: getAuthHeaders(token),
            body: JSON.stringify({ message })
        });

        if (response.ok) {
            const data = await response.json(); // Lê a resposta que contém a nova mensagem
            
            // Verifica se a resposta contém a nova mensagem
            if (data.success && data.chat && data.chat.length > 0) { 
                input.value = ''; // Limpa o input

                // --- ATUALIZAÇÃO DIRETA NO DOM ---
                const chatContainer = document.getElementById('chat-messages');
                if (chatContainer) {
                    // Renderiza APENAS a nova mensagem
                    const newMessageHTML = renderChatMessage(data.chat[0]); 
                    // Adiciona ao final do chat existente
                    chatContainer.insertAdjacentHTML('beforeend', newMessageHTML); 
                    // Rola para o fundo
                    chatContainer.scrollTop = chatContainer.scrollHeight; 
                } else {
                    console.warn("[sendChatMessage v6] Container do chat (#chat-messages) não encontrado.");
                }
                // --- FIM DA ATUALIZAÇÃO DIRETA ---
            } else {
                 // Resposta OK, mas sem a mensagem (pouco provável)
                 console.warn("[sendChatMessage v6] POST OK, mas resposta não continha a nova mensagem.");
                 input.value = ''; // Limpa mesmo assim
                 // Não chamamos fetchLiveFeed aqui para evitar sobrescrever
            }

        } else { // Se a resposta NÃO foi OK
            const errorData = await response.json().catch(() => ({ message: response.statusText })); 
            console.error("[sendChatMessage v6] Erro resposta POST:", response.status, errorData.message || 'Erro desconhecido'); 
            alert(`Erro ao enviar: ${errorData.message || 'Erro desconhecido'}`);
        }
    } catch (error) { // Erro de rede
        console.error("[sendChatMessage v6] Erro rede POST:", error); 
        alert("Erro de rede ao enviar. Tente novamente.");
    } finally {
        input.disabled = false; // Reabilita o input
        // NÃO mexemos mais no liveFeedInterval aqui
    }
}

// Função para controlar o botão de minimizar/expandir (VERSÃO SIMPLIFICADA v3)
function setupChatToggle() {

    const toggleBtn = document.getElementById('toggle-chat-btn');
    const sidebar = document.getElementById('social-sidebar');
    const header = sidebar ? sidebar.querySelector('.sidebar-header') : null;

    console.log("Elementos encontrados:", { toggleBtn, sidebar, header });

    if (!toggleBtn || !sidebar || !header) {
        console.error("ERRO: Elementos do chat toggle não encontrados!");
        return;
    }

    // Função interna para atualizar o ícone
    const updateButtonIcon = () => {
        if (!toggleBtn) return; 
        if (sidebar.classList.contains('minimized')) {
            toggleBtn.textContent = '＋';
        } else {
            toggleBtn.textContent = '−';
        }
    };

    // Listener APENAS no header
    header.addEventListener('click', () => {
        console.log("--- CLIQUE no HEADER detectado! ---"); 
        sidebar.classList.toggle('minimized');
        updateButtonIcon();
    });

    // Define o estado inicial responsivo (Mantém-se)
    if (window.innerWidth < 1250) {
        if (!sidebar.classList.contains('minimized')) {
            console.log("Forçando estado inicial minimizado (<1250px)");
            sidebar.classList.add('minimized');
        }
    } else {
         // Opcional: Forçar expandido em desktop
         // sidebar.classList.remove('minimized'); 
    }
    updateButtonIcon(); // Define o ícone inicial
}

// Inicializa todas as funcionalidades sociais
export function initializeSocialFeatures() {
    const socialSidebar = document.getElementById('social-sidebar');
    if (!socialSidebar) {
        console.error("ERRO: Sidebar social (#social-sidebar) não encontrada!");
        return; // Sai se a sidebar não existir
    }
    

    // Mostra a barra lateral APENAS se o utilizador estiver logado
    if (Auth.JWT_TOKEN) {
        console.log("Utilizador logado, mostrando socialSidebar.");
        socialSidebar.style.display = 'flex'; // Torna visível

        // --- INICIALIZAÇÃO DOS COMPONENTES DO CHAT ---
        // Lógica das abas
        const tabButtons = socialSidebar.querySelectorAll('.social-tab-btn'); // Busca dentro da sidebar
        const tabPanes = socialSidebar.querySelectorAll('.social-tab-pane'); // Busca dentro da sidebar
        if (tabButtons.length > 0 && tabPanes.length > 0) {
            tabButtons.forEach(button => {
                button.addEventListener('click', (e) => {
                    e.stopPropagation(); 
                    tabButtons.forEach(btn => btn.classList.remove('active'));
                    tabPanes.forEach(pane => pane.classList.remove('active'));
                    button.classList.add('active');
                    const targetPane = socialSidebar.querySelector(`#social-tab-${button.dataset.tab}`); // Busca dentro da sidebar
                    if (targetPane) targetPane.classList.add('active');
                });
            });
        } else {
            console.warn("Abas do chat não encontradas ou incompletas.");
        }

        // Lógica do formulário de chat
        const chatForm = socialSidebar.querySelector('#chat-form'); // Busca dentro da sidebar
        if (chatForm) {
            chatForm.addEventListener('submit', sendChatMessage);
            console.log("Listener 'submit' adicionado ao chatForm.");
        } else {
            console.error("ERRO: Formulário #chat-form não encontrado!");
        }
        
        // Configura o botão minimizar/maximizar
        setupChatToggle(); 

        // --- INÍCIO DO POLLING DO FEED ---
       if (!liveFeedInterval && Auth.JWT_TOKEN) { 
        liveFeedInterval = setInterval(fetchLiveFeed, 5000); // Cria o novo intervalo
        fetchLiveFeed('initial_load'); // Busca os dados a primeira vez
    }

    } else {
        console.log("Utilizador não logado, mantendo socialSidebar escondida.");
        socialSidebar.style.display = 'none'; // Garante que está escondida se não logado
    }
}

// Para a atualização do feed (ex: ao fazer logout)
export function stopLiveFeed() {
    if (liveFeedInterval) {
        clearInterval(liveFeedInterval);
        liveFeedInterval = null; // Marca como parado
        console.log("[stopLiveFeed] Intervalo parado.");
    }
    const socialSidebar = document.getElementById('social-sidebar');
    if(socialSidebar) {
        socialSidebar.style.display = 'none'; // Esconde a sidebar
    }
}