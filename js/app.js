// ==================== КОНФИГУРАЦИЯ ====================

// Конфигурация приложения
const CONFIG = {
    TOTAL_DAYS: 300,
    PLANK_SECONDS_PER_DAY: 3,
    HISTORY_MAX_ENTRIES: 30,
    TOTAL_STORIES: 4,
    UPDATE_CHECK_INTERVAL_MS: 60 * 60 * 1000
};

// ==================== HELPER ФУНКЦИИ ====================

// Форматирование секунд в MM:SS (без миллисекунд)
function formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

// Форматирование миллисекунд в MM:SS.MS
function formatTimeWithMs(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const ms = Math.floor((milliseconds % 1000) / 10); // Две цифры миллисекунд
    const min = Math.floor(totalSeconds / 60);
    const sec = totalSeconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

// Расчет процента выполнения
function calculatePercentage(current, target, decimals = 1) {
    const percentage = (current / target) * 100;
    return Math.min(percentage, 100).toFixed(decimals);
}

// Переключение видимости панели
function togglePanel(elementId, hideOtherIds = []) {
    const element = document.getElementById(elementId);
    element.classList.toggle('hidden');

    hideOtherIds.forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
}

// ==================== PWA / SERVICE WORKER ====================

// Регистрация Service Worker для PWA
let newWorker;

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => {
                console.log('Service Worker зарегистрирован:', registration);

                // Проверка обновлений каждый час
                setInterval(() => {
                    registration.update();
                }, CONFIG.UPDATE_CHECK_INTERVAL_MS);

                // Обработка обновления
                registration.addEventListener('updatefound', () => {
                    newWorker = registration.installing;

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // Новая версия доступна!
                            showUpdateNotification();
                        }
                    });
                });
            })
            .catch(error => {
                console.log('Ошибка регистрации Service Worker:', error);
            });

        // Обработка сообщений от Service Worker
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                refreshing = true;
                window.location.reload();
            }
        });
    });
}

// Показ уведомления об обновлении
function showUpdateNotification() {
    document.getElementById('updateNotification').classList.remove('hidden');
}

// Применение обновления
function updateApp() {
    if (newWorker) {
        newWorker.postMessage({ action: 'skipWaiting' });
    }
}

// ==================== ИНИЦИАЛИЗАЦИЯ ДАННЫХ ====================

// Инициализация данных
let data = {
    currentDay: 1,
    exercises: {
        pushups: { current: 0, target: 1 },
        squats: { current: 0, target: 1 },
        pullups: { current: 0, target: 1 },
        stairs: { current: 0, target: 1 },
        plank: { current: 0, target: 3 } // секунды
    },
    history: [],
    totals: {
        pushups: 0,
        squats: 0,
        pullups: 0,
        stairs: 0,
        plank: 0
    },
    streak: 0,
    lastCompletedDate: null
};

// ==================== НАСТРОЙКИ И СОСТОЯНИЕ ====================

// Настройки Telegram
let telegramSettings = {
    botToken: '',
    chatId: '',
    enabled: false
};

// Таймер для планки
let plankInterval = null;
let plankStartTime = 0;

// Дата последнего показа сториз
let lastStoriesShownDate = null;

// ==================== РАБОТА С ДАННЫМИ ====================

// Загрузка данных из localStorage
function loadData() {
    const saved = localStorage.getItem('challengeData');
    if (saved) {
        data = JSON.parse(saved);
        updateUI();
    }

    const savedTelegram = localStorage.getItem('telegramSettings');
    if (savedTelegram) {
        telegramSettings = JSON.parse(savedTelegram);
        updateTelegramStatus();
    }

    const savedStoriesDate = localStorage.getItem('lastStoriesShownDate');
    if (savedStoriesDate) {
        lastStoriesShownDate = savedStoriesDate;
    }
}

// Сохранение данных в localStorage
function saveData() {
    localStorage.setItem('challengeData', JSON.stringify(data));
}

// ==================== ОБНОВЛЕНИЕ UI ====================

// Обновление UI
function updateUI() {
    document.getElementById('dayCounter').textContent = `День ${data.currentDay}`;

    // Обновляем прогресс-бар дней
    const daysPercentage = calculatePercentage(data.currentDay - 1, CONFIG.TOTAL_DAYS);
    document.getElementById('daysProgressBar').style.width = `${daysPercentage}%`;
    document.getElementById('daysProgressPercentage').textContent = `${daysPercentage}%`;
    document.getElementById('daysProgressText').textContent = `${data.currentDay} / ${CONFIG.TOTAL_DAYS} дней`;

    // Проверяем, выполнена ли сегодняшняя тренировка
    checkIfDayCompleted();

    for (let exercise in data.exercises) {
        const ex = data.exercises[exercise];
        const percentage = Math.min((ex.current / ex.target) * 100, 100);

        if (exercise === 'plank') {
            document.getElementById(`${exercise}-progress`).textContent =
                `${formatTime(ex.current)}/${formatTime(ex.target)}`;
        } else {
            document.getElementById(`${exercise}-progress`).textContent = `${ex.current}/${ex.target}`;
        }

        document.getElementById(`${exercise}-bar`).style.width = `${percentage}%`;

        // Добавляем класс completed если цель достигнута
        const item = document.getElementById(`${exercise}-item`);
        if (ex.current >= ex.target) {
            item.classList.add('completed');
        } else {
            item.classList.remove('completed');
        }
    }

    updateStats();
}

// Проверка, выполнена ли сегодняшняя тренировка
function checkIfDayCompleted() {
    const today = new Date().toDateString();
    const isDayCompleted = data.lastCompletedDate === today;

    const messageElement = document.getElementById('dayCompletedMessage');
    const exercisesContainer = document.getElementById('exercisesContainer');
    const completeDayBtn = document.getElementById('completeDayBtn');

    if (isDayCompleted) {
        // Показываем сообщение, скрываем упражнения и кнопку
        messageElement.classList.remove('hidden');
        exercisesContainer.classList.add('hidden');
        completeDayBtn.classList.add('hidden');
    } else {
        // Скрываем сообщение, показываем упражнения и кнопку
        messageElement.classList.add('hidden');
        exercisesContainer.classList.remove('hidden');
        completeDayBtn.classList.remove('hidden');
    }
}

// ==================== ЛОГИКА УПРАЖНЕНИЙ ====================

// Добавление повторений
function addReps(exercise, amount) {
    data.exercises[exercise].current += amount;
    if (data.exercises[exercise].current > data.exercises[exercise].target) {
        celebrate();
    }
    saveData();
    updateUI();
}

// Сброс упражнения
function resetExercise(exercise) {
    if (confirm(`Сбросить прогресс для этого упражнения?`)) {
        data.exercises[exercise].current = 0;
        saveData();
        updateUI();
    }
}

// ==================== ТАЙМЕР ПЛАНКИ ====================

// Таймер планки
function startPlankTimer() {
    if (plankInterval) return;

    plankStartTime = Date.now() - (data.exercises.plank.current * 1000);
    document.getElementById('plank-start').classList.add('hidden');
    document.getElementById('plank-stop').classList.remove('hidden');

    plankInterval = setInterval(() => {
        const elapsedMs = Date.now() - plankStartTime;
        const elapsedSec = Math.floor(elapsedMs / 1000);
        data.exercises.plank.current = elapsedSec;

        // Отображаем время с миллисекундами
        document.getElementById('plank-timer').textContent = formatTimeWithMs(elapsedMs);

        // Сохраняем данные каждую секунду, а не каждые 10мс
        if (elapsedMs % 1000 < 10) {
            saveData();
            updateUI();
        }
    }, 10); // Обновляем каждые 10 миллисекунд
}

function stopPlankTimer() {
    if (plankInterval) {
        clearInterval(plankInterval);
        plankInterval = null;
        document.getElementById('plank-start').classList.remove('hidden');
        document.getElementById('plank-stop').classList.add('hidden');
    }
}

function addPlankSeconds(seconds) {
    data.exercises.plank.current += seconds;
    document.getElementById('plank-timer').textContent = formatTimeWithMs(data.exercises.plank.current * 1000);
    saveData();
    updateUI();
}

// ==================== ЗАВЕРШЕНИЕ ДНЯ ====================

// Завершение дня
function completeDay() {
    // 1. Проверка, не был ли сегодня уже выполнен день
    const today = new Date().toDateString();
    if (data.lastCompletedDate === today) {
        // Не должно случиться, так как кнопка скрыта, но на всякий случай
        return;
    }

    // 2. Валидация выполнения всех упражнений
    const allCompleted = Object.values(data.exercises).every(
        ex => ex.current >= ex.target
    );

    if (!allCompleted) {
        if (!confirm('Не все упражнения выполнены! Все равно перейти к следующему дню?')) {
            return;
        }
    }

    stopPlankTimer();

    // 3. Сохранение истории
    const historyEntry = {
        day: data.currentDay,
        date: new Date().toLocaleDateString('ru-RU'),
        exercises: JSON.parse(JSON.stringify(data.exercises))
    };
    data.history.unshift(historyEntry);
    if (data.history.length > CONFIG.HISTORY_MAX_ENTRIES) {
        data.history = data.history.slice(0, CONFIG.HISTORY_MAX_ENTRIES);
    }

    // 4. Обновление общей статистики
    for (let exercise in data.exercises) {
        data.totals[exercise] += data.exercises[exercise].current;
    }

    // 5. Обновление серии дней
    if (data.lastCompletedDate) {
        const lastDate = new Date(data.lastCompletedDate);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (lastDate.toDateString() === yesterday.toDateString()) {
            data.streak++;
        } else if (lastDate.toDateString() === today) {
            // Серия не меняется
        } else {
            data.streak = 1;
        }
    } else {
        data.streak = 1;
    }
    data.lastCompletedDate = today;

    // 6. Переход к следующему дню
    data.currentDay++;

    // 7. Обновление целевых значений
    data.exercises.pushups.target = data.currentDay;
    data.exercises.squats.target = data.currentDay;
    data.exercises.pullups.target = data.currentDay;
    data.exercises.stairs.target = data.currentDay;
    data.exercises.plank.target = data.currentDay * CONFIG.PLANK_SECONDS_PER_DAY;

    // 8. Сброс текущего прогресса
    for (let exercise in data.exercises) {
        data.exercises[exercise].current = 0;
    }
    document.getElementById('plank-timer').textContent = '0:00.00';

    // 9. Сохранение и обновление UI
    celebrate('🎉');
    saveData();
    updateUI();

    // 10. Уведомление в Telegram
    sendDayCompletedNotification(data.currentDay - 1, historyEntry);
}

// Анимация празднования
function celebrate(emoji = '💪') {
    const celebration = document.createElement('div');
    celebration.className = 'celebration';
    celebration.textContent = emoji;
    document.body.appendChild(celebration);

    setTimeout(() => {
        celebration.remove();
    }, 1000);
}

// ==================== СТАТИСТИКА И ИСТОРИЯ ====================

// Обновление статистики
function updateStats() {
    document.getElementById('total-pushups').textContent = data.totals.pushups;
    document.getElementById('total-squats').textContent = data.totals.squats;
    document.getElementById('total-pullups').textContent = data.totals.pullups;
    document.getElementById('total-stairs').textContent = data.totals.stairs;

    document.getElementById('total-plank').textContent = `${formatTime(data.totals.plank)} мин`;

    document.getElementById('streak').textContent = data.streak;
}

// Переключение статистики
function toggleStats() {
    togglePanel('stats', ['history']);
}

// Переключение истории
function toggleHistory() {
    const historyDiv = document.getElementById('history');
    togglePanel('history', ['stats']);

    if (!historyDiv.classList.contains('hidden')) {
        renderHistory();
    }
}

// ==================== НАСТРОЙКИ ====================

// Переключение панели настроек
function toggleSettings() {
    togglePanel('settingsOverlay');
}

// Закрытие настроек при клике на затемненную область
function closeSettingsOnOverlay(event) {
    if (event.target === event.currentTarget) {
        toggleSettings();
    }
}

// Отрисовка истории
function renderHistory() {
    const content = document.getElementById('history-content');
    if (data.history.length === 0) {
        content.innerHTML = '<p style="text-align: center; opacity: 0.7;">История пока пуста</p>';
        return;
    }

    content.innerHTML = data.history.map(entry => {
        return `
            <div class="history-item">
                <div style="font-weight: bold; margin-bottom: 14px; font-size: 1em;">
                    День ${entry.day} - ${entry.date}
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; font-size: 0.9em; line-height: 1.5;">
                    <div>Отжимания: ${entry.exercises.pushups.current}/${entry.exercises.pushups.target}</div>
                    <div>Приседания: ${entry.exercises.squats.current}/${entry.exercises.squats.target}</div>
                    <div>Подтягивания: ${entry.exercises.pullups.current}/${entry.exercises.pullups.target}</div>
                    <div>Лестница: ${entry.exercises.stairs.current}/${entry.exercises.stairs.target}</div>
                    <div style="grid-column: 1 / -1;">Планка: ${formatTime(entry.exercises.plank.current)}/${formatTime(entry.exercises.plank.target)}</div>
                </div>
            </div>
        `;
    }).join('');
}

// Полный сброс
function resetAll() {
    if (confirm('⚠️ ВНИМАНИЕ! Это удалит ВСЕ данные включая историю и статистику. Продолжить?')) {
        if (confirm('Вы уверены? Это действие нельзя отменить!')) {
            localStorage.removeItem('challengeData');
            location.reload();
        }
    }
}

// Экспорт данных
function exportData() {
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;

    const date = new Date().toISOString().split('T')[0];
    link.download = `300-challenge-backup-${date}.json`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toggleSettings();
    alert('✅ Данные экспортированы! Файл сохранен в Downloads.');
}

// Импорт данных
function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);

            // Проверяем что это правильный формат данных
            if (!importedData.currentDay || !importedData.exercises) {
                alert('❌ Ошибка: Неверный формат файла!');
                return;
            }

            if (confirm('⚠️ ВНИМАНИЕ! Это заменит все текущие данные. Продолжить?')) {
                data = importedData;
                saveData();
                updateUI();
                toggleSettings();
                alert('✅ Данные успешно импортированы!');

                // Останавливаем таймер планки если он был запущен
                stopPlankTimer();

                // Обновляем таймер планки
                const plankCurrent = data.exercises.plank.current;
                document.getElementById('plank-timer').textContent = formatTimeWithMs(plankCurrent * 1000);
            }
        } catch (error) {
            alert('❌ Ошибка при чтении файла: ' + error.message);
        }
    };

    reader.readAsText(file);

    // Сбрасываем input чтобы можно было загрузить тот же файл снова
    event.target.value = '';
}

// ==================== TELEGRAM ИНТЕГРАЦИЯ ====================

// Открытие панели настройки Telegram
function openTelegramSetup() {
    toggleSettings(); // Закрываем настройки
    toggleTelegramSetup(); // Открываем Telegram настройки

    // Заполняем поля если данные уже есть
    if (telegramSettings.botToken) {
        document.getElementById('botToken').value = telegramSettings.botToken;
    }
    if (telegramSettings.chatId) {
        document.getElementById('chatId').value = telegramSettings.chatId;
    }
}

// Переключение панели Telegram
function toggleTelegramSetup() {
    togglePanel('telegramSetupOverlay');
}

// Закрытие при клике на затемненную область
function closeTelegramSetupOnOverlay(event) {
    if (event.target === event.currentTarget) {
        toggleTelegramSetup();
    }
}

// Обновление статуса подключения
function updateTelegramStatus() {
    const statusDisplay = document.getElementById('telegramStatusDisplay');
    if (telegramSettings.enabled && telegramSettings.botToken && telegramSettings.chatId) {
        statusDisplay.className = 'telegram-status connected';
        statusDisplay.textContent = '✅ Telegram подключен';
    } else {
        statusDisplay.className = 'telegram-status disconnected';
        statusDisplay.textContent = 'Telegram не подключен';
    }
}

// Отправка сообщения в Telegram
async function sendTelegramMessage(message) {
    if (!telegramSettings.enabled || !telegramSettings.botToken || !telegramSettings.chatId) {
        return false;
    }

    const url = `https://api.telegram.org/bot${telegramSettings.botToken}/sendMessage`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: telegramSettings.chatId,
                text: message,
                parse_mode: 'HTML'
            })
        });

        const result = await response.json();
        return result.ok;
    } catch (error) {
        console.error('Ошибка отправки в Telegram:', error);
        return false;
    }
}

// Сохранение настроек Telegram
async function saveTelegramSettings() {
    const botToken = document.getElementById('botToken').value.trim();
    const chatId = document.getElementById('chatId').value.trim();

    if (!botToken || !chatId) {
        alert('❌ Пожалуйста, заполните оба поля!');
        return;
    }

    // Временно сохраняем настройки
    telegramSettings.botToken = botToken;
    telegramSettings.chatId = chatId;
    telegramSettings.enabled = true;

    // Проверяем подключение отправкой тестового сообщения
    const testMessage = '🎉 Telegram успешно подключен к 300 Day Challenge!\n\nТеперь ты будешь получать уведомления о своих тренировках.';

    const success = await sendTelegramMessage(testMessage);

    if (success) {
        localStorage.setItem('telegramSettings', JSON.stringify(telegramSettings));
        updateTelegramStatus();
        alert('✅ Telegram успешно подключен! Проверь свой Telegram, там должно быть тестовое сообщение.');
    } else {
        telegramSettings.enabled = false;
        alert('❌ Ошибка подключения! Проверь правильность токена и Chat ID.');
    }
}

// Отключение Telegram
function disconnectTelegram() {
    if (confirm('Отключить Telegram уведомления?')) {
        telegramSettings = {
            botToken: '',
            chatId: '',
            enabled: false
        };
        localStorage.removeItem('telegramSettings');
        document.getElementById('botToken').value = '';
        document.getElementById('chatId').value = '';
        updateTelegramStatus();
        alert('✅ Telegram отключен');
    }
}

// Отправка уведомления о завершении дня
async function sendDayCompletedNotification(completedDay, historyEntry) {
    if (!telegramSettings.enabled) return;

    const message = `🎉 <b>День ${completedDay} завершен!</b>

📅 Дата: ${historyEntry.date}

✅ <b>Результаты:</b>
💪 Отжимания: ${historyEntry.exercises.pushups.current}/${historyEntry.exercises.pushups.target}
🦵 Приседания: ${historyEntry.exercises.squats.current}/${historyEntry.exercises.squats.target}
🏋️ Подтягивания: ${historyEntry.exercises.pullups.current}/${historyEntry.exercises.pullups.target}
🏃 Лестница: ${historyEntry.exercises.stairs.current}/${historyEntry.exercises.stairs.target} пролетов
⏱️ Планка: ${formatTime(historyEntry.exercises.plank.current)}

🔥 Серия дней: ${data.streak}

💪 Продолжай в том же духе!`;

    await sendTelegramMessage(message);
}

// ==================== STORIES (ОНБОРДИНГ) ====================

let currentStoryIndex = 0;
const totalStories = CONFIG.TOTAL_STORIES;
const STORY_DURATION = 5000; // 5 секунд на сториз
let storyTimer = null;

// Проверка, показывали ли уже сториз
function checkStoriesShown() {
    const today = new Date().toDateString();

    // Если сториз не показывались сегодня, показать их
    if (lastStoriesShownDate !== today) {
        showStories();
    } else {
        // Если сториз уже показывались, сразу показать основной контент
        document.body.classList.add('app-loaded');
    }
}

// Показать сториз
function showStories() {
    // Убрать класс app-loaded, чтобы скрыть основной контент
    document.body.classList.remove('app-loaded');

    document.getElementById('storiesOverlay').classList.remove('hidden');
    document.body.classList.add('stories-open');

    // Сбросить все состояния перед началом
    for (let i = 0; i < totalStories; i++) {
        document.getElementById(`progress-${i}`).classList.remove('active', 'completed');
        document.getElementById(`story-${i}`).classList.remove('active');
    }

    // Установить первую историю как активную
    currentStoryIndex = 0;
    document.getElementById('progress-0').classList.add('active');
    document.getElementById('story-0').classList.add('active');

    updateStoryUI();
    updateStartButton();
    startStoryTimer();
}

// Запустить таймер для автоматического перелистывания
function startStoryTimer() {
    // Очистить предыдущий таймер, если есть
    if (storyTimer) {
        clearTimeout(storyTimer);
    }

    // Запустить таймер на STORY_DURATION миллисекунд
    storyTimer = setTimeout(() => {
        nextStory();
    }, STORY_DURATION);
}

// Остановить таймер
function stopStoryTimer() {
    if (storyTimer) {
        clearTimeout(storyTimer);
        storyTimer = null;
    }
}

// Следующая история
function nextStory() {
    if (currentStoryIndex < totalStories - 1) {
        // Отметить текущую как завершенную
        document.getElementById(`progress-${currentStoryIndex}`).classList.remove('active');
        document.getElementById(`progress-${currentStoryIndex}`).classList.add('completed');
        document.getElementById(`story-${currentStoryIndex}`).classList.remove('active');

        currentStoryIndex++;

        // Показать следующую
        document.getElementById(`progress-${currentStoryIndex}`).classList.add('active');
        document.getElementById(`story-${currentStoryIndex}`).classList.add('active');

        updateStoryUI();

        // На последней истории НЕ запускаем автоматический таймер
        // чтобы дать пользователю время нажать кнопку
        if (currentStoryIndex < totalStories - 1) {
            startStoryTimer();
        }
    } else {
        // На последней истории - закрываем сториз
        finishStories();
    }
}

// Предыдущая история
function previousStory() {
    if (currentStoryIndex > 0) {
        // Убрать активность с текущей
        document.getElementById(`progress-${currentStoryIndex}`).classList.remove('active', 'completed');
        document.getElementById(`story-${currentStoryIndex}`).classList.remove('active');

        currentStoryIndex--;

        // Вернуться к предыдущей
        document.getElementById(`progress-${currentStoryIndex}`).classList.remove('completed');
        document.getElementById(`progress-${currentStoryIndex}`).classList.add('active');
        document.getElementById(`story-${currentStoryIndex}`).classList.add('active');

        updateStoryUI();
        startStoryTimer(); // Перезапустить таймер
    }
}

// Обновление UI сториз
function updateStoryUI() {
    // Функция оставлена для совместимости, но кнопки больше не используются
    // Навигация теперь осуществляется через tap zones
}

// Обновление текста кнопки старта на последней стории
function updateStartButton() {
    const startBtn = document.getElementById('startChallengeBtn');
    if (startBtn) {
        if (data.currentDay === 1) {
            startBtn.textContent = 'Начать челлендж';
        } else {
            startBtn.textContent = `Начать ${data.currentDay} день!`;
        }
    }
}

// Завершить показ сториз
function finishStories() {
    stopStoryTimer(); // Остановить таймер

    document.getElementById('storiesOverlay').classList.add('hidden');
    document.body.classList.remove('stories-open');

    // Показать основной контент
    document.body.classList.add('app-loaded');

    // Сохранить дату показа сториз
    const today = new Date().toDateString();
    lastStoriesShownDate = today;
    localStorage.setItem('lastStoriesShownDate', today);

    // Сбросить индекс (очистка состояния произойдет при следующем открытии)
    currentStoryIndex = 0;
}

// ==================== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ====================

// Инициализация при загрузке DOM (до загрузки всех ресурсов)
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    updateUI();
    checkStoriesShown();
});

// Остановка таймера при закрытии страницы
window.addEventListener('beforeunload', () => {
    stopPlankTimer();
});
