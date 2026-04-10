// Snake Survival - Cyber Edition
// Complete game logic with Yandex Games SDK integration

// Game Constants
const TILE_SIZE = 25;
const GRID_WIDTH = 32;
const GRID_HEIGHT = 24;
const INITIAL_SPEED = 150;
const MIN_SPEED = 60;

// Game State
let canvas, ctx;
let gameState = 'menu'; // menu, playing, paused, upgrade, gameover
let lastTime = 0;
let gameTime = 0;
let gameSpeed = INITIAL_SPEED;

// Player (Snake)
let snake = [];
let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let snakeColor = '#00ffff';
let snakeGlow = '#0088ff';

// Game Objects
let foods = [];
let enemies = [];
let particles = [];
let powerups = [];
let damageNumbers = [];

// Stats
let score = 0;
let bestScore = 0;
let level = 1;
let xp = 0;
let xpToNextLevel = 100;
let health = 100;
let maxHealth = 100;
let combo = 1;
let comboTimer = 0;
let kills = 0;
let totalKills = 0;

// Permanent Upgrades
let permanentUpgrades = {
    damage: 1,
    speed: 1,
    health: 1,
    magnetRange: 1,
    luck: 1
};

// Temporary Upgrades (current run)
let currentUpgrades = [];

// Upgrade Pool
const upgradePool = [
    {
        id: 'speed_boost',
        name: 'Ускорение',
        description: '+15% к скорости движения',
        icon: '⚡',
        rarity: 'common',
        apply: () => {
            gameSpeed = Math.max(MIN_SPEED, gameSpeed * 0.85);
        }
    },
    {
        id: 'damage_up',
        name: 'Сила удара',
        description: '+25% к урону врагам',
        icon: '💥',
        rarity: 'common',
        apply: () => {
            permanentUpgrades.damage *= 1.25;
        }
    },
    {
        id: 'health_max',
        name: 'Макс. здоровье',
        description: '+30 к максимальному здоровью',
        icon: '❤️',
        rarity: 'common',
        apply: () => {
            maxHealth += 30;
            health = Math.min(health + 30, maxHealth);
        }
    },
    {
        id: 'heal',
        name: 'Лечение',
        description: 'Восстанавливает 50 здоровья',
        icon: '💚',
        rarity: 'common',
        apply: () => {
            health = Math.min(health + 50, maxHealth);
        }
    },
    {
        id: 'magnet',
        name: 'Магнит',
        description: '+40% радиус притяжения еды',
        icon: '🧲',
        rarity: 'rare',
        apply: () => {
            permanentUpgrades.magnetRange *= 1.4;
        }
    },
    {
        id: 'luck',
        name: 'Удача',
        description: '+30% шанс редких улучшений',
        icon: '🍀',
        rarity: 'rare',
        apply: () => {
            permanentUpgrades.luck *= 1.3;
        }
    },
    {
        id: 'shield',
        name: 'Щит',
        description: 'Поглощает 1 удар врага',
        icon: '🛡️',
        rarity: 'rare',
        apply: () => {
            currentUpgrades.push('shield');
        }
    },
    {
        id: 'double_xp',
        name: 'Двойной XP',
        description: '2x опыт до конца игры',
        icon: '✨',
        rarity: 'rare',
        apply: () => {
            currentUpgrades.push('double_xp');
        }
    },
    {
        id: 'ghost',
        name: 'Призрак',
        description: 'Проход сквозь стены (30 сек)',
        icon: '👻',
        rarity: 'legendary',
        apply: () => {
            currentUpgrades.push('ghost');
            setTimeout(() => {
                const idx = currentUpgrades.indexOf('ghost');
                if (idx > -1) currentUpgrades.splice(idx, 1);
            }, 30000);
        }
    },
    {
        id: 'invincibility',
        name: 'Неуязвимость',
        description: 'Бессмертие на 15 секунд',
        icon: '⭐',
        rarity: 'legendary',
        apply: () => {
            currentUpgrades.push('invincibility');
            setTimeout(() => {
                const idx = currentUpgrades.indexOf('invincibility');
                if (idx > -1) currentUpgrades.splice(idx, 1);
            }, 15000);
        }
    },
    {
        id: 'growth_boost',
        name: 'Рост силы',
        description: '+50% к длине змейки',
        icon: '📈',
        rarity: 'rare',
        apply: () => {
            const growCount = Math.floor(snake.length * 0.5);
            for (let i = 0; i < growCount; i++) {
                const tail = snake[snake.length - 1];
                snake.push({ x: tail.x, y: tail.y });
            }
        }
    },
    {
        id: 'score_boost',
        name: 'Очковый буст',
        description: '+500 очков мгновенно',
        icon: '🎯',
        rarity: 'common',
        apply: () => {
            addScore(500);
        }
    },
    {
        id: 'regen',
        name: 'Регенерация',
        description: '+2 здоровья каждую секунду',
        icon: '💧',
        rarity: 'rare',
        apply: () => {
            currentUpgrades.push('regen');
        }
    },
    {
        id: 'critical',
        name: 'Критический удар',
        description: '10% шанс критического урона (3x)',
        icon: '🔥',
        rarity: 'legendary',
        apply: () => {
            currentUpgrades.push('critical');
        }
    },
    {
        id: 'vampire',
        name: 'Вампиризм',
        description: '+5 здоровья за убийство врага',
        icon: '🩸',
        rarity: 'legendary',
        apply: () => {
            currentUpgrades.push('vampire');
        }
    }
];

// Yandex SDK
let ysdk = null;
let player = null;

// Initialize Yandex SDK
function initYandexSDK() {
    return new Promise((resolve) => {
        if (window.YaGames) {
            YaGames.init().then(sdk => {
                ysdk = sdk;
                console.log('Yandex SDK initialized');
                
                // Show loading progress
                const loaderBar = document.getElementById('loaderBar');
                if (loaderBar) {
                    loaderBar.style.width = '50%';
                }
                
                // Try to get player
                ysdk.getPlayer().then(_player => {
                    player = _player;
                    loadData();
                    if (loaderBar) loaderBar.style.width = '100%';
                    resolve(true);
                }).catch(err => {
                    console.log('Player not available:', err);
                    loadLocalData();
                    if (loaderBar) loaderBar.style.width = '100%';
                    resolve(false);
                });
            }).catch(err => {
                console.log('Yandex SDK init error:', err);
                loadLocalData();
                const loaderBar = document.getElementById('loaderBar');
                if (loaderBar) loaderBar.style.width = '100%';
                resolve(false);
            });
        } else {
            console.log('Yandex SDK not available');
            loadLocalData();
            const loaderBar = document.getElementById('loaderBar');
            if (loaderBar) loaderBar.style.width = '100%';
            resolve(false);
        }
    });
}

// Save data to Yandex Cloud
function saveData() {
    if (player) {
        player.setData({
            bestScore: bestScore,
            totalGames: window.totalGames || 0,
            totalScore: window.totalScore || 0,
            maxLevel: window.maxLevel || 1,
            totalKills: totalKills,
            permanentUpgrades: permanentUpgrades
        }).then(() => {
            console.log('Data saved to cloud');
        }).catch(err => {
            console.error('Save error:', err);
            saveLocalData();
        });
    } else {
        saveLocalData();
    }
}

// Load data from Yandex Cloud
function loadData() {
    if (player) {
        player.getData().then(data => {
            if (data.bestScore !== undefined) bestScore = data.bestScore;
            if (data.totalGames !== undefined) window.totalGames = data.totalGames;
            if (data.totalScore !== undefined) window.totalScore = data.totalScore;
            if (data.maxLevel !== undefined) window.maxLevel = data.maxLevel;
            if (data.totalKills !== undefined) totalKills = data.totalKills;
            if (data.permanentUpgrades !== undefined) {
                Object.assign(permanentUpgrades, data.permanentUpgrades);
            }
            updateUI();
            console.log('Data loaded from cloud');
        }).catch(err => {
            console.error('Load error:', err);
        });
    }
}

// Local Storage fallback
function saveLocalData() {
    const data = {
        bestScore: bestScore,
        totalGames: window.totalGames || 0,
        totalScore: window.totalScore || 0,
        maxLevel: window.maxLevel || 1,
        totalKills: totalKills,
        permanentUpgrades: permanentUpgrades
    };
    localStorage.setItem('snakeSurvivalSave', JSON.stringify(data));
}

function loadLocalData() {
    const data = localStorage.getItem('snakeSurvivalSave');
    if (data) {
        const parsed = JSON.parse(data);
        if (parsed.bestScore !== undefined) bestScore = parsed.bestScore;
        if (parsed.totalGames !== undefined) window.totalGames = parsed.totalGames;
        if (parsed.totalScore !== undefined) window.totalScore = parsed.totalScore;
        if (parsed.maxLevel !== undefined) window.maxLevel = parsed.maxLevel;
        if (parsed.totalKills !== undefined) totalKills = parsed.totalKills;
        if (parsed.permanentUpgrades !== undefined) {
            Object.assign(permanentUpgrades, parsed.permanentUpgrades);
        }
        updateUI();
    }
}

// Show Ad
function showAd(callback) {
    if (ysdk) {
        ysdk.adv.showFullscreenAdv({
            callbacks: {
                onClose: function(wasShown) {
                    if (callback) callback();
                },
                onError: function(error) {
                    console.log('Ad error:', error);
                    if (callback) callback();
                }
            }
        });
    } else {
        if (callback) callback();
    }
}

// Canvas Setup
function setupCanvas() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // Calculate canvas size based on grid
    const maxWidth = Math.min(window.innerWidth - 40, GRID_WIDTH * TILE_SIZE);
    const maxHeight = Math.min(window.innerHeight - 150, GRID_HEIGHT * TILE_SIZE);
    
    const scale = Math.min(maxWidth / (GRID_WIDTH * TILE_SIZE), maxHeight / (GRID_HEIGHT * TILE_SIZE));
    
    canvas.width = GRID_WIDTH * TILE_SIZE * scale;
    canvas.height = GRID_HEIGHT * TILE_SIZE * scale;
    
    ctx.scale(scale, scale);
    
    // Handle resize
    window.addEventListener('resize', () => {
        const newMaxWidth = Math.min(window.innerWidth - 40, GRID_WIDTH * TILE_SIZE);
        const newMaxHeight = Math.min(window.innerHeight - 150, GRID_HEIGHT * TILE_SIZE);
        const newScale = Math.min(newMaxWidth / (GRID_WIDTH * TILE_SIZE), newMaxHeight / (GRID_HEIGHT * TILE_SIZE));
        
        canvas.width = GRID_WIDTH * TILE_SIZE * newScale;
        canvas.height = GRID_HEIGHT * TILE_SIZE * newScale;
        
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(newScale, newScale);
    });
}

// Initialize Game
function initGame() {
    snake = [
        { x: Math.floor(GRID_WIDTH / 2), y: Math.floor(GRID_HEIGHT / 2) },
        { x: Math.floor(GRID_WIDTH / 2) - 1, y: Math.floor(GRID_HEIGHT / 2) },
        { x: Math.floor(GRID_WIDTH / 2) - 2, y: Math.floor(GRID_HEIGHT / 2) }
    ];
    
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    gameSpeed = INITIAL_SPEED / (permanentUpgrades.speed || 1);
    
    foods = [];
    enemies = [];
    particles = [];
    powerups = [];
    damageNumbers = [];
    currentUpgrades = [];
    
    score = 0;
    level = 1;
    xp = 0;
    xpToNextLevel = 100;
    maxHealth = 100 * (permanentUpgrades.health || 1);
    health = maxHealth;
    combo = 1;
    comboTimer = 0;
    kills = 0;
    
    // Spawn initial food
    for (let i = 0; i < 5; i++) {
        spawnFood();
    }
    
    updateUI();
}

// Spawn Food
function spawnFood() {
    let validPosition = false;
    let x, y;
    
    while (!validPosition) {
        x = Math.floor(Math.random() * GRID_WIDTH);
        y = Math.floor(Math.random() * GRID_HEIGHT);
        
        validPosition = true;
        
        // Check collision with snake
        for (const segment of snake) {
            if (segment.x === x && segment.y === y) {
                validPosition = false;
                break;
            }
        }
        
        // Check collision with other food
        for (const food of foods) {
            if (food.x === x && food.y === y) {
                validPosition = false;
                break;
            }
        }
    }
    
    const types = ['normal', 'normal', 'normal', 'xp', 'powerup'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    let color;
    let value;
    
    switch(type) {
        case 'xp':
            color = '#ba55d3';
            value = 25;
            break;
        case 'powerup':
            color = '#ffd700';
            value = 50;
            break;
        default:
            color = '#00ff88';
            value = 10;
    }
    
    foods.push({
        x, y,
        color,
        value,
        type,
        pulse: Math.random() * Math.PI * 2
    });
}

// Spawn Enemy
function spawnEnemy() {
    const side = Math.floor(Math.random() * 4);
    let x, y, vx, vy;
    
    switch(side) {
        case 0: // Top
            x = Math.floor(Math.random() * GRID_WIDTH);
            y = 0;
            vx = (Math.random() - 0.5) * 2;
            vy = Math.random() * 2 + 1;
            break;
        case 1: // Right
            x = GRID_WIDTH - 1;
            y = Math.floor(Math.random() * GRID_HEIGHT);
            vx = -(Math.random() * 2 + 1);
            vy = (Math.random() - 0.5) * 2;
            break;
        case 2: // Bottom
            x = Math.floor(Math.random() * GRID_WIDTH);
            y = GRID_HEIGHT - 1;
            vx = (Math.random() - 0.5) * 2;
            vy = -(Math.random() * 2 + 1);
            break;
        case 3: // Left
            x = 0;
            y = Math.floor(Math.random() * GRID_HEIGHT);
            vx = Math.random() * 2 + 1;
            vy = (Math.random() - 0.5) * 2;
            break;
    }
    
    const enemyTypes = [
        { color: '#ff4444', speed: 1, damage: 10, size: 1 },
        { color: '#ff8800', speed: 1.5, damage: 15, size: 0.8 },
        { color: '#ff00ff', speed: 2, damage: 20, size: 0.6 }
    ];
    
    const difficulty = Math.min(level / 5, 2);
    const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
    
    enemies.push({
        x, y,
        vx: vx * type.speed * (1 + difficulty * 0.2),
        vy: vy * type.speed * (1 + difficulty * 0.2),
        color: type.color,
        damage: type.damage * (1 + difficulty),
        size: type.size,
        health: 30 * (1 + difficulty)
    });
}

// Create Particle
function createParticle(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
        const speed = Math.random() * 3 + 2;
        particles.push({
            x: x * TILE_SIZE + TILE_SIZE / 2,
            y: y * TILE_SIZE + TILE_SIZE / 2,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            decay: Math.random() * 0.03 + 0.02,
            color,
            size: Math.random() * 4 + 2
        });
    }
}

// Add Damage Number
function addDamageNumber(x, y, damage, isCritical = false) {
    damageNumbers.push({
        x: x * TILE_SIZE,
        y: y * TILE_SIZE,
        damage: damage,
        life: 1,
        isCritical
    });
}

// Add Score
function addScore(points) {
    const finalPoints = Math.floor(points * combo);
    score += finalPoints;
    
    if (finalPoints >= 50) {
        showCombo();
    }
    
    updateUI();
}

// Show Combo
function showCombo() {
    const comboDisplay = document.getElementById('comboDisplay');
    comboDisplay.textContent = `x${combo} COMBO!`;
    comboDisplay.classList.remove('active');
    void comboDisplay.offsetWidth; // Trigger reflow
    comboDisplay.classList.add('active');
}

// Gain XP
function gainXP(amount) {
    if (currentUpgrades.includes('double_xp')) {
        amount *= 2;
    }
    
    xp += amount;
    
    while (xp >= xpToNextLevel) {
        xp -= xpToNextLevel;
        levelUp();
    }
    
    updateUI();
}

// Level Up
function levelUp() {
    level++;
    xpToNextLevel = Math.floor(xpToNextLevel * 1.3);
    
    // Heal on level up
    health = Math.min(health + 20, maxHealth);
    
    // Show upgrade selection
    showUpgradeScreen();
}

// Get Random Upgrades
function getRandomUpgrades(count = 3) {
    const available = [...upgradePool];
    const selected = [];
    
    for (let i = 0; i < count && available.length > 0; i++) {
        // Weight by rarity
        const weights = available.map(u => {
            switch(u.rarity) {
                case 'legendary': return 0.1 * permanentUpgrades.luck;
                case 'rare': return 0.3 * permanentUpgrades.luck;
                default: return 0.6;
            }
        });
        
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let random = Math.random() * totalWeight;
        
        let selectedIndex = 0;
        for (let j = 0; j < weights.length; j++) {
            random -= weights[j];
            if (random <= 0) {
                selectedIndex = j;
                break;
            }
        }
        
        selected.push(available[selectedIndex]);
        available.splice(selectedIndex, 1);
    }
    
    return selected;
}

// Update UI
function updateUI() {
    document.getElementById('scoreValue').textContent = score;
    document.getElementById('bestValue').textContent = bestScore;
    document.getElementById('levelValue').textContent = level;
    document.getElementById('healthFill').style.width = `${(health / maxHealth) * 100}%`;
    document.getElementById('xpFill').style.width = `${(xp / xpToNextLevel) * 100}%`;
}

// Game Loop
let lastUpdate = 0;
function gameLoop(timestamp) {
    if (gameState !== 'playing') {
        requestAnimationFrame(gameLoop);
        return;
    }
    
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    gameTime += deltaTime;
    
    // Update snake position at fixed intervals
    if (timestamp - lastUpdate > gameSpeed) {
        updateSnake();
        lastUpdate = timestamp;
    }
    
    updateEnemies(deltaTime);
    updateParticles(deltaTime);
    updateDamageNumbers(deltaTime);
    updatePowerups(deltaTime);
    checkCollisions();
    render();
    
    requestAnimationFrame(gameLoop);
}

// Update Snake
function updateSnake() {
    direction = { ...nextDirection };
    
    const head = {
        x: snake[0].x + direction.x,
        y: snake[0].y + direction.y
    };
    
    // Wall collision
    if (head.x < 0 || head.x >= GRID_WIDTH || head.y < 0 || head.y >= GRID_HEIGHT) {
        if (currentUpgrades.includes('ghost')) {
            // Wrap around
            if (head.x < 0) head.x = GRID_WIDTH - 1;
            if (head.x >= GRID_WIDTH) head.x = 0;
            if (head.y < 0) head.y = GRID_HEIGHT - 1;
            if (head.y >= GRID_HEIGHT) head.y = 0;
        } else {
            takeDamage(20);
            // Bounce back
            direction = { x: -direction.x, y: -direction.y };
            nextDirection = { ...direction };
            head.x = snake[0].x + direction.x;
            head.y = snake[0].y + direction.y;
        }
    }
    
    // Self collision
    for (let i = 0; i < snake.length - 1; i++) {
        if (snake[i].x === head.x && snake[i].y === head.y) {
            takeDamage(15);
            direction = { x: -direction.x, y: -direction.y };
            nextDirection = { ...direction };
            head.x = snake[0].x + direction.x;
            head.y = snake[0].y + direction.y;
            break;
        }
    }
    
    snake.unshift(head);
    
    // Check food collision
    let ate = false;
    const magnetRange = 3 * (permanentUpgrades.magnetRange || 1);
    
    for (let i = foods.length - 1; i >= 0; i--) {
        const food = foods[i];
        const dist = Math.sqrt(Math.pow(head.x - food.x, 2) + Math.pow(head.y - food.y, 2));
        
        // Magnet effect
        if (dist < magnetRange && dist > 1) {
            food.x += (head.x - food.x) * 0.1;
            food.y += (head.y - food.y) * 0.1;
        }
        
        if (head.x === Math.round(food.x) && head.y === Math.round(food.y)) {
            ate = true;
            addScore(food.value);
            gainXP(food.value);
            createParticle(food.x, food.y, food.color);
            foods.splice(i, 1);
            spawnFood();
            
            // Chance to spawn powerup
            if (Math.random() < 0.1) {
                spawnPowerup();
            }
        }
    }
    
    if (!ate) {
        snake.pop();
    }
    
    // Regeneration
    if (currentUpgrades.includes('regen')) {
        health = Math.min(health + 0.1, maxHealth);
        updateUI();
    }
}

// Update Enemies
function updateEnemies(deltaTime) {
    // Spawn enemies based on level
    const maxEnemies = 3 + Math.floor(level * 0.5);
    if (enemies.length < maxEnemies && Math.random() < 0.02) {
        spawnEnemy();
    }
    
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        
        // Move towards snake head
        const head = snake[0];
        const dx = head.x - enemy.x;
        const dy = head.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 0) {
            enemy.vx += (dx / dist) * 0.05;
            enemy.vy += (dy / dist) * 0.05;
            
            // Limit speed
            const speed = Math.sqrt(enemy.vx * enemy.vx + enemy.vy * enemy.vy);
            if (speed > 3) {
                enemy.vx = (enemy.vx / speed) * 3;
                enemy.vy = (enemy.vy / speed) * 3;
            }
        }
        
        enemy.x += enemy.vx * (deltaTime / 16);
        enemy.y += enemy.vy * (deltaTime / 16);
        
        // Remove if too far
        if (enemy.x < -5 || enemy.x > GRID_WIDTH + 5 || enemy.y < -5 || enemy.y > GRID_HEIGHT + 5) {
            enemies.splice(i, 1);
        }
    }
}

// Update Particles
function updateParticles(deltaTime) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        p.vy += 0.1; // Gravity
        
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

// Update Damage Numbers
function updateDamageNumbers(deltaTime) {
    for (let i = damageNumbers.length - 1; i >= 0; i--) {
        const dn = damageNumbers[i];
        dn.y -= 2 * (deltaTime / 16);
        dn.life -= 0.02;
        
        if (dn.life <= 0) {
            damageNumbers.splice(i, 1);
        }
    }
}

// Update Powerups
function updatePowerups(deltaTime) {
    for (let i = powerups.length - 1; i >= 0; i--) {
        const p = powerups[i];
        p.life -= deltaTime / 1000;
        
        if (p.life <= 0) {
            powerups.splice(i, 1);
        }
    }
}

// Spawn Powerup
function spawnPowerup() {
    let validPosition = false;
    let x, y;
    
    while (!validPosition) {
        x = Math.floor(Math.random() * GRID_WIDTH);
        y = Math.floor(Math.random() * GRID_HEIGHT);
        validPosition = true;
        
        for (const segment of snake) {
            if (segment.x === x && segment.y === y) {
                validPosition = false;
                break;
            }
        }
    }
    
    const types = [
        { color: '#00ffff', effect: 'speed', duration: 5000 },
        { color: '#ff00ff', effect: 'damage', duration: 5000 },
        { color: '#ffff00', effect: 'invincible', duration: 3000 }
    ];
    
    const type = types[Math.floor(Math.random() * types.length)];
    
    powerups.push({
        x, y,
        ...type,
        life: 10
    });
}

// Check Collisions
function checkCollisions() {
    const head = snake[0];
    
    // Enemy collision
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        const dist = Math.sqrt(Math.pow(head.x - enemy.x, 2) + Math.pow(head.y - enemy.y, 2));
        
        if (dist < 1) {
            // Deal damage to enemy
            let damage = 25 * permanentUpgrades.damage;
            let isCritical = false;
            
            if (currentUpgrades.includes('critical') && Math.random() < 0.1) {
                damage *= 3;
                isCritical = true;
            }
            
            enemy.health -= damage;
            addDamageNumber(enemy.x, enemy.y, Math.floor(damage), isCritical);
            createParticle(enemy.x, enemy.y, enemy.color, 5);
            
            if (enemy.health <= 0) {
                // Enemy killed
                createParticle(enemy.x, enemy.y, enemy.color, 15);
                addScore(100);
                gainXP(20);
                kills++;
                totalKills++;
                
                if (currentUpgrades.includes('vampire')) {
                    health = Math.min(health + 5, maxHealth);
                    updateUI();
                }
                
                enemies.splice(i, 1);
            } else {
                // Take damage from enemy
                if (!currentUpgrades.includes('invincibility')) {
                    if (currentUpgrades.includes('shield')) {
                        const idx = currentUpgrades.indexOf('shield');
                        if (idx > -1) currentUpgrades.splice(idx, 1);
                        createParticle(head.x, head.y, '#00ffff', 20);
                    } else {
                        takeDamage(enemy.damage);
                    }
                }
            }
        }
    }
    
    // Powerup collision
    for (let i = powerups.length - 1; i >= 0; i--) {
        const p = powerups[i];
        const dist = Math.sqrt(Math.pow(head.x - p.x, 2) + Math.pow(head.y - p.y, 2));
        
        if (dist < 1) {
            // Apply powerup effect
            switch(p.effect) {
                case 'speed':
                    const oldSpeed = gameSpeed;
                    gameSpeed *= 0.7;
                    setTimeout(() => { gameSpeed = oldSpeed; }, p.duration);
                    break;
                case 'damage':
                    const oldDamage = permanentUpgrades.damage;
                    permanentUpgrades.damage *= 2;
                    setTimeout(() => { permanentUpgrades.damage = oldDamage; }, p.duration);
                    break;
                case 'invincible':
                    currentUpgrades.push('invincibility');
                    setTimeout(() => {
                        const idx = currentUpgrades.indexOf('invincibility');
                        if (idx > -1) currentUpgrades.splice(idx, 1);
                    }, p.duration);
                    break;
            }
            
            createParticle(p.x, p.y, p.color, 20);
            powerups.splice(i, 1);
        }
    }
}

// Take Damage
function takeDamage(amount) {
    if (currentUpgrades.includes('invincibility')) return;
    
    health -= amount;
    updateUI();
    
    // Screen shake effect
    canvas.style.transform = `translate(${Math.random() * 10 - 5}px, ${Math.random() * 10 - 5}px)`;
    setTimeout(() => {
        canvas.style.transform = 'none';
    }, 100);
    
    if (health <= 0) {
        gameOver();
    }
}

// Render
function render() {
    // Clear canvas
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, GRID_WIDTH * TILE_SIZE, GRID_HEIGHT * TILE_SIZE);
    
    // Draw grid
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= GRID_WIDTH; x++) {
        ctx.beginPath();
        ctx.moveTo(x * TILE_SIZE, 0);
        ctx.lineTo(x * TILE_SIZE, GRID_HEIGHT * TILE_SIZE);
        ctx.stroke();
    }
    for (let y = 0; y <= GRID_HEIGHT; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * TILE_SIZE);
        ctx.lineTo(GRID_WIDTH * TILE_SIZE, y * TILE_SIZE);
        ctx.stroke();
    }
    
    // Draw food
    for (const food of foods) {
        food.pulse += 0.1;
        const pulseSize = Math.sin(food.pulse) * 2;
        
        ctx.shadowBlur = 15;
        ctx.shadowColor = food.color;
        ctx.fillStyle = food.color;
        
        ctx.beginPath();
        ctx.arc(
            food.x * TILE_SIZE + TILE_SIZE / 2,
            food.y * TILE_SIZE + TILE_SIZE / 2,
            TILE_SIZE / 2 - 4 + pulseSize,
            0, Math.PI * 2
        );
        ctx.fill();
        
        ctx.shadowBlur = 0;
    }
    
    // Draw powerups
    for (const p of powerups) {
        const pulse = Math.sin(gameTime / 200) * 3;
        
        ctx.shadowBlur = 20;
        ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        
        ctx.beginPath();
        ctx.moveTo(p.x * TILE_SIZE + TILE_SIZE / 2, p.y * TILE_SIZE - 10 + pulse);
        ctx.lineTo(p.x * TILE_SIZE + TILE_SIZE - 5, p.y * TILE_SIZE + TILE_SIZE / 2);
        ctx.lineTo(p.x * TILE_SIZE + TILE_SIZE / 2, p.y * TILE_SIZE + TILE_SIZE + 5 + pulse);
        ctx.lineTo(p.x * TILE_SIZE + 5, p.y * TILE_SIZE + TILE_SIZE / 2);
        ctx.closePath();
        ctx.fill();
        
        ctx.shadowBlur = 0;
    }
    
    // Draw snake
    for (let i = snake.length - 1; i >= 0; i--) {
        const segment = snake[i];
        const isHead = i === 0;
        
        const gradient = ctx.createRadialGradient(
            segment.x * TILE_SIZE + TILE_SIZE / 2,
            segment.y * TILE_SIZE + TILE_SIZE / 2,
            0,
            segment.x * TILE_SIZE + TILE_SIZE / 2,
            segment.y * TILE_SIZE + TILE_SIZE / 2,
            TILE_SIZE / 2
        );
        
        if (isHead) {
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(0.5, snakeColor);
            gradient.addColorStop(1, snakeGlow);
            
            ctx.shadowBlur = 25;
            ctx.shadowColor = snakeGlow;
        } else {
            const alpha = 1 - (i / snake.length) * 0.5;
            gradient.addColorStop(0, snakeColor);
            gradient.addColorStop(1, snakeGlow);
            
            ctx.globalAlpha = alpha;
            ctx.shadowBlur = 15;
            ctx.shadowColor = snakeGlow;
        }
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(
            segment.x * TILE_SIZE + 2,
            segment.y * TILE_SIZE + 2,
            TILE_SIZE - 4,
            TILE_SIZE - 4,
            isHead ? 8 : 5
        );
        ctx.fill();
        
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        
        // Draw eyes on head
        if (isHead) {
            ctx.fillStyle = '#ffffff';
            const eyeOffset = 6;
            const eyeSize = 4;
            
            let eye1X, eye1Y, eye2X, eye2Y;
            
            if (direction.x === 1) {
                eye1X = segment.x * TILE_SIZE + TILE_SIZE - 8;
                eye1Y = segment.y * TILE_SIZE + 7;
                eye2X = segment.x * TILE_SIZE + TILE_SIZE - 8;
                eye2Y = segment.y * TILE_SIZE + TILE_SIZE - 11;
            } else if (direction.x === -1) {
                eye1X = segment.x * TILE_SIZE + 8;
                eye1Y = segment.y * TILE_SIZE + 7;
                eye2X = segment.x * TILE_SIZE + 8;
                eye2Y = segment.y * TILE_SIZE + TILE_SIZE - 11;
            } else if (direction.y === -1) {
                eye1X = segment.x * TILE_SIZE + 7;
                eye1Y = segment.y * TILE_SIZE + 8;
                eye2X = segment.x * TILE_SIZE + TILE_SIZE - 11;
                eye2Y = segment.y * TILE_SIZE + 8;
            } else {
                eye1X = segment.x * TILE_SIZE + 7;
                eye1Y = segment.y * TILE_SIZE + TILE_SIZE - 8;
                eye2X = segment.x * TILE_SIZE + TILE_SIZE - 11;
                eye2Y = segment.y * TILE_SIZE + TILE_SIZE - 8;
            }
            
            ctx.beginPath();
            ctx.arc(eye1X, eye1Y, eyeSize, 0, Math.PI * 2);
            ctx.arc(eye2X, eye2Y, eyeSize, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Draw enemies
    for (const enemy of enemies) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = enemy.color;
        ctx.fillStyle = enemy.color;
        
        const size = TILE_SIZE * enemy.size;
        ctx.beginPath();
        ctx.arc(
            enemy.x * TILE_SIZE + TILE_SIZE / 2,
            enemy.y * TILE_SIZE + TILE_SIZE / 2,
            size / 2,
            0, Math.PI * 2
        );
        ctx.fill();
        
        ctx.shadowBlur = 0;
    }
    
    // Draw particles
    for (const p of particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
    
    // Draw damage numbers
    for (const dn of damageNumbers) {
        ctx.globalAlpha = dn.life;
        ctx.fillStyle = dn.isCritical ? '#ffd700' : '#ffffff';
        ctx.font = dn.isCritical ? 'bold 20px Orbitron' : '16px Rajdhani';
        ctx.textAlign = 'center';
        ctx.fillText(
            dn.damage + (dn.isCritical ? '!' : ''),
            dn.x + TILE_SIZE / 2,
            dn.y
        );
        ctx.globalAlpha = 1;
    }
}

// Screen Management
function hideAllScreens() {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('hud').style.display = 'none';
    document.getElementById('pauseBtn').style.display = 'none';
    document.getElementById('comboDisplay').style.display = 'none';
    document.getElementById('mobileControls').style.display = 'none';
}

function showMainMenu() {
    hideAllScreens();
    gameState = 'menu';
    document.getElementById('mainMenu').classList.remove('hidden');
    
    // Reset loader
    const loaderBar = document.getElementById('loaderBar');
    if (loaderBar) loaderBar.style.width = '0%';
}

function startGame() {
    hideAllScreens();
    gameState = 'playing';
    document.getElementById('hud').style.display = 'flex';
    document.getElementById('pauseBtn').style.display = 'flex';
    document.getElementById('comboDisplay').style.display = 'block';
    
    if (window.innerWidth <= 768) {
        document.getElementById('mobileControls').style.display = 'flex';
    }
    
    initGame();
    lastTime = performance.now();
    lastUpdate = 0;
    requestAnimationFrame(gameLoop);
    
    // Track game
    window.totalGames = (window.totalGames || 0) + 1;
}

function showUpgradeScreen() {
    gameState = 'upgrade';
    hideAllScreens();
    
    const screen = document.getElementById('upgradeScreen');
    screen.classList.remove('hidden');
    
    const cardsContainer = document.getElementById('upgradeCards');
    cardsContainer.innerHTML = '';
    
    const upgrades = getRandomUpgrades(3);
    
    upgrades.forEach(upgrade => {
        const card = document.createElement('div');
        card.className = 'upgrade-card';
        card.onclick = () => selectUpgrade(upgrade);
        
        card.innerHTML = `
            <span class="card-rarity rarity-${upgrade.rarity}">${upgrade.rarity}</span>
            <div class="card-icon">${upgrade.icon}</div>
            <div class="card-name">${upgrade.name}</div>
            <div class="card-description">${upgrade.description}</div>
        `;
        
        cardsContainer.appendChild(card);
    });
}

function selectUpgrade(upgrade) {
    upgrade.apply();
    
    // Hide upgrade screen and resume game
    document.getElementById('upgradeScreen').classList.add('hidden');
    gameState = 'playing';
    document.getElementById('hud').style.display = 'flex';
    document.getElementById('pauseBtn').style.display = 'flex';
    document.getElementById('comboDisplay').style.display = 'block';
    
    if (window.innerWidth <= 768) {
        document.getElementById('mobileControls').style.display = 'flex';
    }
    
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function showStats() {
    hideAllScreens();
    document.getElementById('statsScreen').classList.remove('hidden');
    
    document.getElementById('statBest').textContent = bestScore;
    document.getElementById('statGames').textContent = window.totalGames || 0;
    document.getElementById('statTotal').textContent = window.totalScore || 0;
    document.getElementById('statMaxLevel').textContent = window.maxLevel || 1;
    document.getElementById('statKills').textContent = totalKills;
}

function showUpgrades() {
    alert('Прокачка происходит автоматически во время игры!\nВыбирайте улучшения при повышении уровня.\n\nПостоянные улучшения:\n- Урон: x' + permanentUpgrades.damage.toFixed(2) + '\n- Скорость: x' + permanentUpgrades.speed.toFixed(2) + '\n- Здоровье: x' + permanentUpgrades.health.toFixed(2) + '\n- Магнит: x' + permanentUpgrades.magnetRange.toFixed(2) + '\n- Удача: x' + permanentUpgrades.luck.toFixed(2));
}

function togglePause() {
    if (gameState === 'playing') {
        gameState = 'paused';
        hideAllScreens();
        document.getElementById('pauseScreen').classList.remove('hidden');
    } else if (gameState === 'paused') {
        document.getElementById('pauseScreen').classList.add('hidden');
        gameState = 'playing';
        document.getElementById('hud').style.display = 'flex';
        document.getElementById('pauseBtn').style.display = 'flex';
        document.getElementById('comboDisplay').style.display = 'block';
        lastTime = performance.now();
        requestAnimationFrame(gameLoop);
    }
}

function gameOver() {
    gameState = 'gameover';
    
    // Update stats
    if (score > bestScore) {
        bestScore = score;
    }
    window.totalScore = (window.totalScore || 0) + score;
    if (level > (window.maxLevel || 1)) {
        window.maxLevel = level;
    }
    
    // Save data
    saveData();
    
    // Show game over screen
    hideAllScreens();
    document.getElementById('gameOverScreen').classList.remove('hidden');
    
    document.getElementById('finalScore').textContent = score;
    document.getElementById('finalBest').textContent = bestScore;
    document.getElementById('finalLevel').textContent = level;
    
    // Show ad after game over
    setTimeout(() => {
        showAd();
    }, 500);
}

// Input Handling
function setDirection(dir) {
    switch(dir) {
        case 'up':
            if (direction.y !== 1) nextDirection = { x: 0, y: -1 };
            break;
        case 'down':
            if (direction.y !== -1) nextDirection = { x: 0, y: 1 };
            break;
        case 'left':
            if (direction.x !== 1) nextDirection = { x: -1, y: 0 };
            break;
        case 'right':
            if (direction.x !== -1) nextDirection = { x: 1, y: 0 };
            break;
    }
}

document.addEventListener('keydown', (e) => {
    if (gameState !== 'playing') return;
    
    switch(e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
        case 'ц':
            setDirection('up');
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
        case 'ы':
            setDirection('down');
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
        case 'ф':
            setDirection('left');
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
        case 'в':
            setDirection('right');
            break;
        case 'Escape':
        case 'p':
        case 'P':
        case 'з':
            togglePause();
            break;
    }
});

// Touch controls for mobile
let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    if (gameState !== 'playing') return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const dx = touchEndX - touchStartX;
    const dy = touchEndY - touchStartY;
    
    if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 30) setDirection('right');
        else if (dx < -30) setDirection('left');
    } else {
        if (dy > 30) setDirection('down');
        else if (dy < -30) setDirection('up');
    }
    
    e.preventDefault();
}, { passive: false });

// Initialize
async function init() {
    setupCanvas();
    await initYandexSDK();
    showMainMenu();
    updateUI();
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
