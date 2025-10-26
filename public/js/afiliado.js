const API_BASE_URL = 'https://datajogos.onrender.com/api';

// Função para buscar e exibir os dados do afiliado
async function loadAffiliateData() {
    const token = localStorage.getItem('jwtToken');

    // 1. Segurança: Se não estiver logado, volta para a página inicial
    if (!token) {
        window.location.href = '/'; // Redireciona para o login
        return;
    }

    try {
        // 2. Chama o novo endpoint que criamos no back-end
        const response = await fetch(`${API_BASE_URL}/affiliate/dashboard`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Falha ao buscar dados do afiliado.');
        }

        const data = await response.json();

        // 3. Preenche os elementos do HTML com os dados recebidos
        if (data.success) {
            document.getElementById('referral-code-input').value = data.referralCode;
            document.getElementById('commission-balance-display').textContent = `R$ ${data.commissionBalance.replace('.', ',')}`;
            document.getElementById('referral-count-display').textContent = data.referralCount;
        }

    } catch (error) {
        console.error('Erro:', error);
        alert('Não foi possível carregar seus dados de afiliado.');
    }
}

// Função para o botão "Copiar"
function setupCopyButton() {
    const copyButton = document.getElementById('copy-button');
    const referralInput = document.getElementById('referral-code-input');

    copyButton.addEventListener('click', () => {
        // Usa a API do navegador para copiar o texto
        navigator.clipboard.writeText(referralInput.value).then(() => {
            // Feedback visual para o usuário
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

// Executa as funções quando a página terminar de carregar
document.addEventListener('DOMContentLoaded', () => {
    loadAffiliateData();
    setupCopyButton();
});