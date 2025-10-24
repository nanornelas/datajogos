// js/utils.js

export const API_BASE_URL = 'http://localhost:3000/api';
export const VISIBLE_SLOT_COUNT = 5; 
export const CYCLE_TIME_MS = 8000; // Mantenha esta linha
export const SLOT_WIDTH_WITH_MARGIN = 140; 
export const ANIMATION_DURATION = 700; 

// Utilitário para formatar Headers com o Token
export const getAuthHeaders = (token) => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}` 
});

// Funções de UI (essenciais para múltiplos arquivos)
//export function switchPage(pageId) {
//    document.getElementById('auth-page').style.display = (pageId === 'auth-page') ? 'block' : 'none';
//    document.getElementById('game-page').style.display = (pageId === 'game-page') ? 'block' : 'none';
//}

// A declaração duplicada de CYCLE_TIME_MS FOI REMOVIDA AQUI

// NOVIDADE CRÍTICA: Função para reiniciar o timer visual
export function restartTimer() {
    const progressElement = document.getElementById('progress');
    
    // Evita erro de leitura se o elemento ainda não estiver na tela (apenas na página de jogo)
    if (!progressElement) return; 

    progressElement.style.transition = 'none';
    progressElement.style.width = '100%';
    void progressElement.offsetWidth; // Força o reflow para resetar a animação
    progressElement.style.transition = `width ${CYCLE_TIME_MS / 1000}s linear`;
    progressElement.style.width = '0%';
}