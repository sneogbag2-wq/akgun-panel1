import './MascotAvatar.css';

interface MascotAvatarProps {
  size?: 'small' | 'medium' | 'large' | string;
  isTyping?: boolean;
  className?: string;
}

export function MascotAvatar({ size = 'medium', isTyping = false, className = '' }: MascotAvatarProps) {
  return (
    <div className={`mascot-avatar-wrapper size-${size} ${isTyping ? 'is-typing' : ''} ${className}`} title="Günlü — AKGÜN Akıllı Finansal Asistan Maskotu">
      <div className="mascot-glow-ring"></div>
      <svg viewBox="0 0 100 100" className="mascot-svg-graphic">
        <defs>
          <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F472B6" />
            <stop offset="50%" stopColor="#C9922E" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
          <linearGradient id="earGradientL" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F472B6" />
            <stop offset="100%" stopColor="#C9922E" />
          </linearGradient>
          <linearGradient id="earGradientR" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C9922E" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
        </defs>

        {/* Crown & Antenna */}
        <g className="mascot-antenna-group">
          <line x1="50" y1="24" x2="50" y2="10" stroke="#F472B6" strokeWidth="4" strokeLinecap="round" />
          {/* Crown Gem */}
          <polygon points="50,4 54,9 50,14 46,9" fill="#FFD700" className="antenna-gem" />
          <circle cx="50" cy="9" r="2.5" fill="#FFFFFF" />
        </g>

        {/* Cute Ears with Pink Inner Accent */}
        <path d="M 22 36 C 12 18, 32 14, 37 28 Z" fill="url(#earGradientL)" className="mascot-ear ear-l" />
        <path d="M 78 36 C 88 18, 68 14, 63 28 Z" fill="url(#earGradientR)" className="mascot-ear ear-r" />
        <path d="M 25 33 C 18 22, 30 18, 34 27 Z" fill="#FCE7F3" opacity="0.6" />
        <path d="M 75 33 C 82 22, 70 18, 66 27 Z" fill="#FCE7F3" opacity="0.6" />

        {/* Main Body Outer Shading */}
        <rect x="18" y="24" width="64" height="60" rx="28" fill="url(#bodyGradient)" />
        
        {/* Inner Dark Face Plate */}
        <rect x="23" y="29" width="54" height="50" rx="23" fill="#0F172A" />

        {/* Cute Blushing Cheeks */}
        <circle cx="31" cy="58" r="5.5" fill="#EC4899" opacity="0.85" className="cheek-left" />
        <circle cx="69" cy="58" r="5.5" fill="#EC4899" opacity="0.85" className="cheek-right" />

        {/* Animated Eyes Group with Eyelashes */}
        <g className="mascot-eyes-group">
          {/* Left Eye Eyelashes */}
          <path d="M 32 42 Q 36 39 42 41" stroke="#F472B6" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M 31 44 Q 28 41 29 38" stroke="#F472B6" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          {/* Left Eye */}
          <g className="eye-l">
            <circle cx="38" cy="47" r="6.8" fill="#FFFFFF" />
            <circle cx="39.5" cy="45.5" r="3.2" fill="#0F172A" />
            <circle cx="41.2" cy="44.2" r="1.5" fill="#FFFFFF" />
            <circle cx="37" cy="48" r="0.8" fill="#F472B6" />
          </g>

          {/* Right Eye Eyelashes */}
          <path d="M 68 42 Q 64 39 58 41" stroke="#F472B6" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M 69 44 Q 72 41 71 38" stroke="#F472B6" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          {/* Right Eye */}
          <g className="eye-r">
            <circle cx="62" cy="47" r="6.8" fill="#FFFFFF" />
            <circle cx="60.5" cy="45.5" r="3.2" fill="#0F172A" />
            <circle cx="58.8" cy="44.2" r="1.5" fill="#FFFFFF" />
            <circle cx="63" cy="48" r="0.8" fill="#F472B6" />
          </g>
        </g>

        {/* Happy Sweet Smile Mouth */}
        <path d="M 43 58 Q 50 66 57 58" fill="none" stroke="#FFD700" strokeWidth="3" strokeLinecap="round" className="mascot-smile" />

        {/* Small Golden Bow / Ribbon Collar Gem */}
        <circle cx="50" cy="78" r="3.5" fill="#FFD700" />
        <path d="M 45 78 L 50 78 L 46 82 Z" fill="#F472B6" />
        <path d="M 55 78 L 50 78 L 54 82 Z" fill="#F472B6" />
      </svg>
    </div>
  );
}

export default MascotAvatar;
