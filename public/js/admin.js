const API_BASE_URL = 'http://localhost:3000/api';
const token = localStorage.getItem('jwtToken');

let allUsersData = [];
let selectedUserId = null;
let financialChart = null;

// Declaração das variáveis de elementos do DOM
let navLinks, views, modalOverlay, modalCloseBtn, modalTitle,
    modalUserRoleSelect, modalSaveRoleBtn, modalCurrentBalanceSpan, modalCurrentBonusSpan,
    modalTransactionAmountInput, modalAddBonusCheckbox, modalDepositBtn, modalWithdrawalBtn,
    modalStatus, tableBody;

// Função para alternar entre as visualizações do painel
function showView(viewId) {
    views.forEach(view => view.classList.remove('active'));
    navLinks.forEach(link => link.classList.remove('active'));
    const viewToShow = document.getElementById(viewId);
    if (viewToShow) viewToShow.classList.add('active');
    const viewName = viewId.replace('-view', '');
    const correspondingNavLink = document.getElementById(`nav-${viewName}`);
    if (correspondingNavLink) correspondingNavLink.classList.add('active');
}

// Abre o pop-up (modal) de edição com os dados do utilizador
function openUserModal(userId) {
    const user = allUsersData.find(u => u.userId === userId);
    if (!user) return;
    selectedUserId = userId;
    modalTitle.textContent = `Editar Utilizador: ${user.username}`;
    modalUserRoleSelect.value = user.role;
    modalCurrentBalanceSpan.textContent = `R$ ${user.balance.toFixed(2)}`;
    modalCurrentBonusSpan.textContent = `R$ ${user.bonusBalance.toFixed(2)}`;
    modalTransactionAmountInput.value = '';
    modalAddBonusCheckbox.checked = false;
    modalStatus.textContent = '';
    modalOverlay.style.display = 'flex';
}

// Fecha o pop-up (modal) de edição
function closeUserModal() {
    modalOverlay.style.display = 'none';
    selectedUserId = null;
}

// Salva a alteração da 'role' (função) do utilizador
async function saveRoleChange() {
    if (!selectedUserId) return;
    const newRole = modalUserRoleSelect.value;
    modalStatus.textContent = 'A salvar role...';
    modalStatus.style.color = '#FFEB3B';
    try {
        const response = await fetch(`${API_BASE_URL}/admin/user/${selectedUserId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ role: newRole })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        modalStatus.textContent = data.message;
        modalStatus.style.color = '#4CAF50';
        loadUsersList();
    } catch (error) {
        modalStatus.textContent = `Erro: ${error.message}`;
        modalStatus.style.color = '#E53935';
    }
}

// Lida com o registo de uma nova transação (Depósito ou Saque)
async function handleTransaction(type) {
    if (!selectedUserId) return;
    const amount = parseFloat(modalTransactionAmountInput.value);
    const addBonus = modalAddBonusCheckbox.checked && type === 'DEPOSIT';

    if (isNaN(amount) || amount <= 0) {
        modalStatus.textContent = 'Erro: Por favor, insira um valor de transação válido.';
        modalStatus.style.color = '#E53935';
        return;
    }
    modalStatus.textContent = 'A processar transação...';
    modalStatus.style.color = '#FFEB3B';
    try {
        const response = await fetch(`${API_BASE_URL}/admin/transaction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ userId: selectedUserId, type, amount, addBonus }) // Envia a opção de bónus
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        modalStatus.textContent = data.message;
        modalStatus.style.color = '#4CAF50';
        
        // Atualiza a UI com os novos saldos
        modalCurrentBalanceSpan.textContent = `R$ ${data.newBalance.toFixed(2)}`;
        modalCurrentBonusSpan.textContent = `R$ ${data.newBonusBalance.toFixed(2)}`;
        modalTransactionAmountInput.value = '';
        modalAddBonusCheckbox.checked = false;
        loadUsersList();
        renderFinancialChart();
    } catch (error) {
        modalStatus.textContent = `Erro: ${error.message}`;
        modalStatus.style.color = '#E53935';
    }
}

// Carrega os dados dos cards de estatísticas do Dashboard
async function loadDashboardStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/stats`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error('Falha ao carregar estatísticas.');
        const data = await response.json();
        document.getElementById('stats-total-users').textContent = data.totalUsers;
        document.getElementById('stats-total-balance').textContent = `R$ ${data.totalPlatformBalance}`;
        document.getElementById('stats-total-commissions').textContent = `R$ ${data.totalCommissionsPaid}`;
    } catch (error) {
        console.error(error);
        document.querySelector('#dashboard-view .stats-grid').innerHTML = '<p style="color: #E53935;">Não foi possível carregar os dados.</p>';
    }
}

// Carrega e renderiza a lista de todos os utilizadores na tabela
async function loadUsersList() {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">A carregar utilizadores...</td></tr>';
    try {
        const response = await fetch(`${API_BASE_URL}/admin/users`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error('Falha ao carregar utilizadores.');
        const data = await response.json();
        allUsersData = data.users;
        tableBody.innerHTML = '';
        allUsersData.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.userId}</td>
                <td>${user.username}</td>
                <td>${user.role}</td>
                <td>${user.balance.toFixed(2)}</td>
                <td>${user.commissionBalance.toFixed(2)}</td>
                <td>${new Date(user.createdAt).toLocaleDateString('pt-BR')}</td>
            `;
            row.addEventListener('click', () => openUserModal(user.userId));
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error(error);
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: #E53935;">Não foi possível carregar os utilizadores.</td></tr>';
    }
}

// Configura os botões de controlo do jogo
function setupGameControls() {
    const controlButtons = document.querySelectorAll('#game-control-view .bet-button');
    const statusElement = document.getElementById('admin-status');
    controlButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
            const color = e.target.dataset.color;
            statusElement.textContent = `A enviar comando para forçar a cor ${color}...`;
            statusElement.style.color = '#FFEB3B';
            try {
                const response = await fetch(`${API_BASE_URL}/admin/set-draw`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ color })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);
                statusElement.textContent = data.message;
                statusElement.style.color = '#4CAF50';
            } catch (error) {
                statusElement.textContent = `Erro: ${error.message}`;
                statusElement.style.color = '#E53935';
            }
        });
    });
}

// Carrega os dados e renderiza o gráfico financeiro
async function renderFinancialChart() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/financial-summary`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error('Falha ao carregar dados do gráfico.');
        const data = await response.json();
        const ctx = document.getElementById('financial-chart').getContext('2d');
        if (financialChart) { financialChart.destroy(); }
        financialChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [
                    { type: 'line', label: 'Utilizadores Ativos', data: data.datasets.activeUsers, borderColor: '#FFEB3B', backgroundColor: 'rgba(255, 235, 59, 0.2)', yAxisID: 'yActiveUsers', tension: 0.3, fill: true },
                    { type: 'bar', label: 'Depósitos (R$)', data: data.datasets.deposits, backgroundColor: '#4CAF50', yAxisID: 'yFinancial' },
                    { type: 'bar', label: 'Saques (R$)', data: data.datasets.withdrawals, backgroundColor: '#E53935', yAxisID: 'yFinancial' }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { ticks: { color: '#B0B0B0' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                    yFinancial: { type: 'linear', position: 'left', ticks: { color: '#B0B0B0', callback: value => `R$ ${value}` }, grid: { color: 'rgba(255,255,255,0.1)' }, title: { display: true, text: 'Movimentação Financeira (R$)', color: '#E0E0E0' } },
                    yActiveUsers: { type: 'linear', position: 'right', ticks: { color: '#B0B0B0' }, grid: { drawOnChartArea: false }, title: { display: true, text: 'Utilizadores Ativos', color: '#E0E0E0' } }
                },
                plugins: { legend: { labels: { color: '#E0E0E0' } } }
            }
        });
    } catch (error) {
        console.error(error);
        document.querySelector('.chart-card').innerHTML = '<p style="color: #E53935;">Não foi possível carregar o gráfico.</p>';
    }
}

// Função principal de inicialização
document.addEventListener('DOMContentLoaded', () => {
    // Inicializa as variáveis de elementos do DOM
    navLinks = document.querySelectorAll('nav a[id^="nav-"]');
    views = document.querySelectorAll('.admin-view');
    modalOverlay = document.getElementById('user-edit-modal');
    modalCloseBtn = document.getElementById('modal-close-btn');
    modalTitle = document.getElementById('modal-title');
    modalUserRoleSelect = document.getElementById('modal-user-role');
    modalSaveRoleBtn = document.getElementById('modal-save-role-btn');
    modalCurrentBalanceSpan = document.getElementById('modal-current-balance');
    modalCurrentBonusSpan = document.getElementById('modal-current-bonus');
    modalTransactionAmountInput = document.getElementById('modal-transaction-amount');
    modalAddBonusCheckbox = document.getElementById('modal-add-bonus-checkbox');
    modalDepositBtn = document.getElementById('modal-deposit-btn');
    modalWithdrawalBtn = document.getElementById('modal-withdrawal-btn');
    modalStatus = document.getElementById('modal-status');
    tableBody = document.getElementById('users-table-body');
    
    if (!token) { window.location.href = '/'; return; }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const viewName = e.target.id.replace('nav-', '');
            showView(`${viewName}-view`);
        });
    });

    // Eventos do Modal
    modalCloseBtn.addEventListener('click', closeUserModal);
    modalSaveRoleBtn.addEventListener('click', saveRoleChange);
    modalDepositBtn.addEventListener('click', () => handleTransaction('DEPOSIT'));
    modalWithdrawalBtn.addEventListener('click', () => handleTransaction('WITHDRAWAL'));

    // Carrega todos os dados da página
    loadDashboardStats();
    loadUsersList();
    setupGameControls();
    renderFinancialChart();
});

