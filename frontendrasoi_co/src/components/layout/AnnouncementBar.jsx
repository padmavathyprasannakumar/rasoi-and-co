import { Link } from 'react-router-dom';
import { useSite } from '../../context/SiteContext';

const SPARKS = Array.from({ length: 14 }, (_, i) => ({
  left: `${(i * 7.3 + 3) % 100}%`,
  top: `${(i * 37) % 80 + 10}%`,
  delay: `${(i * 0.37) % 3}s`,
  size: 6 + (i % 3) * 3,
}));

export default function AnnouncementBar() {
  const { settings } = useSite();
  if (settings && !settings.show_announcement) return null;
  const text = settings?.announcement_text || 'Free shipping over ₹1,999 · 2-year warranty on all appliances';
  const content = (
    <>
      <span className="announce-star">✦</span> {text} <span className="announce-star">✦</span>
    </>
  );
  return (
    <div className="announcement">
      <div className="announce-sparkles" aria-hidden="true">
        {SPARKS.map((s, i) => (
          <span key={i} style={{ left: s.left, top: s.top, animationDelay: s.delay, width: s.size, height: s.size }} />
        ))}
      </div>
      <p className="announce-text">
        {settings?.announcement_link ? <Link to={settings.announcement_link}>{content}</Link> : content}
      </p>
    </div>
  );
}
