// js/afiliado.js

// API_BASE_URL é agora GLOBAL, não precisa ser redeclarada se main.js a carregar.
// Mas para manter o módulo independente, vamos re-importar:
import { API_BASE_URL } from './utils.js';

// Função para buscar e exibir os dados do afiliado
export async function loadAffiliateData() { // <-- Adicionado EXPORT
    const token = localStorage.getItem('jwtToken');

    if (!token) {
        // A verificação de login agora é (provavelmente) feita pelo auth.js/main.js
        // Mas podemos manter por segurança se a página for acedida diretamente
        // window.location.href = '/'; 
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/affiliate/dashboard?cacheBust=${new Date().getTime()}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache'
            }
        });

        if (!response.ok) {
            throw new Error('Falha ao buscar dados do afiliado.');
        }

        const data = await response.json();

        if (data.success) {
            const referralCodeInput = document.getElementById('referral-code-input');
            const commissionBalanceDisplay = document.getElementById('commission-balance-display');
            const referralCountDisplay = document.getElementById('referral-count-display');
            const referralLinkInput = document.getElementById('referral-link-input');

            if (referralCodeInput) referralCodeInput.value = data.referralCode;
            if (commissionBalanceDisplay) commissionBalanceDisplay.textContent = `R$ ${data.commissionBalance.replace('.', ',')}`;
            if (referralCountDisplay) referralCountDisplay.textContent = data.referralCount;

            const siteBaseURL = window.location.origin; // Usa o URL atual do site (ex: https://datajogos.vercel.app)
            if (referralLinkInput) {
                referralLinkInput.value = `${siteBaseURL}/?ref=${data.referralCode}`;
            }
        }

    } catch (error) {
        console.error('Erro ao carregar dados de afiliado:', error);
        alert('Não foi possível carregar seus dados de afiliado.');
    }
}

// Função para o botão "Copiar" (CÓDIGO)
export function setupCopyButton() { // <-- Adicionado EXPORT
    const copyButton = document.getElementById('copy-button');
    const referralInput = document.getElementById('referral-code-input');

    if (!copyButton || !referralInput) return; 

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

// Função para o botão "Copiar Link"
export function setupCopyLinkButton() { // <-- Adicionado EXPORT
    const copyLinkBtn = document.getElementById('copy-link-btn');
    const referralLinkInput = document.getElementById('referral-link-input');

    if (!copyLinkBtn || !referralLinkInput) return; 

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

// REMOVIDO o 'DOMContentLoaded' daqui
// document.addEventListener('DOMContentLoaded', () => { ... });