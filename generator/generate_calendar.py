import json
import datetime
import os

NEPALI_MONTHS = ["Baisakh", "Jestha", "Ashad", "Shrawan", "Bhadra", "Ashwin", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"]

def main():
    print("====================================")
    print("   Nepali Calendar Data Generator   ")
    print("====================================")
    
    # 1. Ask for standard details
    nepali_year = input("Enter Nepali Year (e.g., 2083): ").strip()
    eng_start_str = input("Enter English start date for Baisakh 1 (Format DD/MM/YYYY, e.g., 14/04/2026): ").strip()
    
    try:
        current_eng_date = datetime.datetime.strptime(eng_start_str, "%d/%m/%Y")
    except ValueError:
        print("Error: Invalid date format. Please use DD/MM/YYYY.")
        return

    # 2. Ask for the number of days in each Nepali month
    print("\nPlease enter the number of days for each Nepali month:")
    month_days = {}
    for month in NEPALI_MONTHS:
        # In a real run, this asks for every month dynamically
        days = int(input(f"  - How many days in {month}? "))
        month_days[month] = days

    # 3. Load the custom events from events.json
    events_path = os.path.join(os.path.dirname(__file__), 'events.json')
    try:
        with open(events_path, 'r', encoding='utf-8') as f:
            events_data = json.load(f)
            print("\nLoaded customized event rules from events.json")
    except FileNotFoundError:
        print("\nevents.json not found. Proceeding with no extra custom events.")
        events_data = {}

    # Category mappings to standard types (for frontend colors)
    CATEGORY_MAP = {
        "holiday": "holiday",
        "exam": "exam",
        "college": "College Event",
        "it": "IT Club Event"
    }

    # 4. Map events for quick lookup
    # event_dict format: {"Baisakh": {12: {"name": "Session Starts", "type": "College Event"}}}
    event_dict = {m: {} for m in NEPALI_MONTHS}
    
    for category, events in events_data.items():
        if category not in CATEGORY_MAP:
            continue
        
        event_type = CATEGORY_MAP[category]
        for date_key, raw_name in events.items():
            # Auto-capitalize the name (title format), empty string if None
            formatted_name = raw_name.title() if raw_name else ""
            
            # Parse 'MM-DD' or 'MM-start:end'
            try:
                month_str, days_str = date_key.split('-')
                month_idx = int(month_str) - 1
                month_name = NEPALI_MONTHS[month_idx]
                
                if ':' in days_str:
                    start_d, end_d = map(int, days_str.split(':'))
                    for d in range(start_d, end_d + 1):
                        event_dict[month_name][d] = {"name": formatted_name, "type": event_type}
                else:
                    d = int(days_str)
                    event_dict[month_name][d] = {"name": formatted_name, "type": event_type}
            except Exception as e:
                print(f"Warning: Could not parse event date key '{date_key}'. Skipping.")

    # 5. Generate Calendar JSON Structure
    calendar_output = {
        "year": nepali_year,
        "months": []
    }

    for month in NEPALI_MONTHS:
        days_in_month = month_days[month]
        month_data = {
            "name": month,
            "days": []
        }
        for d in range(1, days_in_month + 1):
            day_of_week = current_eng_date.strftime("%A") # Gets "Monday", "Tuesday", etc.
            
            # Auto-Flag Saturdays and Sundays as Holidays
            is_weekend = day_of_week in ["Saturday", "Sunday"]
            
            # Check if this day has a special event registered
            event_info = event_dict[month].get(d, None)
            
            day_type = "normal"
            event_name = ""
            
            if event_info:
                if is_weekend and event_info["type"] == "exam":
                    # Exams are skipped on weekends; keep it as a regular holiday
                    day_type = "holiday"
                    event_name = "Weekend"
                else:
                    # User config overrides default behavior
                    day_type = event_info["type"]
                    event_name = event_info["name"]
            elif is_weekend:
                # Fallback to weekend holiday
                day_type = "holiday"
                event_name = "Weekend"

            day_obj = {
                "nepali_date": d,
                "english_date": current_eng_date.strftime("%d/%m/%Y"),
                "day_of_week": day_of_week,
                "type": day_type,
                "event_name": event_name
            }
            month_data["days"].append(day_obj)
            
            # Step the mathematical English calendar forward by 1 day
            current_eng_date += datetime.timedelta(days=1)
        
        calendar_output["months"].append(month_data)

    # 6. Save output JSON exactly where the Frontend needs it
    output_dir = os.path.join(os.path.dirname(__file__), '..')
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, 'calendar_data.json')
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(calendar_output, f, indent=4)
        
    print(f"\nSuccess! Built final calendar data directly at:")
    print(os.path.abspath(output_path))

if __name__ == "__main__":
    main()
