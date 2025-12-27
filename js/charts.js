// ==================== ГРАФИКИ НА CANVAS ====================
// Модуль для визуализации статистики без внешних библиотек

// Текущий выбранный период для графика прогресса
let currentChartPeriod = 'all';

// ==================== ЛИНЕЙНЫЙ ГРАФИК ПРОГРЕССА ====================

/**
 * Рисует линейный график прогресса упражнений за последние N дней
 * @param {string} canvasId - ID элемента canvas
 * @param {Array} historyData - массив истории из data.history
 * @param {number|string} maxDays - максимальное количество дней или 'all' для всей истории
 */
function drawProgressChart(canvasId, historyData, maxDays = 30) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Установка размеров с учетом device pixel ratio для четкости
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Очистка канваса
    ctx.clearRect(0, 0, width, height);

    // Если нет данных
    if (!historyData || historyData.length === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
        ctx.textAlign = 'center';
        ctx.fillText('Нет данных для отображения', width / 2, height / 2);
        return;
    }

    // Подготовка данных (берем последние N дней или всю историю, сортируем по возрастанию)
    const chartData = maxDays === 'all'
        ? historyData.slice().reverse()
        : historyData.slice(0, maxDays).reverse();

    // Настройки отступов
    const padding = { top: 45, right: 20, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Находим максимальное значение для масштабирования
    const exercises = ['pushups', 'squats', 'pullups', 'stairs'];
    let maxValue = 0;
    chartData.forEach(day => {
        exercises.forEach(ex => {
            if (day.exercises[ex] && day.exercises[ex].current > maxValue) {
                maxValue = day.exercises[ex].current;
            }
        });
    });

    // Округляем максимум вверх для красивой сетки
    maxValue = Math.ceil(maxValue / 10) * 10;
    if (maxValue === 0) maxValue = 10;

    // Рисуем сетку
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
        const y = padding.top + (chartHeight / gridLines) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();

        // Подписи по Y
        const value = Math.round(maxValue - (maxValue / gridLines) * i);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
        ctx.textAlign = 'right';
        ctx.fillText(value, padding.left - 10, y + 4);
    }

    // Цвета для упражнений
    const colors = {
        pushups: '#2196F3',   // Синий
        squats: '#4CAF50',    // Зеленый
        pullups: '#FF9800',   // Оранжевый
        stairs: '#9C27B0'     // Фиолетовый
    };

    // Рисуем линии для каждого упражнения
    exercises.forEach(exercise => {
        ctx.strokeStyle = colors[exercise];
        ctx.lineWidth = 2;
        ctx.beginPath();

        chartData.forEach((day, index) => {
            const x = padding.left + (chartWidth / (chartData.length - 1)) * index;
            const value = day.exercises[exercise]?.current || 0;
            const y = padding.top + chartHeight - (value / maxValue) * chartHeight;

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();

        // Рисуем точки на графике
        chartData.forEach((day, index) => {
            const x = padding.left + (chartWidth / (chartData.length - 1)) * index;
            const value = day.exercises[exercise]?.current || 0;
            const y = padding.top + chartHeight - (value / maxValue) * chartHeight;

            ctx.fillStyle = colors[exercise];
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        });
    });

    // Подписи по X (дни) - убраны для предотвращения наложения
    // ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    // ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    // ctx.textAlign = 'center';

    // // Адаптивное количество подписей в зависимости от количества данных
    // const maxLabels = chartData.length > 60 ? 10 : 7;
    // const labelStep = Math.max(1, Math.floor(chartData.length / maxLabels));

    // chartData.forEach((day, index) => {
    //     if (index % labelStep === 0 || index === chartData.length - 1) {
    //         const x = padding.left + (chartWidth / (chartData.length - 1)) * index;
    //         ctx.fillText(`День ${day.day}`, x, height - padding.bottom + 20);
    //     }
    // });

    // Легенда (располагаем в 2 ряда по 2 элемента)
    const legendStartX = padding.left;
    const legendStartY = 10;
    const legendItemWidth = width / 2 - padding.left / 2; // Делим пополам
    const legendRowHeight = 16;

    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.textAlign = 'left';

    const labels = {
        pushups: '🔥 Отжимания',
        squats: '🦵 Приседания',
        pullups: '💪 Подтягивания',
        stairs: '🏃 Лестница'
    };

    Object.keys(labels).forEach((ex, i) => {
        const row = Math.floor(i / 2); // 0 или 1
        const col = i % 2; // 0 или 1

        const x = legendStartX + col * legendItemWidth;
        const y = legendStartY + row * legendRowHeight;

        // Цветная линия
        ctx.strokeStyle = colors[ex];
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 16, y);
        ctx.stroke();

        // Текст
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillText(labels[ex], x + 20, y + 4);
    });
}

// ==================== ГРАФИК ПЛАНКИ ====================

/**
 * Рисует график прогресса планки
 * @param {string} canvasId - ID элемента canvas
 * @param {Array} historyData - массив истории из data.history
 * @param {number|string} maxDays - максимальное количество дней или 'all' для всей истории
 */
function drawPlankChart(canvasId, historyData, maxDays = 'all') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    ctx.clearRect(0, 0, width, height);

    if (!historyData || historyData.length === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
        ctx.textAlign = 'center';
        ctx.fillText('Нет данных для отображения', width / 2, height / 2);
        return;
    }

    // Подготовка данных
    const chartData = maxDays === 'all'
        ? historyData.slice().reverse()
        : historyData.slice(0, maxDays).reverse();

    const padding = { top: 30, right: 20, bottom: 40, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Находим максимальное значение планки в секундах
    let maxSeconds = 0;
    chartData.forEach(day => {
        if (day.exercises.plank && day.exercises.plank.current > maxSeconds) {
            maxSeconds = day.exercises.plank.current;
        }
    });

    // Округляем максимум вверх до ближайших 30 секунд
    maxSeconds = Math.ceil(maxSeconds / 30) * 30;
    if (maxSeconds === 0) maxSeconds = 30;

    // Рисуем сетку
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    const gridLines = 5;

    for (let i = 0; i <= gridLines; i++) {
        const y = padding.top + (chartHeight / gridLines) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();

        // Подписи по Y (в минутах и секундах)
        const seconds = Math.round(maxSeconds - (maxSeconds / gridLines) * i);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const label = minutes > 0 ? `${minutes}:${secs.toString().padStart(2, '0')}` : `${secs}с`;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
        ctx.textAlign = 'right';
        ctx.fillText(label, padding.left - 10, y + 4);
    }

    // Рисуем линию и область под ней
    const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    gradient.addColorStop(0, 'rgba(76, 175, 80, 0.3)');
    gradient.addColorStop(1, 'rgba(76, 175, 80, 0.05)');

    // Рисуем область под графиком
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(padding.left, height - padding.bottom);

    chartData.forEach((day, index) => {
        const x = padding.left + (chartWidth / (chartData.length - 1)) * index;
        const value = day.exercises.plank?.current || 0;
        const y = padding.top + chartHeight - (value / maxSeconds) * chartHeight;

        if (index === 0) {
            ctx.lineTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });

    ctx.lineTo(padding.left + chartWidth, height - padding.bottom);
    ctx.closePath();
    ctx.fill();

    // Рисуем линию
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 3;
    ctx.beginPath();

    chartData.forEach((day, index) => {
        const x = padding.left + (chartWidth / (chartData.length - 1)) * index;
        const value = day.exercises.plank?.current || 0;
        const y = padding.top + chartHeight - (value / maxSeconds) * chartHeight;

        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });

    ctx.stroke();

    // Рисуем точки
    chartData.forEach((day, index) => {
        const x = padding.left + (chartWidth / (chartData.length - 1)) * index;
        const value = day.exercises.plank?.current || 0;
        const y = padding.top + chartHeight - (value / maxSeconds) * chartHeight;

        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Белый контур
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 2;
        ctx.stroke();
    });

    // Подписи по X (дни) - убраны для предотвращения наложения
    // ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    // ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    // ctx.textAlign = 'center';

    // const maxLabels = chartData.length > 60 ? 10 : 7;
    // const labelStep = Math.max(1, Math.floor(chartData.length / maxLabels));

    // chartData.forEach((day, index) => {
    //     if (index % labelStep === 0 || index === chartData.length - 1) {
    //         const x = padding.left + (chartWidth / (chartData.length - 1)) * index;
    //         ctx.fillText(`День ${day.day}`, x, height - padding.bottom + 20);
    //     }
    // });

    // Заголовок оси Y
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.textAlign = 'center';
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Время (мин:сек)', 0, 0);
    ctx.restore();
}

// ==================== ТЕПЛОВАЯ КАРТА АКТИВНОСТИ ====================

/**
 * Рисует тепловую карту активности (как на GitHub)
 * @param {string} canvasId - ID элемента canvas
 * @param {Array} historyData - массив истории из data.history
 * @param {number} weeks - количество недель для отображения (по умолчанию 12)
 */
function drawActivityHeatmap(canvasId, historyData, weeks = 12) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    ctx.clearRect(0, 0, width, height);

    // Параметры ячеек
    const cellSize = 12;
    const cellGap = 3;
    const daysInWeek = 7;
    const totalDays = weeks * daysInWeek;

    // Отступы
    const padding = { top: 30, left: 40, right: 10, bottom: 20 };

    // Создаем словарь выполненных дней
    const completedDays = new Map();
    historyData.forEach(entry => {
        completedDays.set(entry.date, entry);
    });

    // Получаем текущую дату
    const today = new Date();

    // Функция для получения процента выполнения дня
    const getDayCompletion = (date) => {
        const dateStr = date.toLocaleDateString('ru-RU');
        const entry = completedDays.get(dateStr);

        if (!entry) return 0;

        // Считаем процент выполнения целей
        const exercises = entry.exercises;
        let completed = 0;
        let total = 0;

        Object.keys(exercises).forEach(ex => {
            const current = exercises[ex].current;
            const target = exercises[ex].target;
            if (current >= target) completed++;
            total++;
        });

        return completed / total; // 0 до 1
    };

    // Цвета для разных уровней активности
    const getColor = (completion) => {
        if (completion === 0) return '#2d2d2d'; // Нет активности
        if (completion < 0.5) return '#ff4444'; // Частичное выполнение (красный)
        if (completion < 1.0) return '#ffaa00'; // Почти выполнено (желтый)
        return '#4CAF50'; // Полное выполнение (зеленый)
    };

    // Подписи дней недели
    const dayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.textAlign = 'right';

    dayLabels.forEach((label, i) => {
        const y = padding.top + i * (cellSize + cellGap) + cellSize / 2 + 3;
        ctx.fillText(label, padding.left - 8, y);
    });

    // Рисуем ячейки (начиная с сегодня и идем назад)
    // Функция для получения номера недели относительно сегодня
    const getWeekNumber = (targetDate, referenceDate) => {
        // Находим понедельник текущей недели для referenceDate
        const refDay = referenceDate.getDay();
        const refMonday = new Date(referenceDate);
        refMonday.setDate(referenceDate.getDate() - (refDay === 0 ? 6 : refDay - 1));
        refMonday.setHours(0, 0, 0, 0);

        // Находим понедельник недели для targetDate
        const targetDay = targetDate.getDay();
        const targetMonday = new Date(targetDate);
        targetMonday.setDate(targetDate.getDate() - (targetDay === 0 ? 6 : targetDay - 1));
        targetMonday.setHours(0, 0, 0, 0);

        // Разница в неделях
        const diffMs = refMonday - targetMonday;
        const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
        return diffWeeks;
    };

    // Проходим по всем дням начиная с сегодня
    for (let i = 0; i < totalDays; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        // Определяем день недели для этой даты (Пн=0, ..., Вс=6)
        const dayOfWeek = date.getDay();
        const row = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

        // Определяем колонку (неделю) относительно сегодняшней недели
        const col = getWeekNumber(date, today);

        // Пропускаем если вышли за границы
        if (col >= weeks) continue;

        const x = padding.left + (weeks - 1 - col) * (cellSize + cellGap);
        const y = padding.top + row * (cellSize + cellGap);

        const completion = getDayCompletion(date);
        const color = getColor(completion);

        // Рисуем ячейку
        ctx.fillStyle = color;
        ctx.fillRect(x, y, cellSize, cellSize);

        // Обводка
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, cellSize, cellSize);
    }

    // Подписи месяцев
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.textAlign = 'left';

    const monthLabels = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
    let lastMonth = -1;

    // Проходим по неделям справа налево (от настоящего к прошлому)
    for (let col = 0; col < weeks; col++) {
        const weekStart = col * 7;
        const date = new Date(today);
        date.setDate(date.getDate() - weekStart);
        const month = date.getMonth();

        if (month !== lastMonth) {
            const x = padding.left + (weeks - 1 - col) * (cellSize + cellGap);
            ctx.fillText(monthLabels[month], x, padding.top - 10);
            lastMonth = month;
        }
    }

    // Легенда
    const legendY = height - padding.bottom + 5;
    const legendX = padding.left;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    ctx.textAlign = 'left';
    ctx.fillText('Меньше', legendX, legendY + 10);

    const legendColors = ['#2d2d2d', '#ff4444', '#ffaa00', '#4CAF50'];
    legendColors.forEach((color, i) => {
        const x = legendX + 45 + i * (cellSize + cellGap);
        ctx.fillStyle = color;
        ctx.fillRect(x, legendY, cellSize, cellSize);
        ctx.strokeStyle = '#1a1a1a';
        ctx.strokeRect(x, legendY, cellSize, cellSize);
    });

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.textAlign = 'left';
    ctx.fillText('Больше', legendX + 45 + legendColors.length * (cellSize + cellGap) + 5, legendY + 10);
}

// ==================== АДАПТИВНОСТЬ ====================

/**
 * Перерисовывает все графики при изменении размера окна
 */
function initChartsResize() {
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            // Перерисовываем графики если страница статистики активна
            const statsPage = document.getElementById('statsPage');
            if (statsPage && statsPage.classList.contains('active')) {
                renderCharts();
            }
        }, 250);
    });
}

/**
 * Главная функция отрисовки всех графиков
 * Вызывается при переходе на страницу статистики
 */
function renderCharts() {
    // Проверяем что data существует
    if (typeof data === 'undefined') {
        console.warn('Data not loaded yet');
        return;
    }

    // Рисуем линейный график прогресса с текущим выбранным периодом
    drawProgressChart('progressChart', data.history, currentChartPeriod);

    // Рисуем график планки
    drawPlankChart('plankChart', data.history, currentChartPeriod);

    // Рисуем тепловую карту активности
    drawActivityHeatmap('activityHeatmap', data.history, 12);

    // Инициализируем обработчики кликов для графиков
    initChartInteractions();
}

// ==================== ИНТЕРАКТИВНОСТЬ ГРАФИКОВ ====================

/**
 * Инициализация обработчиков кликов для графиков
 */
function initChartInteractions() {
    const progressCanvas = document.getElementById('progressChart');
    const plankCanvas = document.getElementById('plankChart');

    if (progressCanvas) {
        progressCanvas.onclick = (e) => handleChartClick(e, 'progressChart', 'progressChartTooltip');
    }

    if (plankCanvas) {
        plankCanvas.onclick = (e) => handleChartClick(e, 'plankChart', 'plankChartTooltip');
    }

    // Закрытие тултипа при клике вне графика
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.chart-canvas')) {
            hideAllTooltips();
        }
    });
}

/**
 * Обработка клика по графику
 */
function handleChartClick(event, canvasId, tooltipId) {
    const canvas = document.getElementById(canvasId);
    const tooltip = document.getElementById(tooltipId);

    if (!canvas || !tooltip) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Получаем данные для графика
    const chartData = currentChartPeriod === 'all'
        ? data.history.slice().reverse()
        : data.history.slice(0, currentChartPeriod).reverse();

    if (chartData.length === 0) return;

    // Вычисляем параметры графика (должны совпадать с drawProgressChart/drawPlankChart)
    const padding = { top: 45, right: 20, bottom: 40, left: 50 };
    const chartWidth = rect.width - padding.left - padding.right;

    // Находим ближайшую точку данных
    let closestIndex = -1;
    let minDistance = Infinity;

    chartData.forEach((_, index) => {
        const pointX = padding.left + (chartWidth / (chartData.length - 1)) * index;
        const distance = Math.abs(x - pointX);

        if (distance < minDistance && distance < 30) { // 30px - радиус чувствительности
            minDistance = distance;
            closestIndex = index;
        }
    });

    if (closestIndex === -1) {
        tooltip.classList.add('hidden');
        return;
    }

    // Получаем данные для выбранного дня
    const dayData = chartData[closestIndex];

    // Формируем содержимое тултипа
    let tooltipHTML = `<div class="tooltip-title">День ${dayData.day}</div>`;

    if (canvasId === 'progressChart') {
        // Тултип для графика прогресса
        const exercises = [
            { key: 'pushups', label: 'Отжимания', color: '#2196F3' },
            { key: 'squats', label: 'Приседания', color: '#4CAF50' },
            { key: 'pullups', label: 'Подтягивания', color: '#FF9800' },
            { key: 'stairs', label: 'Лестница', color: '#9C27B0' }
        ];

        exercises.forEach(ex => {
            const current = dayData.exercises[ex.key]?.current || 0;
            const target = dayData.exercises[ex.key]?.target || 0;
            const percent = target > 0 ? Math.round((current / target) * 100) : 0;

            tooltipHTML += `
                <div class="tooltip-item">
                    <span class="tooltip-label">
                        <span class="tooltip-color-dot" style="background: ${ex.color}"></span>
                        ${ex.label}
                    </span>
                    <span class="tooltip-value">${current}/${target} (${percent}%)</span>
                </div>
            `;
        });
    } else if (canvasId === 'plankChart') {
        // Тултип для графика планки
        const current = dayData.exercises.plank?.current || 0;
        const target = dayData.exercises.plank?.target || 0;
        const percent = target > 0 ? Math.round((current / target) * 100) : 0;

        const formatTime = (seconds) => {
            const min = Math.floor(seconds / 60);
            const sec = seconds % 60;
            return `${min}:${sec.toString().padStart(2, '0')}`;
        };

        tooltipHTML += `
            <div class="tooltip-item">
                <span class="tooltip-label">
                    <span class="tooltip-color-dot" style="background: #4CAF50"></span>
                    Выполнено
                </span>
                <span class="tooltip-value">${formatTime(current)}</span>
            </div>
            <div class="tooltip-item">
                <span class="tooltip-label">Цель</span>
                <span class="tooltip-value">${formatTime(target)}</span>
            </div>
            <div class="tooltip-item">
                <span class="tooltip-label">Прогресс</span>
                <span class="tooltip-value">${percent}%</span>
            </div>
        `;
    }

    tooltip.innerHTML = tooltipHTML;

    // Позиционируем тултип
    const pointX = padding.left + (chartWidth / (chartData.length - 1)) * closestIndex;

    // Показываем тултип справа или слева от точки в зависимости от позиции
    const tooltipWidth = 200; // примерная ширина тултипа
    let tooltipX = pointX + 15;

    if (pointX + tooltipWidth > rect.width - padding.right) {
        tooltipX = pointX - tooltipWidth - 15;
    }

    tooltip.style.left = `${tooltipX}px`;
    tooltip.style.top = `${y - 80}px`; // Немного выше курсора

    tooltip.classList.remove('hidden');
}

/**
 * Скрыть все тултипы
 */
function hideAllTooltips() {
    const tooltips = document.querySelectorAll('.chart-tooltip');
    tooltips.forEach(tooltip => tooltip.classList.add('hidden'));
}

/**
 * Изменение периода отображения графиков
 */
function changeChartPeriod(period, buttonElement) {
    currentChartPeriod = period;

    // Обновляем активную вкладку (для DaisyUI tabs)
    const tabs = document.querySelectorAll('.chart-period-selector .tab');
    tabs.forEach(tab => {
        tab.classList.remove('tab-active');
    });

    if (buttonElement) {
        buttonElement.classList.add('tab-active');
    }

    // Скрываем все тултипы
    hideAllTooltips();

    // Перерисовываем графики
    renderCharts();
}

