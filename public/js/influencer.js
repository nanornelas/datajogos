import { API_BASE_URL, getAuthHeaders } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('jwtToken');

    // 1. Barreira de Segurança
    if (!token) {
        window.location.href = '/'; 
        return;
    }

    // 2. Carrega as métricas e o extrato de forma resiliente
    await loadInfluencerDashboard(token);

    // 3. Ativa os botões de "Copiar"
    setupCopyButtons();

    // 4. Ativa o Modal de Saque
    setupWithdrawalModal();
});

// ==========================================
// PUXAR DADOS DO SERVIDOR
// ==========================================
async function loadInfluencerDashboard(token) {
    const headers = { ...getAuthHeaders(token), 'Cache-Control': 'no-cache' };
    const cacheBust = `?t=${new Date().getTime()}`;

    // 🟢 PASSO 1: CARREGA O PAINEL E OS LINKS
    try {
        const dashRes = await fetch(`${API_BASE_URL}/affiliate/dashboard${cacheBust}`, { headers });
        const dashData = await dashRes.json();

        if (dashData.success) {
            const referralCodeInput = document.getElementById('referral-code-input');
            const commissionBalanceDisplay = document.getElementById('commission-balance-display');
            const referralCountDisplay = document.getElementById('referral-count-display');
            const referralLinkInput = document.getElementById('referral-link-input');

            if (referralCodeInput) referralCodeInput.value = dashData.referralCode;
            if (commissionBalanceDisplay) commissionBalanceDisplay.textContent = `R$ ${dashData.commissionBalance.replace('.', ',')}`;
            if (referralCountDisplay) referralCountDisplay.textContent = dashData.referralCount;

            // Preenche o Link automaticamente com o domínio atual
            if (referralLinkInput) {
                referralLinkInput.value = `${window.location.origin}/?ref=${dashData.referralCode}`;
            }
        }
    } catch (error) {
        console.error('Erro ao carregar o dashboard principal:', error);
    }

    // 🟢 PASSO 2: CARREGA O EXTRATO DETALHADO
    try {
        const historyRes = await fetch(`${API_BASE_URL}/influencer/statement${cacheBust}`, { headers });
        const historyData = await historyRes.json();
        
        const historyBody = document.getElementById('statement-body');
        
        if (historyBody) {
            if (historyData.success && historyData.statement && historyData.statement.length > 0) {
                historyBody.innerHTML = historyData.statement.map(tx => {
                    const dateObj = new Date(tx.createdAt);
                    const dateStr = dateObj.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'}) + ' ' + dateObj.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'});

                    let typeDisplay = tx.type;
                    let color = '#4CAF50';
                    let signal = '+';
                    let details = '-';

                    // Lógica VIP: Tradução, Cores e Detalhamento da Aposta
                    if (tx.type === 'NGR') {
                        typeDisplay = 'RevShare (Lucro)';
                        color = '#9C27B0'; // Roxo VIP
                        details = `Perda da banca: R$ ${tx.sourceBetAmount ? tx.sourceBetAmount.toFixed(2).replace('.', ',') : '0,00'}`;
                    } else if (tx.type === 'NGR_DEBIT') {
                        typeDisplay = 'Ajuste RevShare';
                        color = '#E53935'; // Vermelho
                        signal = '-';
                        details = `Ganho do jogador: R$ ${tx.sourcePlayerProfit ? tx.sourcePlayerProfit.toFixed(2).replace('.', ',') : '0,00'}`;
                    } else if (tx.type === 'CPA') {
                        typeDisplay = 'CPA (Indicação)';
                        color = '#4CAF50'; // Verde
                        details = 'Primeira aposta do indicado';
                    }

                    const sourceUser = tx.sourceUsername || 'Jogador Oculto';

                    return `
                        <tr style="border-bottom: 1px solid #2a2a2a;">
                            <td style="padding: 12px 5px; color: #bbb; font-size: 0.9em;">${dateStr}</td>
                            <td style="padding: 12px 5px; color: #E0E0E0;">${sourceUser}</td>
                            <td style="padding: 12px 5px; color: ${color}; font-weight: bold;">${typeDisplay}</td>
                            <td style="padding: 12px 5px; color: #B0B0B0; font-size: 0.9em;">${details}</td>
                            <td style="padding: 12px 5px; color: ${color}; font-weight: bold;">${signal} R$ ${tx.amount.toFixed(2).replace('.', ',')}</td>
                        </tr>
                    `;
                }).join('');
            } else {
                historyBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #888; padding: 20px;">Nenhum ganho registado ainda. Comece a divulgar!</td></tr>';
            }
        }
    } catch (error) {
        console.error('Erro ao carregar o extrato de ganhos:', error);
        const historyBody = document.getElementById('statement-body');
        if (historyBody) historyBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #E53935; padding: 20px;">Sem histórico no momento.</td></tr>';
    }
}

// ==========================================
// BOTÕES DE COPIAR LINK E CÓDIGO
// ==========================================
function setupCopyButtons() {
    const copyLinkBtn = document.getElementById('copy-link-btn');
    const copyCodeBtn = document.getElementById('copy-button');
    const linkInput = document.getElementById('referral-link-input');
    const codeInput = document.getElementById('referral-code-input');

    const copyAction = (inputEl, btnEl) => {
        if (!inputEl || !btnEl) return;
        
        inputEl.select();
        inputEl.setSelectionRange(0, 99999); 
        
        navigator.clipboard.writeText(inputEl.value).then(() => {
            const originalText = btnEl.textContent;
            const originalBg = btnEl.style.backgroundColor;
            
            btnEl.textContent = 'Copiado! ✓';
            btnEl.style.backgroundColor = '#9C27B0'; // Roxo VIP no feedback
            btnEl.style.color = '#FFF';
            
            setTimeout(() => {
                btnEl.textContent = originalText;
                btnEl.style.backgroundColor = originalBg;
            }, 2000);
        });
    };

    if (copyLinkBtn) copyLinkBtn.addEventListener('click', () => copyAction(linkInput, copyLinkBtn));
    if (copyCodeBtn) copyCodeBtn.addEventListener('click', () => copyAction(codeInput, copyCodeBtn));
}

// ==========================================
// MODAL DE SAQUE
// ==========================================
function setupWithdrawalModal() {
    const withdrawBtn = document.getElementById('btn-withdraw-commission');
    const modal = document.getElementById('withdraw-modal-overlay');
    const closeBtn = document.getElementById('withdraw-modal-close-btn');
    const form = document.getElementById('withdraw-form');

    if (withdrawBtn && modal) withdrawBtn.addEventListener('click', () => { modal.style.display = 'flex'; });
    if (closeBtn && modal) closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });

    if (form && modal) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            alert('A sua solicitação de Saque VIP foi recebida! (Integração PIX real na Fase 4.1)');
            modal.style.display = 'none';
        });
    }
}