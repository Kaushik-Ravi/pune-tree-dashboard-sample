// src/components/common/InfoPopover.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Info, X } from 'lucide-react';

interface InfoPopoverProps {
  titleContent: React.ReactNode;
  children: React.ReactNode;
  iconSize?: number;
  className?: string;
  popoverWidthClass?: string;
}

const InfoPopover: React.FC<InfoPopoverProps> = ({
  titleContent,
  children,
  iconSize = 18,
  className,
  popoverWidthClass = "w-72 md:w-80"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const togglePopover = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen &&
          popoverRef.current && !popoverRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative inline-flex">
      <button
        ref={buttonRef}
        onClick={togglePopover}
        className={`text-gray-500 hover:text-primary-600 focus:outline-none ${className}`}
        aria-expanded={isOpen}
        aria-label="More information"
      >
        <Info size={iconSize} />
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="info-popover-title"
          className={`absolute top-full z-50 mt-2 ${popoverWidthClass}
                     max-h-[80vh] overflow-y-auto
                     origin-top-right right-4 md:right-0
                     bg-white rounded-lg shadow-xl border border-gray-200
                     animate-fade-in`}
        >
          <div className="p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 id="info-popover-title" className="text-md font-semibold text-gray-800">
                {titleContent}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-1 ring-inset focus:ring-gray-400"
                aria-label="Close popover"
              >
                <X size={20} />
              </button>
            </div>
            <div className="text-sm text-gray-600 space-y-2">
              {children}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InfoPopover;