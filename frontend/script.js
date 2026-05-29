let globalCalendarData = null;
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

    fetch('calendar_data.json')
        .then(response => {
            if (!response.ok) throw new Error("JSON not found. Run python generator first.");
            return response.json();
        })
        .then(data => {
            globalCalendarData = data;
            
            // Try to set currentMonthIndex to the month that contains today
            let foundTodayMonth = false;
            for (let m = 0; m < data.months.length; m++) {
                const month = data.months[m];
                if (month.days.some(d => d.english_date === todayEnglishDateStr)) {
                    currentMonthIndex = m;
                    foundTodayMonth = true;
                    break;
                }
            }
            
            // If today isn't in this calendar, just start at month 0 (Baisakh)
            if (!foundTodayMonth) currentMonthIndex = 0;
            
            renderMonth(currentMonthIndex);
        })
        .catch(error => {
            document.getElementById('monthTitle').innerText = "Error: Data not generated";
            console.error("Calendar Load Error:", error);
            document.getElementById('calendarGrid').innerHTML = `<div style="padding: 20px; grid-column: span 7;">Please generate the calendar data first by running the Python generator.</div>`;
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
    
    // Manage Grid
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = "";

    // Calculate empty padding slots
    const firstDayStr = monthData.days[0].day_of_week;
    const paddingSlots = DOW_MAP[firstDayStr];

    for (let i = 0; i < paddingSlots; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = "cal-cell empty";
        grid.appendChild(emptyCell);
    }

    // Grouping events for the footer display
    const eventsMap = new Map();

    // Render Actual Days
    monthData.days.forEach(day => {
        const cell = document.createElement('div');
        cell.className = "cal-cell";

        const isWeekend = (day.day_of_week === "Saturday" || day.day_of_week === "Sunday");
        
        let finalType = "normal";
        if (day.type === "College Event" || day.type === "college") finalType = "college";
        else if (day.type === "IT Club Event" || day.type === "it") finalType = "it";
        else if (isWeekend || day.type === "holiday") finalType = "holiday";
        else if (day.type === "exam") finalType = "exam";

        let evName = day.event_name;

        // Front-end override: If it's a weekend, strictly enforce NO exam markings
        if (isWeekend && day.type === "exam") {
            evName = "Weekend";
            finalType = "holiday";
        }

        if (finalType !== "normal") cell.classList.add(`type-${finalType}`);
        if (day.english_date === todayEnglishDateStr) cell.classList.add("is-today");

        // Build Inner HTML
        let cellHTML = `
            <div class="nepali-date">${day.nepali_date}</div>
            <div class="english-date">${day.english_date.substring(0,5)}</div>
        `;

        if (evName && evName !== "Weekend") {
            cellHTML += `<div class="event-dots-container" title="${evName}"><div class="event-dot"></div></div>`;
            
            // Add or extend group in the Map for the footer
            if (!eventsMap.has(evName)) {
                eventsMap.set(evName, {
                    name: evName,
                    typeClass: `et-${finalType}`,
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
        grid.appendChild(cell);
    });

    // Populate the bottom Event List
    const eventListEl = document.getElementById('eventList');
    eventListEl.innerHTML = "";
    
    if (eventsMap.size === 0) {
        eventListEl.innerHTML = "<li class='event-item'><i>No special events this month.</i></li>";
    } else {
        eventsMap.forEach(ev => {
            const dateDisplay = ev.start === ev.end ? ev.start : `${ev.start} - ${ev.end}`;
            eventListEl.innerHTML += `
                <li class="event-item ${ev.typeClass}">
                    <div class="ev-date" style="font-weight: bold; min-width: 60px;">${dateDisplay}</div>
                    <div class="ev-name">${ev.name}</div>
                </li>
            `;
        });
    }
}