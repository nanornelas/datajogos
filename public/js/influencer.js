const API_BASE_URL = 'http://localhost:3000/api';

// Função para buscar os dados de resumo (saldo, indicados, código)
async function loadSummaryData(token) {
    try {
        const response = await fetch(`${API_BASE_URL}/affiliate/dashboard`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
            document.getElementById('referral-code-input').value = data.referralCode;
            document.getElementById('commission-balance-display').textContent = `R$ ${data.commissionBalance.replace('.', ',')}`;
            document.getElementById('referral-count-display').textContent = data.referralCount;
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('Erro ao carregar dados de resumo:', error);
    }
}

// Função para buscar e renderizar a tabela do extrato detalhado
async function loadStatementData(token) {
    const tableBody = document.getElementById('statement-body');
    try {
        const response = await fetch(`${API_BASE_URL}/influencer/statement`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Falha ao buscar extrato.');
        }

        const data = await response.json();

        if (data.success && data.statement.length > 0) {
            tableBody.innerHTML = ''; // Limpa a mensagem "A carregar..."
            data.statement.forEach(tx => {
                // Formata a data para um formato legível
                const txDate = new Date(tx.createdAt).toLocaleString('pt-BR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });

                // LÓGICA CORRIGIDA: Verifica o tipo de transação antes de aceder às propriedades
                let details = '-';
                let valueSign = '+';
                let valueClass = `commission-${tx.type.toLowerCase().replace('_debit', '')}`;

                if (tx.type === 'NGR') {
                    details = `Perda do jogador de R$ ${tx.sourceBetAmount.toFixed(2).replace('.', ',')}`;
                } else if (tx.type === 'NGR_DEBIT') {
                    details = `Ganho do jogador de R$ ${tx.sourcePlayerProfit.toFixed(2).replace('.', ',')}`;
                    valueSign = '-';
                    valueClass = 'commission-ngr_debit';
                } else if (tx.type === 'CPA') {
                    details = 'Primeira aposta do indicado';
                }

                const row = `
                    <tr>
                        <td>${txDate}</td>
                        <td><span class="${valueClass}">${tx.type}</span></td>
                        <td>${tx.sourceUsername}</td>
                        <td>${details}</td>
                        <td class="${valueClass}">${valueSign} R$ ${tx.amount.toFixed(2).replace('.', ',')}</td>
                    </tr>
                `;
                tableBody.innerHTML += row; // Adiciona a nova linha na tabela
            });
        } else {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nenhuma transação encontrada.</td></tr>';
        }

    } catch (error) {
        console.error('Erro ao carregar extrato:', error);
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: #E53935;">Erro: ${error.message}</td></tr>`;
    }
}

// Função para configurar a funcionalidade do botão "Copiar"
function setupCopyButton() {
    const copyButton = document.getElementById('copy-button');
    const referralInput = document.getElementById('referral-code-input');

    copyButton.addEventListener('click', () => {
        // Usa a API do navegador para copiar o texto
        navigator.clipboard.writeText(referralInput.value).then(() => {
            // Feedback visual para o utilizador
            copyButton.textContent = 'Copiado!';
            setTimeout(() => {
                copyButton.textContent = 'Copiar';
            }, 2000); // Volta ao normal depois de 2 segundos
        }).catch(err => {
            console.error('Erro ao copiar texto: ', err);
            alert('Não foi possível copiar o código.');
        });
    });
}

// Função principal que é executada assim que a página termina de carregar
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('jwtToken');

    // Medida de segurança: se não houver token, volta para a página inicial
    if (!token) {
        window.location.href = '/';
        return;
    }

    // Chama todas as funções necessárias para inicializar a página
    loadSummaryData(token);
    loadStatementData(token);
    setupCopyButton();
});

