// src/components/layout/Sidebar.tsx — Light Theme / Corporate Brand + Mobile Drawer
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Bot,
  FileText,
  Wallet,
  ShoppingCart,
  Package,
  BarChart3,
  Timer,
  Settings,
  X,
  Box,
  ChevronRight,
  Activity
} from 'lucide-react';
import './Sidebar.css';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  soon?: boolean;
  badge?: React.ReactNode;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'GENEL',
    items: [
      { to: '/',            icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
      { to: '/cari',        icon: <Users size={20} />, label: 'Cari Yönetimi' },
    ]
  },
  {
    label: 'MODÜLLER',
    items: [
      { to: '/fatura-kontrol', icon: <FileText size={20} />, label: 'Fatura Kontrol' },
      { to: '/sevkiyat-takip', icon: <Package size={20} />, label: 'Sevkiyat & Yükleme Takip' },
      { to: '/hedef-sellout',  icon: <Box size={20} />, label: 'Hedef & Sellout' },
      { to: '/tahsilat',       icon: <Wallet size={20} />, label: 'Tahsilat Takibi',   soon: true },
      { to: '/satin-alma',     icon: <ShoppingCart size={20} />, label: 'Satın Alma',        soon: true },
      { to: '/stok',           icon: <Package size={20} />, label: 'Stok Yönetimi',     soon: true },
    ]
  },
  {
    label: 'GÜNLÜ (AI ASİSTAN)',
    items: [
      { to: '/ai-risk', icon: <Bot size={20} />, label: 'Finansal Risk Analizi' },
      { to: '/ai-temsilci', icon: <Users size={20} />, label: 'Temsilci Performansı' },
      { to: '/ai-lojistik', icon: <Package size={20} />, label: 'Sevkiyat & Lojistik' },
      { to: '/ai-senaryo', icon: <Activity size={20} />, label: 'Senaryolar (SCN & FAN)' },
      { to: '/ai-kalite', icon: <Activity size={20} />, label: 'Kalite ve Gözlem' },
    ]
  },
  {
    label: 'RAPORLAR & BI',
    items: [
      { to: '/raporlar', icon: <BarChart3 size={20} />, label: 'Genel Raporlar', soon: true },
      { to: '/yaslama',  icon: <Timer size={20} />, label: 'Yaşlandırma', soon: true },
    ]
  },
  {
    label: 'SİSTEM',
    items: [
      { to: '/ayarlar', icon: <Settings size={20} />, label: 'Ayarlar' },
      { to: '/v4-pilot', icon: <Box size={20} />, label: 'V4 Pilot (Stok)' },
    ]
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadClick?: () => void;
  isMobilePreview?: boolean;
  onToggleMobilePreview?: () => void;
}

export default function Sidebar({
  isOpen,
  onClose,
  onUploadClick,
  isMobilePreview = false,
  onToggleMobilePreview
}: SidebarProps) {
  const location = useLocation();

  return (
    <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
      {/* Brand */}
      <div className="sidebar__brand">
        <div className="sidebar__brand-icon-box">
          <Box size={24} color="white" />
        </div>
        <div className="sidebar__brand-group">
          <div className="sidebar__brand-main">
            <span className="sidebar__brand-name">AKGÜN</span>
          </div>
          <span className="sidebar__brand-product">Neşriyat Gıda</span>
        </div>
        <span className="sidebar__brand-badge">v2</span>
        {isOpen && (
          <button className="sidebar__close-btn" onClick={onClose} title="Menüyü Kapat">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Sidebar Entegre TopBar Aksiyon Şeridi (Option 2 Architecture) */}
      <div className="sidebar__actions-strip">
        {onUploadClick && (
          <button className="sidebar__btn-upload" onClick={onUploadClick} title="Excel Dosyası Yükle">
            <Bot size={14} />
            <span>Yükle</span>
          </button>
        )}
        {onToggleMobilePreview && (
          <button
            className={`sidebar__btn-icon ${isMobilePreview ? 'active' : ''}`}
            onClick={onToggleMobilePreview}
            title={isMobilePreview ? "Masaüstü görünümüne geç" : "Mobil canlı görünümü test et"}
          >
            {isMobilePreview ? <Box size={14} /> : <Activity size={14} />}
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="sidebar__nav">
        {NAV_SECTIONS.map(({ label, items }) => (
          <div key={label}>
            <div className="sidebar__section-label">{label}</div>
            {items.map((item) => {
              if (item.soon) {
                return (
                  <div key={item.to} className="sidebar__item sidebar__item--disabled" title="Yakında">
                    <span className="sidebar__item-icon">{item.icon}</span>
                    <span className="sidebar__item-label">{item.label}</span>
                    <span className="sidebar__item-badge">Yakında</span>
                  </div>
                );
              }

              const isActive = item.to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.to);

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={`sidebar__item${isActive ? ' sidebar__item--active' : ''}`}
                  onClick={onClose}
                >
                  <span className="sidebar__item-icon">{item.icon}</span>
                  <span className="sidebar__item-label">{item.label}</span>
                  {item.badge && item.badge}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer – User Profile */}
      <div className="sidebar__footer">
        <div className="sidebar__user-profile">
          <div className="sidebar__user-avatar">AG</div>
          <div className="sidebar__user-info">
            <span className="sidebar__user-name">Admin</span>
            <span className="sidebar__user-status">Çevrimiçi</span>
          </div>
          <ChevronRight size={16} className="sidebar__user-chevron" />
        </div>
      </div>
    </aside>
  );
}
