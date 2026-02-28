import { API_BASE_URL, getAuthHeaders } from './utils.js';

// ==========================================
// 1. CARREGAMENTO DOS DADOS E EXTRATO
// ==========================================
export async function loadAffiliateData() { 
    const token = localStorage.getItem('jwtToken');

    if (!token) {
        window.location.href = '/'; 
        return;
    }

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

    // 🟢 PASSO 1.5: CARREGA O SALDO PRINCIPAL NA BARRA DO TOPO
    try {
        const userId = localStorage.getItem('userId');
        const balRes = await fetch(`${API_BASE_URL}/balance/${userId}`, { headers });
        const balData = await balRes.json();
        
        if (balData.success) {
            const navBalanceReal = document.getElementById('nav-balance-real');
            if (navBalanceReal) {
                navBalanceReal.textContent = `R$ ${parseFloat(balData.balance).toFixed(2).replace('.', ',')}`;
            }
        }
    } catch (error) {
        console.error('Erro ao sincronizar saldo principal:', error);
    }

    // 🟢 PASSO 2: CARREGA O EXTRATO DETALHADO
    try {
        const historyRes = await fetch(`${API_BASE_URL}/influencer/statement${cacheBust}`, { headers });
        const historyData = await historyRes.json();
        
        const historyBody = document.getElementById('affiliate-history-body');
        
        if (historyBody) {
            if (historyData.success && historyData.statement && historyData.statement.length > 0) {
                historyBody.innerHTML = historyData.statement.map(tx => {
                    const dateObj = new Date(tx.createdAt);
                    const dateStr = dateObj.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'}) + ' ' + dateObj.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'});

                    let typeDisplay = tx.type;
                    let color = '#4CAF50';
                    let signal = '+';

                    if (tx.type === 'CPA') { typeDisplay = 'CPA (Novo Jogador)'; color = '#4CAF50'; } 
                    else if (tx.type === 'NGR') { typeDisplay = 'RevShare (Lucro)'; color = '#00BCD4'; } 
                    else if (tx.type === 'NGR_DEBIT') { typeDisplay = 'Ajuste RevShare'; color = '#E53935'; signal = '-'; }

                    const sourceUser = tx.sourceUsername || 'Jogador Oculto';

                    return `
                        <tr style="border-bottom: 1px solid #2a2a2a;">
                            <td style="padding: 12px 5px; color: #bbb; font-size: 0.9em;">${dateStr}</td>
                            <td style="padding: 12px 5px; color: #E0E0E0;">${sourceUser}</td>
                            <td style="padding: 12px 5px; color: ${color}; font-weight: bold;">${typeDisplay}</td>
                            <td style="padding: 12px 5px; color: ${color}; font-weight: bold;">${signal} R$ ${tx.amount.toFixed(2).replace('.', ',')}</td>
                        </tr>
                    `;
                }).join('');
            } else {
                historyBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #888; padding: 20px;">Nenhum ganho registado ainda. Comece a divulgar!</td></tr>';
            }
        }
    } catch (error) {
        console.error('Erro ao carregar o extrato de ganhos:', error);
        const historyBody = document.getElementById('affiliate-history-body');
        if (historyBody) historyBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #E53935; padding: 20px;">Sem histórico no momento.</td></tr>';
    }
}

// ==========================================
// 2. FUNÇÃO AUXILIAR PARA OS BOTÕES DE COPIAR (Com Feedback Visual)
// ==========================================
function copyAction(inputEl, btnEl) {
    if (!inputEl || !btnEl) return;
    
    inputEl.select();
    inputEl.setSelectionRange(0, 99999); 
    
    navigator.clipboard.writeText(inputEl.value).then(() => {
        const originalText = btnEl.textContent;
        const originalBg = btnEl.style.backgroundColor;
        
        btnEl.textContent = 'Copiado! ✓';
        btnEl.style.backgroundColor = '#4CAF50';
        btnEl.style.color = '#FFF';
        
        setTimeout(() => {
            btnEl.textContent = originalText;
            btnEl.style.backgroundColor = originalBg;
        }, 2000);
    }).catch(err => {
        console.error('Erro ao copiar: ', err);
        alert('Não foi possível copiar o texto.');
    });
}

// ==========================================
// 3. EXPORTS PARA O MAIN.JS
// ==========================================
export function setupCopyButton() { 
    const copyBtn = document.getElementById('copy-button');
    const codeInput = document.getElementById('referral-code-input');
    if (copyBtn) copyBtn.addEventListener('click', () => copyAction(codeInput, copyBtn));
}

export function setupCopyLinkButton() { 
    const copyLinkBtn = document.getElementById('copy-link-btn');
    const linkInput = document.getElementById('referral-link-input');
    if (copyLinkBtn) copyLinkBtn.addEventListener('click', () => copyAction(linkInput, copyLinkBtn));
}

export function setupWithdrawalModal() {
    const withdrawBtn = document.getElementById('btn-withdraw-commission');
    const modal = document.getElementById('withdraw-modal-overlay');
    const closeBtn = document.getElementById('withdraw-modal-close-btn');
    const form = document.getElementById('withdraw-form');

    if (withdrawBtn && modal) withdrawBtn.addEventListener('click', () => { modal.style.display = 'flex'; });
    if (closeBtn && modal) closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            alert('A sua solicitação de Saque de Comissões foi recebida! (Integração PIX real na Fase 4.1)');
            modal.style.display = 'none';
        });
    }
}

export function setupTransferModal() {
    const transferBtn = document.getElementById('btn-transfer-commission');
    
    if (transferBtn) {
        transferBtn.addEventListener('click', () => {
            const oldModal = document.getElementById('transfer-modal-custom');
            if (oldModal) oldModal.remove();

            const modalHtml = `
                <div id="transfer-modal-custom" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: rgba(0, 0, 0, 0.85); z-index: 2147483647; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(5px);">
                    <div style="background-color: #1A1A1D; border: 1px solid #00BCD4; border-radius: 12px; padding: 30px; width: 90%; max-width: 400px; box-shadow: 0 10px 40px rgba(0, 188, 212, 0.3); text-align: center; position: relative;">
                        <button id="close-transfer-btn" style="position: absolute; top: 15px; right: 20px; background: none; border: none; font-size: 2em; color: #888; cursor: pointer; padding: 0; line-height: 1;">&times;</button>
                        
                        <h2 style="color: #00BCD4; margin-top: 0; margin-bottom: 10px;">Transferir Comissão</h2>
                        <p style="color: #aaa; font-size: 0.9em; margin-bottom: 25px;">Envie os seus ganhos direto para o Saldo de Jogo para apostar.</p>

                        <div style="margin-bottom: 20px; text-align: left;">
                            <label style="color: #B0B0B0; font-size: 0.9em; font-weight: bold;">Valor a transferir (R$)</label>
                            <input type="number" id="transfer-amount-input" placeholder="Ex: 50.00" min="1" step="0.01" style="width: 100%; padding: 12px; margin-top: 8px; background: #111; border: 1px solid #444; color: white; border-radius: 6px; box-sizing: border-box; font-size: 1.2em; font-weight: bold;">
                        </div>

                        <div id="transfer-status-msg" style="min-height: 20px; font-weight: bold; margin-bottom: 15px; color: #E53935;"></div>

                        <div style="display: flex; gap: 10px;">
                            <button id="cancel-transfer-btn" style="flex: 1; padding: 12px; background: transparent; color: #888; border: 1px solid #444; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s;">Cancelar</button>
                            <button id="confirm-transfer-btn" style="flex: 1; padding: 12px; background-color: #00BCD4; color: #121212; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 10px rgba(0, 188, 212, 0.3);">Confirmar</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);

            const modal = document.getElementById('transfer-modal-custom');
            const closeBtn = document.getElementById('close-transfer-btn');
            const cancelBtn = document.getElementById('cancel-transfer-btn');
            const confirmBtn = document.getElementById('confirm-transfer-btn');
            const amountInput = document.getElementById('transfer-amount-input');
            const statusMsg = document.getElementById('transfer-status-msg');

            setTimeout(() => amountInput.focus(), 100);

            const closeModal = () => modal.remove();
            closeBtn.onclick = closeModal;
            cancelBtn.onclick = closeModal;
            modal.onclick = (e) => { if (e.target === modal) closeModal(); };

            confirmBtn.onclick = async () => {
                const amount = parseFloat(amountInput.value);

                if (isNaN(amount) || amount <= 0) {
                    statusMsg.textContent = 'Por favor, digite um valor válido.';
                    return;
                }

                statusMsg.style.color = 'white';
                statusMsg.textContent = 'Processando...';
                confirmBtn.disabled = true; 

                const token = localStorage.getItem('jwtToken');

                try {
                    const response = await fetch(`${API_BASE_URL}/affiliate/transfer-to-balance`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ amount: amount })
                    });

                    const data = await response.json();

                    if (data.success) {
                        statusMsg.style.color = '#4CAF50';
                        statusMsg.textContent = `Sucesso! R$ ${amount.toFixed(2)} transferidos.`;
                        setTimeout(() => {
                            closeModal();
                            window.location.reload(); 
                        }, 1500);
                    } else {
                        statusMsg.style.color = '#E53935';
                        statusMsg.textContent = `Erro: ${data.message}`;
                        confirmBtn.disabled = false;
                    }
                } catch (error) {
                    console.error('Erro na transferência:', error);
                    statusMsg.style.color = '#E53935';
                    statusMsg.textContent = 'Falha de comunicação com o servidor.';
                    confirmBtn.disabled = false;
                }
            };
        });
    }
}