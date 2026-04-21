import { useState, useEffect, useCallback, useRef } from "react";
import Papa from "papaparse";

// ─── Configuration ───────────────────────────────────────────────
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSSPe6b7XJQGHZmrlaPPEjvzONoEief0tMr43Byc-3yxvhhSLLAAODtS9VlWkubP6F67oyDrbBj-KU8/pub?gid=0&single=true&output=csv";
const CONTACT_NAME = "Xander Patton";
const CONTACT_PHONE = "(816) 916-6595";
const CONTACT_EMAIL = "xpatton@college.harvard.edu";
const REFRESH_INTERVAL_MS = 60_000;

// ─── Helpers ─────────────────────────────────────────────────────
function toDriveDirectUrl(url) {
  if (!url) return url;
  const match = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (match) return `https://lh3.googleusercontent.com/d/${match[1]}`;
  return url;
}

function parseItems(csv) {
  const { data } = Papa.parse(csv, { header: true, skipEmptyLines: true });
  return data.map((row) => {
    const images = ["image 1", "image 2", "image 3"]
      .map((key) => toDriveDirectUrl((row[key] || "").trim()))
      .filter(Boolean);
    return {
      name: (row.name || "").trim(),
      category: (row.category || "").trim(),
      price: parseFloat(row.price) || 0,
      images,
      details: (row.details || "").trim(),
      sold: (row.sold || "").trim().toUpperCase() === "TRUE",
    };
  });
}

function formatPrice(price) {
  if (price === 0) return "Free";
  if (Number.isInteger(price)) return `$${price}`;
  return `$${price.toFixed(2)}`;
}

// ─── Styles ──────────────────────────────────────────────────────
const ACCENT = "#e85d04";

const URL_RE = /(https?:\/\/[^\s]+)/g;

function linkify(text) {
  const parts = text.split(URL_RE);
  return parts.map((part, i) => {
    // Use a fresh regex test to avoid global lastIndex issues
    if (/^https?:\/\//.test(part)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: ACCENT }}>
          {part}
        </a>
      );
    }
    return part;
  });
}
const BG = "#faf9f6";
const CARD_BG = "#ffffff";
const TEXT = "#1a1a1a";
const MUTED = "#6b7280";
const SOLD_COLOR = "#dc2626";

const styles = {
  body: {
    margin: 0,
    fontFamily: "'DM Sans', sans-serif",
    background: BG,
    color: TEXT,
    minHeight: "100vh",
  },
  header: {
    textAlign: "center",
    padding: "48px 24px 32px",
  },
  title: {
    fontFamily: "'Playfair Display', serif",
    fontSize: "clamp(2rem, 5vw, 3.2rem)",
    fontWeight: 900,
    margin: 0,
    letterSpacing: "-0.02em",
  },
  subtitle: {
    fontSize: "1.1rem",
    color: MUTED,
    marginTop: 8,
    fontStyle: "italic",
  },
  contact: {
    marginTop: 20,
    fontSize: "0.95rem",
    color: TEXT,
    lineHeight: 1.6,
  },
  contactLink: {
    color: ACCENT,
    textDecoration: "none",
    fontWeight: 500,
  },
  filterBar: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
    padding: "0 24px 24px",
    maxWidth: 960,
    margin: "0 auto",
  },
  chip: (active) => ({
    padding: "6px 16px",
    borderRadius: 999,
    border: `1.5px solid ${active ? ACCENT : "#d1d5db"}`,
    background: active ? ACCENT : "transparent",
    color: active ? "#fff" : TEXT,
    cursor: "pointer",
    fontSize: "0.85rem",
    fontWeight: 500,
    transition: "all 0.15s",
    whiteSpace: "nowrap",
  }),
  sortBtn: (active) => ({
    padding: "6px 14px",
    borderRadius: 999,
    border: `1.5px solid ${active ? ACCENT : "#d1d5db"}`,
    background: active ? ACCENT : "transparent",
    color: active ? "#fff" : TEXT,
    cursor: "pointer",
    fontSize: "0.85rem",
    fontWeight: 500,
    transition: "all 0.15s",
    whiteSpace: "nowrap",
  }),
  toggle: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: "0.85rem",
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(min(340px, 100%), 1fr))",
    gap: 32,
    paddingBottom: 64,
    maxWidth: 1600,
    margin: "0 auto",
  },
  card: (sold) => ({
    background: CARD_BG,
    borderRadius: 12,
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)",
    opacity: sold ? 0.55 : 1,
    filter: sold ? "grayscale(40%)" : "none",
    transition: "transform 0.15s, box-shadow 0.15s",
    position: "relative",
    cursor: "default",
    display: "flex",
    flexDirection: "column",
    height: 505,
  }),
  cardHover: {
    transform: "translateY(-2px)",
    boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
  },
  imgWrap: {
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
    background: "#ffffff",
    cursor: "pointer",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
  },
  img: {
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
    display: "block",
  },
  imgPlaceholder: {
    color: "#d1d5db",
    fontSize: 48,
  },
  cardBody: {
    padding: "14px 16px 18px",
  },
  itemName: {
    fontWeight: 700,
    fontSize: "1.05rem",
    margin: 0,
  },
  categoryTag: {
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: 999,
    background: "#f3f4f6",
    color: MUTED,
    fontSize: "0.75rem",
    fontWeight: 500,
    marginTop: 6,
  },
  price: {
    fontSize: "1.2rem",
    fontWeight: 700,
    color: ACCENT,
    marginTop: 8,
  },
  details: {
    fontSize: "0.88rem",
    color: MUTED,
    marginTop: 8,
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
  detailsClamped: {
    fontSize: "0.88rem",
    color: MUTED,
    marginTop: 8,
    lineHeight: 1.5,
    wordBreak: "break-word",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  seeMoreBtn: {
    background: "none",
    border: "none",
    padding: "2px 0 0",
    color: ACCENT,
    fontSize: "0.82rem",
    fontWeight: 600,
    cursor: "pointer",
    display: "block",
  },
  soldBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    background: SOLD_COLOR,
    color: "#fff",
    fontWeight: 700,
    fontSize: "0.8rem",
    padding: "4px 12px",
    borderRadius: 999,
    letterSpacing: "0.05em",
    zIndex: 2,
  },
  refreshBtn: {
    padding: "6px 14px",
    borderRadius: 999,
    border: `1.5px solid ${ACCENT}`,
    background: "transparent",
    color: ACCENT,
    cursor: "pointer",
    fontSize: "0.85rem",
    fontWeight: 500,
    transition: "all 0.15s",
    whiteSpace: "nowrap",
  },
  footer: {
    textAlign: "center",
    padding: "32px 24px",
    fontSize: "0.85rem",
    color: MUTED,
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.85)",
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "zoom-out",
  },
  lightboxImg: {
    maxWidth: "90vw",
    maxHeight: "90vh",
    objectFit: "contain",
    borderRadius: 8,
    cursor: "default",
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 20,
    background: "none",
    border: "none",
    color: "#fff",
    fontSize: 32,
    cursor: "pointer",
    lineHeight: 1,
    zIndex: 2,
  },
  lightboxNav: {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    background: "rgba(0,0,0,0.5)",
    border: "none",
    color: "#fff",
    fontSize: 40,
    cursor: "pointer",
    padding: "12px 16px",
    lineHeight: 1,
    zIndex: 2,
    borderRadius: 8,
  },
  cardNav: {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    background: "rgba(0,0,0,0.6)",
    border: "2px solid rgba(255,255,255,0.5)",
    color: "#fff",
    fontSize: 28,
    cursor: "pointer",
    padding: "10px 8px",
    lineHeight: 1,
    zIndex: 2,
    opacity: 1,
    transition: "opacity 0.15s",
  },
  imgCounter: {
    position: "absolute",
    top: 10,
    right: 10,
    background: "rgba(0,0,0,0.55)",
    color: "#fff",
    fontSize: "0.78rem",
    fontWeight: 600,
    padding: "3px 8px",
    borderRadius: 999,
    boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
    zIndex: 2,
    letterSpacing: "0.03em",
  },
  empty: {
    textAlign: "center",
    padding: "64px 24px",
    color: MUTED,
    fontSize: "1.1rem",
  },
  loading: {
    textAlign: "center",
    padding: "80px 24px",
    color: MUTED,
    fontSize: "1rem",
  },
};

// ─── Components ──────────────────────────────────────────────────
function Lightbox({ images, index, onClose }) {
  const [current, setCurrent] = useState(index);

  useEffect(() => {
    setCurrent(index);
  }, [index]);

  useEffect(() => {
    if (!images || images.length === 0) return;
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setCurrent((c) => (c + 1) % images.length);
      if (e.key === "ArrowLeft") setCurrent((c) => (c - 1 + images.length) % images.length);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, images]);

  if (!images || images.length === 0) return null;
  return (
    <div style={styles.overlay} onClick={onClose}>
      <button style={styles.closeBtn} onClick={onClose} aria-label="Close">
        ×
      </button>
      {images.length > 1 && (
        <>
          <button
            style={{ ...styles.lightboxNav, left: 16 }}
            onClick={(e) => { e.stopPropagation(); setCurrent((c) => (c - 1 + images.length) % images.length); }}
            aria-label="Previous"
          >
            ‹
          </button>
          <button
            style={{ ...styles.lightboxNav, right: 16 }}
            onClick={(e) => { e.stopPropagation(); setCurrent((c) => (c + 1) % images.length); }}
            aria-label="Next"
          >
            ›
          </button>
        </>
      )}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }} onClick={(e) => e.stopPropagation()}>
        <img
          src={images[current]}
          alt="Full size"
          style={styles.lightboxImg}
          referrerPolicy="no-referrer"
        />
        {images.length > 1 && (
          <div style={{ display: "flex", gap: 8 }}>
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  border: "none",
                  background: i === current ? "#fff" : "rgba(255,255,255,0.4)",
                  cursor: "pointer",
                  padding: 0,
                  transition: "background 0.15s",
                }}
                aria-label={`Image ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ItemCard({ item, onImageClick }) {
  const [hovered, setHovered] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [isTruncatable, setIsTruncatable] = useState(false);
  const detailsRef = useRef(null);

  useEffect(() => {
    if (detailsRef.current && !expanded) {
      setIsTruncatable(detailsRef.current.scrollHeight > detailsRef.current.clientHeight);
    }
  }, [item.details, expanded]);

  const hasImages = item.images.length > 0;
  const hasMultiple = item.images.length > 1;
  const cardStyle = {
    ...styles.card(item.sold),
    ...(hovered && !item.sold ? styles.cardHover : {}),
  };

  return (
    <div
      style={cardStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {item.sold && <span style={styles.soldBadge}>SOLD</span>}
      <div
        style={{ ...styles.imgWrap, position: "relative" }}
        onClick={() => hasImages && onImageClick(item.images, imgIndex)}
      >
        {hasImages ? (
          <img src={item.images[imgIndex]} alt={item.name} style={styles.img} loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <span style={styles.imgPlaceholder}>📷</span>
        )}
        {hasMultiple && (
          <>
            <button
              style={{ ...styles.cardNav, left: 0, borderRadius: "0 4px 4px 0" }}
              onClick={(e) => { e.stopPropagation(); setImgIndex((i) => (i - 1 + item.images.length) % item.images.length); }}
              aria-label="Previous image"
            >‹</button>
            <button
              style={{ ...styles.cardNav, right: 0, borderRadius: "4px 0 0 4px" }}
              onClick={(e) => { e.stopPropagation(); setImgIndex((i) => (i + 1) % item.images.length); }}
              aria-label="Next image"
            >›</button>
            <div style={styles.imgCounter}>
              {imgIndex + 1}/{item.images.length}
            </div>
          </>
        )}
      </div>
      <div style={styles.cardBody}>
        <p style={styles.itemName}>{item.name}</p>
        {item.category && <span style={styles.categoryTag}>{item.category}</span>}
        <p style={styles.price}>{formatPrice(item.price)}</p>
        {item.details && (
          <>
            <p ref={detailsRef} style={expanded ? styles.details : styles.detailsClamped}>
              {linkify(item.details)}
            </p>
            {(isTruncatable || expanded) && (
              <button style={styles.seeMoreBtn} onClick={() => setExpanded((e) => !e)}>
                {expanded ? "See Less" : "See More"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────
export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [sortDir, setSortDir] = useState(null);
  const [hideSold, setHideSold] = useState(false);
  const [lightboxImages, setLightboxImages] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const intervalRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(SHEET_CSV_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const csv = await res.text();
      setItems(parseItems(csv));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [fetchData]);

  // Category order = order of first appearance in the sheet
  const categoryOrder = [...new Set(items.map((i) => i.category).filter(Boolean))];
  const categories = ["All", ...categoryOrder];
  const categoryIndex = (cat) => {
    const i = categoryOrder.indexOf(cat);
    return i === -1 ? categoryOrder.length : i;
  };

  let filtered = items;
  if (activeCategory !== "All") {
    filtered = filtered.filter((i) => i.category === activeCategory);
  }
  if (hideSold) {
    filtered = filtered.filter((i) => !i.sold);
  }
  if (sortDir) {
    filtered = [...filtered].sort((a, b) =>
      sortDir === "asc" ? a.price - b.price : b.price - a.price
    );
  } else {
    // Default: group by category in sheet-appearance order (stable sort preserves in-category order)
    filtered = [...filtered].sort((a, b) => categoryIndex(a.category) - categoryIndex(b.category));
  }

  const cycleSortDir = () => {
    setSortDir((prev) => (prev === null ? "asc" : prev === "asc" ? "desc" : null));
  };

  const sortLabel =
    sortDir === "asc"
      ? "Price: Low → High"
      : sortDir === "desc"
        ? "Price: High → Low"
        : "Sort by Price";

  return (
    <div style={styles.body}>
      <header style={styles.header}>
        <h1 style={styles.title}>Prescott 20A-26 Senior Sale</h1>
        <p style={styles.subtitle}>Take our shit. I know you want it.</p>
        <div style={styles.contact}>
          Want something? Text or email{" "}
          <strong>{CONTACT_NAME} </strong>
          to claim.
          <br />
          <a href={`tel:${CONTACT_PHONE}`} style={styles.contactLink}>
            {CONTACT_PHONE}
          </a>
          {" · "}
          <a href={`mailto:${CONTACT_EMAIL}`} style={styles.contactLink}>
            {CONTACT_EMAIL}
          </a>
        </div>
      </header>

      <div style={styles.filterBar}>
        {categories.map((cat) => (
          <button
            key={cat}
            style={styles.chip(activeCategory === cat)}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
        <button style={styles.sortBtn(sortDir !== null)} onClick={cycleSortDir}>
          {sortLabel}
        </button>
        <label style={styles.toggle}>
          <input
            type="checkbox"
            checked={hideSold}
            onChange={(e) => setHideSold(e.target.checked)}
          />
          Hide sold
        </label>
        <button style={styles.refreshBtn} onClick={fetchData}>
          ↻ Refresh
        </button>
      </div>

      {loading ? (
        <p style={styles.loading}>Loading items…</p>
      ) : error ? (
        <p style={styles.empty}>
          Could not load items. Make sure the CSV URL is set.
          <br />
          <span style={{ fontSize: "0.85rem" }}>{error}</span>
        </p>
      ) : filtered.length === 0 ? (
        <p style={styles.empty}>No items to show.</p>
      ) : (
        <div style={styles.grid} className="item-grid">
          {filtered.map((item, idx) => (
            <ItemCard key={item.name + item.category} item={item} onImageClick={(imgs, idx) => { setLightboxImages(imgs); setLightboxIndex(idx); }} />
          ))}
        </div>
      )}

      <footer style={styles.footer}>Made with ☕ and senioritis</footer>

      <Lightbox images={lightboxImages} index={lightboxIndex} onClose={() => setLightboxImages(null)} />
    </div>
  );
}
