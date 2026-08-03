import React from 'react';
import './ModalWrapper.css';

interface ModalWrapperProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const ModalWrapper: React.FC<ModalWrapperProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="v3-modal-overlay" onClick={onClose}>
      <div 
        className="v3-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="v3-modal-header">
          <h2 className="v3-modal-title">
            <i className="fa-solid fa-layer-group" style={{ color: '#3B82F6', marginRight: '10px' }}></i>
            {title}
          </h2>
          <button 
            onClick={onClose}
            className="v3-modal-close-btn"
            title="Kapat"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Body */}
        <div className="v3-modal-body">
          {children}
        </div>
      </div>
    </div>
  );
};
