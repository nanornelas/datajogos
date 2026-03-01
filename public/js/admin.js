import { API_BASE_URL, getAuthHeaders } from './utils.js';

let financialChart = null; 

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('jwtToken');
    if (!token) { window.location.href = '/'; return; }

    await loadAdminStats(token);
    await loadUsersTable(token);
    setupForceDraw(token);
    setupTransactionForm(token);
    setupRoleForm(token);
    renderFinancialChart(token);
});

// ==========================================
// MÓDULO 1: ESTATÍSTICAS
// ==========================================
async function loadAdminStats(token) {
    try {
        const res = await fetch(`${API_BASE_URL}/admin/stats`, { headers: getAuthHeaders(token) });
        const data = await res.json();
        if (data.success) {
            document.getElementById('admin-total-balance').textContent = `R$ ${data.totalPlatformBalance.replace('.', ',')}`;
            document.getElementById('admin-total-commissions').textContent = `R$ ${data.totalCommissionsPaid.replace('.', ',')}`;
            document.getElementById('admin-total-users').textContent = data.totalUsers;
        }
    } catch (error) { console.error(error); }
}

// ==========================================
// MÓDULO 2: TABELA E AUTO-PREENCHIMENTO DE USERNAME
// ==========================================
window.populateAdminForms = (username) => {
    const txInput = document.getElementById('admin-tx-username');
    const roleInput = document.getElementById('admin-role-username');
    
    // Agora preenche o campo com o nome do jogador (ex: "Maria123")
    if (txInput) txInput.value = username;
    if (roleInput) roleInput.value = username;

    window.scrollTo({ top: 0, behavior: 'smooth' });
};

async function loadUsersTable(token) {
    try {
        const res = await fetch(`${API_BASE_URL}/admin/users`, { headers: getAuthHeaders(token) });
        const data = await res.json();
        const tbody = document.getElementById('admin-users-table-body');
        
        if (data.success && data.users.length > 0) {
            tbody.innerHTML = data.users.map(user => {
                const date = new Date(user.createdAt).toLocaleDateString('pt-BR');
                let roleDisplay = 'Jogador';
                let roleColor = '#bbb';
                
                if (user.role === 'admin') { roleDisplay = 'Admin'; roleColor = '#FFC107'; }
                else if (user.role === 'influencer') { roleDisplay = 'Influencer VIP'; roleColor = '#9C27B0'; }
                else if (user.role === 'affiliate') { roleDisplay = 'Afiliado'; roleColor = '#00BCD4'; }

                // 🟢 CORREÇÃO: Passamos o 'user.username' no clique!
                return `
                    <tr style="border-bottom: 1px solid #2a2a2a; transition: background 0.2s; cursor: pointer;" 
                        onmouseover="this.style.background='#1a1a1a'" 
                        onmouseout="this.style.background='transparent'"
                        onclick="populateAdminForms('${user.username}')">
                        <td style="padding: 12px 5px; color: #888; font-size: 0.9em;">${date}</td>
                        <td style="padding: 12px 5px; color: #E0E0E0; font-family: monospace; font-size: 0.9em;">${user.userId}</td>
                        <td style="padding: 12px 5px; color: #FFF; font-weight: bold;">${user.username}</td>
                        <td style="padding: 12px 5px; color: ${roleColor}; font-weight: bold;">${roleDisplay}</td>
                        <td style="padding: 12px 5px; color: #4CAF50;">R$ ${user.balance.toFixed(2).replace('.', ',')}</td>
                        <td style="padding: 12px 5px; color: #FFC107;">R$ ${user.commissionBalance.toFixed(2).replace('.', ',')}</td>
                    </tr>
                `;
            }).join('');
        }
    } catch (error) { console.error(error); }
}

// ==========================================
// MÓDULO 3: GATILHO DA ROLETA
// ==========================================
function setupForceDraw(token) {
    const msgEl = document.getElementById('force-draw-msg');
    const forceColor = async (color, colorName, hexCode) => {
        msgEl.textContent = 'A comunicar...';
        msgEl.style.color = 'white';
        try {
            const res = await fetch(`${API_BASE_URL}/admin/set-draw`, {
                method: 'POST',
                headers: { ...getAuthHeaders(token), 'Content-Type': 'application/json' },
                body: JSON.stringify({ color })
            });
            const data = await res.json();
            if (data.success) {
                msgEl.textContent = `🎯 SUCESSO: A próxima bola será ${colorName}!`;
                msgEl.style.color = hexCode;
                setTimeout(() => msgEl.textContent = '', 4000);
            }
        } catch (error) {}
    };

    const btnRed = document.getElementById('btn-force-red');
    const btnBlue = document.getElementById('btn-force-blue');
    const btnGreen = document.getElementById('btn-force-green');
    if(btnRed) btnRed.addEventListener('click', () => forceColor('RED', 'VERMELHO', '#E53935'));
    if(btnBlue) btnBlue.addEventListener('click', () => forceColor('BLUE', 'AZUL', '#1E88E5'));
    if(btnGreen) btnGreen.addEventListener('click', () => forceColor('GREEN', 'VERDE', '#4CAF50'));
}

// ==========================================
// MÓDULO 4: INJECTAR/REMOVER SALDO
// ==========================================
function setupTransactionForm(token) {
    const form = document.getElementById('form-admin-transaction');
    const msgEl = document.getElementById('admin-tx-msg');
    if(!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('admin-tx-username').value.trim();
        const type = document.getElementById('admin-tx-type').value;
        const amount = parseFloat(document.getElementById('admin-tx-amount').value);
        
        const bonusCheckbox = document.getElementById('admin-tx-bonus');
        const addBonus = bonusCheckbox ? bonusCheckbox.checked && type === 'DEPOSIT' : false;

        if (!username || isNaN(amount) || amount <= 0) {
            msgEl.textContent = 'Preencha todos os campos.';
            msgEl.style.color = '#E53935';
            return;
        }

        msgEl.textContent = 'A processar transação...';
        msgEl.style.color = 'white';

        try {
            const res = await fetch(`${API_BASE_URL}/admin/transaction`, {
                method: 'POST',
                headers: { ...getAuthHeaders(token), 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, type, amount, addBonus }) 
            });
            const data = await res.json();

            if (data.success) {
                msgEl.textContent = `✅ Transação concluída!`;
                msgEl.style.color = '#4CAF50';
                form.reset();
                loadAdminStats(token);
                loadUsersTable(token);
                renderFinancialChart(token);
                setTimeout(() => msgEl.textContent = '', 4000);
            } else {
                msgEl.textContent = `Erro: ${data.message}`;
                msgEl.style.color = '#E53935';
            }
        } catch (error) {}
    });
}

// ==========================================
// MÓDULO 5: PROMOVER CARGOS
// ==========================================
function setupRoleForm(token) {
    const form = document.getElementById('form-admin-role');
    const msgEl = document.getElementById('admin-role-msg');
    if(!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('admin-role-username').value.trim();
        const role = document.getElementById('admin-role-select').value;

        msgEl.textContent = 'A atualizar privilégios...';
        msgEl.style.color = 'white';

        try {
            // 🟢 MUDAMOS PARA O NOVO ENDPOINT DE UPDATE-ROLE
            const res = await fetch(`${API_BASE_URL}/admin/update-role`, {
                method: 'PUT',
                headers: { ...getAuthHeaders(token), 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, role })
            });
            const data = await res.json();

            if (data.success) {
                msgEl.textContent = `👑 ${username} promovido com sucesso!`;
                msgEl.style.color = '#FFC107';
                form.reset();
                loadUsersTable(token);
                setTimeout(() => msgEl.textContent = '', 4000);
            } else {
                msgEl.textContent = `Erro: ${data.message}`;
                msgEl.style.color = '#E53935';
            }
        } catch (error) {}
    });
}

// ==========================================
// MÓDULO 6: GRÁFICO FINANCEIRO
// ==========================================
async function renderFinancialChart(token) {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/financial-summary`, { headers: getAuthHeaders(token) });
        if (!response.ok) return;
        const data = await response.json();
        
        const ctxEl = document.getElementById('financial-chart');
        if (!ctxEl) return;
        
        const ctx = ctxEl.getContext('2d');
        if (financialChart) { financialChart.destroy(); }
        
        financialChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [
                    { type: 'line', label: 'Utilizadores Ativos', data: data.datasets.activeUsers, borderColor: '#FFC107', backgroundColor: 'rgba(255, 193, 7, 0.2)', yAxisID: 'yActiveUsers', tension: 0.3, fill: true },
                    { type: 'bar', label: 'Depósitos (R$)', data: data.datasets.deposits, backgroundColor: '#4CAF50', yAxisID: 'yFinancial' },
                    { type: 'bar', label: 'Saques (R$)', data: data.datasets.withdrawals, backgroundColor: '#E53935', yAxisID: 'yFinancial' }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { ticks: { color: '#B0B0B0' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    yFinancial: { type: 'linear', position: 'left', ticks: { color: '#B0B0B0', callback: value => `R$ ${value}` }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    yActiveUsers: { type: 'linear', position: 'right', ticks: { color: '#B0B0B0' }, grid: { drawOnChartArea: false } }
                },
                plugins: { legend: { labels: { color: '#E0E0E0' } } }
            }
        });
    } catch (error) {}
}