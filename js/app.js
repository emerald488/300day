// ==================== КОНФИГУРАЦИЯ ====================

// Конфигурация приложения
const CONFIG = {
    TOTAL_DAYS: 300,
    PLANK_SECONDS_PER_DAY: 3, // 3 секунды прироста в день (итого: день 1 = 3 сек, день 60 = 180 сек = 3 мин)
    HISTORY_MAX_ENTRIES: 30,
    TOTAL_STORIES: 4,
    UPDATE_CHECK_INTERVAL_MS: 60 * 60 * 1000
};

// ==================== HELPER ФУНКЦИИ ====================

// Навигация между страницами
function navigateTo(page) {
    const pageId = page + 'Page';
    const targetPage = document.getElementById(pageId);

    if (!targetPage) return;

    // Проверяем, уже ли мы на этой странице
    const isAlreadyActive = targetPage.classList.contains('active');

    // Если уже на этой странице, ничего не делаем
    if (isAlreadyActive) return;

    // Используем requestAnimationFrame для синхронизации с render cycle
    requestAnimationFrame(() => {
        // Скрываем все страницы, КРОМЕ целевой (чтобы избежать мигания)
        document.querySelectorAll('.page').forEach(p => {
            if (p !== targetPage) {
                p.classList.remove('active');
            }
        });

        // Показываем нужную страницу
        targetPage.classList.add('active');

        // Обновляем активную кнопку меню
        const navButtons = document.querySelectorAll('.nav-item');
        const buttonIndex = { 'home': 0, 'stats': 1, 'history': 2, 'settings': 3 };

        navButtons.forEach((btn, index) => {
            if (index === buttonIndex[page]) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Сбрасываем скролл ПОСЛЕ переключения страниц
        window.scrollTo(0, 0);

        // Обновляем контент в следующем фрейме для плавности
        requestAnimationFrame(() => {
            if (page === 'home') {
                // Обновляем UI только при реальном переходе на главную
                checkIfDayCompleted();
            } else if (page === 'history') {
                renderHistory();
            } else if (page === 'stats') {
                // Рисуем графики при переходе на статистику
                if (typeof renderCharts === 'function') {
                    renderCharts();
                }
            }
        });
    });
}

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

// Регистрация Service Worker для PWA - АВТОМАТИЧЕСКОЕ ОБНОВЛЕНИЕ
// Версия SW: v40 - Удалены дефолтные значения из HTML
if ('serviceWorker' in navigator) {
    // Автоматическая перезагрузка при обновлении Service Worker
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
            refreshing = true;
            console.log('Service Worker обновлен, перезагружаем страницу...');
            window.location.reload();
        }
    });

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/300day/service-worker.js', { scope: '/300day/' })
            .then(registration => {
                console.log('Service Worker зарегистрирован (v40)');

                // Принудительная проверка обновлений при загрузке
                if (registration.waiting) {
                    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                }

                registration.update().catch(err => {
                    console.log('Ошибка при обновлении SW:', err);
                });

                // Проверка обновлений каждый час
                setInterval(() => {
                    registration.update().catch(err => {
                        console.log('Ошибка при обновлении SW:', err);
                    });
                }, CONFIG.UPDATE_CHECK_INTERVAL_MS);
            })
            .catch(error => {
                console.log('Ошибка регистрации Service Worker:', error);
            });
    });
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
    lastCompletedDate: null,
    lastActivityDate: null // Дата последней активности (для автосохранения)
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
        migrateOldData();          // СНАЧАЛА миграция данных со старой версии
        fixCorruptedDayCount();    // ПОТОМ исправление поврежденных данных
        checkForNewDay();          // И ТОЛЬКО ПОТОМ проверка нового дня
        // updateUI() убран - вызывается снаружи после loadData()
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

// Миграция данных со старой версии (v1.0.6 и ранее)
function migrateOldData() {
    // Проверяем флаг миграции
    const migrated = localStorage.getItem('migrated_v1.0.7');
    if (migrated) return; // Уже мигрировали

    const today = new Date().toDateString();

    // Если день завершен сегодня и currentDay > 1
    // значит это старые данные где день был увеличен сразу
    if (data.lastCompletedDate === today && data.currentDay > 1) {
        // Откатываем день назад
        data.currentDay--;

        // Обновляем цели на правильный день
        data.exercises.pushups.target = data.currentDay;
        data.exercises.squats.target = data.currentDay;
        data.exercises.pullups.target = data.currentDay;
        data.exercises.stairs.target = data.currentDay;
        data.exercises.plank.target = data.currentDay * CONFIG.PLANK_SECONDS_PER_DAY;

        saveData();
        console.log(`✅ Migrated from old version: corrected currentDay from ${data.currentDay + 1} to ${data.currentDay}`);
    }

    // Отмечаем что миграция выполнена
    localStorage.setItem('migrated_v1.0.7', 'true');
}

// Исправление поврежденного счетчика дней (из-за бага множественного увеличения)
function fixCorruptedDayCount() {
    const fixApplied = localStorage.getItem('day_count_fix_applied');
    if (fixApplied) return; // Уже исправлено

    // Вычислить правильный currentDay на основе истории
    if (data.history && data.history.length > 0) {
        const lastHistoryDay = Math.max(...data.history.map(h => h.day));
        const today = new Date().toDateString();

        // Если день уже завершен сегодня, остаемся на нем
        // Если нет - переходим к следующему
        const correctDay = (data.lastCompletedDate === today)
            ? lastHistoryDay
            : lastHistoryDay + 1;

        if (data.currentDay !== correctDay) {
            console.log(`✅ Исправление поврежденных данных: currentDay с ${data.currentDay} на ${correctDay}`);
            data.currentDay = correctDay;

            // Обновить цели
            data.exercises.pushups.target = data.currentDay;
            data.exercises.squats.target = data.currentDay;
            data.exercises.pullups.target = data.currentDay;
            data.exercises.stairs.target = data.currentDay;
            data.exercises.plank.target = data.currentDay * CONFIG.PLANK_SECONDS_PER_DAY;

            saveData();
        }
    }

    // Отмечаем что исправление выполнено
    localStorage.setItem('day_count_fix_applied', 'true');
}

// Проверка наступления нового дня
function checkForNewDay() {
    const today = new Date().toDateString();
    const lastTransitionDate = localStorage.getItem('lastDayTransitionDate');

    // Защита от множественного увеличения дня: проверяем, был ли переход УЖЕ в этот день
    if (lastTransitionDate === today) {
        return; // Уже обработали переход на сегодня
    }

    // Вычисляем вчерашний день
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    // АВТОСОХРАНЕНИЕ: Если вчера была активность, но день не завершили
    if (data.lastActivityDate === yesterdayStr &&
        data.lastCompletedDate !== yesterdayStr) {

        // Проверяем, был ли хоть какой-то прогресс
        const hasProgress = Object.values(data.exercises).some(ex => ex.current > 0);

        if (hasProgress) {
            // Автоматически сохраняем вчерашний день в историю
            const historyEntry = {
                day: data.currentDay,
                date: yesterday.toLocaleDateString('ru-RU'),
                exercises: JSON.parse(JSON.stringify(data.exercises)),
                autoCompleted: true // Помечаем как автозавершенный
            };
            data.history.unshift(historyEntry);

            // Обрезаем историю если превышен лимит
            if (data.history.length > CONFIG.HISTORY_MAX_ENTRIES) {
                data.history = data.history.slice(0, CONFIG.HISTORY_MAX_ENTRIES);
            }

            // Обновляем общую статистику
            for (let exercise in data.exercises) {
                data.totals[exercise] += data.exercises[exercise].current;
            }

            // Обновляем серию дней
            if (data.lastCompletedDate) {
                const lastDate = new Date(data.lastCompletedDate);
                const dayBeforeYesterday = new Date(yesterday);
                dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 1);

                if (lastDate.toDateString() === dayBeforeYesterday.toDateString()) {
                    data.streak++; // Продолжаем серию
                } else {
                    data.streak = 1; // Начинаем новую серию
                }
            } else {
                data.streak = 1; // Первый день
            }

            // Помечаем вчерашний день как завершенный
            data.lastCompletedDate = yesterdayStr;
        }
    }

    // ПЕРЕХОД НА НОВЫЙ ДЕНЬ: Только если вчера был завершен
    if (data.lastCompletedDate === yesterdayStr) {
        // Увеличиваем номер дня
        data.currentDay++;

        // Обновляем целевые значения для нового дня
        data.exercises.pushups.target = data.currentDay;
        data.exercises.squats.target = data.currentDay;
        data.exercises.pullups.target = data.currentDay;
        data.exercises.stairs.target = data.currentDay;
        data.exercises.plank.target = data.currentDay * CONFIG.PLANK_SECONDS_PER_DAY;

        // Сбрасываем текущий прогресс
        for (let exercise in data.exercises) {
            data.exercises[exercise].current = 0;
        }

        // Серия продолжается (день был завершен вчера)
        // Streak уже обновлен в completeDay или автосохранении
    } else {
        // День не был завершен вчера - сбрасываем серию
        data.streak = 0;
    }

    // Сохраняем флаг даты перехода
    localStorage.setItem('lastDayTransitionDate', today);
    saveData();
}

// Сохранение данных в localStorage
function saveData() {
    localStorage.setItem('challengeData', JSON.stringify(data));
}

// ==================== ОБНОВЛЕНИЕ UI ====================

// Обновление UI
function updateUI() {
    const today = new Date().toDateString();
    const isDayCompleted = data.lastCompletedDate === today;

    // Показываем контейнер (был скрыт для предотвращения мигания)
    const container = document.querySelector('.container');
    if (container) {
        container.style.opacity = '1';
    }

    // Отображаем номер дня с меткой "ЗАВЕРШЕН" если день выполнен
    if (isDayCompleted) {
        document.getElementById('dayCounter').innerHTML = `День ${data.currentDay} <span style="color: #4CAF50; font-size: 0.4em; display: block; margin-top: 10px;">✅ ЗАВЕРШЕН</span>`;
    } else {
        document.getElementById('dayCounter').textContent = `День ${data.currentDay}`;
    }

    // Отображаем текущую дату
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = new Date().toLocaleDateString('ru-RU', dateOptions);
    document.getElementById('currentDate').textContent = formattedDate;

    // Обновляем прогресс-бар дней
    // Если день завершен, показываем текущий день как завершенный
    // Если не завершен, показываем предыдущие завершенные дни
    const completedDays = isDayCompleted ? data.currentDay : data.currentDay - 1;
    const daysPercentage = calculatePercentage(completedDays, CONFIG.TOTAL_DAYS);
    document.getElementById('daysProgressBar').style.width = `${daysPercentage}%`;
    document.getElementById('daysProgressPercentage').textContent = `${daysPercentage}%`;
    document.getElementById('daysProgressText').textContent = `${completedDays} / ${CONFIG.TOTAL_DAYS} дней`;

    // Сначала определяем что показывать
    checkIfDayCompleted();

    // Обновляем упражнения только если день не завершен
    if (!isDayCompleted) {
        for (let exercise in data.exercises) {
            const ex = data.exercises[exercise];
            const percentage = Math.min((ex.current / ex.target) * 100, 100);

            if (exercise === 'plank') {
                document.getElementById(`${exercise}-progress`).textContent =
                    `${formatTime(ex.current)}/${formatTime(ex.target)}`;
            } else {
                document.getElementById(`${exercise}-progress`).textContent = `${ex.current}/${ex.target}`;
            }

            // Не обновляем прогресс-бар планки если таймер активен (он обновляется отдельно)
            if (exercise !== 'plank' || !plankInterval) {
                document.getElementById(`${exercise}-bar`).style.width = `${percentage}%`;
            }

            // Добавляем класс completed если цель достигнута
            const item = document.getElementById(`${exercise}-item`);
            if (ex.current >= ex.target) {
                item.classList.add('completed');
            } else {
                item.classList.remove('completed');
            }
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
    const homePage = document.getElementById('homePage');

    // Проверяем текущее состояние, чтобы избежать ненужных перерисовок
    const isCurrentlyShowingCompleted = messageElement.classList.contains('hidden') === false;

    // Обновляем только если состояние изменилось
    if (isDayCompleted && !isCurrentlyShowingCompleted) {
        // Показываем сообщение, скрываем упражнения и кнопку
        messageElement.classList.remove('hidden');
        exercisesContainer.classList.add('hidden');
        completeDayBtn.classList.add('hidden');
        homePage.classList.add('day-completed');
    } else if (!isDayCompleted && isCurrentlyShowingCompleted) {
        // Скрываем сообщение, показываем упражнения и кнопку
        messageElement.classList.add('hidden');
        exercisesContainer.classList.remove('hidden');
        exercisesContainer.style.opacity = '1'; // Плавно показываем
        completeDayBtn.classList.remove('hidden');
        completeDayBtn.style.opacity = '1'; // Плавно показываем
        homePage.classList.remove('day-completed');
    } else if (!isDayCompleted) {
        // Первая загрузка - показываем упражнения если день не завершен
        exercisesContainer.style.opacity = '1';
        completeDayBtn.style.opacity = '1';
    }
}

// ==================== ЛОГИКА УПРАЖНЕНИЙ ====================

// Добавление повторений
function addReps(exercise, amount) {
    data.exercises[exercise].current += amount;
    data.lastActivityDate = new Date().toDateString(); // Отмечаем активность
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

        // Специальная обработка для планки
        if (exercise === 'plank') {
            plankStartTime = 0;
            document.getElementById('plank-timer').textContent = '0:00.00';
        }

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

    // Убираем CSS transition для плавного обновления
    const plankBar = document.getElementById('plank-bar');
    plankBar.classList.add('no-transition');

    plankInterval = setInterval(() => {
        const elapsedMs = Date.now() - plankStartTime;
        const elapsedSec = Math.floor(elapsedMs / 1000);
        data.exercises.plank.current = elapsedSec;

        // Отображаем время с миллисекундами
        document.getElementById('plank-timer').textContent = formatTimeWithMs(elapsedMs);

        // Обновляем прогресс-бар планки каждые 10мс для плавности
        // Конвертируем миллисекунды в секунды (с дробной частью) и делим на target
        const elapsedSecWithMs = elapsedMs / 1000;
        const plankPercentage = Math.min((elapsedSecWithMs / data.exercises.plank.target) * 100, 100);
        plankBar.style.width = `${plankPercentage}%`;

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

        // Возвращаем CSS transition обратно
        document.getElementById('plank-bar').classList.remove('no-transition');
    }
}

function addPlankSeconds(seconds) {
    data.exercises.plank.current += seconds;
    data.lastActivityDate = new Date().toDateString(); // Отмечаем активность
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

    // 6. НЕ переходим к следующему дню сразу - он начнется автоматически завтра
    // Просто отмечаем текущий день как завершенный

    // 7. Сброс текущего прогресса (чтобы пользователь не мог добавлять еще)
    for (let exercise in data.exercises) {
        data.exercises[exercise].current = 0;
    }
    document.getElementById('plank-timer').textContent = '0:00.00';

    // 8. Сохранение и обновление UI
    celebrate('🎉');
    saveData();
    updateUI();

    // 9. Уведомление в Telegram (отправляем текущий день, а не -1)
    sendDayCompletedNotification(data.currentDay, historyEntry);
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

    // Расчет среднего значения на основе завершенных дней
    const completedDays = data.history.length;

    if (completedDays > 0) {
        const avgPushups = Math.round(data.totals.pushups / completedDays);
        const avgSquats = Math.round(data.totals.squats / completedDays);
        const avgPullups = Math.round(data.totals.pullups / completedDays);
        const avgStairs = Math.round(data.totals.stairs / completedDays);
        const avgPlank = Math.round(data.totals.plank / completedDays);

        document.getElementById('avg-pushups').textContent = avgPushups;
        document.getElementById('avg-squats').textContent = avgSquats;
        document.getElementById('avg-pullups').textContent = avgPullups;
        document.getElementById('avg-stairs').textContent = avgStairs;
        document.getElementById('avg-plank').textContent = formatTime(avgPlank);
    } else {
        document.getElementById('avg-pushups').textContent = '0';
        document.getElementById('avg-squats').textContent = '0';
        document.getElementById('avg-pullups').textContent = '0';
        document.getElementById('avg-stairs').textContent = '0';
        document.getElementById('avg-plank').textContent = '0:00';
    }
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

// Переключение панели настроек (теперь просто переход на страницу)
function toggleSettings() {
    navigateTo('settings');
}

// Закрытие настроек при клике на затемненную область (устаревшая функция, оставлена для совместимости)
function closeSettingsOnOverlay(event) {
    // Функция больше не используется, так как настройки теперь отдельная страница
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

// Принудительное обновление приложения
async function forceUpdateApp() {
    if (!confirm('🔄 Обновить приложение до последней версии?\n\nБудет очищен кэш и перезагружена страница. Данные тренировок сохранятся.')) {
        return;
    }

    try {
        // Очищаем все кэши
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
            console.log('Кэши очищены');
        }

        // Удаляем все Service Workers
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(registration => registration.unregister()));
            console.log('Service Workers удалены');
        }

        // Показываем сообщение и перезагружаем страницу с очисткой кэша
        alert('✅ Приложение будет обновлено!\n\nСтраница сейчас перезагрузится.');

        // Перезагружаем с полной очисткой кэша
        window.location.reload(true);
    } catch (error) {
        console.error('Ошибка при обновлении:', error);
        alert('❌ Произошла ошибка при обновлении. Попробуйте перезагрузить страницу вручную.');
    }
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
    const modal = document.getElementById('telegramSetupOverlay');
    modal.classList.toggle('modal-open');
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
    const statusText = document.getElementById('telegramStatusText');

    if (telegramSettings.enabled && telegramSettings.botToken && telegramSettings.chatId) {
        statusDisplay.style.background = '#1b5e20';
        statusDisplay.style.borderColor = '#4CAF50';
        statusText.textContent = '✅ Telegram подключен';
    } else {
        statusDisplay.style.background = '#424242';
        statusDisplay.style.borderColor = '#5a5a5a';
        statusText.textContent = 'Telegram не подключен';
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

// Отправка документа в Telegram
async function sendTelegramDocument(jsonData, filename, caption = '') {
    if (!telegramSettings.enabled || !telegramSettings.botToken || !telegramSettings.chatId) {
        return false;
    }

    const url = `https://api.telegram.org/bot${telegramSettings.botToken}/sendDocument`;

    try {
        // Создаем Blob из JSON данных
        const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });

        // Создаем FormData для отправки файла
        const formData = new FormData();
        formData.append('chat_id', telegramSettings.chatId);
        formData.append('document', blob, filename);
        if (caption) {
            formData.append('caption', caption);
            formData.append('parse_mode', 'HTML');
        }

        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        return result.ok;
    } catch (error) {
        console.error('Ошибка отправки документа в Telegram:', error);
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

    // Формируем сообщение с результатами
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

    // Отправляем текстовое сообщение
    await sendTelegramMessage(message);

    // Формируем имя файла с датой
    const date = new Date();
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const filename = `300-challenge-backup-day-${completedDay}-${dateStr}.json`;

    // Отправляем JSON файл с бэкапом данных
    await sendTelegramDocument(data, filename, `📦 Бэкап данных после дня ${completedDay}`);
}

// ==================== STORIES (ОНБОРДИНГ) ====================

let currentStoryIndex = 0;
const totalStories = CONFIG.TOTAL_STORIES;
const STORY_DURATION = 5000; // 5 секунд на сториз
let storyTimer = null;
let storyPaused = false;
let storyStartTime = 0;
let storyRemainingTime = STORY_DURATION;
let touchStartTime = 0;
const LONG_PRESS_THRESHOLD = 200; // миллисекунды для определения долгого нажатия

// Получить набор stories для текущего дня недели
function getTodayStorySet() {
    const dayOfWeek = new Date().getDay(); // 0-6 (Воскресенье=0, Понедельник=1, ..., Суббота=6)
    return STORIES_DATA[dayOfWeek];
}

// Рендеринг контента stories из данных
function renderStoryContent() {
    const todayStories = getTodayStorySet();

    todayStories.forEach((story, index) => {
        const storyElement = document.getElementById(`story-${index}`);

        // Всегда показываем кнопку на последней (4-й) story
        const buttonHtml = (index === 3)
            ? '<button class="story-btn primary" id="startChallengeBtn" onclick="finishStories()" style="margin-top: 30px;">Начать челлендж</button>'
            : '';

        storyElement.innerHTML = `
            <div>
                <div class="story-emoji">${story.emoji}</div>
                <div class="story-title">${story.title}</div>
                <div class="story-description">${story.text}</div>
                ${buttonHtml}
            </div>
        `;
    });

    // Обновить текст кнопки в зависимости от дня челленджа
    updateStartButton();
}

// Проверка, показывали ли уже сториз
// Возвращает true если stories показываются, false если нет
function checkStoriesShown() {
    const today = new Date().toDateString();

    // Если сториз не показывались сегодня, показать их
    if (lastStoriesShownDate !== today) {
        showStories();
        return true; // Stories показываются
    }

    return false; // Stories не показываются
}

// Показать сториз
function showStories() {
    // Рендерим контент stories для сегодняшнего дня недели
    renderStoryContent();

    document.getElementById('storiesOverlay').classList.remove('hidden');
    document.body.classList.add('stories-open');

    // Сбросить все состояния перед началом
    for (let i = 0; i < totalStories; i++) {
        document.getElementById(`progress-${i}`).classList.remove('active', 'completed');
        document.getElementById(`story-${i}`).classList.remove('active');
    }

    // Установить первую историю как активную
    currentStoryIndex = 0;

    // Добавляем класс active с небольшой задержкой для корректного запуска CSS-анимации
    const firstProgress = document.getElementById('progress-0');
    void firstProgress.offsetWidth; // Триггер reflow
    firstProgress.classList.add('active');

    document.getElementById('story-0').classList.add('active');

    updateStoryUI();
    updateStartButton();

    // Сброс времени перед запуском
    storyRemainingTime = STORY_DURATION;
    storyPaused = false;
    startStoryTimer();
}

// Запустить таймер для автоматического перелистывания
function startStoryTimer() {
    // Очистить предыдущий таймер, если есть
    if (storyTimer) {
        clearTimeout(storyTimer);
    }

    // Запустить таймер на оставшееся время
    storyStartTime = Date.now();
    storyTimer = setTimeout(() => {
        nextStory();
    }, storyRemainingTime);
}

// Остановить таймер
function stopStoryTimer() {
    if (storyTimer) {
        clearTimeout(storyTimer);
        storyTimer = null;
    }
}

// Поставить сториз на паузу (при зажатии)
function pauseStory(event) {
    // Предотвратить двойное срабатывание touch и mouse событий
    if (event && event.type === 'touchstart') {
        event.preventDefault();
    }

    // Запомнить время начала нажатия
    touchStartTime = Date.now();

    if (storyPaused) return;

    storyPaused = true;

    // Рассчитать оставшееся время
    const elapsed = Date.now() - storyStartTime;
    storyRemainingTime = Math.max(0, storyRemainingTime - elapsed);

    // Остановить таймер
    stopStoryTimer();

    // Остановить анимацию прогресс-бара
    const activeProgress = document.getElementById(`progress-${currentStoryIndex}`);
    if (activeProgress) {
        activeProgress.classList.add('paused');
    }
}

// Возобновить сториз (при отпускании)
function resumeStory(event) {
    if (!storyPaused) return;

    storyPaused = false;

    // Убрать паузу с анимации
    const activeProgress = document.getElementById(`progress-${currentStoryIndex}`);
    if (activeProgress) {
        activeProgress.classList.remove('paused');
    }

    // Возобновить таймер с оставшимся временем
    startStoryTimer();
}

// Проверка, было ли долгое нажатие
function wasLongPress() {
    // Если touchStartTime = 0, значит не было касания вообще (автоматическое переключение)
    if (touchStartTime === 0) {
        return false;
    }
    const pressDuration = Date.now() - touchStartTime;
    return pressDuration >= LONG_PRESS_THRESHOLD;
}

// Следующая история
function nextStory() {
    // Если было долгое нажатие (пауза), не переключать
    if (wasLongPress()) {
        touchStartTime = 0; // Сбросить
        return;
    }

    if (currentStoryIndex < totalStories - 1) {
        // Отметить текущую как завершенную
        const currentProgress = document.getElementById(`progress-${currentStoryIndex}`);
        currentProgress.classList.remove('active', 'paused');
        currentProgress.classList.add('completed');
        document.getElementById(`story-${currentStoryIndex}`).classList.remove('active');

        currentStoryIndex++;

        // Показать следующую
        const nextProgress = document.getElementById(`progress-${currentStoryIndex}`);

        // Сбросить анимацию: убираем класс, принудительно перерисовываем, добавляем обратно
        nextProgress.classList.remove('active');
        void nextProgress.offsetWidth; // Триггер reflow для перезапуска анимации
        nextProgress.classList.add('active');

        document.getElementById(`story-${currentStoryIndex}`).classList.add('active');

        updateStoryUI();

        // Сбросить таймер для новой истории
        storyRemainingTime = STORY_DURATION;
        storyPaused = false;
        touchStartTime = 0;

        // Запускаем таймер для всех историй, включая последнюю
        startStoryTimer();
    } else {
        // Достигли конца всех историй - закрываем сториз
        finishStories();
    }
}

// Предыдущая история
function previousStory() {
    // Если было долгое нажатие (пауза), не переключать
    if (wasLongPress()) {
        touchStartTime = 0; // Сбросить
        return;
    }

    if (currentStoryIndex > 0) {
        // Убрать активность с текущей
        document.getElementById(`progress-${currentStoryIndex}`).classList.remove('active', 'completed', 'paused');
        document.getElementById(`story-${currentStoryIndex}`).classList.remove('active');

        currentStoryIndex--;

        // Вернуться к предыдущей
        const prevProgress = document.getElementById(`progress-${currentStoryIndex}`);
        prevProgress.classList.remove('completed');

        // Сбросить анимацию: убираем класс, принудительно перерисовываем, добавляем обратно
        prevProgress.classList.remove('active');
        void prevProgress.offsetWidth; // Триггер reflow для перезапуска анимации
        prevProgress.classList.add('active');

        document.getElementById(`story-${currentStoryIndex}`).classList.add('active');

        updateStoryUI();

        // Сбросить таймер для новой истории
        storyRemainingTime = STORY_DURATION;
        storyPaused = false;
        touchStartTime = 0;
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

    // Сохранить дату показа сториз
    const today = new Date().toDateString();
    lastStoriesShownDate = today;
    localStorage.setItem('lastStoriesShownDate', today);

    // Сбросить индекс (очистка состояния произойдет при следующем открытии)
    currentStoryIndex = 0;

    // Отрисовываем UI после закрытия stories
    updateUI();
}

// ==================== РОТАЦИЯ ПОДЗАГОЛОВКОВ ====================

// Массив мотивирующих подзаголовков
const ROTATING_SUBTITLES = [
    'Путь к легенде начинается здесь',
    'От простого движения к абсолютной силе',
    'Маленькие шаги каждый день — невероятный результат',
    'Дисциплина побеждает мотивацию',
    'Ритм сильнее мотивации',
    'Марафон, не спринт',
    'Привычка важнее идеала',
    'Каждый день чуть больше — уже победа',
    'Победа = выполненный день',
    'Ты строишь фундамент своей силы',
    'Лучше меньше, но каждый день',
    'Трансформация через регулярность',
    'Твоё тело преодолеет любой барьер',
    'Сегодня ты сильнее, чем вчера',
    'Один день — один шаг к цели'
];

let currentSubtitleIndex = 0;
let subtitleRotationTimer = null;

// Функция смены подзаголовка с плавной анимацией
function rotateSubtitle() {
    const subtitleElement = document.getElementById('rotatingSubtitle');
    if (!subtitleElement) return;

    // Плавное исчезновение
    subtitleElement.style.opacity = '0';

    // Через 500мс (время fade-out) меняем текст и показываем
    setTimeout(() => {
        currentSubtitleIndex = (currentSubtitleIndex + 1) % ROTATING_SUBTITLES.length;
        subtitleElement.textContent = ROTATING_SUBTITLES[currentSubtitleIndex];
        subtitleElement.style.opacity = '0.85';
    }, 500);
}

// Запуск ротации подзаголовков
function startSubtitleRotation() {
    // Останавливаем предыдущий таймер, если есть
    if (subtitleRotationTimer) {
        clearInterval(subtitleRotationTimer);
    }

    // Случайный начальный подзаголовок
    currentSubtitleIndex = Math.floor(Math.random() * ROTATING_SUBTITLES.length);
    const subtitleElement = document.getElementById('rotatingSubtitle');
    if (subtitleElement) {
        subtitleElement.textContent = ROTATING_SUBTITLES[currentSubtitleIndex];
    }

    // Меняем подзаголовок каждые 8 секунд
    subtitleRotationTimer = setInterval(rotateSubtitle, 8000);
}

// Остановка ротации (при необходимости)
function stopSubtitleRotation() {
    if (subtitleRotationTimer) {
        clearInterval(subtitleRotationTimer);
        subtitleRotationTimer = null;
    }
}

// ==================== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ====================

// Фиксируем высоту viewport для мобильных устройств (исправление для Android)
function setVhVariable() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}

// Вызываем при загрузке и изменении размера
setVhVariable();
window.addEventListener('resize', setVhVariable);
window.addEventListener('orientationchange', setVhVariable);

// Инициализация при загрузке DOM (до загрузки всех ресурсов)
document.addEventListener('DOMContentLoaded', () => {
    // ЭТАП 1: Загружаем и обрабатываем данные (БЕЗ отрисовки)
    loadData();

    // ЭТАП 2: Проверяем нужно ли показать stories (ДО отрисовки UI!)
    // Если stories показываются - основной UI скрыт
    const shouldShowStories = checkStoriesShown();

    // ЭТАП 3: Рисуем UI только если stories НЕ показываются
    // (если stories активны, UI отрисуется после их закрытия)
    if (!shouldShowStories) {
        updateUI();
    }

    // Инициализируем адаптивность графиков
    if (typeof initChartsResize === 'function') {
        initChartsResize();
    }

    // Устанавливаем правильную высоту viewport
    setVhVariable();

    // Запускаем ротацию подзаголовков
    startSubtitleRotation();
});

// Остановка таймера при закрытии страницы
window.addEventListener('beforeunload', () => {
    stopPlankTimer();
});
