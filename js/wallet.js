// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is authenticated
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                // Listen for real-time updates to user's token data from Firestore
                db.collection('toki_users').doc(user.uid).onSnapshot((userDoc) => {
                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        updateWalletSummary(userData);
                        updateTransactionHistory(userData);
                    } else {
                        console.error('No user data found');
                    }
                });
            } catch (error) {
                console.error('Error fetching user data:', error);
            }
            // Load approve tasks section
            loadApproveTasksSection(user.email);
            // Load redeem tokens section
            loadRedeemTokensSection(user.uid);
        } else {
            // Handle unauthenticated state
            console.log('User not authenticated');
            // You might want to redirect to login page or show a message
        }
    });

    // Handle package purchases
    const packageCards = document.querySelectorAll('.package-card');
    packageCards.forEach(card => {
        const purchaseBtn = card.querySelector('.purchase-btn');
        purchaseBtn.addEventListener('click', () => {
            const tokens = card.dataset.tokens;
            initiatePurchase(tokens);
        });
    });

    // Handle custom purchase
    const customInput = document.getElementById('customTokens');
    const customPurchaseBtn = document.getElementById('customPurchaseBtn');
    const estimatedPrice = document.getElementById('estimatedPrice');

    customInput.addEventListener('input', () => {
        const tokens = parseInt(customInput.value) || 0;
        const price = calculatePrice(tokens);
        estimatedPrice.textContent = `₹${price}`;
    });

    customPurchaseBtn.addEventListener('click', () => {
        const tokens = parseInt(customInput.value) || 0;
        if (tokens >= 10) {
            initiatePurchase(tokens);
        } else {
            alert('Minimum purchase amount is 10 tokens');
        }
    });
});

function updateWalletSummary(userData) {
    // Update total balance
    const totalBalanceElement = document.querySelector('.total-balance h2');
    totalBalanceElement.textContent = `${userData.toki || 0} Tokens`;
    
    // Calculate tokens earned and spent from transactions
    let tokensEarned = 0;
    let tokensSpent = 0;
    if (userData.transactions && Array.isArray(userData.transactions)) {
        tokensEarned = userData.transactions
            .filter(tx => tx.type === 'EARNED')
            .reduce((sum, tx) => sum + (tx.amount || 0), 0);
        tokensSpent = userData.transactions
            .filter(tx => tx.type === 'SPENT')
            .reduce((sum, tx) => sum + (tx.amount || 0), 0);
    }
    
    // Update tokens earned
    const tokensEarnedElement = document.querySelector('.tokens-earned h2');
    tokensEarnedElement.textContent = tokensEarned;
    
    // Update tokens spent
    const tokensSpentElement = document.querySelector('.tokens-spent h2');
    tokensSpentElement.textContent = tokensSpent;
    
    // Update approximate values in rupees (assuming 1 token = ₹1 for display)
    const totalBalanceValue = document.querySelector('.total-balance span');
    const tokensEarnedValue = document.querySelector('.tokens-earned span');
    const tokensSpentValue = document.querySelector('.tokens-spent span');
    
    totalBalanceValue.textContent = `≈ ₹${userData.toki || 0} available to spend`;
    tokensEarnedValue.textContent = `≈ ₹${tokensEarned} earned to date`;
    tokensSpentValue.textContent = `≈ ₹${tokensSpent} spent to date`;
}

function updateTransactionHistory(userData) {
    const tbody = document.querySelector('.transactions table tbody');
    tbody.innerHTML = ''; // Clear existing transactions
    
    if (userData.transactions && userData.transactions.length > 0) {
        // Sort transactions by date in descending order (newest first)
        const sortedTransactions = [...userData.transactions].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );
        
        sortedTransactions.forEach(transaction => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${formatDate(transaction.date)}</td>
                <td>${transaction.description}</td>
                <td class="${transaction.type.toLowerCase()}">${transaction.type === 'EARNED' ? '+ Earned' : 'Spent'}</td>
                <td class="${transaction.type.toLowerCase()}">${transaction.type === 'EARNED' ? '+' : ''}${transaction.amount} Tokens</td>
            `;
            tbody.appendChild(row);
        });
    } else {
        // Show message if no transactions
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="4" style="text-align: center;">No transactions found</td>';
        tbody.appendChild(row);
    }
}

function formatDate(date) {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function calculatePrice(tokens) {
    // For Basic plan (50 tokens or less), 1 rupee = 1 token
    if (tokens <= 50) {
        return tokens;
    }
    // For other plans, ₹5 per token
    return tokens * 5;
}

async function initiatePurchase(tokens) {
    try {
        const user = auth.currentUser;
        if (!user) {
            alert('Please log in to purchase tokens');
            return;
        }

        const price = calculatePrice(tokens);
        const confirmed = confirm(`Confirm purchase of ${tokens} tokens for ₹${price}?`);
        
        if (confirmed) {
            const userRef = db.collection('toki_users').doc(user.uid);
            const userDoc = await userRef.get();
            let userData = userDoc.exists ? userDoc.data() : {};

            // Ensure all required fields are present
            const email = user.email || userData.email || '';
            const tokensEarned = (userData.tokensEarned || 0) + parseInt(tokens);
            const toki = userData.toki || 0; // If you want to update this, add logic here
            const totalBalance = (userData.totalBalance || 0) + parseInt(tokens);
            const transactions = userData.transactions || [];

            // Add new transaction
            const newTransaction = {
                amount: parseInt(tokens),
                date: new Date(),
                description: 'Token Purchase',
                type: 'EARNED'
            };
            transactions.push(newTransaction);

            // Set or update the document with all required fields
            await userRef.set({
                email,
                tokensEarned,
                toki,
                totalBalance,
                transactions
            }, { merge: true });

            alert('Tokens purchased successfully!');
        }
    } catch (error) {
        console.error('Error processing purchase:', error);
        alert('Error processing purchase. Please try again.');
    }
}

// Approve Completed Tasks Section Logic
function loadApproveTasksSection(userEmail) {
    const approveTasksTableBody = document.querySelector('#approveTasksTable tbody');
    approveTasksTableBody.innerHTML = '<tr><td colspan="5">Loading tasks...</td></tr>';

    db.collection('tasks')
        .where('postedBy', '==', userEmail)
        .where('status', '==', 'Completed')
        .onSnapshot(snapshot => {
            if (snapshot.empty) {
                approveTasksTableBody.innerHTML = '<tr><td colspan="5">No completed tasks to approve.</td></tr>';
                return;
            }
            let html = '';
            snapshot.forEach(doc => {
                const task = doc.data();
                html += `
                  <tr>
                    <td>${task.title}</td>
                    <td>${task.description}</td>
                    <td>${task.acceptedBy || 'N/A'}</td>
                    <td>${task.completedAt && task.completedAt.toDate ? task.completedAt.toDate().toLocaleString() : 'N/A'}</td>
                    <td><button class="approve-task-btn" data-taskid="${doc.id}">Approve</button></td>
                  </tr>
                `;
            });
            approveTasksTableBody.innerHTML = html;

            // Add event listeners to approve buttons
            document.querySelectorAll('.approve-task-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const taskId = btn.getAttribute('data-taskid');
                    try {
                        await db.collection('tasks').doc(taskId).update({ status: 'Approved' });
                        alert('Task approved!');
                    } catch (err) {
                        alert('Error approving task.');
                        console.error(err);
                    }
                });
            });
        });
}

// Redeem Tokens Section Logic
function loadRedeemTokensSection(userUid) {
    const redeemTokensTableBody = document.querySelector('#redeemTokensTable tbody');
    redeemTokensTableBody.innerHTML = '<tr><td colspan="5">Loading redeemable tasks...</td></tr>';

    db.collection('tasks')
        .where('acceptedBy', '==', userUid)
        .where('status', '==', 'Approved')
        .onSnapshot(snapshot => {
            if (snapshot.empty) {
                redeemTokensTableBody.innerHTML = '<tr><td colspan="5">No approved tasks to redeem.</td></tr>';
                return;
            }
            let html = '';
            snapshot.forEach(doc => {
                const task = doc.data();
                html += `
                  <tr>
                    <td>${task.title}</td>
                    <td>${task.description}</td>
                    <td>${task.postedBy || 'N/A'}</td>
                    <td>${task.tokens || 0}</td>
                    <td><button class="redeem-task-btn" data-taskid="${doc.id}">Redeem</button></td>
                  </tr>
                `;
            });
            redeemTokensTableBody.innerHTML = html;

            // Add event listeners to redeem buttons
            document.querySelectorAll('.redeem-task-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const taskId = btn.getAttribute('data-taskid');
                    try {
                        // Get the task document
                        const taskDoc = await db.collection('tasks').doc(taskId).get();
                        const task = taskDoc.data();
                        const tokens = parseInt(task.tokens) || 0;
                        const user = auth.currentUser;
                        if (!user) {
                            alert('Please log in to redeem tokens');
                            return;
                        }
                        // Get user wallet doc
                        const userRef = db.collection('toki_users').doc(user.uid);
                        const userDoc = await userRef.get();
                        let userData = userDoc.exists ? userDoc.data() : {};
                        // Update wallet fields
                        const tokensEarned = (userData.tokensEarned || 0) + tokens;
                        const totalBalance = (userData.totalBalance || 0) + tokens;
                        const transactions = userData.transactions || [];
                        // Add transaction
                        const newTransaction = {
                            amount: tokens,
                            date: new Date(),
                            description: `Redeemed for task: ${task.title}`,
                            type: 'EARNED'
                        };
                        transactions.push(newTransaction);
                        // Update wallet
                        await userRef.set({
                            tokensEarned,
                            totalBalance,
                            transactions
                        }, { merge: true });
                        // Optionally, mark the task as redeemed
                        await db.collection('tasks').doc(taskId).update({ status: 'Redeemed' });
                        alert('Tokens redeemed and added to your wallet!');
                    } catch (err) {
                        alert('Error redeeming tokens.');
                        console.error(err);
                    }
                });
            });
        });
} 