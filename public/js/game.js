import { API_BASE_URL, VISIBLE_SLOT_COUNT, CYCLE_TIME_MS, ANIMATION_DURATION, restartTimer } from './utils.js';
import * as Auth from './auth.js'; 

// VARIÁVEIS DE ESTADO DO MÓDULO GAME
let results = [];
let cycleInterval = null; 
let isBettingEnabled = true; 

// Referências diretas ao DOM
const sequenceElement = document.getElementById('slots-scroller'); 
const resultSequenceContainer = document.querySelector('.result-sequence'); 
const betButtons = document.querySelectorAll('.bet-button');


// FUNÇÕES DE UI DE JOGO
// FUNÇÕES DE UI DE JOGO (Atualizado)
export const updateGameUI = {
    updateBalanceDisplay: (balance, bonusBalance) => {
        const realBalanceEl = document.getElementById('nav-balance-real');
        const bonusBalanceEl = document.getElementById('nav-balance-bonus');
        const bonusBoxEl = document.getElementById('nav-balance-bonus-box');

        // Garante que os elementos existem
        if (!realBalanceEl || !bonusBalanceEl || !bonusBoxEl) {
            console.error("Elementos de saldo na navegação não encontrados!");
            return;
        }

        // Formata e exibe o saldo real
        realBalanceEl.textContent = `R$ ${parseFloat(balance).toFixed(2).replace('.', ',')}`;

        // Formata e exibe o saldo bónus (e mostra/esconde a caixa)
        if (bonusBalance > 0) {
            bonusBalanceEl.textContent = `R$ ${parseFloat(bonusBalance).toFixed(2).replace('.', ',')}`;
            bonusBoxEl.style.display = 'block'; // Mostra a caixa de bónus
        } else {
            bonusBoxEl.style.display = 'none'; // Esconde a caixa de bónus se for zero
        }
    },
    // A função updateStatus continua igual
    updateStatus: (message, color = 'white') => {
        const statusEl = document.getElementById('status-message');
        // Garante que o elemento existe
        if (statusEl) {
            statusEl.textContent = message;
            // Poderia adicionar style.color = color aqui se quisesse usar o parâmetro
        }
    }
};

 // --- LÓGICA DE CRIAÇÃO DE SLOT E ANIMAÇÃO ---

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
        // --- MOSTRA O ÍCONE SVG PARA VERDE ---
        contentHTML = `
            <span class="value coringa-icon"><img src="assets/joker.svg" alt="Coringa" class="coringa-svg-img"></span> 
            <span class="label parity-label">&nbsp;</span>`; 
    } else {
        // Mantém o formato normal para Vermelho/Azul
        contentHTML = `
            <span class="value">${result.number}</span>
            <span class="label parity-label">(${result.translatedParity})</span>`;
    }
    return `<div class="${classList}">${contentHTML}</div>`;
}
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
    // --- CORREÇÃO DE SINTAXE: HTML limpo, sem espaços ---
   if (newResult.color === 'GREEN') {
         // --- MOSTRA O ÍCONE SVG PARA VERDE ---
        mysteryBack.innerHTML = `
            <span class="value coringa-icon"><img src="assets/joker.svg" alt="Coringa" class="coringa-svg-img"></span>
            <span class="label parity-label">&nbsp;</span>`;
    } else {
        // Mantém o formato normal para Vermelho/Azul
        mysteryBack.innerHTML = `
            <span class="value">${newResult.number}</span>
            <span class="label parity-label">(${newResult.translatedParity})</span>`;
    }
   mysterySlotContainer.classList.add('flipped');

    // --- ETAPA 3: ESPERA A CARTA TERMINAR DE VIRAR ---
    // (A pausa de 600ms para a animação do flip)
    await new Promise(resolve => setTimeout(resolve, 600));

    // --- ETAPA 4: INICIA A ANIMAÇÃO DE ROLAGEM (MAIS LENTA) ---
    // (A rolagem agora acontece ANTES de a nova carta ser adicionada ao DOM)
   const scrollDistance = getCalculatedScrollDistance();
   sequenceElement.style.transition = 'transform 1.0s cubic-bezier(0.645, 0.045, 0.355, 1)';
   sequenceElement.style.transform = `translateX(-${scrollDistance}px)`;

    // --- ETAPA 5: ESPERA A ROLAGEM TERMINAR (COM O 'transitionend') ---
   await new Promise(resolve => {
        const onTransitionEnd = (event) => {
            if (event.propertyName === 'transform') {
                sequenceElement.removeEventListener('transitionend', onTransitionEnd);
                resolve();
            }
        };
        sequenceElement.addEventListener('transitionend', onTransitionEnd);
    });

    // --- ETAPA 6: ATUALIZAÇÃO INSTANTÂNEA DO DOM (O "RESET" SEM SALTO) ---
    // 1. Desliga a animação
   sequenceElement.style.transition = 'none';
    // 2. Reseta a posição da rolagem
   sequenceElement.style.transform = 'translateX(0px)';

    // 3. ATUALIZA O ARRAY DE DADOS
   results.shift(); // Remove o resultado antigo
    results.push(newResult); // Adiciona o resultado novo

    // 4. ATUALIZA O DOM (Remove a carta 1, Adiciona a carta 6)
   const slotToRemove = sequenceElement.querySelector('.slot');
   if (slotToRemove) { sequenceElement.removeChild(slotToRemove); }
    
    const newSlotHTML = createSlotHTML(newResult, false, false); // Cria a nova carta (sem 'revealed')
   sequenceElement.insertAdjacentHTML('beforeend', newSlotHTML); // Adiciona ao fim

    // 5. LIMPA A CARTA '?'
   mysterySlotContainer.classList.remove('flipped', 'last-drawn');
   mysteryBack.innerHTML = ''; 
   mysteryBack.className = 'back'; 

    // 6. DESTACA A NOVA CARTA (a que acabámos de adicionar)
   const fixedNewSlot = sequenceElement.lastChild;
   if (fixedNewSlot) {
       fixedNewSlot.classList.add('last-drawn');
   }
   
    // 7. Re-aplica o 'faded-out' a todas as cartas, exceto a última
   const allSlots = sequenceElement.querySelectorAll('.slot');
   allSlots.forEach((slot, index) => {
       if (index < allSlots.length - 1) { 
           slot.classList.add('faded-out');
       } else {
           slot.classList.remove('faded-out'); 
       }
   });
   
    // 8. REABILITA AS APOSTAS
   betButtons.forEach(btn => btn.disabled = false);
   isBettingEnabled = true;
 }

 function getCalculatedScrollDistance() {
    const screenWidth = window.innerWidth;

    if (screenWidth < 500) {
        // CSS: width: 90px + gap: 5px
        return 95;
    } else if (screenWidth < 890) {
        // CSS: width: 100px + gap: 5px
        return 105;
    } else {
        // CSS: width: 130px + gap: 10px
        return 140;
    }
 }

 // --- FUNÇÕES DE CONEXÃO E CICLO ---

 export async function processWinLoss(gameResult, isWin, winnings) {
     await renderSequence(gameResult); 
     const resultColor = gameResult.translatedColor || gameResult.color; 
     const resultParity = gameResult.translatedParity || gameResult.parity; 
     let resultMsg = `Resultado: ${resultColor} (${resultParity}, ${gameResult.number}).`;
     if (isWin) {
         updateGameUI.updateStatus(`🎉 VOCÊ VENCEU! Ganho de R$ ${winnings.toFixed(2)}. ${resultMsg}`);
     } else {
         updateGameUI.updateStatus(`😔 Tente novamente. ${resultMsg}`);
     }
  }

 async function fetchAndAnimateNextDraw() {
    try {
        const response = await fetch(`${API_BASE_URL}/initial-draw`);
        const data = await response.json();
        if (data.success && data.gameResult) {
            await renderSequence(data.gameResult); 
        }
    } catch (error) {
        updateGameUI.updateStatus("Erro de conexão com o servidor de sorteio.");
        console.error("Não foi possível buscar o próximo sorteio.", error);
    }
 }

 /**
 * Retorna a contagem de slots a desenhar e o padding da carta '?' 
 * com base na largura da tela, alinhando com as regras do CSS.
 */
 function getResponsiveConfig() {
    const screenWidth = window.innerWidth;

    if (screenWidth < 500) { 
        // Configuração para Telemóvel Pequeno (CSS usa padding 8px)
        return { 
            slotCount: 4, 
            paddingRight: '8px',
            paddingTop: '8px'
        };
    } else if (screenWidth < 890) {
        // Configuração para Tablet (CSS usa padding 10px)
        return { 
            slotCount: 4, 
            paddingRight: '10px',
            paddingTop: '10px'
        };
    } else {
        // Configuração Padrão (Desktop)
        return { 
            slotCount: VISIBLE_SLOT_COUNT, // O seu valor original (5)
            paddingRight: '10px', // O padding padrão do CSS
            paddingTop: '10px'
        };
    }
 }

 // FUNÇÃO DE CRIAÇÃO DE SLOTS INICIAL (SETUP)
 export async function initializeSlotsSetup() {
    // --- ADICIONADO ---
    // Pega a configuração responsiva (quantas cartas desenhar, qual o padding)
    const config = getResponsiveConfig();
    const slotCountToRender = config.slotCount;
    // --- FIM DA ADIÇÃO ---

   let initialResults = [];
   try {
       const response = await fetch(`${API_BASE_URL}/initial-draw`);
       const data = await response.json();
       if (data.success && data.gameResult) {
  // Esta lógica NÃO MUDA. O array 'results' sempre terá 5 (ou o VISIBLE_SLOT_COUNT)
           for(let i = 0; i < VISIBLE_SLOT_COUNT; i++) { initialResults.push(data.gameResult); }
       }
   } catch (error) {
  // Esta lógica NÃO MUDA.
       for(let i = 0; i < VISIBLE_SLOT_COUNT; i++) {
           initialResults.push({ color: 'BLUE', number: '00', parity: 'EVEN', translatedColor: 'AZUL', translatedParity: 'PAR' });
       }
   }
   results = initialResults; // O array 'results' agora tem 5 cartas na memória
   let initialScrollerHTML = '';
    
    // --- MODIFICADO ---
    // Aqui, pegamos apenas os X últimos resultados (4 ou 5) para DESENHAR
    const slotsToRender = results.slice(-slotCountToRender);
   slotsToRender.forEach((result, index) => {
       const isFaded = index < slotsToRender.length - 1; 
       initialScrollerHTML += createSlotHTML(result, false, isFaded);
   });
    // --- FIM DA MODIFICAÇÃO ---

   sequenceElement.innerHTML = initialScrollerHTML; // Desenha 4 ou 5 cartas
   // Cria o slot '?' se ele não existir
   if (!document.querySelector('.slot.flip-container')) {
       const mysterySlotHTML = createSlotHTML(null);
       resultSequenceContainer.insertAdjacentHTML('beforeend', mysterySlotHTML);
   }
   // Posiciona o '?' de forma robusta
   const mysterySlot = resultSequenceContainer.querySelector('.slot.flip-container');
   mysterySlot.style.position = 'absolute';
   mysterySlot.style.left = ''; 
    
    // --- MODIFICADO ---
    // Usa o padding dinâmico da nossa função de configuração
   mysterySlot.style.right = config.paddingRight;
   // --- FIM DA MODIFICAÇÃO ---
   
   mysterySlot.style.top = config.paddingTop;
   
   const lastInitialSlot = sequenceElement.lastChild;
   if (lastInitialSlot) {
       lastInitialSlot.classList.add('last-drawn');
 }
 }

 // FUNÇÃO QUE INICIA O CICLO DE TEMPO E ANIMAÇÃO
 export async function initializeGameCycle() { 
    if (results.length === 0) {
        await initializeSlotsSetup(); 
    }
    if (!cycleInterval) { 
        cycleInterval = setInterval(runCycle, CYCLE_TIME_MS);
        restartTimer(); 
    }
 }

 export function stopGameCycle() {
    if (cycleInterval) {
        clearInterval(cycleInterval);
        cycleInterval = null;
        console.log("Ciclo do jogo parado.");
        // Opcional: Limpar visualmente o estado do jogo aqui, se necessário
        // Ex: sequenceElement.innerHTML = '';
        // Ex: document.getElementById('progress').style.width = '100%';
    }
}

 // FUNÇÃO DE CICLO PRINCIPAL
 function runCycle() {
    if (Auth.getCurrentBet().type) {
        Auth.fetchBetResult(Auth.getCurrentBet()); 
        Auth.setCurrentBet({ type: null, value: null, amount: 0 }); 
        isBettingEnabled = false; 
    } else {
        updateGameUI.updateStatus(`Aposta liberada! Escolha um valor e faça sua jogada.`);
        isBettingEnabled = true; 
        fetchAndAnimateNextDraw(); 
    }
    restartTimer();
 }

 // FUNÇÃO DE APOSTA
 export function handleBet(event) {
    event.preventDefault(); 
    if (!isBettingEnabled || !Auth.JWT_TOKEN) {
        updateGameUI.updateStatus('Faça login para apostar!', '#E53935');
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
    Auth.setCurrentBet({ type: betType, value: betValue, amount: betAmount }); 
    isBettingEnabled = false;
    const betDescription = betValue === 'RED' ? 'Vermelho' : betValue === 'BLUE' ? 'Azul' : betValue === 'GREEN' ? 'Verde' : betValue === 'ODD' ? 'Ímpar' : 'Par';
    updateGameUI.updateStatus(`Aposta de R$ ${betAmount.toFixed(2)} em ${betDescription} registrada! Aguarde o próximo sorteio...`);
    
    betButtons.forEach(btn => btn.disabled = true);
    event.currentTarget.blur();
 }

