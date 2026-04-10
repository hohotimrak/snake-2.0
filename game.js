// Snake Survival: Fantasy Quest - Game Logic
// Плавное движение змейки, фэнтези стиль, прокачка за еду

(function() {
    'use strict';

    // Инициализация Yandex SDK
    let ysdk = null;
    let player = null;

    function initYandexSDK() {
        if (window.YaGames) {
            YaGames.init().then(ysdkInstance => {
                ysdk = ysdkInstance;
                console.log('Yandex SDK initialized');
                loadProgress();
            }).catch(err => {
                console.error('Yandex SDK error:', err);
            });
        }
    }

    // Канвас и контекст
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // Настройки игры
    const WORLD_WIDTH = 2000;
    const WORLD_HEIGHT = 1500;
    const CELL_SIZE = 25;
    const INITIAL_SNAKE_LENGTH = 5;
    const FOOD_TO_LEVEL_UP = 5;

    // Состояние игры
    let gameState = 'menu'; // menu, playing, paused, upgrade, gameover
    let score = 0;
    let level = 1;
    let health = 100;
    let foodsEaten = 0;
    let foodsToNextLevel = FOOD_TO_LEVEL_UP;

    // Змейка
    let snake = {
        x: WORLD_WIDTH / 2,
        y: WORLD_HEIGHT / 2,
        angle: 0,
        speed: 3,
        baseSpeed: 3,
        segments: [],
        targetAngle: 0,
        growthPending: 0
    };

    // Камера
    let camera = {
        x: 0,
        y: 0
    };

    // Еда
    let foods = [];
    const MAX_FOODS = 50;

    // Препятствия
    let obstacles = [];

    // Улучшения игрока
    let upgrades = {
        speed: 0,          // -speed per level
        magnetRange: 0,    // +range per level
        foodValue: 0,      // +value per level
        autoCollect: 0,    // boolean flag
        maxHealth: 0,      // +max health per level
        healthRegen: 0,    // regen per second
        shield: 0,         // shield points
        luck: 0,           // rare food chance
        growthBonus: 0,    // extra growth per food
        slowMode: 0,       // slower speed
        vision: 0,         // see more of map
        damageResist: 0    // reduce obstacle damage
    };

    // Частицы
    let particles = [];

    // Управление
    let keys = {};
    let touchStartX = 0;
    let touchStartY = 0;

    // Лучшие результаты
    let bestScore = 0;
    let maxLevelReached = 1;

    // Типы улучшений
    const UPGRADE_TYPES = [
        { id: 'slowMode', name: 'Мудрость Черепахи', desc: 'Змейка движется медленнее и плавнее', icon: '🐢', rarity: 'common' },
        { id: 'magnetRange', name: 'Магнит Феи', desc: 'Еда притягивается издалека', icon: '🧲', rarity: 'rare' },
        { id: 'foodValue', name: 'Благословение Эльфов', desc: 'Еда даёт больше очков', icon: '✨', rarity: 'common' },
        { id: 'autoCollect', name: 'Дух Леса', desc: 'Автоматический сбор nearby еды', icon: '🌟', rarity: 'epic' },
        { id: 'maxHealth', name: 'Жизнь Древа', desc: '+20 к максимальному здоровью', icon: '💚', rarity: 'common' },
        { id: 'healthRegen', name: 'Источник Жизни', desc: 'Регенерация здоровья', icon: '💧', rarity: 'rare' },
        { id: 'shield', name: 'Щит Дракона', desc: 'Защитный барьер', icon: '🛡️', rarity: 'epic' },
        { id: 'luck', name: 'Удача Гнома', desc: 'Чаще появляется редкая еда', icon: '🍀', rarity: 'rare' },
        { id: 'growthBonus', name: 'Сила Великана', desc: 'Хвост растёт быстрее', icon: '💪', rarity: 'common' },
        { id: 'damageResist', name: 'Кожа Тролля', desc: 'Меньше урона от препятствий', icon: '🗿', rarity: 'rare' },
        { id: 'vision', name: 'Глаз Орла', desc: 'Видно больше карты', icon: '👁️', rarity: 'common' },
        { id: 'speedBoost', name: 'Сапоги Героя', desc: 'Небольшое ускорение', icon: '👢', rarity: 'common' }
    ];

    // Инициализация
    function init() {
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        // Загрузка лучших результатов
        const saved = localStorage.getItem('snakeSurvivalBest');
        if (saved) {
            const data = JSON.parse(saved);
            bestScore = data.bestScore || 0;
            maxLevelReached = data.maxLevel || 1;
        }
        updateBestStats();

        // Генерация препятствий
        generateObstacles();

        // Обработчики ввода
        setupInputHandlers();

        // Yandex SDK
        initYandexSDK();

        // Запуск игрового цикла
        requestAnimationFrame(gameLoop);
    }

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function generateObstacles() {
        obstacles = [];
        // Границы мира
        obstacles.push({ x: -CELL_SIZE, y: -CELL_SIZE, width: WORLD_WIDTH + CELL_SIZE * 2, height: CELL_SIZE });
        obstacles.push({ x: -CELL_SIZE, y: WORLD_HEIGHT, width: WORLD_WIDTH + CELL_SIZE * 2, height: CELL_SIZE });
        obstacles.push({ x: -CELL_SIZE, y: 0, width: CELL_SIZE, height: WORLD_HEIGHT });
        obstacles.push({ x: WORLD_WIDTH, y: 0, width: CELL_SIZE, height: WORLD_HEIGHT });

        // Случайные препятствия
        for (let i = 0; i < 30; i++) {
            const width = 50 + Math.random() * 150;
            const height = 50 + Math.random() * 150;
            const x = Math.random() * (WORLD_WIDTH - width);
            const y = Math.random() * (WORLD_HEIGHT - height);
            
            // Не создавать слишком близко к центру (спавн змейки)
            const distToCenter = Math.sqrt(Math.pow(x + width/2 - WORLD_WIDTH/2, 2) + Math.pow(y + height/2 - WORLD_HEIGHT/2, 2));
            if (distToCenter > 300) {
                obstacles.push({ x, y, width, height, type: 'tree' });
            }
        }
    }

    function setupInputHandlers() {
        // Клавиатура
        document.addEventListener('keydown', (e) => {
            keys[e.code] = true;
            
            if (e.code === 'Escape') {
                if (gameState === 'playing') {
                    pauseGame();
                } else if (gameState === 'paused') {
                    resumeGame();
                }
            }
            
            // Стрелки для управления
            if (gameState === 'playing') {
                const turnSpeed = 0.08;
                if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
                    snake.targetAngle -= turnSpeed;
                }
                if (e.code === 'ArrowRight' || e.code === 'KeyD') {
                    snake.targetAngle += turnSpeed;
                }
                if (e.code === 'ArrowUp' || e.code === 'KeyW') {
                    snake.targetAngle = snake.angle; // Продолжать прямо
                }
            }
        });

        document.addEventListener('keyup', (e) => {
            keys[e.code] = false;
        });

        // Тач управление
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: false });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (gameState !== 'playing') return;
            
            const touchX = e.touches[0].clientX;
            const touchY = e.touches[0].clientY;
            const dx = touchX - touchStartX;
            const dy = touchY - touchStartY;
            
            if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                const turnSpeed = 0.08;
                if (dx < -10) snake.targetAngle -= turnSpeed;
                if (dx > 10) snake.targetAngle += turnSpeed;
                touchStartX = touchX;
                touchStartY = touchY;
            }
        }, { passive: false });
    }

    function startGame() {
        // Сброс состояния
        snake = {
            x: WORLD_WIDTH / 2,
            y: WORLD_HEIGHT / 2,
            angle: -Math.PI / 2,
            speed: 3,
            baseSpeed: 3,
            segments: [],
            targetAngle: -Math.PI / 2,
            growthPending: 0
        };

        // Начальные сегменты
        for (let i = 0; i < INITIAL_SNAKE_LENGTH; i++) {
            snake.segments.push({
                x: snake.x,
                y: snake.y + i * CELL_SIZE
            });
        }

        // Сброс статистики
        score = 0;
        level = 1;
        health = 100;
        foodsEaten = 0;
        foodsToNextLevel = FOOD_TO_LEVEL_UP;

        // Сброс улучшений
        upgrades = {
            speed: 0,
            magnetRange: 0,
            foodValue: 0,
            autoCollect: 0,
            maxHealth: 0,
            healthRegen: 0,
            shield: 0,
            luck: 0,
            growthBonus: 0,
            slowMode: 0,
            vision: 0,
            damageResist: 0
        };

        // Очистка частиц
        particles = [];

        // Генерация начальной еды
        foods = [];
        for (let i = 0; i < MAX_FOODS; i++) {
            spawnFood();
        }

        // Перегенерация препятствий
        generateObstacles();

        // Скрытие меню
        document.getElementById('mainMenu').style.display = 'none';
        document.getElementById('gameOverScreen').style.display = 'none';
        document.getElementById('pauseMenu').style.display = 'none';

        gameState = 'playing';
        updateHUD();
    }

    function spawnFood() {
        const padding = 50;
        let x, y, valid;
        let attempts = 0;
        
        do {
            valid = true;
            x = padding + Math.random() * (WORLD_WIDTH - padding * 2);
            y = padding + Math.random() * (WORLD_HEIGHT - padding * 2);
            
            // Проверка на столкновение с препятствиями
            for (const obs of obstacles) {
                if (x > obs.x - CELL_SIZE && x < obs.x + obs.width + CELL_SIZE &&
                    y > obs.y - CELL_SIZE && y < obs.y + obs.height + CELL_SIZE) {
                    valid = false;
                    break;
                }
            }
            attempts++;
        } while (!valid && attempts < 10);

        // Тип еды
        let type = 'apple';
        let value = 1;
        let color = '#ff4444';

        if (upgrades.luck > 0 && Math.random() < 0.1 * upgrades.luck) {
            type = 'golden';
            value = 5;
            color = '#ffd93d';
        } else if (Math.random() < 0.15) {
            type = 'berry';
            value = 2;
            color = '#9b59b6';
        }

        foods.push({ x, y, type, value, color });
    }

    function gameLoop(timestamp) {
        update(timestamp);
        render();
        requestAnimationFrame(gameLoop);
    }

    let lastTime = 0;
    function update(timestamp) {
        const deltaTime = (timestamp - lastTime) / 1000;
        lastTime = timestamp;

        if (gameState !== 'playing') return;

        // Обновление скорости на основе улучшений
        let targetSpeed = snake.baseSpeed;
        if (upgrades.slowMode > 0) {
            targetSpeed *= (1 - upgrades.slowMode * 0.1);
        }
        if (upgrades.speed > 0) {
            targetSpeed *= (1 + upgrades.speed * 0.15);
        }
        snake.speed = targetSpeed;

        // Плавный поворот змейки
        let angleDiff = snake.targetAngle - snake.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        snake.angle += angleDiff * 0.15;

        // Движение змейки
        const moveSpeed = snake.speed;
        snake.x += Math.cos(snake.angle) * moveSpeed;
        snake.y += Math.sin(snake.angle) * moveSpeed;

        // Ограничение мира
        snake.x = Math.max(CELL_SIZE, Math.min(WORLD_WIDTH - CELL_SIZE, snake.x));
        snake.y = Math.max(CELL_SIZE, Math.min(WORLD_HEIGHT - CELL_SIZE, snake.y));

        // Добавление нового сегмента
        snake.segments.unshift({ x: snake.x, y: snake.y });

        // Удаление старых сегментов или рост
        const targetLength = INITIAL_SNAKE_LENGTH + snake.growthPending;
        while (snake.segments.length > targetLength) {
            snake.segments.pop();
        }

        // Проверка столкновений с препятствиями
        checkObstacleCollisions();

        // Магнит для еды
        const magnetRange = 50 + upgrades.magnetRange * 20;
        for (let i = foods.length - 1; i >= 0; i--) {
            const food = foods[i];
            const dx = snake.x - food.x;
            const dy = snake.y - food.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Притягивание магнитом
            if (dist < magnetRange) {
                food.x += (dx / dist) * 2;
                food.y += (dy / dist) * 2;
            }

            // Автоматический сбор
            if (upgrades.autoCollect > 0 && dist < 80) {
                collectFood(i);
                continue;
            }

            // Сбор при касании
            if (dist < CELL_SIZE) {
                collectFood(i);
            }
        }

        // Регенерация здоровья
        if (upgrades.healthRegen > 0) {
            health = Math.min(getMaxHealth(), health + upgrades.healthRegen * deltaTime);
        }

        // Обновление камеры
        camera.x = snake.x - canvas.width / 2;
        camera.y = snake.y - canvas.height / 2;
        camera.x = Math.max(-CELL_SIZE, Math.min(camera.x, WORLD_WIDTH - canvas.width + CELL_SIZE));
        camera.y = Math.max(-CELL_SIZE, Math.min(camera.y, WORLD_HEIGHT - canvas.height + CELL_SIZE));

        // Обновление компаса
        updateCompass();

        // Обновление частиц
        updateParticles(deltaTime);

        // Обновление HUD
        updateHUD();
    }

    function getMaxHealth() {
        return 100 + upgrades.maxHealth * 20;
    }

    function checkObstacleCollisions() {
        const snakeRadius = CELL_SIZE / 2 - 2;

        for (const obs of obstacles) {
            // Простая проверка прямоугольника
            const closestX = Math.max(obs.x, Math.min(snake.x, obs.x + obs.width));
            const closestY = Math.max(obs.y, Math.min(snake.y, obs.y + obs.height));
            
            const dx = snake.x - closestX;
            const dy = snake.y - closestY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < snakeRadius) {
                // Столкновение!
                const damage = upgrades.damageResist > 0 ? 10 : 20;
                health -= damage;
                
                // Отталкивание
                if (dist > 0) {
                    snake.x += (dx / dist) * 20;
                    snake.y += (dy / dist) * 20;
                }

                // Частицы
                createParticles(snake.x, snake.y, '#8B4513', 5);

                if (health <= 0) {
                    gameOver();
                }
                break;
            }
        }
    }

    function collectFood(index) {
        const food = foods[index];
        const value = food.value + upgrades.foodValue;
        score += value;
        foodsEaten++;
        
        // Рост хвоста
        const growth = 1 + upgrades.growthBonus;
        snake.growthPending += growth;

        // Частицы
        createParticles(food.x, food.y, food.color, 8);

        // Удаление еды
        foods.splice(index, 1);

        // Проверка повышения уровня
        if (foodsEaten >= foodsToNextLevel) {
            levelUp();
        } else {
            // Spawn new food
            spawnFood();
        }

        updateHUD();
    }

    function levelUp() {
        level++;
        foodsEaten = 0;
        foodsToNextLevel = Math.floor(FOOD_TO_LEVEL_UP * Math.pow(1.2, level - 1));
        
        // Лечение при повышении уровня
        health = Math.min(getMaxHealth(), health + 20);

        // Показать экран выбора улучшений
        showUpgradeScreen();
    }

    function showUpgradeScreen() {
        gameState = 'upgrade';
        
        // Выбор 3 случайных улучшений
        const available = [...UPGRADE_TYPES];
        const choices = [];
        
        for (let i = 0; i < 3 && available.length > 0; i++) {
            const index = Math.floor(Math.random() * available.length);
            choices.push(available[index]);
            available.splice(index, 1);
        }

        // Рендер карточек
        const container = document.getElementById('upgradeCards');
        container.innerHTML = '';

        choices.forEach(upgrade => {
            const card = document.createElement('div');
            card.className = `upgrade-card rarity-${upgrade.rarity}`;
            card.innerHTML = `
                <div class="upgrade-icon">${upgrade.icon}</div>
                <div class="upgrade-name">${upgrade.name}</div>
                <div class="upgrade-desc">${upgrade.desc}</div>
            `;
            card.onclick = () => selectUpgrade(upgrade.id);
            container.appendChild(card);
        });

        document.getElementById('upgradeScreen').style.display = 'flex';
    }

    function selectUpgrade(upgradeId) {
        // Применение улучшения
        switch(upgradeId) {
            case 'slowMode':
                upgrades.slowMode++;
                break;
            case 'magnetRange':
                upgrades.magnetRange++;
                break;
            case 'foodValue':
                upgrades.foodValue++;
                break;
            case 'autoCollect':
                upgrades.autoCollect = 1;
                break;
            case 'maxHealth':
                upgrades.maxHealth++;
                health = Math.min(getMaxHealth(), health + 20);
                break;
            case 'healthRegen':
                upgrades.healthRegen++;
                break;
            case 'shield':
                upgrades.shield++;
                break;
            case 'luck':
                upgrades.luck++;
                break;
            case 'growthBonus':
                upgrades.growthBonus++;
                break;
            case 'damageResist':
                upgrades.damageResist++;
                break;
            case 'vision':
                upgrades.vision++;
                break;
            case 'speedBoost':
                upgrades.speed++;
                break;
        }

        // Скрытие экрана улучшений
        document.getElementById('upgradeScreen').style.display = 'none';
        gameState = 'playing';
        updateHUD();
    }

    function createParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 100,
                vy: (Math.random() - 0.5) * 100,
                life: 1,
                color: color,
                size: 3 + Math.random() * 3
            });
        }
    }

    function updateParticles(deltaTime) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx * deltaTime;
            p.y += p.vy * deltaTime;
            p.life -= deltaTime * 2;
            
            if (p.life <= 0) {
                particles.splice(i, 1);
            }
        }
    }

    function updateCompass() {
        // Найти ближайшую еду
        let nearestFood = null;
        let minDist = Infinity;

        for (const food of foods) {
            const dx = food.x - snake.x;
            const dy = food.y - snake.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < minDist) {
                minDist = dist;
                nearestFood = food;
            }
        }

        if (nearestFood) {
            const dx = nearestFood.x - snake.x;
            const dy = nearestFood.y - snake.y;
            let angle = Math.atan2(dy, dx);
            
            // Преобразование в угол относительно направления змейки
            const relativeAngle = angle - snake.angle;
            
            const arrow = document.getElementById('compassArrow');
            arrow.style.transform = `translate(-50%, -100%) rotate(${relativeAngle}rad)`;
        }
    }

    function updateHUD() {
        document.getElementById('scoreDisplay').textContent = score;
        document.getElementById('levelDisplay').textContent = level;
        document.getElementById('healthDisplay').textContent = Math.round(health);
    }

    function updateBestStats() {
        document.getElementById('bestScore').textContent = bestScore;
        document.getElementById('maxLevel').textContent = maxLevelReached;
    }

    function saveProgress() {
        if (score > bestScore) bestScore = score;
        if (level > maxLevelReached) maxLevelReached = level;
        
        localStorage.setItem('snakeSurvivalBest', JSON.stringify({
            bestScore,
            maxLevel: maxLevelReached
        }));

        // Сохранение в облако Yandex
        if (player) {
            player.setData({
                bestScore,
                maxLevel: maxLevelReached
            }).then(() => {
                console.log('Progress saved to cloud');
            }).catch(err => {
                console.error('Cloud save error:', err);
            });
        }
    }

    function loadProgress() {
        if (ysdk) {
            ysdk.getPlayer().then(_player => {
                player = _player;
                return player.getData();
            }).then(data => {
                if (data.bestScore) bestScore = data.bestScore;
                if (data.maxLevel) maxLevelReached = data.maxLevel;
                updateBestStats();
            }).catch(err => {
                console.error('Cloud load error:', err);
            });
        }
    }

    function gameOver() {
        gameState = 'gameover';
        saveProgress();

        // Показ рекламы
        if (ysdk) {
            ysdk.adv.showFullscreenAdv({
                callbacks: {
                    onClose: function(wasShown) {
                        console.log('Ad closed');
                    },
                    onError: function(error) {
                        console.log('Ad error:', error);
                    }
                }
            });
        }

        document.getElementById('finalScore').textContent = score;
        document.getElementById('finalLevel').textContent = level;
        document.getElementById('gameOverScreen').style.display = 'flex';
    }

    function pauseGame() {
        gameState = 'paused';
        document.getElementById('pauseMenu').style.display = 'flex';
    }

    function resumeGame() {
        document.getElementById('pauseMenu').style.display = 'none';
        gameState = 'playing';
    }

    function quitToMenu() {
        document.getElementById('pauseMenu').style.display = 'none';
        document.getElementById('gameOverScreen').style.display = 'none';
        document.getElementById('mainMenu').style.display = 'flex';
        gameState = 'menu';
        saveProgress();
    }

    function showControls() {
        alert('Управление:\n\n🖥️ ПК: Стрелки или WASD для поворота\n📱 Мобильные: Свайп влево/вправо\n\nESC - Пауза');
    }

    function render() {
        // Очистка
        ctx.fillStyle = '#2d5a3f';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(-camera.x, -camera.y);

        // Рендер фона (сетка)
        renderGrid();

        // Рендер препятствий
        renderObstacles();

        // Рендер еды
        renderFoods();

        // Рендер змейки
        renderSnake();

        // Рендер частиц
        renderParticles();

        ctx.restore();
    }

    function renderGrid() {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;

        const gridSize = CELL_SIZE;
        const startX = Math.floor(camera.x / gridSize) * gridSize;
        const startY = Math.floor(camera.y / gridSize) * gridSize;

        for (let x = startX; x < camera.x + canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, camera.y);
            ctx.lineTo(x, camera.y + canvas.height);
            ctx.stroke();
        }

        for (let y = startY; y < camera.y + canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(camera.x, y);
            ctx.lineTo(camera.x + canvas.width, y);
            ctx.stroke();
        }
    }

    function renderObstacles() {
        for (const obs of obstacles) {
            // Границы видимости
            if (obs.x + obs.width < camera.x || obs.x > camera.x + canvas.width ||
                obs.y + obs.height < camera.y || obs.y > camera.y + canvas.height) {
                continue;
            }

            if (obs.type === 'tree') {
                // Деревья
                ctx.fillStyle = '#1a3a1a';
                ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
                
                // Детали дерева
                ctx.fillStyle = '#2d5a2d';
                const trunkSize = Math.min(obs.width, obs.height) * 0.3;
                ctx.fillRect(
                    obs.x + obs.width/2 - trunkSize/2,
                    obs.y + obs.height/2 - trunkSize/2,
                    trunkSize,
                    trunkSize
                );
            } else {
                // Границы мира
                ctx.fillStyle = '#1a2a1a';
                ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
            }
        }
    }

    function renderFoods() {
        for (const food of foods) {
            // Границы видимости
            if (food.x < camera.x - CELL_SIZE || food.x > camera.x + canvas.width + CELL_SIZE ||
                food.y < camera.y - CELL_SIZE || food.y > camera.y + canvas.height + CELL_SIZE) {
                continue;
            }

            // Свечение
            const gradient = ctx.createRadialGradient(food.x, food.y, 0, food.x, food.y, CELL_SIZE);
            gradient.addColorStop(0, food.color);
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.arc(food.x, food.y, CELL_SIZE, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;

            // Основная еда
            ctx.fillStyle = food.color;
            ctx.beginPath();
            ctx.arc(food.x, food.y, CELL_SIZE / 2 - 2, 0, Math.PI * 2);
            ctx.fill();

            // Блик
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.beginPath();
            ctx.arc(food.x - 3, food.y - 3, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function renderSnake() {
        // Рендер сегментов змейки
        for (let i = snake.segments.length - 1; i >= 0; i--) {
            const seg = snake.segments[i];
            const isHead = i === 0;
            
            // Размер сегмента уменьшается к хвосту
            const sizeRatio = 1 - (i / snake.segments.length) * 0.4;
            const size = (CELL_SIZE / 2) * sizeRatio;

            // Цвет змейки (зелёный градиент)
            const greenValue = Math.max(100, 200 - i * 3);
            ctx.fillStyle = isHead ? '#4a7c59' : `rgb(50, ${greenValue}, 80)`;

            ctx.beginPath();
            ctx.arc(seg.x, seg.y, size, 0, Math.PI * 2);
            ctx.fill();

            // Глаза для головы
            if (isHead) {
                const eyeOffset = size * 0.6;
                const eyeSize = size * 0.3;
                
                // Левый глаз
                const leftEyeX = seg.x + Math.cos(snake.angle - 0.4) * eyeOffset;
                const leftEyeY = seg.y + Math.sin(snake.angle - 0.4) * eyeOffset;
                
                // Правый глаз
                const rightEyeX = seg.x + Math.cos(snake.angle + 0.4) * eyeOffset;
                const rightEyeY = seg.y + Math.sin(snake.angle + 0.4) * eyeOffset;

                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(leftEyeX, leftEyeY, eyeSize, 0, Math.PI * 2);
                ctx.arc(rightEyeX, rightEyeY, eyeSize, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#000';
                ctx.beginPath();
                ctx.arc(leftEyeX, leftEyeY, eyeSize * 0.5, 0, Math.PI * 2);
                ctx.arc(rightEyeX, rightEyeY, eyeSize * 0.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    function renderParticles() {
        for (const p of particles) {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // Глобальные функции для HTML
    window.startGame = startGame;
    window.pauseGame = pauseGame;
    window.resumeGame = resumeGame;
    window.quitToMenu = quitToMenu;
    window.showControls = showControls;

    // Запуск
    init();
})();
