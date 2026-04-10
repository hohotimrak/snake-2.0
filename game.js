// Snake Survival: Neon Arena - Полная игровая логика

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Yandex SDK
        this.ysdk = null;
        this.player = null;
        
        // Настройки игры
        this.cellSize = 25;
        this.gridWidth = 40;
        this.gridHeight = 30;
        
        // Состояние игры
        this.gameState = 'menu'; // menu, playing, paused, gameover, upgrade
        this.score = 0;
        this.level = 1;
        this.foodEaten = 0;
        this.foodToLevel = 5;
        
        // Змейка
        this.snake = [];
        this.direction = { x: 1, y: 0 };
        this.nextDirection = { x: 1, y: 0 };
        this.speed = 150;
        this.lastMove = 0;
        
        // Еда и объекты
        this.foods = [];
        this.obstacles = [];
        this.particles = [];
        this.powerups = [];
        
        // Улучшения
        this.upgrades = {
            speed: 0,
            magnetRange: 0,
            foodValue: 0,
            foodSpawnRate: 0,
            obstacleClear: 0,
            slowMotion: 0,
            doublePoints: 0,
            shield: 0,
            extraLife: 0,
            foodMagnet: false,
            autoCollect: false,
            ghostMode: false,
            comboMultiplier: 1,
            maxFoodOnScreen: 0,
            luckyStrike: 0
        };
        
        // Статистика
        this.stats = {
            bestScore: 0,
            totalGames: 0,
            totalFood: 0,
            maxLevel: 1
        };
        
        // Управление
        this.touchStartX = 0;
        this.touchStartY = 0;
        
        // Камера для большого мира
        this.camera = { x: 0, y: 0 };
        this.worldWidth = 200;
        this.worldHeight = 150;
        
        this.init();
    }
    
    async init() {
        this.setupCanvas();
        this.loadStats();
        this.setupEventListeners();
        await this.initYandexSDK();
        this.showMenu();
        this.gameLoop();
    }
    
    setupCanvas() {
        const maxSize = Math.min(window.innerWidth, window.innerHeight) * 0.9;
        const aspectRatio = this.gridWidth / this.gridHeight;
        
        if (window.innerWidth > window.innerHeight) {
            this.canvas.width = Math.min(maxSize * 1.5, 1200);
            this.canvas.height = this.canvas.width / aspectRatio;
        } else {
            this.canvas.height = Math.min(maxSize * 1.2, 800);
            this.canvas.width = this.canvas.height * aspectRatio;
        }
        
        this.cellSize = this.canvas.width / this.gridWidth;
    }
    
    async initYandexSDK() {
        try {
            if (window.YaGames) {
                this.ysdk = await YaGames.init();
                console.log('Yandex SDK initialized');
                
                // Загрузка сохранений
                this.loadCloudSave();
            }
        } catch (e) {
            console.log('Yandex SDK not available (development mode)');
        }
    }
    
    loadCloudSave() {
        if (this.ysdk && this.ysdk.getPlayer) {
            this.ysdk.getPlayer().then(player => {
                this.player = player;
                return player.getData(['stats', 'upgrades']);
            }).then(data => {
                if (data.stats) {
                    this.stats = { ...this.stats, ...data.stats };
                    this.updateStatsDisplay();
                }
            }).catch(() => {});
        }
    }
    
    saveCloudData() {
        if (this.player) {
            this.player.setData({
                stats: this.stats,
                upgrades: this.upgrades
            }).catch(() => {});
        }
    }
    
    showAd() {
        if (this.ysdk) {
            this.ysdk.adv.showFullscreenAdv({
                callbacks: {
                    onClose: () => {
                        console.log('Ad closed');
                    },
                    onError: () => {
                        console.log('Ad error');
                    }
                }
            });
        }
    }
    
    setupEventListeners() {
        // Кнопки меню
        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('statsBtn').addEventListener('click', () => this.showStats());
        document.getElementById('backBtn').addEventListener('click', () => this.showMenu());
        document.getElementById('restartBtn').addEventListener('click', () => this.startGame());
        document.getElementById('menuBtn').addEventListener('click', () => this.showMenu());
        document.getElementById('resumeBtn').addEventListener('click', () => this.resumeGame());
        document.getElementById('quitBtn').addEventListener('click', () => this.showMenu());
        document.getElementById('pauseBtn').addEventListener('click', () => this.pauseGame());
        
        // Клавиатура
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        
        // Тач управление
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        
        // Ресайз
        window.addEventListener('resize', () => this.setupCanvas());
    }
    
    handleKeyPress(e) {
        if (this.gameState !== 'playing') return;
        
        switch(e.key) {
            case 'ArrowUp':
            case 'w':
            case 'W':
                if (this.direction.y !== 1) this.nextDirection = { x: 0, y: -1 };
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                if (this.direction.y !== -1) this.nextDirection = { x: 0, y: 1 };
                break;
            case 'ArrowLeft':
            case 'a':
            case 'A':
                if (this.direction.x !== 1) this.nextDirection = { x: -1, y: 0 };
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                if (this.direction.x !== -1) this.nextDirection = { x: 1, y: 0 };
                break;
            case 'Escape':
            case 'p':
            case 'P':
                this.pauseGame();
                break;
        }
    }
    
    handleTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;
    }
    
    handleTouchEnd(e) {
        e.preventDefault();
        if (this.gameState !== 'playing') return;
        
        const touch = e.changedTouches[0];
        const dx = touch.clientX - this.touchStartX;
        const dy = touch.clientY - this.touchStartY;
        
        if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > 30 && this.direction.x !== -1) {
                this.nextDirection = { x: 1, y: 0 };
            } else if (dx < -30 && this.direction.x !== 1) {
                this.nextDirection = { x: -1, y: 0 };
            }
        } else {
            if (dy > 30 && this.direction.y !== -1) {
                this.nextDirection = { x: 0, y: 1 };
            } else if (dy < -30 && this.direction.y !== 1) {
                this.nextDirection = { x: 0, y: -1 };
            }
        }
    }
    
    startGame() {
        this.hideAllMenus();
        document.getElementById('uiOverlay').style.display = 'flex';
        
        // Сброс состояния
        this.snake = [
            { x: Math.floor(this.worldWidth / 2), y: Math.floor(this.worldHeight / 2) },
            { x: Math.floor(this.worldWidth / 2) - 1, y: Math.floor(this.worldHeight / 2) },
            { x: Math.floor(this.worldWidth / 2) - 2, y: Math.floor(this.worldHeight / 2) }
        ];
        this.direction = { x: 1, y: 0 };
        this.nextDirection = { x: 1, y: 0 };
        
        this.score = 0;
        this.level = 1;
        this.foodEaten = 0;
        this.foodToLevel = 5;
        this.speed = 150;
        
        // Сброс улучшений
        Object.keys(this.upgrades).forEach(key => {
            if (typeof this.upgrades[key] === 'boolean') {
                this.upgrades[key] = false;
            } else if (key === 'comboMultiplier') {
                this.upgrades[key] = 1;
            } else {
                this.upgrades[key] = 0;
            }
        });
        
        this.foods = [];
        this.obstacles = [];
        this.particles = [];
        this.powerups = [];
        
        // Генерация препятствий
        this.generateObstacles();
        
        // Спавн еды
        for (let i = 0; i < 5 + this.upgrades.maxFoodOnScreen; i++) {
            this.spawnFood();
        }
        
        this.updateUI();
        this.gameState = 'playing';
        this.stats.totalGames++;
        this.saveStats();
    }
    
    generateObstacles() {
        const obstacleCount = 15 + Math.floor(Math.random() * 10);
        
        for (let i = 0; i < obstacleCount; i++) {
            let obstacle;
            let attempts = 0;
            
            do {
                obstacle = {
                    x: Math.floor(Math.random() * (this.worldWidth - 10)) + 5,
                    y: Math.floor(Math.random() * (this.worldHeight - 10)) + 5,
                    width: Math.floor(Math.random() * 3) + 2,
                    height: Math.floor(Math.random() * 3) + 2
                };
                attempts++;
            } while (
                attempts < 50 &&
                this.isObstacleTooClose(obstacle)
            );
            
            if (attempts < 50) {
                this.obstacles.push(obstacle);
            }
        }
    }
    
    isObstacleTooClose(obstacle) {
        const snakeHead = this.snake[0];
        const minDistance = 10;
        
        if (Math.abs(obstacle.x - snakeHead.x) < minDistance && 
            Math.abs(obstacle.y - snakeHead.y) < minDistance) {
            return true;
        }
        
        for (const existing of this.obstacles) {
            if (Math.abs(obstacle.x - existing.x) < 5 && 
                Math.abs(obstacle.y - existing.y) < 5) {
                return true;
            }
        }
        
        return false;
    }
    
    spawnFood() {
        let food;
        let attempts = 0;
        
        do {
            food = {
                x: Math.floor(Math.random() * this.worldWidth),
                y: Math.floor(Math.random() * this.worldHeight),
                type: this.getRandomFoodType(),
                value: 1 + this.upgrades.foodValue
            };
            attempts++;
        } while (
            attempts < 50 &&
            (this.isOnSnake(food.x, food.y) || 
             this.isInObstacle(food.x, food.y) ||
             this.isNearFood(food.x, food.y))
        );
        
        if (attempts < 50) {
            this.foods.push(food);
        }
    }
    
    getRandomFoodType() {
        const rand = Math.random();
        if (rand < 0.7) return 'normal';
        if (rand < 0.85) return 'bonus';
        if (rand < 0.95) return 'rare';
        return 'legendary';
    }
    
    isOnSnake(x, y) {
        return this.snake.some(segment => segment.x === x && segment.y === y);
    }
    
    isInObstacle(x, y) {
        return this.obstacles.some(obs => 
            x >= obs.x && x < obs.x + obs.width &&
            y >= obs.y && y < obs.y + obs.height
        );
    }
    
    isNearFood(x, y) {
        return this.foods.some(food => 
            Math.abs(food.x - x) < 3 && Math.abs(food.y - y) < 3
        );
    }
    
    spawnPowerup(x, y) {
        const types = ['speedBoost', 'slowMo', 'shield', 'doublePoints'];
        const type = types[Math.floor(Math.random() * types.length)];
        
        this.powerups.push({
            x, y,
            type,
            lifetime: 600
        });
    }
    
    createParticles(x, y, color, count = 10) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: x * this.cellSize + this.cellSize / 2,
                y: y * this.cellSize + this.cellSize / 2,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                life: 1,
                color,
                size: Math.random() * 4 + 2
            });
        }
    }
    
    update(deltaTime) {
        if (this.gameState !== 'playing') return;
        
        // Обновление частиц
        this.updateParticles();
        
        // Движение змейки
        const now = Date.now();
        let currentSpeed = this.speed - (this.upgrades.speed * 5);
        
        if (this.upgrades.slowMotion > 0) {
            currentSpeed *= 1.5;
        }
        
        if (now - this.lastMove > currentSpeed) {
            this.moveSnake();
            this.lastMove = now;
        }
        
        // Авто-сбор еды с магнитом
        if (this.upgrades.foodMagnet || this.upgrades.autoCollect) {
            this.collectFoodWithMagnet();
        }
        
        // Спавн новой еды
        const maxFood = 5 + this.upgrades.maxFoodOnScreen + this.upgrades.foodSpawnRate;
        if (this.foods.length < maxFood && Math.random() < 0.02) {
            this.spawnFood();
        }
        
        // Обновление powerups
        this.updatePowerups();
        
        // Обновление камеры
        this.updateCamera();
        
        // Обновление UI
        this.updateUI();
    }
    
    moveSnake() {
        this.direction = { ...this.nextDirection };
        
        const head = {
            x: this.snake[0].x + this.direction.x,
            y: this.snake[0].y + this.direction.y
        };
        
        // Проверка столкновений со стенами
        if (head.x < 0 || head.x >= this.worldWidth ||
            head.y < 0 || head.y >= this.worldHeight) {
            if (this.upgrades.ghostMode) {
                // Телепорт на другую сторону
                if (head.x < 0) head.x = this.worldWidth - 1;
                if (head.x >= this.worldWidth) head.x = 0;
                if (head.y < 0) head.y = this.worldHeight - 1;
                if (head.y >= this.worldHeight) head.y = 0;
            } else {
                this.gameOver();
                return;
            }
        }
        
        // Проверка столкновений с препятствиями
        if (!this.upgrades.ghostMode && this.isInObstacle(head.x, head.y)) {
            if (this.upgrades.shield > 0) {
                this.upgrades.shield--;
                this.createParticles(head.x, head.y, '#00ffff', 20);
            } else {
                this.gameOver();
                return;
            }
        }
        
        // Проверка столкновений с хвостом
        if (!this.upgrades.ghostMode && this.isOnSnake(head.x, head.y)) {
            this.gameOver();
            return;
        }
        
        this.snake.unshift(head);
        
        // Проверка поедания еды
        let ate = false;
        for (let i = this.foods.length - 1; i >= 0; i--) {
            const food = this.foods[i];
            if (head.x === food.x && head.y === food.y) {
                this.eatFood(food, i);
                ate = true;
                break;
            }
        }
        
        // Проверка powerups
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const powerup = this.powerups[i];
            if (head.x === powerup.x && head.y === powerup.y) {
                this.collectPowerup(powerup, i);
            }
        }
        
        if (!ate) {
            this.snake.pop();
        }
    }
    
    eatFood(food, index) {
        this.foods.splice(index, 1);
        
        let points = food.value;
        
        // Типы еды
        switch(food.type) {
            case 'bonus':
                points *= 2;
                this.createParticles(food.x, food.y, '#00ff00', 15);
                break;
            case 'rare':
                points *= 5;
                this.createParticles(food.x, food.y, '#00ffff', 20);
                break;
            case 'legendary':
                points *= 10;
                this.createParticles(food.x, food.y, '#ffd700', 30);
                if (Math.random() < 0.5) {
                    this.spawnPowerup(food.x, food.y);
                }
                break;
            default:
                this.createParticles(food.x, food.y, '#ff00ff', 10);
        }
        
        // Комбо множитель
        this.upgrades.comboMultiplier = Math.min(this.upgrades.comboMultiplier + 0.1, 5);
        points = Math.floor(points * this.upgrades.comboMultiplier);
        
        if (this.upgrades.doublePoints > 0) {
            points *= 2;
        }
        
        this.score += points;
        this.foodEaten++;
        this.stats.totalFood++;
        
        // Повышение уровня
        if (this.foodEaten >= this.foodToLevel) {
            this.levelUp();
        }
        
        this.saveStats();
    }
    
    collectFoodWithMagnet() {
        const head = this.snake[0];
        const magnetRange = 5 + (this.upgrades.magnetRange * 2);
        
        for (let i = this.foods.length - 1; i >= 0; i--) {
            const food = this.foods[i];
            const distance = Math.sqrt(
                Math.pow(food.x - head.x, 2) + 
                Math.pow(food.y - head.y, 2)
            );
            
            if (distance <= magnetRange) {
                // Притягивание еды
                food.x += (head.x - food.x) * 0.1;
                food.y += (head.y - food.y) * 0.1;
                
                // Если очень близко - автоматический сбор
                if (distance < 1.5 && this.upgrades.autoCollect) {
                    this.eatFood(food, i);
                }
            }
        }
    }
    
    collectPowerup(powerup, index) {
        this.powerups.splice(index, 1);
        
        switch(powerup.type) {
            case 'speedBoost':
                this.speed = Math.max(50, this.speed - 30);
                setTimeout(() => { this.speed = 150 - (this.upgrades.speed * 5); }, 5000);
                break;
            case 'slowMo':
                this.upgrades.slowMotion = Math.min(this.upgrades.slowMotion + 1, 3);
                setTimeout(() => { this.upgrades.slowMotion = Math.max(0, this.upgrades.slowMotion - 1); }, 5000);
                break;
            case 'shield':
                this.upgrades.shield = Math.min(this.upgrades.shield + 1, 3);
                break;
            case 'doublePoints':
                this.upgrades.doublePoints = Math.min(this.upgrades.doublePoints + 1, 3);
                setTimeout(() => { this.upgrades.doublePoints = Math.max(0, this.upgrades.doublePoints - 1); }, 5000);
                break;
        }
        
        this.createParticles(powerup.x, powerup.y, '#ffffff', 25);
    }
    
    updatePowerups() {
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            this.powerups[i].lifetime--;
            if (this.powerups[i].lifetime <= 0) {
                this.powerups.splice(i, 1);
            }
        }
    }
    
    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.95;
            p.vy *= 0.95;
            p.life -= 0.02;
            
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }
    
    updateCamera() {
        if (this.snake.length > 0) {
            const head = this.snake[0];
            const targetX = head.x * this.cellSize - this.canvas.width / 2;
            const targetY = head.y * this.cellSize - this.canvas.height / 2;
            
            this.camera.x += (targetX - this.camera.x) * 0.1;
            this.camera.y += (targetY - this.camera.y) * 0.1;
            
            // Ограничение камеры границами мира
            this.camera.x = Math.max(0, Math.min(this.camera.x, this.worldWidth * this.cellSize - this.canvas.width));
            this.camera.y = Math.max(0, Math.min(this.camera.y, this.worldHeight * this.cellSize - this.canvas.height));
        }
    }
    
    levelUp() {
        this.level++;
        this.foodEaten = 0;
        this.foodToLevel = Math.floor(this.foodToLevel * 1.2);
        
        if (this.level > this.stats.maxLevel) {
            this.stats.maxLevel = this.level;
        }
        
        // Показать экран выбора улучшений
        this.showUpgradeScreen();
    }
    
    showUpgradeScreen() {
        this.gameState = 'upgrade';
        const panel = document.getElementById('upgradePanel');
        const cardsContainer = document.getElementById('upgradeCards');
        
        // Выбор 3 случайных улучшений
        const availableUpgrades = this.getAvailableUpgrades();
        const selected = [];
        
        for (let i = 0; i < 3 && availableUpgrades.length > 0; i++) {
            const index = Math.floor(Math.random() * availableUpgrades.length);
            selected.push(availableUpgrades[index]);
            availableUpgrades.splice(index, 1);
        }
        
        cardsContainer.innerHTML = '';
        
        selected.forEach(upgrade => {
            const card = document.createElement('div');
            card.className = `upgrade-card rarity-${upgrade.rarity}`;
            card.innerHTML = `
                <div class="upgrade-icon">${upgrade.icon}</div>
                <div class="upgrade-name">${upgrade.name}</div>
                <div class="upgrade-desc">${upgrade.desc}</div>
            `;
            card.addEventListener('click', () => this.selectUpgrade(upgrade));
            cardsContainer.appendChild(card);
        });
        
        panel.style.display = 'block';
    }
    
    getAvailableUpgrades() {
        const upgrades = [
            {
                id: 'speed',
                name: 'Ускорение',
                desc: '+10% к скорости движения',
                icon: '⚡',
                rarity: 'common'
            },
            {
                id: 'magnetRange',
                name: 'Магнит',
                desc: 'Увеличивает радиус притяжения еды',
                icon: '🧲',
                rarity: 'common'
            },
            {
                id: 'foodValue',
                name: 'Питательность',
                desc: '+1 к ценности каждой еды',
                icon: '🍎',
                rarity: 'common'
            },
            {
                id: 'foodSpawnRate',
                name: 'Изобилие',
                desc: 'Чаще появляется еда',
                icon: '✨',
                rarity: 'common'
            },
            {
                id: 'maxFoodOnScreen',
                name: 'Щедрость',
                desc: '+2 к макс. количеству еды',
                icon: '🌟',
                rarity: 'rare'
            },
            {
                id: 'obstacleClear',
                name: 'Расчистка',
                desc: 'Удаляет часть препятствий',
                icon: '💥',
                rarity: 'rare'
            },
            {
                id: 'slowMotion',
                name: 'Замедление',
                desc: 'Время замедляется на 5 сек',
                icon: '🐌',
                rarity: 'rare'
            },
            {
                id: 'doublePoints',
                name: 'Двоение',
                desc: '2x очков на 5 секунд',
                icon: '💰',
                rarity: 'epic'
            },
            {
                id: 'shield',
                name: 'Щит',
                desc: 'Защищает от 1 удара',
                icon: '🛡️',
                rarity: 'epic'
            },
            {
                id: 'foodMagnet',
                name: 'Авто-магнит',
                desc: 'Еда притягивается автоматически',
                icon: '🔮',
                rarity: 'epic'
            },
            {
                id: 'autoCollect',
                name: 'Авто-сбор',
                desc: 'Автоматический сбор рядом стоящей еды',
                icon: '🌀',
                rarity: 'legendary'
            },
            {
                id: 'ghostMode',
                name: 'Призрак',
                desc: 'Проход сквозь стены (1 удар)',
                icon: '👻',
                rarity: 'legendary'
            },
            {
                id: 'extraLife',
                name: 'Доп. жизнь',
                desc: 'Восстанавливает игру при смерти',
                icon: '❤️',
                rarity: 'legendary'
            },
            {
                id: 'luckyStrike',
                name: 'Удача',
                desc: 'Шанс на легендарную еду',
                icon: '🍀',
                rarity: 'epic'
            }
        ];
        
        return upgrades.filter(u => {
            if (typeof this.upgrades[u.id] === 'boolean') {
                return !this.upgrades[u.id]; // Не показывать уже выбранные boolean улучшения
            }
            return this.upgrades[u.id] < 5; // Ограничить уровень улучшений
        });
    }
    
    selectUpgrade(upgrade) {
        // Применение улучшения
        if (typeof this.upgrades[upgrade.id] === 'boolean') {
            this.upgrades[upgrade.id] = true;
        } else {
            this.upgrades[upgrade.id]++;
        }
        
        // Особые эффекты
        if (upgrade.id === 'obstacleClear') {
            // Удалить случайные препятствия
            const toRemove = Math.min(5, Math.floor(this.obstacles.length / 3));
            for (let i = 0; i < toRemove; i++) {
                if (this.obstacles.length > 0) {
                    const idx = Math.floor(Math.random() * this.obstacles.length);
                    const obs = this.obstacles[idx];
                    this.createParticles(
                        obs.x + obs.width/2, 
                        obs.y + obs.height/2, 
                        '#ff6600', 
                        15
                    );
                    this.obstacles.splice(idx, 1);
                }
            }
        }
        
        document.getElementById('upgradePanel').style.display = 'none';
        this.gameState = 'playing';
        this.lastMove = Date.now();
    }
    
    gameOver() {
        this.gameState = 'gameover';
        
        // Проверка рекорда
        const isNewRecord = this.score > this.stats.bestScore;
        if (isNewRecord) {
            this.stats.bestScore = this.score;
        }
        
        this.saveStats();
        this.saveCloudData();
        
        // Показать экран смерти
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('finalLevel').textContent = this.level;
        document.getElementById('newRecord').textContent = isNewRecord ? '🏆 НОВЫЙ!' : 'Нет';
        document.getElementById('gameOverMenu').style.display = 'flex';
        document.getElementById('uiOverlay').style.display = 'none';
        
        // Показать рекламу после game over
        setTimeout(() => this.showAd(), 1000);
    }
    
    pauseGame() {
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
            document.getElementById('pauseMenu').style.display = 'flex';
        }
    }
    
    resumeGame() {
        this.gameState = 'playing';
        document.getElementById('pauseMenu').style.display = 'none';
        this.lastMove = Date.now();
    }
    
    showMenu() {
        this.hideAllMenus();
        document.getElementById('mainMenu').style.display = 'flex';
        document.getElementById('uiOverlay').style.display = 'none';
        this.gameState = 'menu';
    }
    
    showStats() {
        this.hideAllMenus();
        this.updateStatsDisplay();
        document.getElementById('statsMenu').style.display = 'flex';
    }
    
    hideAllMenus() {
        document.querySelectorAll('.menu-screen, .upgrade-panel').forEach(el => {
            el.style.display = 'none';
        });
    }
    
    updateUI() {
        document.getElementById('scoreValue').textContent = this.score;
        document.getElementById('levelValue').textContent = this.level;
        
        const progress = (this.foodEaten / this.foodToLevel) * 100;
        document.getElementById('levelProgress').style.width = `${progress}%`;
    }
    
    updateStatsDisplay() {
        document.getElementById('bestScore').textContent = this.stats.bestScore;
        document.getElementById('totalGames').textContent = this.stats.totalGames;
        document.getElementById('totalFood').textContent = this.stats.totalFood;
        document.getElementById('maxLevel').textContent = this.stats.maxLevel;
    }
    
    loadStats() {
        const saved = localStorage.getItem('snakeSurvivalStats');
        if (saved) {
            this.stats = { ...this.stats, ...JSON.parse(saved) };
        }
    }
    
    saveStats() {
        localStorage.setItem('snakeSurvivalStats', JSON.stringify(this.stats));
    }
    
    draw() {
        // Очистка
        this.ctx.fillStyle = 'rgba(10, 10, 30, 0.95)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Сохранение контекста для камеры
        this.ctx.save();
        
        if (this.gameState === 'playing' || this.gameState === 'paused') {
            this.ctx.translate(-this.camera.x, -this.camera.y);
            
            // Отрисовка сетки
            this.drawGrid();
            
            // Отрисовка препятствий
            this.drawObstacles();
            
            // Отрисовка еды
            this.drawFoods();
            
            // Отрисовка powerups
            this.drawPowerups();
            
            // Отрисовка змейки
            this.drawSnake();
            
            // Отрисовка частиц
            this.drawParticles();
        }
        
        this.ctx.restore();
    }
    
    drawGrid() {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        this.ctx.lineWidth = 1;
        
        const startX = Math.floor(this.camera.x / this.cellSize);
        const startY = Math.floor(this.camera.y / this.cellSize);
        const endX = startX + Math.ceil(this.canvas.width / this.cellSize) + 1;
        const endY = startY + Math.ceil(this.canvas.height / this.cellSize) + 1;
        
        for (let x = startX; x <= endX; x++) {
            this.ctx.beginPath();
            this.ctx.moveTo(x * this.cellSize, startY * this.cellSize);
            this.ctx.lineTo(x * this.cellSize, endY * this.cellSize);
            this.ctx.stroke();
        }
        
        for (let y = startY; y <= endY; y++) {
            this.ctx.beginPath();
            this.ctx.moveTo(startX * this.cellSize, y * this.cellSize);
            this.ctx.lineTo(endX * this.cellSize, y * this.cellSize);
            this.ctx.stroke();
        }
        
        // Границы мира
        this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(0, 0, this.worldWidth * this.cellSize, this.worldHeight * this.cellSize);
    }
    
    drawSnake() {
        this.snake.forEach((segment, index) => {
            const x = segment.x * this.cellSize;
            const y = segment.y * this.cellSize;
            
            // Градиент для тела
            const gradient = this.ctx.createRadialGradient(
                x + this.cellSize/2, y + this.cellSize/2, 0,
                x + this.cellSize/2, y + this.cellSize/2, this.cellSize/2
            );
            
            if (index === 0) {
                // Голова
                gradient.addColorStop(0, '#00ffff');
                gradient.addColorStop(1, '#0088ff');
                
                // Щит эффект
                if (this.upgrades.shield > 0) {
                    this.ctx.beginPath();
                    this.ctx.arc(x + this.cellSize/2, y + this.cellSize/2, this.cellSize/1.5, 0, Math.PI * 2);
                    this.ctx.strokeStyle = `rgba(0, 255, 255, ${0.5 + Math.sin(Date.now() / 200) * 0.3})`;
                    this.ctx.lineWidth = 3;
                    this.ctx.stroke();
                }
            } else {
                // Тело с градиентом от позиции в змейке
                const intensity = 1 - (index / this.snake.length) * 0.5;
                gradient.addColorStop(0, `rgba(138, 43, 226, ${intensity})`);
                gradient.addColorStop(1, `rgba(75, 0, 130, ${intensity})`);
            }
            
            this.ctx.fillStyle = gradient;
            
            // Скруглённый сегмент
            const radius = this.cellSize / 2 - 2;
            this.ctx.beginPath();
            this.ctx.arc(x + this.cellSize/2, y + this.cellSize/2, radius, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Блик
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.beginPath();
            this.ctx.arc(x + this.cellSize/2 - 3, y + this.cellSize/2 - 3, radius/3, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }
    
    drawFoods() {
        this.foods.forEach(food => {
            const x = food.x * this.cellSize + this.cellSize/2;
            const y = food.y * this.cellSize + this.cellSize/2;
            const radius = this.cellSize/3;
            
            let color;
            let glow;
            
            switch(food.type) {
                case 'bonus':
                    color = '#00ff00';
                    glow = 'rgba(0, 255, 0, 0.5)';
                    break;
                case 'rare':
                    color = '#00ffff';
                    glow = 'rgba(0, 255, 255, 0.5)';
                    break;
                case 'legendary':
                    color = '#ffd700';
                    glow = 'rgba(255, 215, 0, 0.7)';
                    break;
                default:
                    color = '#ff00ff';
                    glow = 'rgba(255, 0, 255, 0.4)';
            }
            
            // Пульсация
            const pulse = 1 + Math.sin(Date.now() / 200) * 0.2;
            
            // Свечение
            this.ctx.beginPath();
            this.ctx.arc(x, y, radius * pulse * 1.5, 0, Math.PI * 2);
            this.ctx.fillStyle = glow;
            this.ctx.fill();
            
            // Основная еда
            this.ctx.beginPath();
            this.ctx.arc(x, y, radius * pulse, 0, Math.PI * 2);
            this.ctx.fillStyle = color;
            this.ctx.fill();
            
            // Блик
            this.ctx.beginPath();
            this.ctx.arc(x - radius/3, y - radius/3, radius/4, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            this.ctx.fill();
        });
    }
    
    drawObstacles() {
        this.obstacles.forEach(obs => {
            const x = obs.x * this.cellSize;
            const y = obs.y * this.cellSize;
            const w = obs.width * this.cellSize;
            const h = obs.height * this.cellSize;
            
            // Градиент для препятствия
            const gradient = this.ctx.createLinearGradient(x, y, x + w, y + h);
            gradient.addColorStop(0, '#2a2a4a');
            gradient.addColorStop(0.5, '#3a3a5a');
            gradient.addColorStop(1, '#2a2a4a');
            
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(x, y, w, h);
            
            // Граница
            this.ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(x, y, w, h);
            
            // Узор внутри
            this.ctx.fillStyle = 'rgba(255, 50, 50, 0.2)';
            for (let i = 0; i < obs.width; i++) {
                for (let j = 0; j < obs.height; j++) {
                    if ((i + j) % 2 === 0) {
                        this.ctx.fillRect(
                            x + i * this.cellSize,
                            y + j * this.cellSize,
                            this.cellSize,
                            this.cellSize
                        );
                    }
                }
            }
        });
    }
    
    drawPowerups() {
        this.powerups.forEach(powerup => {
            const x = powerup.x * this.cellSize + this.cellSize/2;
            const y = powerup.y * this.cellSize + this.cellSize/2;
            
            // Пульсация
            const pulse = 1 + Math.sin(Date.now() / 100) * 0.3;
            const alpha = powerup.lifetime / 600;
            
            this.ctx.save();
            this.ctx.globalAlpha = alpha;
            
            // Внешнее кольцо
            this.ctx.beginPath();
            this.ctx.arc(x, y, this.cellSize/2 * pulse, 0, Math.PI * 2);
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            // Внутренний символ
            let symbol;
            let color;
            switch(powerup.type) {
                case 'speedBoost': symbol = '⚡'; color = '#ffff00'; break;
                case 'slowMo': symbol = '🐌'; color = '#00ffff'; break;
                case 'shield': symbol = '🛡️'; color = '#00ff00'; break;
                case 'doublePoints': symbol = '💰'; color = '#ffd700'; break;
            }
            
            this.ctx.fillStyle = color;
            this.ctx.font = `${this.cellSize/1.5}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(symbol, x, y);
            
            this.ctx.restore();
        });
    }
    
    drawParticles() {
        this.particles.forEach(p => {
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1;
    }
    
    gameLoop() {
        const deltaTime = 16.67; // ~60 FPS
        
        this.update(deltaTime);
        this.draw();
        
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Инициализация игры
window.addEventListener('load', () => {
    new Game();
});
