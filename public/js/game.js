import { API_BASE_URL, VISIBLE_SLOT_COUNT } from './utils.js';
import * as Auth from './auth.js'; 

// VARIÁVEIS DE ESTADO DO MÓDULO GAME
let results = [];
let isBettingEnabled = false; // Começa bloqueado até o servidor liberar

// Referências diretas ao DOM
const sequenceElement = document.getElementById('slots-scroller'); 
const resultSequenceContainer = document.querySelector('.result-sequence'); 
const betButtons = document.querySelectorAll('.bet-button');
const progressBar = document.getElementById('progress'); // A barra de tempo verde

// ==========================================
// CONEXÃO COM O SERVIDOR (SOCKET.IO)
// ==========================================
// Conecta o jogo ao "Rádio" do Cassino
export const socket = io(API_BASE_URL.replace('/api', ''));

socket.on('connect', () => {
    console.log('✅ Conectado ao Cassino Ao Vivo! ID:', socket.id);
});

// 1. OUVINDO O RELÓGIO DO SERVIDOR
socket.on('game_timer', (data) => {
    // Atualiza a barra de progresso visual
    if (progressBar) {
        if (data.state === 'BETTING') {
            // Se estamos na fase de aposta (15 a 0 seg)
            const percentage = (data.time / 15) * 100;
            progressBar.style.transition = 'width 1s linear';
            progressBar.style.width = `${percentage}%`;
            progressBar.style.backgroundColor = '#4CAF50'; // Verde
            
            if (data.time <= 3) {
                progressBar.style.backgroundColor = '#E53935'; // Fica vermelho no fim
                updateGameUI.updateStatus(`Apostas encerram em ${data.time}...`, '#E53935');
            } else if (isBettingEnabled) {
                updateGameUI.updateStatus(`Façam suas apostas! Tempo: ${data.time}s`);
            }
            
        } else if (data.state === 'ROLLING') {
            // Fase de animação (Barra vazia e vermelha)
            progressBar.style.transition = 'none';
            progressBar.style.width = '0%';
            progressBar.style.backgroundColor = '#E53935';
        }
    }
});

// 2. OUVINDO O GRITO DE "NOVA RODADA"
socket.on('game_new_round', () => {
    isBettingEnabled = true;
    betButtons.forEach(btn => btn.disabled = false); // Libera os botões
    updateGameUI.updateStatus('Nova rodada iniciada! Façam suas apostas.', '#4CAF50');
});

// 3. OUVINDO O GRITO DE "SORTEIO" E "GIRO"
socket.on('game_roll', async (data) => {
    console.log("🎲 O Servidor sorteou:", data.result);
    
    // Bloqueia as apostas imediatamente
    isBettingEnabled = false;
    betButtons.forEach(btn => btn.disabled = true);
    updateGameUI.updateStatus('Apostas encerradas! Girando...', '#FFEB3B');

    // Manda virar a carta com o resultado oficial de todos
    await renderSequence(data.result);

    // Se o jogador tinha uma aposta engatilhada, agora é a hora de verificar se ele ganhou!
    const myBet = Auth.getCurrentBet();
    if (myBet.type) {
        // Envia a aposta para o servidor descontar o saldo e pagar se ganhou
        await Auth.fetchBetResult(myBet, data.result);
        Auth.setCurrentBet({ type: null, value: null, amount: 0 }); // Limpa a aposta engatilhada
    }
});

// ==========================================
// FUNÇÕES DE UI DE JOGO
// ==========================================
export const updateGameUI = {
    updateBalanceDisplay: (balance, bonusBalance) => {
        const realBalanceEl = document.getElementById('nav-balance-real');
        const bonusBalanceEl = document.getElementById('nav-balance-bonus');
        const bonusBoxEl = document.getElementById('nav-balance-bonus-box');

        if (!realBalanceEl || !bonusBalanceEl || !bonusBoxEl) return;

        realBalanceEl.textContent = `R$ ${parseFloat(balance).toFixed(2).replace('.', ',')}`;

        if (bonusBalance > 0) {
            bonusBalanceEl.textContent = `R$ ${parseFloat(bonusBalance).toFixed(2).replace('.', ',')}`;
            bonusBoxEl.style.display = 'block'; 
        } else {
            bonusBoxEl.style.display = 'none'; 
        }
    },
    updateStatus: (message, color = 'white') => {
        const statusEl = document.getElementById('status-message');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.style.color = color;
        }
    }
};

// ==========================================
// LÓGICA DE CRIAÇÃO DE SLOT E ANIMAÇÃO
// ==========================================
function createSlotHTML(result, isNew = false, isFaded = false) { 
    let classList = 'slot';
    if (isFaded) { classList += ' faded-out'; }
    if (isNew) { classList += ' revealed'; }

    if (result === null) {
        return `<div class="${classList} flip-container"><div class="flipper"><div class="front"><span>?</span></div><div class="back"></div></div></div>`;            
    } else {
        classList += ` color-${result.color}`;
        let contentHTML;
        if (result.color === 'GREEN') {
            contentHTML = `
                <span class="value coringa-icon"><img src="assets/joker.svg" alt="Coringa" class="coringa-svg-img"></span> 
                <span class="label parity-label">&nbsp;</span>`; 
        } else {
            contentHTML = `
                <span class="value">${result.number}</span>
                <span class="label parity-label">(${result.translatedParity})</span>`;
        }
        return `<div class="${classList}">${contentHTML}</div>`;
    }
}
// ==========================================
// MICRO-HISTÓRICO (BARRA DE TENDÊNCIAS)
// ==========================================
function addTrendHistory(result) {
    const trendList = document.getElementById('trend-history-list');
    if (!trendList) return;

    const dot = document.createElement('div');
    dot.className = `trend-dot color-${result.color}`;
    
    // O Coringa usa o SVG, os outros usam o número
    if (result.color === 'GREEN') {
        dot.innerHTML = `<img src="assets/joker.svg" alt="Coringa">`; 
    } else {
        dot.textContent = result.number;
    }
    
    trendList.appendChild(dot);
    
    // 🟢 TRAVA DE MEMÓRIA: Mantém apenas os últimos 50 resultados na fita
    if (trendList.children.length > 50) {
        trendList.removeChild(trendList.firstChild);
    }
    
    // Rola a fita suavemente para a direita para ver a bola nova
    trendList.scrollTo({ left: trendList.scrollWidth, behavior: 'smooth' });
}
export async function renderSequence(newResult) { 
    const oldLastDrawn = sequenceElement.querySelector('.slot.last-drawn');
    if(oldLastDrawn) { 
        oldLastDrawn.classList.remove('last-drawn'); 
        oldLastDrawn.classList.add('faded-out');
    }

    // --- ETAPA 2: ATUALIZA E VIRA A CARTA '?' ---
    const mysterySlotContainer = resultSequenceContainer.querySelector('.slot.flip-container');
    const mysteryBack = mysterySlotContainer.querySelector('.back');

    mysterySlotContainer.classList.add('last-drawn'); 
    mysteryBack.classList.add(`color-${newResult.color}`);
    
    if (newResult.color === 'GREEN') {
        mysteryBack.innerHTML = `
            <span class="value coringa-icon"><img src="assets/joker.svg" alt="Coringa" class="coringa-svg-img"></span>
            <span class="label parity-label">&nbsp;</span>`;
    } else {
        mysteryBack.innerHTML = `
            <span class="value">${newResult.number}</span>
            <span class="label parity-label">(${newResult.translatedParity})</span>`;
    }
    mysterySlotContainer.classList.add('flipped');

    // --- ETAPA 3: ESPERA A CARTA TERMINAR DE VIRAR ---
    await new Promise(resolve => setTimeout(resolve, 600));

    // --- ETAPA 4: INICIA A ANIMAÇÃO DE ROLAGEM ---
    const scrollDistance = getCalculatedScrollDistance();
    sequenceElement.style.transition = 'transform 1.0s cubic-bezier(0.645, 0.045, 0.355, 1)';
    sequenceElement.style.transform = `translateX(-${scrollDistance}px)`;

    // --- ETAPA 5: ESPERA A ROLAGEM TERMINAR ---
    await new Promise(resolve => {
        const onTransitionEnd = (event) => {
            if (event.propertyName === 'transform') {
                sequenceElement.removeEventListener('transitionend', onTransitionEnd);
                resolve();
            }
        };
        sequenceElement.addEventListener('transitionend', onTransitionEnd);
    });

    // --- ETAPA 6: ATUALIZAÇÃO INSTANTÂNEA DO DOM ---
    sequenceElement.style.transition = 'none';
    sequenceElement.style.transform = 'translateX(0px)';

    results.shift(); 
    results.push(newResult); 
    addTrendHistory(newResult);

    const slotToRemove = sequenceElement.querySelector('.slot');
    if (slotToRemove) { sequenceElement.removeChild(slotToRemove); }
    
    const newSlotHTML = createSlotHTML(newResult, false, false); 
    sequenceElement.insertAdjacentHTML('beforeend', newSlotHTML); 

    mysterySlotContainer.classList.remove('flipped', 'last-drawn');
    mysteryBack.innerHTML = ''; 
    mysteryBack.className = 'back'; 

    const fixedNewSlot = sequenceElement.lastChild;
    if (fixedNewSlot) { fixedNewSlot.classList.add('last-drawn'); }
    
    const allSlots = sequenceElement.querySelectorAll('.slot');
    allSlots.forEach((slot, index) => {
        if (index < allSlots.length - 1) { slot.classList.add('faded-out'); } 
        else { slot.classList.remove('faded-out'); }
    });
}

function getCalculatedScrollDistance() {
    const screenWidth = window.innerWidth;
    if (screenWidth < 500) return 52;
    else if (screenWidth < 890) return 78;
    else return 90;
}

export async function processWinLoss(gameResult, isWin, winnings) {
    const resultColor = gameResult.translatedColor || gameResult.color; 
    const resultParity = gameResult.translatedParity || gameResult.parity; 
    let resultMsg = `Resultado: ${resultColor} (${resultParity}, ${gameResult.number}).`;
    
    if (isWin) {
        updateGameUI.updateStatus(`🎉 VOCÊ VENCEU! Ganho de R$ ${winnings.toFixed(2)}. ${resultMsg}`, '#4CAF50');
    } else {
        updateGameUI.updateStatus(`😔 Tente novamente. ${resultMsg}`, '#E53935');
    }
}

function getResponsiveConfig() {
    const screenWidth = window.innerWidth;
    if (screenWidth < 500) return { slotCount: 7, paddingRight: '6px' };
    else if (screenWidth < 1000) return { slotCount: 10, paddingRight: '10px' };
    else return { slotCount: VISIBLE_SLOT_COUNT, paddingRight: '10px' };
}

// ==========================================
// FUNÇÃO DE CRIAÇÃO DE SLOTS INICIAL (SETUP)
// ==========================================
export async function initializeSlotsSetup() {
    const config = getResponsiveConfig();
    const slotCountToRender = config.slotCount;
    let initialResults = [];
    
    try {
        const response = await fetch(`${API_BASE_URL}/initial-draw`);
        const data = await response.json();
        if (data.success && data.gameResult) {
            for(let i = 0; i < VISIBLE_SLOT_COUNT; i++) { initialResults.push(data.gameResult); }
        }
    } catch (error) {
        for(let i = 0; i < VISIBLE_SLOT_COUNT; i++) {
            initialResults.push({ color: 'BLUE', number: '00', parity: 'EVEN', translatedColor: 'AZUL', translatedParity: 'PAR' });
        }
    }
    
    results = initialResults; 
    // 🟢 POPULA A BARRA DE TENDÊNCIAS INICIAL
    const trendList = document.getElementById('trend-history-list');
    if (trendList) {
        trendList.innerHTML = ''; // Limpa a fita
        results.forEach(res => addTrendHistory(res)); // Preenche com o array do servidor
    }
    let initialScrollerHTML = '';
    
    const slotsToRender = results.slice(-slotCountToRender);
    slotsToRender.forEach((result, index) => {
        const isFaded = index < slotsToRender.length - 1; 
        initialScrollerHTML += createSlotHTML(result, false, isFaded);
    });

    sequenceElement.innerHTML = initialScrollerHTML; 
    
    if (!document.querySelector('.slot.flip-container')) {
        const mysterySlotHTML = createSlotHTML(null);
        resultSequenceContainer.insertAdjacentHTML('beforeend', mysterySlotHTML);
    }
    
    const mysterySlot = resultSequenceContainer.querySelector('.slot.flip-container');
    mysterySlot.style.position = 'absolute';
    mysterySlot.style.left = ''; 
    mysterySlot.style.right = config.paddingRight;
    mysterySlot.style.top = '50%';
    mysterySlot.style.transform = 'translateY(-50%)';
    
    const lastInitialSlot = sequenceElement.lastChild;
    if (lastInitialSlot) { lastInitialSlot.classList.add('last-drawn'); }
}

// Como o servidor dita o ritmo, iniciar o ciclo agora é apenas carregar os slots.
export async function initializeGameCycle() { 
    if (results.length === 0) {
        await initializeSlotsSetup(); 
    }
}

export function stopGameCycle() {
    // Não precisamos mais parar intervalos, pois o socket é passivo.
    console.log("Ciclo do jogo local desativado (Aguardando servidor).");
}

// ==========================================
// FUNÇÃO DE APOSTA
// ==========================================
export function handleBet(event) {
    event.preventDefault(); 
    if (!isBettingEnabled || !Auth.JWT_TOKEN) {
        updateGameUI.updateStatus('Apostas fechadas ou usuário deslogado.', '#E53935');
        return;
    }
    
    const currentTotalBalance = Auth.currentBalance + Auth.currentBonusBalance;
    const betAmount = parseFloat(document.getElementById('bet-amount').value);
    
    if (betAmount <= 0 || isNaN(betAmount) || betAmount > currentTotalBalance) {
        updateGameUI.updateStatus(`Saldo ou valor inválido! Saldo Total: R$ ${currentTotalBalance.toFixed(2)}`, '#E53935');
        return;
    }
    
    const betType = event.target.dataset.betType;
    const betValue = event.target.dataset.betValue;
    
    // Engatilha a aposta na memória. Ela só será enviada quando o servidor disser 'game_roll'
    Auth.setCurrentBet({ type: betType, value: betValue, amount: betAmount }); 
    
    isBettingEnabled = false; // Bloqueia para não apostar duas vezes na mesma rodada
    betButtons.forEach(btn => btn.disabled = true);
    
    const betDescription = betValue === 'RED' ? 'Vermelho' : betValue === 'BLUE' ? 'Azul' : betValue === 'GREEN' ? 'Verde' : betValue === 'ODD' ? 'Ímpar' : 'Par';
    updateGameUI.updateStatus(`Aposta de R$ ${betAmount.toFixed(2)} em ${betDescription} registrada! Aguarde o sorteio...`, '#FFEB3B');
    
    event.currentTarget.blur();
}