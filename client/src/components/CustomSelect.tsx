import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

export interface CustomSelectOption {
  value: string | number;
  label: string;
}

interface CustomSelectProps {
  value: string | number;
  onChange: (value: any) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar...',
  className = '',
  style,
  icon,
  disabled = false
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [openUpward, setOpenUpward] = useState(false);
  const [coords, setCoords] = useState<{ top: number; bottom: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close when clicking outside the select container or portal dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        const portalPopup = document.querySelector('.custom-select-options-list');
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

  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width
      });
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpward(spaceBelow < 250); // Options list is typically 250px max height
    }
  };

  // Sync keyboard activeIndex and position dropdown on open
  useEffect(() => {
    if (isOpen) {
      const idx = options.findIndex((opt) => opt.value === value);
      setActiveIndex(idx >= 0 ? idx : 0);
      updateCoords();
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
    }
    return () => {
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, true);
    };
  }, [isOpen, value, options]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < options.length) {
          onChange(options[activeIndex].value);
          setIsOpen(false);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % options.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + options.length) % options.length);
        break;
      case 'Tab':
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  const handleOptionClick = (val: string | number) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={`custom-select-container ${className} ${disabled ? 'disabled' : ''}`}
      style={style}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : 0}
    >
      <div
        className={`custom-select-trigger ${isOpen ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
      >
        <div className="custom-select-trigger-content">
          {icon && <span className="custom-select-trigger-icon">{icon}</span>}
          <span className="custom-select-trigger-text">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown size={14} className={`custom-select-arrow ${isOpen ? 'open' : ''}`} />
      </div>

      {isOpen && coords && createPortal(
        <div
          className="custom-select-options-list premium-popup"
          style={{
            position: 'fixed',
            left: coords.left,
            width: coords.width,
            minWidth: coords.width, // Force trigger width, override 100vw body min-width
            right: 'auto', // Override CSS right: 0 to prevent horizontal stretching
            zIndex: 9999,
            ...(openUpward
              ? { bottom: window.innerHeight - coords.top + 4, top: 'auto', boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.35)' }
              : { top: coords.bottom + 4, bottom: 'auto' })
          }}
        >
          {options.map((option, idx) => {
            const isSelected = option.value === value;
            const isActive = idx === activeIndex;
            return (
              <div
                key={option.value}
                className={`custom-select-option ${isSelected ? 'selected' : ''} ${
                  isActive ? 'active' : ''
                }`}
                onClick={() => handleOptionClick(option.value)}
              >
                {option.label}
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
