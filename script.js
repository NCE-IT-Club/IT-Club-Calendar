let globalCalendarData = null;
let globalEventLookup = {};
let currentMonthIndex = 0;
let todayEnglishDateStr = "";

const DOW_MAP = {
    "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3, 
    "Thursday": 4, "Friday": 5, "Saturday": 6
};

// Determine "Today" in typical DD/MM/YYYY format
function initTodayString() {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0'); // January is 0!
    const yyyy = today.getFullYear();
    todayEnglishDateStr = `${dd}/${mm}/${yyyy}`;
}

document.addEventListener("DOMContentLoaded", () => {
    initTodayString();

    Promise.all([
        fetch('calendar_data.json').then(response => {
            if (!response.ok) throw new Error("JSON not found.");
            return response.json();
        }),
        fetch('generator/events.json').then(response => response.json()).catch(() => ({}))
    ])
    .then(([data, eventsData]) => {
        globalCalendarData = data;

        // Process dynamic events directly on the frontend
        for (const [category, events] of Object.entries(eventsData)) {
            if (category.startsWith("_")) continue;
            for (const [dateKey, rawName] of Object.entries(events)) {
                // Auto capitalize safely
                const name = rawName ? rawName.replace(/\b\w/g, c => c.toUpperCase()) : "";
                const parts = dateKey.split("-");
                if (parts.length < 2) continue;
                
                const monthStr = parts[0];
                const daysStr = parts[1];
                
                if (daysStr.includes(":")) {
                    const [start, end] = daysStr.split(":");
                    for (let d = parseInt(start); d <= parseInt(end); d++) {
                        const formattedDay = String(d).padStart(2, '0');
                        globalEventLookup[`${monthStr}-${formattedDay}`] = { name, type: category };
                    }
                } else {
                    const formattedDay = String(parseInt(daysStr)).padStart(2, '0');
                    globalEventLookup[`${monthStr}-${formattedDay}`] = { name, type: category };
                }
            }
        }
        
        let foundTodayMonth = false;
        for (let m = 0; m < data.months.length; m++) {
            const month = data.months[m];
            if (month.days.some(d => d.english_date === todayEnglishDateStr)) {
                currentMonthIndex = m;
                foundTodayMonth = true;
                break;
            }
        }
        
        if (!foundTodayMonth) currentMonthIndex = 0;
        
        renderMonth(currentMonthIndex);
    })
    .catch(error => {
        document.getElementById('monthTitle').innerText = "Error";
        console.error("Calendar Load Error:", error);
        document.getElementById('calendarGrid').innerHTML = `<div style="padding: 20px; grid-column: span 7; color: red;">Error: ${error.message} - Please generate calendar_data.json first.</div>`;
    });

    document.getElementById('prevBtn').addEventListener('click', () => {
        if (currentMonthIndex > 0) {
            currentMonthIndex--;
            renderMonth(currentMonthIndex);
        }
    });

    document.getElementById('nextBtn').addEventListener('click', () => {
        if (globalCalendarData && currentMonthIndex < globalCalendarData.months.length - 1) {
            currentMonthIndex++;
            renderMonth(currentMonthIndex);
        }
    });

    document.getElementById('todayBtn').addEventListener('click', () => {
        if (!globalCalendarData) return;
        let foundTodayMonth = false;
        for (let m = 0; m < globalCalendarData.months.length; m++) {
            if (globalCalendarData.months[m].days.some(d => d.english_date === todayEnglishDateStr)) {
                currentMonthIndex = m;
                foundTodayMonth = true;
                break;
            }
        }
        if (foundTodayMonth) {
            renderMonth(currentMonthIndex);
        } else {
            alert("Today's date is not within the generated calendar year.");
        }
    });
});

function renderMonth(monthIndex) {
    if (!globalCalendarData) return;

    const monthData = globalCalendarData.months[monthIndex];
    document.getElementById('monthTitle').innerText = `${monthData.name} ${globalCalendarData.year}`;
    
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = "";

    const firstDayStr = monthData.days[0].day_of_week;
    const paddingSlots = DOW_MAP[firstDayStr];
    
    // Core Logic Upgrade: Limit calendar grid to 5 exact rows (35 maximum slots) 
    const totalSlots = 35;
    const cellElements = new Array(totalSlots).fill(null);
    const occupied = new Array(totalSlots).fill(false);

    const eventsMap = new Map();

    monthData.days.forEach((day, index) => {
        const slotIdx = (paddingSlots + index) % totalSlots;
        occupied[slotIdx] = true;
        
        const cell = document.createElement('div');
        cell.className = "cal-cell";

        const isWeekend = (day.day_of_week === "Saturday" || day.day_of_week === "Sunday");
        
        const monthNumStr = String(monthIndex + 1).padStart(2, '0');
        const dayNumStr = String(day.nepali_date).padStart(2, '0');
        const lookupKey = `${monthNumStr}-${dayNumStr}`;
        const customEvent = globalEventLookup[lookupKey];

        let finalType = "normal";
        let evName = "";

        // FRONTEND REAL-TIME LOGIC takes complete priority!
        if (customEvent) {
            if (isWeekend && customEvent.type === "exam") {
                finalType = "holiday";
                evName = "Weekend";
            } else {
                finalType = customEvent.type;
                evName = customEvent.name;
            }
        } else if (isWeekend) {
            finalType = "holiday";
            evName = "Weekend";
        }

        if (finalType !== "normal") cell.classList.add(`type-${finalType}`);
        if (day.english_date === todayEnglishDateStr) cell.classList.add("is-today");

        let cellHTML = `
            <div class="nepali-date">${day.nepali_date}</div>
            <div class="english-date">${day.english_date.substring(0,5)}</div>
        `;

        if (evName && evName !== "Weekend") {
            // Birthday: show 🎉 icon on top-left, no dot, no color
            if (finalType === "birthday") {
                cellHTML += `<div class="birthday-icon" title="🎂 ${evName}">🎉</div>`;
            } else {
                cellHTML += `<div class="event-dots-container" title="${evName}"><div class="event-dot"></div></div>`;
            }
            
            if (!eventsMap.has(evName)) {
                eventsMap.set(evName, {
                    name: evName,
                    typeClass: `et-${finalType}`,
                    type: finalType,
                    start: day.nepali_date,
                    end: day.nepali_date
                });
            } else {
                let e = eventsMap.get(evName);
                if (day.nepali_date > e.end) {
                    e.end = day.nepali_date;
                }
            }
        }

        cell.innerHTML = cellHTML;
        
        // Wrap-around trick: Push dates past the 35th slot backward to the very top!
        cellElements[slotIdx] = cell;
    });

    // 2. Previous Month (Fill empty gaps at top)
    const prevMonthData = monthIndex > 0 ? globalCalendarData.months[monthIndex - 1] : null;
    for (let idx = paddingSlots - 1; idx >= 0; idx--) {
        if (!occupied[idx] && prevMonthData) {
            const daysBack = paddingSlots - idx;
            const prevDayIndex = prevMonthData.days.length - daysBack;
            if (prevDayIndex >= 0) {
                const day = prevMonthData.days[prevDayIndex];
                const cell = document.createElement('div');
                cell.className = "cal-cell faint type-prev-month";
                cell.innerHTML = `
                    <div class="nepali-date">${day.nepali_date}</div>
                    <div class="english-date">${day.english_date.substring(0,5)}</div>
                `;
                cell.addEventListener('click', () => document.getElementById('prevBtn').click());
                cellElements[idx] = cell;
                occupied[idx] = true;
            }
        }
    }

    // 3. Next Month (Fill empty gaps at bottom)
    const nextMonthData = monthIndex < globalCalendarData.months.length - 1 ? globalCalendarData.months[monthIndex + 1] : null;
    let logicalEnd = paddingSlots + monthData.days.length;
    let nextIdxCount = 0;
    
    // Fill empty slots cleanly without accidentally wrapping back to the top of the calendar grid
    if (logicalEnd <= totalSlots) {
        // Normal case: Fill remaining slots at the bottom
        for (let idx = logicalEnd; idx < totalSlots; idx++) {
            if (!occupied[idx] && nextMonthData && nextIdxCount < nextMonthData.days.length) {
                const day = nextMonthData.days[nextIdxCount];
                const cell = document.createElement('div');
                cell.className = "cal-cell faint type-next-month";
                cell.innerHTML = `
                    <div class="nepali-date">${day.nepali_date}</div>
                    <div class="english-date">${day.english_date.substring(0,5)}</div>
                `;
                cell.addEventListener('click', () => document.getElementById('nextBtn').click());
                cellElements[idx] = cell;
                occupied[idx] = true;
                nextIdxCount++;
            }
        }
    } else {
        // Wrapped case: Fill remaining free slots between wrapped end and the 1st of the month
        let wrapEnd = logicalEnd % totalSlots;
        for (let idx = wrapEnd; idx < paddingSlots; idx++) {
            if (!occupied[idx] && nextMonthData && nextIdxCount < nextMonthData.days.length) {
                const day = nextMonthData.days[nextIdxCount];
                const cell = document.createElement('div');
                cell.className = "cal-cell faint type-next-month";
                cell.innerHTML = `
                    <div class="nepali-date">${day.nepali_date}</div>
                    <div class="english-date">${day.english_date.substring(0,5)}</div>
                `;
                cell.addEventListener('click', () => document.getElementById('nextBtn').click());
                cellElements[idx] = cell;
                occupied[idx] = true;
                nextIdxCount++;
            }
        }
    }

    // Render exactly 35 cells (7x5 format)
    for (let i = 0; i < totalSlots; i++) {
        if (!cellElements[i]) {
            const emptyCell = document.createElement('div');
            emptyCell.className = "cal-cell empty";
            cellElements[i] = emptyCell;
        }
        grid.appendChild(cellElements[i]);
    }

    const eventListEl = document.getElementById('eventList');
    eventListEl.innerHTML = "";
    
    if (eventsMap.size === 0) {
        eventListEl.innerHTML = "<li class='event-item'><i>No special events this month.</i></li>";
    } else {
        eventsMap.forEach(ev => {
            const dateDisplay = ev.start === ev.end ? ev.start : `${ev.start} - ${ev.end}`;
            const displayName = ev.type === "birthday" ? `🎂 ${ev.name}` : ev.name;
            eventListEl.innerHTML += `
                <li class="event-item ${ev.typeClass}">
                    <div class="ev-date" style="font-weight: bold; min-width: 60px;">${dateDisplay}</div>
                    <div class="ev-name">${displayName}</div>
                </li>
            `;
        });
    }
}

