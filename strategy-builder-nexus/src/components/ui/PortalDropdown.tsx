/**
 * PortalDropdown Component
 *
 * Renders dropdown content via React Portal to escape overflow clipping contexts.
 * Use this when dropdown needs to appear above parent containers with overflow: auto/hidden.
 *
 * @see TICKET_078 - Input Theming and Portal Patterns
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface PortalDropdownProps {
  /** Whether the dropdown is open */
  isOpen: boolean;
  /** Reference to the trigger element for positioning */
  triggerRef: React.RefObject<HTMLElement>;
  /** Callback when dropdown should close */
  onClose: () => void;
  /** Dropdown content */
  children: React.ReactNode;
  /** Optional max height (default: 240px) */
  maxHeight?: number;
  /** Optional z-index (default: 99999) */
  zIndex?: number;
}

// -----------------------------------------------------------------------------
// PortalDropdown Component
// -----------------------------------------------------------------------------

export const PortalDropdown: React.FC<PortalDropdownProps> = ({
  isOpen,
  triggerRef,
  onClose,
  children,
  maxHeight = 240,
  zIndex = 99999,
}) => {
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Calculate position based on trigger element
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [isOpen, triggerRef]);

  // Handle click outside and scroll events
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      // Check if click is outside both trigger and dropdown
      const isOutsideTrigger = triggerRef.current && !triggerRef.current.contains(target);
      const isOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(target);

      if (isOutsideTrigger && isOutsideDropdown) {
        onClose();
      }
    };

    const handleScroll = () => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setPosition({
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width,
        });
      }
    };

    // Use setTimeout to avoid immediate close on the same click that opened it
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={dropdownRef}
      className="fixed overflow-y-auto rounded shadow-xl"
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
        maxHeight,
        zIndex,
        backgroundColor: '#112240',
        border: '1px solid #233554',
      }}
    >
      {children}
    </div>,
    document.body
  );
};

export default PortalDropdown;
