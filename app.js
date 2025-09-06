// Solana Wallet Bubble Map
const canvas = document.getElementById('canvas');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000);
camera.position.z = 5;

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);

// Mouse controls
let mouseX = 0, mouseY = 0;
let targetRotationX = 0, targetRotationY = 0;
let currentRotationX = 0, currentRotationY = 0;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

document.addEventListener('mousemove', (event) => {
    mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    targetRotationY = mouseX * 0.5;
    targetRotationX = mouseY * 0.5;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

document.addEventListener('click', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children);
    if (intersects.length > 0) {
        const intersected = intersects[0].object;
        if (intersected.userData && intersected.userData.address) {
            // View transactions
            console.log('Viewing transactions for:', intersected.userData.address);
            // Placeholder: open Solscan or similar
            window.open(`https://solscan.io/account/${intersected.userData.address}`, '_blank');
        }
    }
});

// Touch events for mobile
document.addEventListener('touchmove', (event) => {
    if (event.touches.length === 1) {
        const touch = event.touches[0];
        mouseX = (touch.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(touch.clientY / window.innerHeight) * 2 + 1;
        targetRotationY = mouseX * 0.5;
        targetRotationX = mouseY * 0.5;
        mouse.x = mouseX;
        mouse.y = mouseY;
    }
});

document.addEventListener('touchend', (event) => {
    if (event.changedTouches.length === 1) {
        const touch = event.changedTouches[0];
        mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(scene.children);
        if (intersects.length > 0) {
            const intersected = intersects[0].object;
            if (intersected.userData && intersected.userData.address) {
                window.open(`https://solscan.io/account/${intersected.userData.address}`, '_blank');
            }
        }
    }
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // Smooth rotation
    currentRotationX += (targetRotationX - currentRotationX) * 0.05;
    currentRotationY += (targetRotationY - currentRotationY) * 0.05;
    scene.rotation.y = currentRotationY;
    scene.rotation.x = currentRotationX;

    // Update particles
    updateParticles();

    // Hover detection (only when mouse moved)
    if (mouse.x !== 0 || mouse.y !== 0) {
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(scene.children);
        if (intersects.length > 0) {
            const intersected = intersects[0].object;
            if (intersected.userData && intersected.userData.address) {
                // Show detailed info (for now, just log)
                console.log('Hovered wallet:', intersected.userData);
            }
        }
    }

    renderer.render(scene, camera);
}
animate();

// Window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Solana connection with proxy switching
let proxyIndex = 0;
const proxies = [
    null, // Direct connection
    'https://cors-anywhere.herokuapp.com/',
    'https://api.allorigins.win/raw?url='
];

function getCurrentProxy() {
    return proxies[proxyIndex];
}

function switchProxy() {
    proxyIndex = (proxyIndex + 1) % proxies.length;
    console.log('Switched to proxy:', getCurrentProxy());
}

const connection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('mainnet-beta'), 'confirmed');

// Placeholder for wallet data
let wallets = [];
let connections = [];

// Rug-pull detection data
let transactionHistory = {};
let anomalyThreshold = 0.2; // 20% contamination for anomaly detection

// User-controlled parameters
let transactionThreshold = 1.0; // SOL threshold for alerts
let updateInterval = 60000; // Update interval in milliseconds
let alertsEnabled = true;
let rugDetectionEnabled = true;
let dumpDetectionEnabled = true;
let mevDetectionEnabled = true;
let updateIntervalId = null;

// Advanced detection data
let sellOffPatterns = {};
let mevPatterns = {};
let dumpThreshold = 10; // SOL threshold for dump detection
let mevTimeWindow = 300000; // 5 minutes for MEV pattern detection

// Function to fetch wallet balance
async function getWalletBalance(publicKey) {
    try {
        const balance = await connection.getBalance(publicKey);
        return balance / solanaWeb3.LAMPORTS_PER_SOL;
    } catch (error) {
        console.error('Error fetching balance:', error);
        return 0;
    }
}

// Function to fetch recent transactions
async function getRecentTransactions(publicKey) {
    try {
        const transactions = await connection.getSignaturesForAddress(publicKey, { limit: 10 });
        return transactions;
    } catch (error) {
        console.error('Error fetching transactions:', error);
        return [];
    }
}

// Function to build connections
async function buildConnections() {
    connections = [];
    for (let wallet of wallets) {
        const publicKey = new solanaWeb3.PublicKey(wallet.address);
        const transactions = await getRecentTransactions(publicKey);

        // Store transaction history for anomaly detection
        if (!transactionHistory[wallet.address]) {
            transactionHistory[wallet.address] = [];
        }

        for (let tx of transactions) {
            try {
                const txDetails = await connection.getParsedTransaction(tx.signature);
                if (txDetails && txDetails.transaction.message.accountKeys) {
                    const accounts = txDetails.transaction.message.accountKeys.map(key => key.toString());

                    // Analyze transaction for balance changes
                    let balanceChange = 0;
                    if (txDetails.meta && txDetails.meta.preBalances && txDetails.meta.postBalances) {
                        const preBalance = txDetails.meta.preBalances[0] || 0;
                        const postBalance = txDetails.meta.postBalances[0] || 0;
                        balanceChange = Math.abs((preBalance - postBalance) / solanaWeb3.LAMPORTS_PER_SOL);
                    }

                    // Store in history
                    transactionHistory[wallet.address].push({
                        signature: tx.signature,
                        balanceChange: balanceChange,
                        timestamp: tx.blockTime || Date.now() / 1000
                    });

                    // Keep only last 50 transactions
                    if (transactionHistory[wallet.address].length > 50) {
                        transactionHistory[wallet.address] = transactionHistory[wallet.address].slice(-50);
                    }

                    // Analyze for advanced patterns
                    analyzeTransactionPatterns(wallet, transactionHistory[wallet.address][transactionHistory[wallet.address].length - 1]);

                    for (let account of accounts) {
                        const connectedWallet = wallets.find(w => w.address === account);
                        if (connectedWallet && connectedWallet !== wallet) {
                            connections.push({
                                from: wallet,
                                to: connectedWallet,
                                amount: balanceChange
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('Error parsing transaction:', error);
            }
        }
    }
}

// Anomaly detection using statistical methods (z-score)
function detectAnomalies(deltas) {
    if (deltas.length < 3) return false; // Need minimum samples

    const mean = deltas.reduce((sum, val) => sum + val, 0) / deltas.length;
    const variance = deltas.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / deltas.length;
    const stdDev = Math.sqrt(variance);

    // Check for anomalies (z-score > 3)
    return deltas.some(delta => Math.abs((delta - mean) / stdDev) > 3);
}

// Check for rug-pull patterns
function checkRugPullPatterns(wallet) {
    const history = transactionHistory[wallet.address];
    if (!history || history.length < 5) return false;

    const deltas = history.map(tx => tx.balanceChange);

    // Large sudden drops based on user threshold
    const recentDeltas = deltas.slice(-5);
    const hasLargeDrop = recentDeltas.some(delta => delta > transactionThreshold);

    // Anomalous patterns
    const hasAnomaly = detectAnomalies(deltas);

    return hasLargeDrop || hasAnomaly;
}

// Detect large sell-offs (dumps)
function detectLargeSellOff(wallet) {
    const history = transactionHistory[wallet.address];
    if (!history || history.length < 3) return false;

    // Look for large negative balance changes (sells/dumps)
    const recentSells = history.slice(-10).filter(tx => tx.balanceChange < -dumpThreshold);
    if (recentSells.length === 0) return false;

    // Calculate sell velocity (total sold in recent period)
    const totalSold = Math.abs(recentSells.reduce((sum, tx) => sum + tx.balanceChange, 0));
    const timeSpan = (history[history.length - 1].timestamp - history[history.length - 10].timestamp) || 1;
    const sellVelocity = totalSold / (timeSpan / 1000 / 60); // SOL per minute

    // Flag if selling more than threshold per minute
    return sellVelocity > dumpThreshold;
}

// Detect MEV bot patterns
function detectMEVActivity(wallet) {
    const history = transactionHistory[wallet.address];
    if (!history || history.length < 5) return false;

    // Look for sandwich attack patterns
    const recentTxs = history.slice(-20);
    let sandwichCount = 0;
    let arbitrageCount = 0;

    for (let i = 2; i < recentTxs.length; i++) {
        const tx1 = recentTxs[i-2];
        const tx2 = recentTxs[i-1];
        const tx3 = recentTxs[i];

        // Sandwich attack: buy-low, victim tx, sell-high
        if (tx1.balanceChange > 0 && tx3.balanceChange < 0 &&
            Math.abs(tx1.balanceChange) > transactionThreshold &&
            Math.abs(tx3.balanceChange) > transactionThreshold) {
            sandwichCount++;
        }

        // Arbitrage pattern: quick buy-sell cycles
        if (tx2.balanceChange > 0 && tx3.balanceChange < 0 &&
            (tx3.timestamp - tx2.timestamp) < 30000) { // Within 30 seconds
            arbitrageCount++;
        }
    }

    // Look for high-frequency trading patterns
    const timeDeltas = [];
    for (let i = 1; i < recentTxs.length; i++) {
        timeDeltas.push(recentTxs[i].timestamp - recentTxs[i-1].timestamp);
    }
    const avgTimeDelta = timeDeltas.reduce((sum, delta) => sum + delta, 0) / timeDeltas.length;
    const highFrequency = avgTimeDelta < 60000; // Less than 1 minute between txs

    return sandwichCount >= 2 || arbitrageCount >= 3 || highFrequency;
}

// Analyze transaction for sell-off and MEV patterns
function analyzeTransactionPatterns(wallet, transaction) {
    if (!sellOffPatterns[wallet.address]) {
        sellOffPatterns[wallet.address] = { sells: [], lastAnalysis: 0 };
    }
    if (!mevPatterns[wallet.address]) {
        mevPatterns[wallet.address] = { patterns: [], lastAnalysis: 0 };
    }

    const now = Date.now();

    // Update sell-off tracking
    if (transaction.balanceChange < -dumpThreshold) {
        sellOffPatterns[wallet.address].sells.push({
            amount: Math.abs(transaction.balanceChange),
            timestamp: transaction.timestamp
        });

        // Keep only recent sells (last hour)
        sellOffPatterns[wallet.address].sells = sellOffPatterns[wallet.address].sells.filter(
            sell => now - sell.timestamp < 3600000
        );
    }

    // Update MEV pattern tracking
    mevPatterns[wallet.address].patterns.push({
        change: transaction.balanceChange,
        timestamp: transaction.timestamp
    });

    // Keep only recent patterns
    mevPatterns[wallet.address].patterns = mevPatterns[wallet.address].patterns.filter(
        pattern => now - pattern.timestamp < mevTimeWindow
    );

    sellOffPatterns[wallet.address].lastAnalysis = now;
    mevPatterns[wallet.address].lastAnalysis = now;
}

// Function to create label
function createLabel(text) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = '20px Arial';
    context.fillStyle = 'white';
    context.fillText(text, 0, 20);
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(2, 1, 1);
    return sprite;
}

// Function to add wallet bubble
function addWalletBubble(wallet) {
    const geometry = new THREE.SphereGeometry(wallet.size, 32, 32);
    const material = new THREE.MeshPhongMaterial({
        color: wallet.color,
        emissive: wallet.emissive,
        transparent: true,
        opacity: 0.8
    });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.set(wallet.x, wallet.y, wallet.z);
    sphere.userData = wallet;
    scene.add(sphere);

    // Add label
    const truncatedAddress = wallet.address.slice(0, 4) + '...' + wallet.address.slice(-4);
    const labelText = `${truncatedAddress}\n${wallet.balance.toFixed(2)} SOL`;
    const label = createLabel(labelText);
    label.position.set(wallet.x, wallet.y + wallet.size + 0.5, wallet.z);
    scene.add(label);

    return sphere;
}

// Particle system for fund flows
let particles = [];
let particleGeometry = new THREE.BufferGeometry();
let particleMaterial = new THREE.PointsMaterial({ size: 0.05, vertexColors: true });
let particleSystem = new THREE.Points(particleGeometry, particleMaterial);
scene.add(particleSystem);

// Function to create particles for a connection
function createParticlesForConnection(connection) {
    const numParticles = 10;
    const fromPos = new THREE.Vector3(connection.from.x, connection.from.y, connection.from.z);
    const toPos = new THREE.Vector3(connection.to.x, connection.to.y, connection.to.z);
    const direction = toPos.clone().sub(fromPos).normalize();

    for (let i = 0; i < numParticles; i++) {
        const particle = {
            position: fromPos.clone(),
            velocity: direction.clone().multiplyScalar(0.01),
            life: 1.0,
            color: new THREE.Color(0x00ff00) // Green for inflow
        };
        particles.push(particle);
    }
}

// Update particles
function updateParticles() {
    const positions = [];
    const colors = [];

    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        particle.position.add(particle.velocity);
        particle.life -= 0.01;

        if (particle.life <= 0) {
            particles.splice(i, 1);
        } else {
            positions.push(particle.position.x, particle.position.y, particle.position.z);
            colors.push(particle.color.r, particle.color.g, particle.color.b);
        }
    }

    particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}

// Initialize with sample wallets
async function initializeWallets() {
    const sampleAddresses = [
        '11111111111111111111111111111112', // System Program
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
        'So11111111111111111111111111111111111111112' // Wrapped SOL
    ];

    // Use Promise.all for better performance
    const walletPromises = sampleAddresses.map(async (address, i) => {
        const publicKey = new solanaWeb3.PublicKey(address);
        const balance = await getWalletBalance(publicKey);
        const size = Math.max(0.1, Math.log(balance + 1) * 0.5);
        return {
            address: address,
            balance: balance,
            size: size,
            x: (Math.random() - 0.5) * 10,
            y: (Math.random() - 0.5) * 10,
            z: (Math.random() - 0.5) * 10,
            color: 0x00ff00,
            emissive: 0x002200,
            suspicious: false
        };
    });

    wallets = await Promise.all(walletPromises);
    wallets.forEach(wallet => addWalletBubble(wallet));
}

// Performance optimization: Batch wallet updates
async function updateWalletsBatch(walletBatch) {
    const updatePromises = walletBatch.map(async (wallet) => {
        const publicKey = new solanaWeb3.PublicKey(wallet.address);
        const newBalance = await getWalletBalance(publicKey);
        return { wallet, newBalance };
    });

    const results = await Promise.all(updatePromises);
    return results;
}

// Real-time updates with rug-pull detection
function startRealTimeUpdates() {
    updateIntervalId = setInterval(async () => {
        const startTime = performance.now();
        let alerts = [];

        // Process wallets in batches for better performance
        const batchSize = 5;
        for (let i = 0; i < wallets.length; i += batchSize) {
            const batch = wallets.slice(i, i + batchSize);
            const results = await updateWalletsBatch(batch);

            results.forEach(({ wallet, newBalance }) => {
                if (newBalance !== wallet.balance) {
                    wallet.balance = newBalance;
                    wallet.size = Math.max(0.1, Math.log(newBalance + 1) * 0.5);
                    // Update sphere size
                    const sphere = scene.children.find(child => child.userData === wallet);
                    if (sphere) {
                        sphere.geometry.dispose();
                        sphere.geometry = new THREE.SphereGeometry(wallet.size, 32, 32);
                    }
                }

                // Check for various suspicious patterns
                let isSuspicious = false;
                let alertMessages = [];
    
                if (rugDetectionEnabled && checkRugPullPatterns(wallet)) {
                    isSuspicious = true;
                    alertMessages.push('rug-pull pattern');
                }
    
                if (dumpDetectionEnabled && detectLargeSellOff(wallet)) {
                    isSuspicious = true;
                    alertMessages.push('large sell-off detected');
                    wallet.dumpActivity = true;
                } else {
                    wallet.dumpActivity = false;
                }
    
                if (mevDetectionEnabled && detectMEVActivity(wallet)) {
                    isSuspicious = true;
                    alertMessages.push('MEV bot activity suspected');
                    wallet.mevActivity = true;
                } else {
                    wallet.mevActivity = false;
                }
    
                if (isSuspicious) {
                    wallet.suspicious = true;
                    if (alertsEnabled && alertMessages.length > 0) {
                        alerts.push(`🚨 ALERT: ${alertMessages.join(', ')} in wallet ${wallet.address.slice(0, 8)}...`);
                    }
                    // Color coding based on activity type
                    const sphere = scene.children.find(child => child.userData === wallet);
                    if (sphere) {
                        if (wallet.dumpActivity) {
                            sphere.material.emissive.setHex(0xff6600); // Orange for dumps
                        } else if (wallet.mevActivity) {
                            sphere.material.emissive.setHex(0x9900ff); // Purple for MEV
                        } else {
                            sphere.material.emissive.setHex(0xff0000); // Red for general suspicious
                        }
                    }
                } else {
                    wallet.suspicious = false;
                    // Reset color if not suspicious
                    const sphere = scene.children.find(child => child.userData === wallet);
                    if (sphere) {
                        sphere.material.emissive.setHex(wallet.emissive);
                    }
                }
            });
        }

        // Update connections (limit for performance)
        if (wallets.length <= 10) { // Only build connections for small datasets
            await buildConnections();

            // Clear existing particles and recreate
            particles = [];
            for (let connection of connections.slice(0, 20)) { // Limit connections
                createParticlesForConnection(connection);
            }
        }

        // Show alerts
        if (alerts.length > 0 && alertsEnabled) {
            alerts.forEach(alert => {
                addMessage('AI: ' + alert);
                console.warn(alert);
            });
        }

        // Periodic save (every 5 minutes)
        const now = Date.now();
        if (!window.lastSaveTime || now - window.lastSaveTime > 300000) {
            saveUserData();
            window.lastSaveTime = now;
        }

        // Performance logging
        const endTime = performance.now();
        console.log(`Update cycle completed in ${(endTime - startTime).toFixed(2)}ms for ${wallets.length} wallets`);
    }, updateInterval);
}

// Initialize
async function init() {
    await initializeWallets();
    await buildConnections();
    // Create particles for connections
    for (let connection of connections) {
        createParticlesForConnection(connection);
    }
    // Start real-time updates
    startRealTimeUpdates();
}

// UI elements
const authDiv = document.getElementById('auth');
const mainUiDiv = document.getElementById('main-ui');
const usernameInput = document.getElementById('username');
const loginButton = document.getElementById('login');
const guestLoginButton = document.getElementById('guestLogin');
const searchInput = document.getElementById('search');
const minBalanceInput = document.getElementById('minBalance');
const maxBalanceInput = document.getElementById('maxBalance');
const filterTypeSelect = document.getElementById('filterType');
const proxySelect = document.getElementById('proxySelect');
const saveButton = document.getElementById('save');
const exportButton = document.getElementById('export');
const shareButton = document.getElementById('share');
const shareKeyInput = document.getElementById('shareKey');
const loadSharedButton = document.getElementById('loadShared');
const logoutButton = document.getElementById('logout');
const notesButton = document.getElementById('notes');
const helpButton = document.getElementById('help');
const toggleChatButton = document.getElementById('toggleChat');
const chatDiv = document.getElementById('chat');
const chatInput = document.getElementById('chatInput');
const sendChatButton = document.getElementById('sendChat');
const chatMessages = document.getElementById('chatMessages');
const notesDialog = document.getElementById('notesDialog');
const notesText = document.getElementById('notesText');
const saveNotesButton = document.getElementById('saveNotes');
const closeNotesButton = document.getElementById('closeNotes');

// New UI elements for dynamic controls
const thresholdSlider = document.getElementById('thresholdSlider');
const thresholdValue = document.getElementById('thresholdValue');
const intervalSlider = document.getElementById('intervalSlider');
const intervalValue = document.getElementById('intervalValue');
const alertsToggle = document.getElementById('alertsToggle');
const rugDetectionToggle = document.getElementById('rugDetectionToggle');
const dumpDetectionToggle = document.getElementById('dumpDetectionToggle');
const mevDetectionToggle = document.getElementById('mevDetectionToggle');

// Authentication
let currentUser = null;

loginButton.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    console.log('Login button clicked, username:', username);
    if (username) {
        currentUser = username;
        localStorage.setItem('currentUser', username);
        authDiv.style.display = 'none';
        mainUiDiv.style.display = 'block';
        console.log('Login successful, loading user data...');
        loadUserData();
        addMessage('AI: Welcome ' + username + '! The Solana Wallet Bubble Map is now active.');
    } else {
        console.log('No username entered');
        alert('Please enter a username to login');
    }
});

guestLoginButton.addEventListener('click', () => {
    console.log('Guest login clicked');
    currentUser = 'guest';
    // Don't save guest as current user in localStorage
    authDiv.style.display = 'none';
    mainUiDiv.style.display = 'block';
    console.log('Guest access granted, loading default data...');
    loadGuestData();
    addMessage('AI: Welcome Guest! You can login anytime to save your settings and notes.');
});

// Load user data from localStorage
function loadUserData() {
    const savedWallets = localStorage.getItem(`wallets_${currentUser}`);
    const savedHistory = localStorage.getItem(`history_${currentUser}`);
    const savedSettings = localStorage.getItem(`settings_${currentUser}`);

    if (savedWallets) {
        wallets = JSON.parse(savedWallets);
        // Re-add bubbles
        wallets.forEach(wallet => addWalletBubble(wallet));
    }

    if (savedHistory) {
        transactionHistory = JSON.parse(savedHistory);
    }

    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        transactionThreshold = settings.threshold || 1.0;
        updateInterval = settings.interval || 60000;
        alertsEnabled = settings.alerts !== false;
        rugDetectionEnabled = settings.rugDetection !== false;
        dumpDetectionEnabled = settings.dumpDetection !== false;
        mevDetectionEnabled = settings.mevDetection !== false;

        // Update UI elements
        thresholdSlider.value = transactionThreshold;
        thresholdValue.textContent = transactionThreshold.toFixed(1);
        intervalSlider.value = updateInterval / 1000;
        intervalValue.textContent = updateInterval / 1000;
        alertsToggle.checked = alertsEnabled;
        rugDetectionToggle.checked = rugDetectionEnabled;
        dumpDetectionToggle.checked = dumpDetectionEnabled;
        mevDetectionToggle.checked = mevDetectionEnabled;
    }
}

// Load guest data (shared/global settings)
function loadGuestData() {
    // Load shared/global settings if available
    const globalSettings = localStorage.getItem('global_settings');
    if (globalSettings) {
        const settings = JSON.parse(globalSettings);
        transactionThreshold = settings.threshold || 1.0;
        updateInterval = settings.interval || 60000;
        alertsEnabled = settings.alerts !== false;
        rugDetectionEnabled = settings.rugDetection !== false;
        dumpDetectionEnabled = settings.dumpDetection !== false;
        mevDetectionEnabled = settings.mevDetection !== false;

        // Update UI elements
        thresholdSlider.value = transactionThreshold;
        thresholdValue.textContent = transactionThreshold.toFixed(1);
        intervalSlider.value = updateInterval / 1000;
        intervalValue.textContent = updateInterval / 1000;
        alertsToggle.checked = alertsEnabled;
        rugDetectionToggle.checked = rugDetectionEnabled;
        dumpDetectionToggle.checked = dumpDetectionEnabled;
        mevDetectionToggle.checked = mevDetectionEnabled;
    }

    // Load any shared notes
    const sharedNotes = localStorage.getItem('shared_notes');
    if (sharedNotes) {
        addMessage('AI: Shared notes available. Check localStorage for shared_notes.');
    }
}

// Save user data
function saveUserData() {
    if (currentUser === 'guest') {
        // Save global settings for guests
        localStorage.setItem('global_settings', JSON.stringify({
            threshold: transactionThreshold,
            interval: updateInterval,
            alerts: alertsEnabled,
            rugDetection: rugDetectionEnabled,
            dumpDetection: dumpDetectionEnabled,
            mevDetection: mevDetectionEnabled
        }));
        // Don't save wallets/history for guests unless they login
    } else {
        localStorage.setItem(`wallets_${currentUser}`, JSON.stringify(wallets));
        localStorage.setItem(`history_${currentUser}`, JSON.stringify(transactionHistory));
        localStorage.setItem(`settings_${currentUser}`, JSON.stringify({
            threshold: transactionThreshold,
            interval: updateInterval,
            alerts: alertsEnabled,
            rugDetection: rugDetectionEnabled,
            dumpDetection: dumpDetectionEnabled,
            mevDetection: mevDetectionEnabled
        }));
    }
}

// Check if already logged in, otherwise show login screen
const savedUser = localStorage.getItem('currentUser');
if (savedUser && savedUser !== 'guest') {
    currentUser = savedUser;
    usernameInput.value = savedUser;
    authDiv.style.display = 'none';
    mainUiDiv.style.display = 'block';
    loadUserData();
    addMessage('AI: Welcome back ' + savedUser + '!');
} else {
    // Show login screen for new users
    console.log('Showing login screen for new user');
    authDiv.style.display = 'block';
    mainUiDiv.style.display = 'none';
    // Don't auto-login as guest
}

// Filtering function
function filterWallets() {
    const searchTerm = searchInput.value.toLowerCase();
    const minBalance = parseFloat(minBalanceInput.value) || 0;
    const maxBalance = parseFloat(maxBalanceInput.value) || Infinity;
    const filterType = filterTypeSelect.value;

    scene.children.forEach(child => {
        if (child.userData && child.userData.address) {
            const wallet = child.userData;
            const matchesSearch = wallet.address.toLowerCase().includes(searchTerm);
            let matchesFilter = true;

            if (filterType === 'balance') {
                matchesFilter = wallet.balance >= minBalance && wallet.balance <= maxBalance;
            } else if (filterType === 'activity') {
                // Placeholder: filter by transaction count
                matchesFilter = true; // Implement based on transaction data
            } else if (filterType === 'connections') {
                // Placeholder: filter by number of connections
                matchesFilter = true; // Implement based on connection data
            }

            child.visible = matchesSearch && matchesFilter;
        }
    });
}

// Event listeners
searchInput.addEventListener('input', filterWallets);
minBalanceInput.addEventListener('input', filterWallets);
maxBalanceInput.addEventListener('input', filterWallets);
filterTypeSelect.addEventListener('change', filterWallets);
proxySelect.addEventListener('change', () => {
    proxyIndex = parseInt(proxySelect.value);
    console.log('Proxy switched to:', getCurrentProxy());
});

// New event listeners for dynamic controls
thresholdSlider.addEventListener('input', (e) => {
    transactionThreshold = parseFloat(e.target.value);
    thresholdValue.textContent = transactionThreshold.toFixed(1);
    saveUserData();
});

intervalSlider.addEventListener('input', (e) => {
    updateInterval = parseInt(e.target.value) * 1000; // Convert to milliseconds
    intervalValue.textContent = e.target.value;

    // Restart the update interval
    if (updateIntervalId) {
        clearInterval(updateIntervalId);
    }
    startRealTimeUpdates();
    saveUserData();
});

alertsToggle.addEventListener('change', (e) => {
    alertsEnabled = e.target.checked;
    saveUserData();
});

rugDetectionToggle.addEventListener('change', (e) => {
    rugDetectionEnabled = e.target.checked;
    saveUserData();
});

dumpDetectionToggle.addEventListener('change', (e) => {
    dumpDetectionEnabled = e.target.checked;
    saveUserData();
});

mevDetectionToggle.addEventListener('change', (e) => {
    mevDetectionEnabled = e.target.checked;
    saveUserData();
});

saveButton.addEventListener('click', () => {
    saveUserData();
    addMessage('AI: Data saved successfully!');
});

logoutButton.addEventListener('click', () => {
    localStorage.removeItem('currentUser');
    currentUser = null;
    authDiv.style.display = 'block';
    mainUiDiv.style.display = 'none';
    usernameInput.value = '';
    console.log('Logged out');
});

notesButton.addEventListener('click', () => {
    // Load existing notes
    const existingNotes = localStorage.getItem('shared_notes') || '';
    notesText.value = existingNotes;
    notesDialog.style.display = 'block';
});

saveNotesButton.addEventListener('click', () => {
    const notes = notesText.value.trim();
    if (notes) {
        const timestamp = new Date().toLocaleString();
        const author = currentUser === 'guest' ? 'Anonymous' : currentUser;
        const noteEntry = `[${timestamp}] ${author}: ${notes}`;
        localStorage.setItem('shared_notes', noteEntry);
        addMessage('AI: Notes saved and shared with other users!');
    }
    notesDialog.style.display = 'none';
});

closeNotesButton.addEventListener('click', () => {
    notesDialog.style.display = 'none';
});

exportButton.addEventListener('click', () => {
    const data = {
        wallets: wallets.map(w => ({ address: w.address, balance: w.balance })),
        history: transactionHistory,
        settings: {
            threshold: transactionThreshold,
            interval: updateInterval,
            alerts: alertsEnabled,
            rugDetection: rugDetectionEnabled,
            dumpDetection: dumpDetectionEnabled,
            mevDetection: mevDetectionEnabled
        },
        timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'solana-wallet-data.json';
    a.click();
});

shareButton.addEventListener('click', () => {
    const key = Date.now().toString();
    localStorage.setItem(`shared_${key}`, JSON.stringify(wallets));
    shareKeyInput.value = key;
    alert(`Shared with key: ${key}`);
});

loadSharedButton.addEventListener('click', () => {
    const key = shareKeyInput.value;
    const sharedData = localStorage.getItem(`shared_${key}`);
    if (sharedData) {
        wallets = JSON.parse(sharedData);
        // Clear scene and re-add
        scene.children = scene.children.filter(child => child.type === 'AmbientLight' || child.type === 'DirectionalLight' || child === particleSystem);
        wallets.forEach(wallet => addWalletBubble(wallet));
        alert('Shared view loaded');
    } else {
        alert('Invalid share key');
    }
});

helpButton.addEventListener('click', () => {
    alert(`Tutorial:
1. App starts in guest mode - login optional for saving data.
2. Move mouse to rotate the view.
3. Click on bubbles to view transactions on Solscan.
4. Use search and filters (Balance, Activity, Connections).
5. Adjust transaction threshold and update interval with sliders.
6. Toggle AI alerts, rug-pull, dump, and MEV detection.
7. Select proxy for API requests.
8. Export data as JSON.
9. Share your view with others using a share key.
10. Use Notes to leave messages for other users.
11. Use AI Chat: ask about "suspicious", "dump", "mev", "predict", "alerts".
12. Color coding: Red=Suspicious, Orange=Dumps, Purple=MEV bots.
13. Particles show fund flows between wallets.
14. Login to save your personal settings and wallet data.`);
});

toggleChatButton.addEventListener('click', () => {
    chatDiv.style.display = chatDiv.style.display === 'none' ? 'block' : 'none';
});

sendChatButton.addEventListener('click', () => {
    const message = chatInput.value;
    if (message) {
        addMessage('You: ' + message);
        processAI(message);
        chatInput.value = '';
    }
});

function addMessage(text) {
    const p = document.createElement('p');
    p.textContent = text;
    chatMessages.appendChild(p);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function processAI(message) {
    const lower = message.toLowerCase();
    if (lower.includes('balance')) {
        const total = wallets.reduce((sum, w) => sum + w.balance, 0);
        addMessage('AI: Total balance across wallets: ' + total.toFixed(2) + ' SOL');
    } else if (lower.includes('highest')) {
        const highest = wallets.reduce((max, w) => w.balance > max.balance ? w : max);
        addMessage('AI: Highest balance wallet: ' + highest.address + ' with ' + highest.balance.toFixed(2) + ' SOL');
        highlightWallet(highest.address);
    } else if (lower.includes('suspicious') || lower.includes('rug')) {
        const suspiciousWallets = wallets.filter(w => w.suspicious);
        if (suspiciousWallets.length > 0) {
            addMessage('AI: Found ' + suspiciousWallets.length + ' suspicious wallets. Check the highlighted bubbles.');
            suspiciousWallets.forEach(wallet => highlightWallet(wallet.address));
        } else {
            addMessage('AI: No suspicious activity detected currently.');
        }
    } else if (lower.includes('dump') || lower.includes('sell')) {
        const dumpWallets = wallets.filter(w => w.dumpActivity);
        if (dumpWallets.length > 0) {
            addMessage('AI: Found ' + dumpWallets.length + ' wallets with large sell-off activity (orange bubbles).');
            dumpWallets.forEach(wallet => highlightWallet(wallet.address));
        } else {
            addMessage('AI: No large sell-off activity detected.');
        }
    } else if (lower.includes('mev') || lower.includes('bot')) {
        const mevWallets = wallets.filter(w => w.mevActivity);
        if (mevWallets.length > 0) {
            addMessage('AI: Found ' + mevWallets.length + ' wallets with suspected MEV bot activity (purple bubbles).');
            mevWallets.forEach(wallet => highlightWallet(wallet.address));
        } else {
            addMessage('AI: No MEV bot activity detected.');
        }
    } else if (lower.includes('predict') || lower.includes('forecast')) {
        const predictions = predictWalletBehavior();
        addMessage('AI: ' + predictions);
    } else if (lower.includes('alerts')) {
        addMessage('AI: Alerts are ' + (alertsEnabled ? 'enabled' : 'disabled') + '. Rug detection is ' + (rugDetectionEnabled ? 'active' : 'inactive') + '.');
    } else if (lower.includes('threshold')) {
        addMessage('AI: Current transaction threshold is ' + transactionThreshold + ' SOL. Large transactions above this will trigger alerts.');
    } else if (lower.includes('suggest')) {
        addMessage('AI: I suggest monitoring wallets with recent large transactions and enabling rug-pull detection.');
    } else {
        addMessage('AI: I can help with balances, suspicious activity detection, predictions, and wallet analysis. Try asking about "suspicious", "predict", or "alerts".');
    }
}

// Predictive analysis function
function predictWalletBehavior() {
    let predictions = [];
    wallets.forEach(wallet => {
        const history = transactionHistory[wallet.address];
        if (history && history.length >= 3) {
            const recent = history.slice(-3);
            const avgChange = recent.reduce((sum, tx) => sum + tx.balanceChange, 0) / recent.length;

            if (avgChange > transactionThreshold * 0.5) {
                predictions.push(`${wallet.address.slice(0, 8)}... shows increasing activity`);
            } else if (avgChange < -transactionThreshold * 0.5) {
                predictions.push(`${wallet.address.slice(0, 8)}... shows decreasing activity`);
            }
        }
    });

    if (predictions.length > 0) {
        return 'Predictions: ' + predictions.join(', ');
    } else {
        return 'No significant patterns detected for predictions.';
    }
}

function highlightWallet(address) {
    scene.children.forEach(child => {
        if (child.userData && child.userData.address === address) {
            child.material.emissive.setHex(0xff0000); // Red highlight
        } else if (child.userData) {
            child.material.emissive.setHex(child.userData.emissive);
        }
    });
}

init();
console.log('Solana Wallet Bubble Map initialized');