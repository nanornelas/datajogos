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

    try {
        // A SUA BOA PRÁTICA: Cache-Busting para garantir saldo atualizado!
        const headers = { ...getAuthHeaders(token), 'Cache-Control': 'no-cache' };
        const cacheBust = `?t=${new Date().getTime()}`;

        // Faz as duas requisições (Dashboard + Extrato) em paralelo para ser mais rápido
        const [dashRes, historyRes] = await Promise.all([
            fetch(`${API_BASE_URL}/affiliate/dashboard${cacheBust}`, { headers }),
            fetch(`${API_BASE_URL}/influencer/statement${cacheBust}`, { headers })
        ]);

        const dashData = await dashRes.json();
        const historyData = await historyRes.json();

        // --- PREENCHE OS CARDS SUPERIORES E LINKS ---
        if (dashData.success) {
            const referralCodeInput = document.getElementById('referral-code-input');
            const commissionBalanceDisplay = document.getElementById('commission-balance-display');
            const referralCountDisplay = document.getElementById('referral-count-display');
            const referralLinkInput = document.getElementById('referral-link-input');

            if (referralCodeInput) referralCodeInput.value = dashData.referralCode;
            if (commissionBalanceDisplay) commissionBalanceDisplay.textContent = `R$ ${dashData.commissionBalance.replace('.', ',')}`;
            if (referralCountDisplay) referralCountDisplay.textContent = dashData.referralCount;

            const siteBaseURL = window.location.origin; 
            if (referralLinkInput) {
                referralLinkInput.value = `${siteBaseURL}/?ref=${dashData.referralCode}`;
            }
        }

        // --- PREENCHE A NOVA TABELA DE EXTRATO DE GANHOS ---
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
        console.error('Erro ao carregar dados de afiliado:', error);
        const historyBody = document.getElementById('affiliate-history-body');
        if(historyBody) historyBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #E53935; padding: 20px;">Erro de conexão com o servidor.</td></tr>';
    }
}

// ==========================================
// 2. FUNÇÃO AUXILIAR PARA OS BOTÕES DE COPIAR (Com Feedback Visual)
// ==========================================
function copyAction(inputEl, btnEl) {
    if (!inputEl || !btnEl) return;
    
    // O select() facilita a vida em dispositivos móveis
    inputEl.select();
    inputEl.setSelectionRange(0, 99999); 
    
    navigator.clipboard.writeText(inputEl.value).then(() => {
        const originalText = btnEl.textContent;
        const originalBg = btnEl.style.backgroundColor;
        
        // Fica verde piscando sucesso
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

// Mantendo os seus exports exatos para não quebrar o main.js
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

// 🟢 NOVO EXPORT: Função para ativar o botão de Saque da tela de Afiliados
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

// ==========================================
// TRANSFERÊNCIA PARA O SALDO DE JOGO
// ==========================================
export function setupTransferModal() {
    const transferBtn = document.getElementById('btn-transfer-commission');
    
    if (transferBtn) {
        transferBtn.addEventListener('click', async () => {
            const token = localStorage.getItem('jwtToken');
            
            // Pergunta quanto ele quer transferir (pode ser aprimorado com um Modal depois)
            const amountStr = prompt('Quanto da sua comissão deseja enviar para o Saldo de Jogo? (Ex: 10.50)');
            if (!amountStr) return; // Utilizador cancelou

            const amount = parseFloat(amountStr.replace(',', '.'));

            if (isNaN(amount) || amount <= 0) {
                alert('Por favor, digite um valor válido.');
                return;
            }

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
                    alert(`Sucesso! R$ ${amount.toFixed(2)} transferidos para a sua carteira de jogo.`);
                    // Atualiza a tela recarregando os dados
                    window.location.reload(); 
                } else {
                    alert(`Erro: ${data.message}`);
                }
            } catch (error) {
                console.error('Erro na transferência:', error);
                alert('Falha ao comunicar com o servidor.');
            }
        });
    }
}