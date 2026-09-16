import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface DateTimePickerProps {
  value: string;
  onChange: (formattedValue: string) => void;
  label?: string;
  placeholder?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  onChange,
  label = 'Date & Time',
  placeholder = 'Select event date & time'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parsing initial or current date
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(now.getDate());

  // Time state
  const [hour, setHour] = useState<string>('07');
  const [minute, setMinute] = useState<string>('00');
  const [period, setPeriod] = useState<'AM' | 'PM'>('PM');

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Compute days in month
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleApply = (day: number | null = selectedDay, h = hour, m = minute, p = period) => {
    if (day === null) {
      onChange('');
      setIsOpen(false);
      return;
    }
    const monthName = MONTH_NAMES[viewMonth];
    const formatted = `${monthName} ${day}, ${viewYear} • ${h}:${m} ${p}`;
    onChange(formatted);
    setIsOpen(false);
  };

  const handleSelectPreset = (offsetDays: number, defaultHour = '07', defaultMinute = '00', defaultPeriod: 'AM' | 'PM' = 'PM') => {
    const target = new Date();
    target.setDate(target.getDate() + offsetDays);
    setViewYear(target.getFullYear());
    setViewMonth(target.getMonth());
    setSelectedDay(target.getDate());
    setHour(defaultHour);
    setMinute(defaultMinute);
    setPeriod(defaultPeriod);

    const monthName = MONTH_NAMES[target.getMonth()];
    const formatted = `${monthName} ${target.getDate()}, ${target.getFullYear()} • ${defaultHour}:${defaultMinute} ${defaultPeriod}`;
    onChange(formatted);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      {label && (
        <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
          {label}
        </label>
      )}

      {/* Input trigger box */}
      <button
        id="btn-datetime-trigger"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3.5 py-3 rounded-2xl border border-gray-200 bg-white hover:border-gray-400 text-left text-sm transition-all shadow-2xs group focus:outline-none focus:ring-2 focus:ring-[#E67E22]/30 min-h-[46px]"
      >
        <div className="flex items-center gap-2.5 truncate">
          <CalendarIcon className="w-4 h-4 text-[#E67E22] shrink-0" />
          <span className={value ? 'text-[#1A1A1A] font-medium' : 'text-gray-400'}>
            {value || placeholder}
          </span>
        </div>
        <Clock className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors shrink-0" />
      </button>

      {/* Dropdown popup */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white dark:bg-[#0C0B12] rounded-3xl shadow-2xl border border-gray-200 dark:border-white/10 p-4 animate-scale-in text-xs max-w-sm sm:max-w-md w-full">
          {/* Quick Presets */}
          <div className="flex flex-wrap gap-1.5 mb-3.5 pb-3 border-b border-gray-100 dark:border-white/10">
            <button
              type="button"
              onClick={() => handleSelectPreset(0, '08', '00', 'PM')}
              className="px-2.5 py-1 rounded-full bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/15 text-gray-700 dark:text-gray-200 font-medium text-[11px] transition-colors"
            >
              Today (8 PM)
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset(1, '07', '00', 'PM')}
              className="px-2.5 py-1 rounded-full bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/15 text-gray-700 dark:text-gray-200 font-medium text-[11px] transition-colors"
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={() => {
                const target = new Date();
                const day = target.getDay();
                const distToSat = (6 - day + 7) % 7 || 7;
                handleSelectPreset(distToSat, '06', '30', 'PM');
              }}
              className="px-2.5 py-1 rounded-full bg-[#E67E22]/10 hover:bg-[#E67E22]/20 text-[#E67E22] font-semibold text-[11px] transition-colors"
            >
              This Saturday
            </button>
          </div>

          {/* Month Header */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="font-bold text-sm text-[#1A1A1A] dark:text-white">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 text-center mb-4">
            {DAYS_OF_WEEK.map((d) => (
              <div key={d} className="text-[10px] font-bold text-gray-400 dark:text-gray-500 py-1">
                {d}
              </div>
            ))}

            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isSelected = selectedDay === day;
              const isToday =
                now.getDate() === day &&
                now.getMonth() === viewMonth &&
                now.getFullYear() === viewYear;

              return (
                <button
                  key={`day-${day}`}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={`h-8 w-8 mx-auto rounded-xl flex items-center justify-center font-medium transition-all ${
                    isSelected
                      ? 'bg-[#1A1A1A] dark:bg-white dark:text-black text-white shadow-xs'
                      : isToday
                      ? 'bg-[#E67E22]/15 text-[#E67E22] font-bold hover:bg-[#E67E22]/25'
                      : 'hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Clock & Time Dropdown Controls */}
          <div className="pt-3 border-t border-gray-100 dark:border-white/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#E67E22]" />
              <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300">Time:</span>
            </div>

            <div className="flex items-center gap-1">
              {/* Hour Dropdown */}
              <select
                value={hour}
                onChange={(e) => setHour(e.target.value)}
                className="bg-gray-50 dark:bg-[#141220] border border-gray-200 dark:border-white/10 rounded-xl px-2 py-1.5 text-xs font-semibold text-[#1A1A1A] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#E67E22]"
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const h = String(i + 1).padStart(2, '0');
                  return (
                    <option key={h} value={h} className="dark:bg-[#0C0B12] dark:text-white">
                      {h}
                    </option>
                  );
                })}
              </select>

              <span className="font-bold text-gray-400">:</span>

              {/* Minute Dropdown */}
              <select
                value={minute}
                onChange={(e) => setMinute(e.target.value)}
                className="bg-gray-50 dark:bg-[#141220] border border-gray-200 dark:border-white/10 rounded-xl px-2 py-1.5 text-xs font-semibold text-[#1A1A1A] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#E67E22]"
              >
                {['00', '15', '30', '45'].map((m) => (
                  <option key={m} value={m} className="dark:bg-[#0C0B12] dark:text-white">
                    {m}
                  </option>
                ))}
              </select>

              {/* AM / PM Toggle */}
              <div className="flex bg-gray-100 dark:bg-[#141220] rounded-xl p-0.5 ml-1 border border-gray-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setPeriod('AM')}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    period === 'AM' ? 'bg-white dark:bg-white/20 shadow-2xs text-[#1A1A1A] dark:text-white' : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  AM
                </button>
                <button
                  type="button"
                  onClick={() => setPeriod('PM')}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    period === 'PM' ? 'bg-white dark:bg-white/20 shadow-2xs text-[#1A1A1A] dark:text-white' : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  PM
                </button>
              </div>
            </div>
          </div>

          {/* Confirm Button */}
          <div className="mt-3 pt-2 border-t border-gray-100 dark:border-white/10 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              className="px-3 py-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 font-medium text-xs transition-colors"
            >
              Clear
            </button>

            <button
              id="btn-apply-datetime"
              type="button"
              onClick={() => handleApply()}
              className="px-4 py-2 rounded-xl bg-[#1A1A1A] dark:bg-white dark:text-black hover:bg-black dark:hover:bg-gray-100 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-all"
            >
              <Check className="w-3.5 h-3.5 text-[#E67E22]" />
              <span>Set Date & Time</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
