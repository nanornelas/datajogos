const API_BASE_URL = 'https://datajogos.onrender.com/api';

// Função para buscar e exibir os dados do afiliado
async function loadAffiliateData() {
    const token = localStorage.getItem('jwtToken');

    if (!token) {
        window.location.href = '/'; 
        return;
    }

    try {
        // --- CORREÇÃO DE CACHE ---
        const response = await fetch(`${API_BASE_URL}/affiliate/dashboard?cacheBust=${new Date().getTime()}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache'
            }
        });
        // --- FIM DA CORREÇÃO ---

        if (!response.ok) {
            throw new Error('Falha ao buscar dados do afiliado.');
        }

        const data = await response.json();

        if (data.success) {
            // Preenche os campos existentes
            document.getElementById('referral-code-input').value = data.referralCode;
            document.getElementById('commission-balance-display').textContent = `R$ ${data.commissionBalance.replace('.', ',')}`;
            document.getElementById('referral-count-display').textContent = data.referralCount;

            // --- ADICIONADO: Preenche o novo campo de Link ---
            const referralLinkInput = document.getElementById('referral-link-input');
            // IMPORTANTE: Confirme se 'https://datajogos.vercel.app' é o URL principal do seu site
            const siteBaseURL = 'https://datajogos.vercel.app'; 
            if (referralLinkInput) {
                referralLinkInput.value = `${siteBaseURL}/?ref=${data.referralCode}`;
            }
            // --- FIM DA ADIÇÃO ---

        }

    } catch (error) {
        console.error('Erro:', error);
        alert('Não foi possível carregar seus dados de afiliado.');
    }
}

// Função para o botão "Copiar" (CÓDIGO)
function setupCopyButton() {
    const copyButton = document.getElementById('copy-button');
    const referralInput = document.getElementById('referral-code-input');

    if (!copyButton || !referralInput) return; // Segurança

    copyButton.addEventListener('click', () => {
        navigator.clipboard.writeText(referralInput.value).then(() => {
            copyButton.textContent = 'Copiado!';
            setTimeout(() => { copyButton.textContent = 'Copiar'; }, 2000);
        }).catch(err => {
            console.error('Erro ao copiar código: ', err);
            alert('Não foi possível copiar o código.');
        });
    });
}

// --- ADICIONADO: Função para o botão "Copiar Link" ---
function setupCopyLinkButton() {
    const copyLinkBtn = document.getElementById('copy-link-btn');
    const referralLinkInput = document.getElementById('referral-link-input');

    if (!copyLinkBtn || !referralLinkInput) return; // Segurança

    copyLinkBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(referralLinkInput.value).then(() => {
            copyLinkBtn.textContent = 'Copiado!';
            setTimeout(() => { copyLinkBtn.textContent = 'Copiar Link'; }, 2000);
        }).catch(err => {
            console.error('Erro ao copiar link: ', err);
            alert('Não foi possível copiar o link.');
        });
    });
}
// --- FIM DA ADIÇÃO ---


// Executa as funções quando a página terminar de carregar
document.addEventListener('DOMContentLoaded', () => {
    loadAffiliateData();
    setupCopyButton();
    setupCopyLinkButton(); // <-- ADICIONADO: Chama a nova função
});