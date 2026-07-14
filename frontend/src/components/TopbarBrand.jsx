import logoSrc from '../assets/Pasted Image.png';

export default function TopbarBrand({ label }) {
  return (
    <div className="topbar-brand">
      <img src={logoSrc} alt="Simple Works" className="topbar-brand-logo" />
      <span>{label}</span>
    </div>
  );
}
