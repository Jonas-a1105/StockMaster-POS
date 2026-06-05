import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface CustomDatePickerProps {
  value: string; // Format "YYYY-MM-DD"
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

export default function CustomDatePicker({
  value,
  onChange,
  placeholder = 'Seleccionar fecha',
  className = '',
  style,
  disabled = false
}: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [coords, setCoords] = useState<{ top: number; bottom: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial or selected date
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-indexed

  // Parse YYYY-MM-DD from value
  const getParsedDate = (val: string) => {
    if (!val) return null;
    const parts = val.split('-');
    if (parts.length !== 3) return null;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1; // Convert to 0-index
    const d = parseInt(parts[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
    return new Date(y, m, d);
  };

  const parsedValue = getParsedDate(value);

  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      let leftVal = rect.left;
      // Prevent offscreen overflow on the right
      if (leftVal + 280 > window.innerWidth) {
        leftVal = Math.max(10, window.innerWidth - 280 - 10);
      }
      setCoords({
        top: rect.top,
        bottom: rect.bottom,
        left: leftVal,
        width: rect.width
      });
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpward(spaceBelow < 330); // Datepicker is typically 330px height
    }
  };

  // Sync internal calendar view and detect viewport spacing on open
  useEffect(() => {
    if (parsedValue) {
      setCurrentYear(parsedValue.getFullYear());
      setCurrentMonth(parsedValue.getMonth());
    }
    if (isOpen) {
      updateCoords();
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
    }
    return () => {
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, true);
    };
  }, [value, isOpen]);

  // Close popup when clicking outside the container or portal popup
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        const portalPopup = document.querySelector('.custom-datepicker-popup');
        if (portalPopup && portalPopup.contains(event.target as Node)) {
          return;
        }
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Format date display for Spanish localization (e.g. "4 de mayo de 2026")
  const formatDateDisplay = (date: Date | null) => {
    if (!date) return '';
    const months = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    return `${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
  };

  // Spanish months list for header
  const monthsList = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  // Date selection
  const handleDaySelect = (day: number, isOtherMonth: 'prev' | 'next' | 'current') => {
    let targetYear = currentYear;
    let targetMonth = currentMonth;

    if (isOtherMonth === 'prev') {
      if (currentMonth === 0) {
        targetMonth = 11;
        targetYear = currentYear - 1;
      } else {
        targetMonth = currentMonth - 1;
      }
    } else if (isOtherMonth === 'next') {
      if (currentMonth === 11) {
        targetMonth = 0;
        targetYear = currentYear + 1;
      } else {
        targetMonth = currentMonth + 1;
      }
    }

    const yyyy = String(targetYear);
    const mm = String(targetMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    onChange(`${yyyy}-${mm}-${dd}`);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setIsOpen(false);
  };

  const handleToday = () => {
    const yyyy = String(today.getFullYear());
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    onChange(`${yyyy}-${mm}-${dd}`);
    setIsOpen(false);
  };

  // Generate calendar days grid
  const generateDays = () => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    // First day of current month (0 is Sunday, 1 is Monday, etc.)
    const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
    
    // Adjust first day of week to start with Monday (Monday = 0, ..., Sunday = 6)
    const firstDayIndex = (firstDayOfWeek + 6) % 7;

    const days = [];

    // 1. Previous month padding days
    const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const prevMonthVal = currentMonth === 0 ? 11 : currentMonth - 1;
    const daysInPrevMonth = new Date(prevMonthYear, prevMonthVal + 1, 0).getDate();

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        day: daysInPrevMonth - i,
        type: 'prev' as const
      });
    }

    // 2. Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        day: i,
        type: 'current' as const
      });
    }

    // 3. Next month padding days to fill 42 cells (6 rows * 7 columns)
    const totalCells = 42;
    const remainingCells = totalCells - days.length;
    for (let i = 1; i <= remainingCells; i++) {
      days.push({
        day: i,
        type: 'next' as const
      });
    }

    return days;
  };

  const daysGrid = generateDays();

  // Helper to check if a grid day is the selected day
  const isSelectedDay = (day: number, type: 'prev' | 'next' | 'current') => {
    if (!parsedValue) return false;
    
    let targetYear = currentYear;
    let targetMonth = currentMonth;

    if (type === 'prev') {
      if (currentMonth === 0) {
        targetMonth = 11;
        targetYear = currentYear - 1;
      } else {
        targetMonth = currentMonth - 1;
      }
    } else if (type === 'next') {
      if (currentMonth === 11) {
        targetMonth = 0;
        targetYear = currentYear + 1;
      } else {
        targetMonth = currentMonth + 1;
      }
    }

    return (
      parsedValue.getDate() === day &&
      parsedValue.getMonth() === targetMonth &&
      parsedValue.getFullYear() === targetYear
    );
  };

  // Helper to check if a grid day is today
  const isTodayDay = (day: number, type: 'prev' | 'next' | 'current') => {
    let targetYear = currentYear;
    let targetMonth = currentMonth;

    if (type === 'prev') {
      if (currentMonth === 0) {
        targetMonth = 11;
        targetYear = currentYear - 1;
      } else {
        targetMonth = currentMonth - 1;
      }
    } else if (type === 'next') {
      if (currentMonth === 11) {
        targetMonth = 0;
        targetYear = currentYear + 1;
      } else {
        targetMonth = currentMonth + 1;
      }
    }

    return (
      today.getDate() === day &&
      today.getMonth() === targetMonth &&
      today.getFullYear() === targetYear
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter') {
      setIsOpen((prev) => !prev);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`custom-datepicker-container ${className} ${disabled ? 'disabled' : ''}`}
      style={style}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : 0}
    >
      <div
        className={`custom-datepicker-trigger ${isOpen ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
      >
        <div className="custom-datepicker-trigger-content">
          <Calendar size={14} className="custom-datepicker-trigger-icon-svg" />
          <span className="custom-datepicker-trigger-text">
            {parsedValue ? formatDateDisplay(parsedValue) : placeholder}
          </span>
        </div>
      </div>

      {isOpen && coords && createPortal(
        <div
          className="custom-datepicker-popup premium-popup"
          style={{
            position: 'fixed',
            left: coords.left,
            right: 'auto', // Override CSS right rules to prevent stretching
            width: '280px', // Maintain 280px standard width
            zIndex: 9999,
            ...(openUpward
              ? { bottom: window.innerHeight - coords.top + 4, top: 'auto', boxShadow: '0 -10px 25px -5px rgba(0, 0, 0, 0.4)' }
              : { top: coords.bottom + 4, bottom: 'auto' })
          }}
        >
          {/* Header */}
          <div className="custom-datepicker-header">
            <button 
              type="button" 
              className="custom-datepicker-nav-btn" 
              onClick={handlePrevMonth}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="custom-datepicker-month-year">
              {monthsList[currentMonth]} {currentYear}
            </span>
            <button 
              type="button" 
              className="custom-datepicker-nav-btn" 
              onClick={handleNextMonth}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Weekdays */}
          <div className="custom-datepicker-weekdays">
            <span className="custom-datepicker-weekday">L</span>
            <span className="custom-datepicker-weekday">M</span>
            <span className="custom-datepicker-weekday">X</span>
            <span className="custom-datepicker-weekday">J</span>
            <span className="custom-datepicker-weekday">V</span>
            <span className="custom-datepicker-weekday">S</span>
            <span className="custom-datepicker-weekday">D</span>
          </div>

          {/* Days Grid */}
          <div className="custom-datepicker-days">
            {daysGrid.map((cell, idx) => {
              const isSelected = isSelectedDay(cell.day, cell.type);
              const isToday = isTodayDay(cell.day, cell.type);
              const isOtherMonth = cell.type !== 'current';

              return (
                <div
                  key={idx}
                  className={`custom-datepicker-day ${isOtherMonth ? 'other-month' : ''} ${
                    isSelected ? 'selected' : ''
                  } ${isToday ? 'today' : ''}`}
                  onClick={() => handleDaySelect(cell.day, cell.type)}
                >
                  {cell.day}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="custom-datepicker-footer">
            <button
              type="button"
              className="custom-datepicker-btn clear"
              onClick={handleClear}
            >
              Borrar
            </button>
            <button
              type="button"
              className="custom-datepicker-btn today-btn"
              onClick={handleToday}
            >
              Hoy
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
