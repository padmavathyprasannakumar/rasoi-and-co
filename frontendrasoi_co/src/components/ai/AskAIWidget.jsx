import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import api from '../../api/axios';
import { useSite } from '../../context/SiteContext';
import { useCart } from '../../context/CartContext';
import Icon from '../ui/Icon';
import { SmartImage } from '../ui/Primitives';
import { formatPrice } from '../../utils/formatPrice';

/**
 * Rasoi AI chat — "Chat · Speak · Shop".
 * Talks to POST /api/ai/chat/ (Django). Assistants come from Django admin → AI assistants.
 * Voice input uses the browser's speech recognition (Chrome / Edge / Android).
 */
const LANGS = [
  { code: 'en', label: 'English', speech: 'en-IN' },
  { code: 'hi', label: 'हिन्दी', speech: 'hi-IN' },
  { code: 'ta', label: 'தமிழ்', speech: 'ta-IN' },
  { code: 'te', label: 'తెలుగు', speech: 'te-IN' },
  { code: 'bn', label: 'বাংলা', speech: 'bn-IN' },
  { code: 'mr', label: 'मराठी', speech: 'mr-IN' },
  { code: 'kn', label: 'ಕನ್ನಡ', speech: 'kn-IN' },
  { code: 'ml', label: 'മലയാളം', speech: 'ml-IN' },
  { code: 'gu', label: 'ગુજરાતી', speech: 'gu-IN' },
];

/** Remove markdown symbols so the voice doesn't read "star star". */
function cleanForSpeech(text = '') {
  return text
    .replace(/\*\*|__|[*_#`>]/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Renders **bold** and simple "- " bullet lists from AI replies (no raw HTML). */
function inline(line, keyBase) {
  return line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={`${keyBase}-${j}`}>{part.slice(2, -2)}</strong> : part,
  );
}

function RichText({ text = '' }) {
  const blocks = [];
  let list = [];
  const flush = (k) => {
    if (list.length) {
      blocks.push(<ul key={`ul-${k}`} className="ai-list">{list}</ul>);
      list = [];
    }
  };
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line) {
      flush(i);
      return;
    }
    const bullet = line.match(/^(?:[-•*]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      list.push(<li key={i}>{inline(bullet[1], i)}</li>);
    } else {
      flush(i);
      blocks.push(<p key={i}>{inline(line.replace(/^#+\s*/, ''), i)}</p>);
    }
  });
  flush('end');
  return <div className="ai-rich">{blocks}</div>;
}

const SUGGESTIONS = ['Best air fryer under ₹8,000', 'Mixer grinder for idli batter', 'Chimney for a small kitchen', 'Diwali gift under ₹2,000', 'Where is my order?'];
const STORE_KEY = 'rasoi_ai_chat';
const SpeechRecognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

function loadChat() {
  try {
    return JSON.parse(sessionStorage.getItem(STORE_KEY)) || [];
  } catch {
    return [];
  }
}

function ProductMini({ p, onNavigate }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const off = Number(p.mrp) > Number(p.sale_price);
  return (
    <div className="ai-product">
      <Link to={`/product/${p.slug}`} onClick={onNavigate} className="ai-product-img">
        <SmartImage src={p.image} alt={p.name} width={160} sizes="64px" />
      </Link>
      <div className="ai-product-info">
        <Link to={`/product/${p.slug}`} onClick={onNavigate} className="ai-product-name">{p.name}</Link>
        <span className="ai-product-price">
          <strong>{formatPrice(p.sale_price)}</strong>
          {off && <s>{formatPrice(p.mrp)}</s>}
        </span>
      </div>
      {p.has_variants ? (
        <Link to={`/product/${p.slug}`} onClick={onNavigate} className="ai-product-btn">View</Link>
      ) : (
        <button
          className="ai-product-btn"
          disabled={!p.in_stock || added}
          onClick={async () => {
            const ok = await addItem(p, { openDrawer: false });
            if (ok) setAdded(true);
          }}
        >
          {added ? 'Added ✓' : p.in_stock ? 'Add' : 'Sold out'}
        </button>
      )}
    </div>
  );
}

export default function AskAIWidget() {
  const { settings } = useSite();
  const { addItem } = useCart();
  const [open, setOpen] = useState(false);
  const [assistants, setAssistants] = useState([]);
  const [assistant, setAssistant] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [lang, setLang] = useState(() => localStorage.getItem('rasoi_ai_lang') || 'en');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(loadChat);
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState(null); // which reply is being read aloud
  const listRef = useRef(null);
  const recRef = useRef(null);
  const viaVoice = useRef(false);
  const inputRef = useRef(null);

  const name = settings?.ai_assistant_name || 'Rasoi AI';

  // Open from anywhere: window.dispatchEvent(new Event('open-ask-ai')) or a link to #ask-ai
  useEffect(() => {
    const openIt = () => setOpen(true);
    const onHash = () => window.location.hash === '#ask-ai' && setOpen(true);
    window.addEventListener('open-ask-ai', openIt);
    window.addEventListener('hashchange', onHash);
    onHash();
    return () => {
      window.removeEventListener('open-ask-ai', openIt);
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  useEffect(() => {
    if (!open || assistants.length) return;
    api
      .get('/ai/assistants/')
      .then(({ data }) => {
        setAssistants(data);
        setAssistant((cur) => cur || data.find((a) => a.is_default) || data[0] || null);
      })
      .catch(() => {});
  }, [open, assistants.length]);

  useEffect(() => {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(messages.slice(-30)));
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  useEffect(() => {
    localStorage.setItem('rasoi_ai_lang', lang);
  }, [lang]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  const stopSpeaking = () => {
    window.speechSynthesis?.cancel();
    setSpeakingIdx(null);
  };

  // Listen / Stop toggle. idx = message index (or 'auto' for voice replies)
  const speak = (text, idx = 'auto') => {
    if (!('speechSynthesis' in window)) return;
    if (speakingIdx === idx) {
      stopSpeaking();
      return;
    }
    const synth = window.speechSynthesis;
    synth.cancel();
    // Chrome stops long speech after ~15 seconds, so read the reply sentence by sentence.
    const parts = (cleanForSpeech(text).match(/[^.!?।\n]+[.!?।]?/g) || []).map((x) => x.trim()).filter(Boolean);
    if (!parts.length) return;
    const voiceLang = LANGS.find((l) => l.code === lang)?.speech || 'en-IN';
    const done = () => setSpeakingIdx((cur) => (cur === idx ? null : cur));
    parts.forEach((part, n) => {
      const u = new SpeechSynthesisUtterance(part);
      u.lang = voiceLang;
      u.rate = 1;
      if (n === parts.length - 1) u.onend = done;
      u.onerror = done;
      synth.speak(u);
    });
    setSpeakingIdx(idx);
  };

  // Stop reading when the chat is closed or the page changes
  useEffect(() => {
    if (!open) stopSpeaking();
  }, [open]);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const send = async (text) => {
    const t = (text ?? input).trim();
    if (!t || thinking) return;
    setInput('');
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    // Products shown in the last reply — so "add it to my cart" knows which one you mean
    const lastWithProducts = [...messages].reverse().find((m) => m.role !== 'user' && m.products?.length);
    const contextProducts = (lastWithProducts?.products || []).map((p) => p.slug);
    setMessages((m) => [...m, { role: 'user', content: t }]);
    setThinking(true);
    try {
      const { data } = await api.post('/ai/chat/', {
        message: t,
        history,
        assistant: assistant?.slug,
        language: lang,
        context_products: contextProducts,
      });
      let reply = data.reply;
      if (data.cart_action) {
        // Really add it to the bag (same as tapping "Add")
        const ok = await addItem(data.cart_action, { openDrawer: false });
        if (!ok) reply = `Sorry, I couldn't add ${data.cart_action.name} to your bag just now. Please tap **Add** on the card below to try again.`;
      }
      setMessages((m) => [...m, { role: 'assistant', content: reply, products: data.products, source: data.source }]);
      if (viaVoice.current) speak(reply, messages.length + 1); // index of this new reply, so its Stop button works
    } catch (err) {
      const msg =
        err.response?.status === 429
          ? 'You are sending messages very quickly — please wait a few seconds and try again.'
          : "Sorry, I couldn't connect just now. Please try again in a moment.";
      setMessages((m) => [...m, { role: 'assistant', content: msg }]);
    } finally {
      setThinking(false);
      viaVoice.current = false;
    }
  };

  const toggleMic = () => {
    if (!SpeechRecognition) {
      setMessages((m) => [...m, { role: 'assistant', content: 'Voice input works in Chrome, Edge and Android browsers. Please type your question here.' }]);
      return;
    }
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = LANGS.find((l) => l.code === lang)?.speech || 'en-IN';
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    let finalText = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      setInput((finalText + interim).trim());
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => {
      setListening(false);
      if (finalText.trim()) {
        viaVoice.current = true;
        send(finalText.trim());
      }
    };
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  const newChat = () => {
    setMessages([]);
    stopSpeaking();
  };

  if (settings && settings.ai_enabled === false) return null;
  const welcome = assistant?.welcome_message || settings?.ai_welcome_message || `Namaste! I'm ${name}. Tell me what you love to cook and I'll help you pick the right appliance.`;

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            className="ai-fab"
            onClick={() => setOpen(true)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.95 }}
            aria-label={settings?.ai_button_text || `Ask ${name}`}
          >
            <Icon name="spark" size={15} /> {settings?.ai_button_text || `Ask ${name}`}
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.section
            className="ai-panel"
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.97 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-label={`${name} chat`}
          >
            <header className="ai-head">
              <span className="ai-head-glow" aria-hidden="true" />
              <div>
                <h2><Icon name="spark" size={20} fill="currentColor" /> {name}</h2>
                <small>{settings?.ai_tagline || 'Chat · Speak · Shop'}</small>
              </div>
              <div className="ai-head-actions">
                {messages.length > 0 && (
                  <button className="ai-head-btn" onClick={newChat} aria-label="Start a new chat" title="New chat">
                    <Icon name="edit" size={17} />
                  </button>
                )}
                <button className="ai-head-btn" onClick={() => setOpen(false)} aria-label="Close chat">
                  <Icon name="close" size={22} />
                </button>
              </div>
            </header>

            {assistants.length > 0 && (
              <div className="ai-picker-wrap">
                <button className="ai-picker" onClick={() => setPickerOpen((v) => !v)} aria-expanded={pickerOpen}>
                  <span>Choose an assistant:</span>
                  <strong>{assistant?.name}</strong>
                  <Icon name="chevronDown" size={15} className={pickerOpen ? 'rot' : ''} />
                </button>
                <AnimatePresence>
                  {pickerOpen && (
                    <motion.ul className="ai-picker-menu" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                      {assistants.map((a) => (
                        <li key={a.slug}>
                          <button
                            className={a.slug === assistant?.slug ? 'active' : ''}
                            onClick={() => {
                              setAssistant(a);
                              setPickerOpen(false);
                            }}
                          >
                            <strong>{a.name}</strong>
                            {a.description && <small>{a.description}</small>}
                          </button>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            )}

            <div className="ai-messages" ref={listRef}>
              <div className="ai-msg ai">{welcome}</div>
              {messages.length === 0 && (
                <div className="ai-suggestions">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} className="chip" onClick={() => send(s)}>{s}</button>
                  ))}
                </div>
              )}
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  className={`ai-msg ${m.role === 'user' ? 'user' : 'ai'}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {m.role === 'user' ? <p>{m.content}</p> : <RichText text={m.content} />}
                  {m.products?.length > 0 && (
                    <div className="ai-products">
                      {m.products.map((p) => (
                        <ProductMini key={p.slug} p={p} onNavigate={() => setOpen(false)} />
                      ))}
                    </div>
                  )}
                  {m.role !== 'user' && (
                    <button
                      className={`ai-speak ${speakingIdx === i ? 'is-speaking' : ''}`}
                      onClick={() => speak(m.content, i)}
                      aria-label={speakingIdx === i ? 'Stop reading' : 'Read aloud'}
                    >
                      {speakingIdx === i ? (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></svg> Stop
                        </>
                      ) : (
                        <>
                          <Icon name="volume" size={12} /> Listen
                        </>
                      )}
                    </button>
                  )}
                </motion.div>
              ))}
              {thinking && (
                <div className="ai-msg ai typing" aria-label={`${name} is typing`}>
                  <span /><span /><span />
                </div>
              )}
            </div>

            <form
              className="ai-input"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <label htmlFor="ai-text" className="sr-only">Message</label>
              <textarea
                id="ai-text"
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={listening ? 'Listening… speak now' : 'Type or speak your request…'}
              />
              <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Reply language">
                {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
              <button
                type="button"
                className={`ai-mic ${listening ? 'listening' : ''}`}
                onClick={toggleMic}
                aria-label={listening ? 'Stop listening' : 'Speak your request'}
                aria-pressed={listening}
              >
                <Icon name="mic" size={17} />
              </button>
              <button className="ai-send" type="submit" disabled={thinking || !input.trim()}>
                Send <Icon name="arrowUpRight" size={14} />
              </button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}
