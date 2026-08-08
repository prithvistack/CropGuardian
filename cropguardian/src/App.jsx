import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea,
} from "recharts";
import {
  LayoutDashboard, Camera, Warehouse, History, BookOpen, FileText, Settings as SettingsIcon,
  Leaf, Cpu, Droplet, Wind, Thermometer, Activity, AlertTriangle, CheckCircle2, Lock,
  ChevronRight, Download, Radio, ShieldCheck, Info, Sprout, Bug,
  Flame, CloudRain, Beaker, UploadCloud, ImageUp, Play, Save, Zap, SlidersHorizontal,
  MessageCircle, Send, LogOut, User, RefreshCw, Calendar, Timer, Droplets, Bell, X,
  Users, MapPin, Target, Clock, ScanLine, ChevronDown, Satellite, BrainCircuit,
} from "lucide-react";
import fieldBg from "./assets/field-bg.jpg";
import loginBgVideo from "./assets/video/login-bg.mp4";
import homeHeroVideo from "./assets/video/home-hero.mp4";

/* ---------------------------------------------------------------------- */
/*  Reference data                                                         */
/* ---------------------------------------------------------------------- */

const NAV_ITEMS = [
  { id: "home", label: "Home", icon: LayoutDashboard },
  { id: "detection", label: "Disease Detection", icon: Camera },
  { id: "storage", label: "Storage Monitoring", icon: Warehouse },
  { id: "history", label: "Spraying History", icon: History },
  { id: "library", label: "Disease Library", icon: BookOpen },
  { id: "reports", label: "Reports Center", icon: FileText },
];

const HARDWARE = [
  { id: "controller", name: "Controller", detail: "Arduino UNO Q", icon: Cpu },
  { id: "sht31", name: "SHT31 Sensor", detail: "Temperature / Humidity", icon: Thermometer },
  { id: "soil", name: "Soil Moisture Sensor", detail: "Capacitive v2.0", icon: Droplet },
  { id: "mq135", name: "MQ-135 Gas Sensor", detail: "Air Quality / CO2", icon: Wind },
  { id: "camera", name: "Camera Module", detail: "OV2640 2MP", icon: Camera },
];

const DISEASES = [
  {
    name: "Late Blight",
    sci: "Phytophthora infestans",
    severity: "Critical",
    symptoms: "Water-soaked grey-green lesions on leaves that rapidly turn brown and papery, often with pale sporulation on the underside in humid conditions.",
    conditions: "Cool nights (10-20°C), high humidity above 90%, prolonged leaf wetness.",
    treatment: "Apply a targeted fungicide spray immediately, remove and destroy infected foliage, and improve canopy airflow to reduce humidity around leaves.",
    precautions: ["Avoid overhead watering in the evening", "Space plants for airflow", "Remove volunteer plants and weeds nearby"],
    recoveryDays: "10–14 days",
    stages: [
      { title: "Infection", days: "Days 1–3", desc: "Spores land on wet leaf surfaces and germinate unseen; no visible symptoms yet." },
      { title: "Early Manifestation", days: "Days 4–7", desc: "Small water-soaked grey-green spots appear, usually on lower or older leaves first." },
      { title: "Active Outbreak", days: "Days 8–12", desc: "Lesions expand rapidly and turn brown and papery; white sporulation appears on leaf undersides in humid mornings." },
      { title: "Severe Defoliation", days: "Days 13+", desc: "Widespread leaf and stem collapse; fruit can develop firm brown lesions. Field-wide spread likely without intervention." },
    ],
  },
  {
    name: "Early Blight",
    sci: "Alternaria solani",
    severity: "Moderate",
    symptoms: "Concentric dark brown rings forming a target pattern on older, lower leaves first.",
    conditions: "Warm temperatures (24-29°C), alternating wet and dry periods, plant stress.",
    treatment: "Rotate fungicide classes, mulch to prevent soil splash onto leaves, and maintain balanced nitrogen feeding.",
    precautions: ["Water at the base, not the leaves", "Rotate crops each season", "Stake plants to keep foliage off the ground"],
    recoveryDays: "7–10 days",
    stages: [
      { title: "Infection", days: "Days 1–3", desc: "Fungal spores establish on stressed or damaged lower leaves; symptoms not yet visible." },
      { title: "Early Manifestation", days: "Days 4–7", desc: "Small dark spots begin forming concentric target-like rings on the oldest leaves." },
      { title: "Active Outbreak", days: "Days 8–12", desc: "Rings enlarge and merge, surrounding tissue yellows, and spotting climbs up the plant." },
      { title: "Severe Defoliation", days: "Days 13+", desc: "Heavy leaf drop reduces canopy cover, exposing fruit to sunscald and further stress." },
    ],
  },
  {
    name: "Septoria Leaf Spot",
    sci: "Septoria lycopersici",
    severity: "Moderate",
    symptoms: "Small circular spots with dark margins and light grey centers, dense on lower leaves.",
    conditions: "Extended leaf wetness, temperatures 20-25°C, dense overcrowded canopy.",
    treatment: "Prune lower foliage, apply a targeted fungicide, and switch to drip irrigation to reduce leaf wetting.",
    precautions: ["Prune for airflow", "Disinfect tools between plants", "Avoid working in wet fields"],
    recoveryDays: "7–12 days",
    stages: [
      { title: "Infection", days: "Days 1–3", desc: "Spores splash up from soil onto lower leaves during wet weather; no symptoms visible yet." },
      { title: "Early Manifestation", days: "Days 4–7", desc: "Tiny circular spots with dark margins and grey centers appear on lower foliage." },
      { title: "Active Outbreak", days: "Days 8–12", desc: "Spots multiply densely, causing lower leaves to yellow and dry out." },
      { title: "Severe Defoliation", days: "Days 13+", desc: "Progressive leaf loss moves up the plant, weakening yield and exposing fruit." },
    ],
  },
  {
    name: "Bacterial Spot",
    sci: "Xanthomonas spp.",
    severity: "High",
    symptoms: "Small, dark, greasy-looking lesions on leaves and fruit with yellow halos.",
    conditions: "Warm, wet, and humid weather; spreads readily via splashing water.",
    treatment: "Apply a copper-based bactericide, avoid overhead irrigation, and sanitize tools between plants.",
    precautions: ["Use certified disease-free seed", "Avoid handling wet plants", "Rotate with non-host crops"],
    recoveryDays: "10–16 days",
    stages: [
      { title: "Infection", days: "Days 1–3", desc: "Bacteria enter through leaf pores or wounds after splashing rain; no visible signs yet." },
      { title: "Early Manifestation", days: "Days 4–7", desc: "Small greasy dark spots with yellow halos appear on lower leaves and stems." },
      { title: "Active Outbreak", days: "Days 8–12", desc: "Lesions spread to fruit, forming raised scabby spots; leaf spotting intensifies." },
      { title: "Severe Defoliation", days: "Days 13+", desc: "Heavy leaf yellowing and drop, with fruit quality and marketability badly affected." },
    ],
  },
  {
    name: "Leaf Mold",
    sci: "Passalora fulva",
    severity: "Low",
    symptoms: "Pale yellow patches on upper leaf surface with olive-green velvety mold beneath.",
    conditions: "High humidity above 85% and poor greenhouse ventilation.",
    treatment: "Increase ventilation, reduce humidity below 85%, and apply a preventive fungicide.",
    precautions: ["Ventilate greenhouse daily", "Avoid leaf crowding", "Water early in the day"],
    recoveryDays: "5–8 days",
    stages: [
      { title: "Infection", days: "Days 1–2", desc: "Spores settle in humid greenhouse air onto leaf undersides; symptoms not yet visible." },
      { title: "Early Manifestation", days: "Days 3–5", desc: "Pale yellow patches emerge on the upper leaf surface." },
      { title: "Active Outbreak", days: "Days 6–9", desc: "Olive-green velvety mold develops on the underside directly beneath the yellow patches." },
      { title: "Severe Defoliation", days: "Days 10+", desc: "Affected leaves curl, dry, and drop if humidity remains uncontrolled." },
    ],
  },
  {
    name: "Tomato Yellow Leaf Curl Virus",
    sci: "TYLCV (Begomovirus)",
    severity: "Critical",
    symptoms: "Upward leaf curling, yellowing between veins, and pronounced stunted growth.",
    conditions: "Transmitted by whitefly vectors; spreads fastest in warm, dry seasons.",
    treatment: "Remove and destroy infected plants, control the whitefly vector, and use resistant cultivars going forward.",
    precautions: ["Install insect netting", "Use reflective mulch to deter whiteflies", "Inspect new seedlings before planting"],
    recoveryDays: "No cure — remove plant",
    stages: [
      { title: "Infection", days: "Days 1–5", desc: "Whiteflies transmit the virus while feeding; no visible symptoms during this incubation window." },
      { title: "Early Manifestation", days: "Days 6–10", desc: "New leaves emerge smaller than normal with a faint upward cup." },
      { title: "Active Outbreak", days: "Days 11–18", desc: "Pronounced yellowing between veins, strong leaf curling, and visible stunting of new growth." },
      { title: "Severe Defoliation", days: "Days 19+", desc: "Growth halts almost entirely; flowering and fruit set are severely reduced or stop." },
    ],
  },
];

const CHAT_SUGGESTIONS = [
  "Why did the pump trigger a spray?",
  "How do I prevent Late Blight?",
  "What does high CO2 in the silo mean?",
  "When should I refill the tank?",
];

/* ---------------------------------------------------------------------- */
/*  Utilities                                                               */
/* ---------------------------------------------------------------------- */

const nowStr = () => new Date().toLocaleTimeString("en-IN", { hour12: false });
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const rand = (min, max) => Math.random() * (max - min) + min;

// The sensor's actual physical dry/wet raw ADC readings — the "ground truth"
// the calibration tool is trying to help the user discover. If the user's
// saved calibration doesn't match these, displayed % will drift from reality,
// which is the whole point of a calibration tool.
const ACTUAL_DRY_RAW = 820;
const ACTUAL_WET_RAW = 380;

const DEFAULT_SETTINGS = {
  soilThreshold: 55,
  tempThreshold: 18,
  humidityThreshold: 90,
  confidenceThreshold: 90,
  cooldownSec: 45,
  sprayDurationSec: 3,
};

const DEFAULT_CALIBRATION = { dryRaw: ACTUAL_DRY_RAW, wetRaw: ACTUAL_WET_RAW };

function loadPersisted(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

// Converts a raw capacitive-sensor ADC reading into a % moisture value using
// the given dry/wet calibration points. Capacitive probes read HIGHER raw
// values when dry, LOWER when wet — hence dryRaw is the upper bound here.
function soilPercentFromRaw(raw, calibration) {
  const { dryRaw, wetRaw } = calibration;
  if (dryRaw === wetRaw) return 0;
  const pct = ((dryRaw - raw) / (dryRaw - wetRaw)) * 100;
  return Math.round(clamp(pct, 0, 100));
}

function generateHistory(days) {
  const arr = [];
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  let detectionsBase = 2;
  for (let i = 0; i < days; i++) {
    const detections = Math.max(0, Math.round(detectionsBase + rand(-2, 3)));
    const byDisease = {};
    let remaining = detections;
    while (remaining > 0) {
      const disease = DISEASES[Math.floor(Math.random() * DISEASES.length)].name;
      byDisease[disease] = (byDisease[disease] || 0) + 1;
      remaining -= 1;
    }
    arr.push({
      date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      detections,
      byDisease,
      avgTemp: Math.round(clamp(12.5 + rand(-2, 2), 8, 18) * 10) / 10,
      avgHumidity: Math.round(clamp(85 + rand(-6, 6), 76, 94)),
      avgSoil: Math.round(clamp(63 + rand(-10, 10), 42, 82)),
    });
    d.setDate(d.getDate() + 1);
  }
  return arr;
}

const staggerContainer = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const staggerItem = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } } };

function seedTelemetry() {
  const arr = [];
  let t = new Date();
  t.setMinutes(t.getMinutes() - 11 * 5);
  let soilTrue = 63, temp = 12.5, hum = 85, co2 = 460;
  for (let i = 0; i < 12; i++) {
    soilTrue = clamp(soilTrue + rand(-2.5, 2.5), 45, 78);
    temp = clamp(temp + rand(-0.4, 0.4), 9, 16);
    hum = clamp(hum + rand(-1.5, 1.5), 78, 92);
    co2 = clamp(co2 + rand(-15, 15), 400, 560);
    const soilRaw = Math.round(clamp(ACTUAL_DRY_RAW - (soilTrue / 100) * (ACTUAL_DRY_RAW - ACTUAL_WET_RAW) + rand(-15, 15), 300, 900));
    arr.push({
      time: t.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }),
      soilRaw,
      soilMoisture: soilPercentFromRaw(soilRaw, DEFAULT_CALIBRATION),
      temp: Math.round(temp * 10) / 10,
      humidity: Math.round(hum),
      co2: Math.round(co2),
    });
    t = new Date(t.getTime() + 5 * 60000);
  }
  return arr;
}

/* ---------------------------------------------------------------------- */
/*  Reusable UI primitives                                                 */
/* ---------------------------------------------------------------------- */

function Card({ children, className = "" }) {
  return (
    <div className={`bg-white/90 backdrop-blur-sm border border-forest-100 rounded-2xl shadow-[0_1px_2px_rgba(15,56,0,0.05),0_8px_20px_rgba(15,56,0,0.06)] transition-all duration-300 hover:shadow-[0_2px_4px_rgba(15,56,0,0.07),0_14px_28px_rgba(15,56,0,0.10)] hover:-translate-y-0.5 relative overflow-hidden ${className}`}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
      {children}
    </div>
  );
}

/** Soft, out-of-focus foliage glow sitting behind the whole app — evokes a leafy,
 *  premium feel without using stock photography. Purely decorative. */
function AmbientBackground({ image = fieldBg, imageOpacity = 0.06, overlayOpacity = 0.7 }) {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {imageOpacity > 0 && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${image})`, opacity: imageOpacity }}
        />
      )}
      <motion.div
        className="absolute -top-32 -left-24 w-[28rem] h-[28rem] rounded-full bg-forest-300/45 blur-3xl"
        animate={{ x: [0, 40, -10, 0], y: [0, 30, -20, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/4 -right-32 w-[26rem] h-[26rem] rounded-full bg-rose-200/45 blur-3xl"
        animate={{ x: [0, -30, 20, 0], y: [0, -25, 15, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-40 left-1/4 w-[30rem] h-[30rem] rounded-full bg-leaf-200/40 blur-3xl"
        animate={{ x: [0, 25, -35, 0], y: [0, -15, 25, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 w-64 h-64 rounded-full bg-lime-200/40 blur-3xl"
        animate={{ x: [0, -20, 15, 0], y: [0, 20, -15, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full bg-aqua-200/40 blur-3xl"
        animate={{ x: [0, 18, -22, 0], y: [0, -18, 12, 0] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-leaf-50 via-white to-forest-50" style={{ opacity: overlayOpacity }} />
    </div>
  );
}

function LeafShape({ x, y, size, rotate, color, opacity = 1, blur = false }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${size / 100})`} opacity={opacity} filter={blur ? "url(#leafBlur)" : undefined}>
      <path
        d="M50 4 C64 18 92 24 96 46 C80 50 70 62 74 92 C55 78 45 78 26 92 C30 62 20 50 4 46 C8 24 36 18 50 4 Z"
        fill={color}
      />
      <path d="M50 10 C50 40 50 65 50 88" stroke="rgba(0,0,0,0.12)" strokeWidth="2" fill="none" />
    </g>
  );
}

/** Original vector leaf-and-bokeh artwork (no stock photography) used to give key
 *  moments — like the login screen — a warm, in-the-field feel on brand. */
function LeafyBokeh({ variant = "corners" }) {
  const leaves = [
    { x: -40, y: -60, size: 190, rotate: -18, color: "#235235", opacity: 0.9 },
    { x: 60, y: -90, size: 150, rotate: 12, color: "#2c6642", opacity: 0.85 },
    { x: -80, y: 40, size: 130, rotate: 35, color: "#1c4129", opacity: 0.75, blur: true },
    { x: 150, y: -30, size: 110, rotate: -25, color: "#3d8055", opacity: 0.6, blur: true },
  ];
  const bokeh = [
    { cx: 20, cy: -10, r: 10 }, { cx: 130, cy: 30, r: 6 }, { cx: -20, cy: 70, r: 8 },
    { cx: 90, cy: -60, r: 5 }, { cx: -60, cy: -20, r: 7 },
  ];
  const goldBokeh = [{ cx: 55, cy: -40, r: 6 }, { cx: -90, cy: 10, r: 4 }];

  const Corner = ({ className }) => (
    <svg viewBox="-120 -120 300 300" className={className} aria-hidden="true">
      <defs>
        <filter id="leafBlur"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>
      {leaves.map((l, i) => <LeafShape key={i} {...l} />)}
      {bokeh.map((b, i) => (
        <circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill="#dcc4a8" opacity="0.5" filter="url(#leafBlur)" />
      ))}
      {goldBokeh.map((b, i) => (
        <circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill="#dcb75f" opacity="0.55" filter="url(#leafBlur)" />
      ))}
    </svg>
  );

  if (variant === "corners") {
    return (
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <Corner className="absolute -top-8 -left-8 w-72 h-72 opacity-80" />
        <Corner className="absolute -bottom-16 -right-12 w-80 h-80 rotate-180 opacity-70" />
      </div>
    );
  }
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <Corner className="absolute -top-10 -right-10 w-56 h-56 opacity-25" />
    </div>
  );
}


function SectionTitle({ icon: Icon, title, sub, tone = "emerald" }) {
  const chipMap = {
    emerald: "bg-forest-50 text-forest-600",
    sky: "bg-aqua-50 text-aqua-600",
    earth: "bg-rose-100 text-rose-600",
  };
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        {Icon && (
          <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${chipMap[tone] || chipMap.emerald}`}>
            <Icon size={13} />
          </span>
        )}
        <h3 className="text-gray-700 font-semibold tracking-wide text-[13px] uppercase">{title}</h3>
      </div>
      {sub && <span className="text-xs text-gray-400 font-mono">{sub}</span>}
    </div>
  );
}

function useCountUp(target, duration = 900) {
  const [display, setDisplay] = useState(0);
  const isNumeric = !isNaN(parseFloat(target)) && isFinite(target);
  useEffect(() => {
    if (!isNumeric) return;
    const end = parseFloat(target);
    const isDecimal = String(target).includes(".");
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = end * eased;
      setDisplay(isDecimal ? Math.round(value * 10) / 10 : Math.round(value));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return isNumeric ? display : target;
}

function KpiCard({ label, value, unit, icon: Icon, tone = "emerald", trend }) {
  const animated = useCountUp(value);
  const toneMap = {
    emerald: "text-white bg-gradient-to-br from-forest-600 to-forest-800 shadow-forest-700/40",
    sky: "text-white bg-gradient-to-br from-aqua-600 to-aqua-800 shadow-aqua-700/40",
    amber: "text-white bg-gradient-to-br from-orange-500 to-orange-700 shadow-orange-600/40",
    red: "text-white bg-gradient-to-br from-rose-500 to-rose-700 shadow-rose-600/40",
    earth: "text-forest-900 bg-gradient-to-br from-leaf-400 to-leaf-500 shadow-leaf-500/40",
  };
  return (
    <Card className="p-5 flex items-center justify-between overflow-hidden relative group">
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">{label}</p>
        <p className="text-2xl font-bold text-gray-900 font-mono tracking-tight">
          {animated}
          {unit && <span className="text-sm text-gray-400 font-sans ml-1">{unit}</span>}
        </p>
        {trend && <p className="text-xs text-gray-400 mt-1">{trend}</p>}
      </div>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 ${toneMap[tone]}`}>
        <Icon size={20} />
      </div>
    </Card>
  );
}

function StatusDot({ online = true }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      {online && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-forest-400 opacity-60" />}
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${online ? "bg-forest-500" : "bg-red-500"}`} />
    </span>
  );
}

function Toggle({ checked, onChange, label, sublabel }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div>
        <p className="text-sm text-gray-800 font-medium">{label}</p>
        {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 shrink-0 ${checked ? "bg-rose-500" : "bg-gray-300"}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-300 ${checked ? "translate-x-5" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

function timeAgo(timeStr) {
  // activityLog stores a locale time string, not a full timestamp — good enough
  // for a "just now" style feed since entries are always same-day.
  return timeStr;
}

const NOTIF_STYLE = {
  alert: { icon: AlertTriangle, dot: "bg-rose-500", chip: "bg-rose-50 text-rose-600" },
  lock: { icon: Lock, dot: "bg-lime-500", chip: "bg-lime-50 text-lime-700" },
  detect: { icon: Bug, dot: "bg-leaf-500", chip: "bg-leaf-50 text-leaf-600" },
  spray: { icon: Droplet, dot: "bg-aqua-500", chip: "bg-aqua-50 text-aqua-600" },
  water: { icon: Droplets, dot: "bg-aqua-600", chip: "bg-aqua-100 text-aqua-700" },
  info: { icon: Info, dot: "bg-forest-400", chip: "bg-forest-50 text-forest-600" },
  system: { icon: Radio, dot: "bg-gray-400", chip: "bg-gray-100 text-gray-500" },
};

function NotificationBell({ activityLog, unreadCount, open, onToggle }) {
  const important = activityLog.slice(0, 20);

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="relative w-9 h-9 rounded-full bg-white/70 border border-white/80 hover:bg-white flex items-center justify-center transition-colors shadow-sm"
        aria-label="Notifications"
      >
        <Bell size={16} className="text-leaf-700" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-11 w-80 max-h-[28rem] overflow-hidden bg-white/95 backdrop-blur-md border border-white/80 rounded-2xl shadow-xl z-30 flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="font-display font-semibold text-slate-800 text-sm">Notifications</p>
              <button onClick={onToggle} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {important.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">You're all caught up.</p>
              ) : (
                important.map((log) => {
                  const style = NOTIF_STYLE[log.type] || NOTIF_STYLE.info;
                  const Icon = style.icon;
                  return (
                    <div key={log.id} className="flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-forest-50/40 transition-colors">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${style.chip}`}>
                        <Icon size={13} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-700 leading-snug">{log.message}</p>
                        <p className="text-[10px] text-gray-400 font-mono mt-1">{timeAgo(log.time)}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Badge({ tone, children, icon: Icon }) {
  const toneMap = {
    sky: "bg-aqua-50 text-aqua-700 ring-aqua-200",
    amber: "bg-rose-50 text-rose-700 ring-rose-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    slate: "bg-gray-100 text-gray-600 ring-gray-200",
    earth: "bg-rose-100 text-rose-700 ring-rose-200",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ring-1 ${toneMap[tone]}`}>
      {Icon && <Icon size={12} />}
      {children}
    </span>
  );
}

function TankGauge({ level, compact = false }) {
  const tone = level > 45 ? "emerald" : level > 15 ? "amber" : "red";
  const gradient =
    tone === "emerald" ? "from-forest-400 to-forest-600" : tone === "amber" ? "from-rose-400 to-rose-600" : "from-red-400 to-red-600";
  return (
    <div className={compact ? "flex items-center gap-3" : ""}>
      <div className={compact ? "w-10 h-16 shrink-0" : "w-14 h-28 mx-auto"}>
        <div className="relative w-full h-full rounded-md border-2 border-gray-300 bg-gray-50 overflow-hidden">
          <motion.div
            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${gradient}`}
            initial={false}
            animate={{ height: `${level}%` }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          >
            <motion.div
              className="absolute -top-1 left-0 right-0 h-2 bg-white/30 blur-[2px]"
              animate={{ x: ["-20%", "20%", "-20%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        </div>
      </div>
      <div className={compact ? "" : "text-center mt-2"}>
        <p className="text-lg font-mono font-bold text-gray-900">{Math.round(level)}%</p>
        <p className="text-xs text-gray-400">Tank Level</p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Login                                                                   */
/* ---------------------------------------------------------------------- */

function AnimatedGrassField({ opacity = 0.5, height = 140 }) {
  // A row of simple blade shapes that sway independently via framer-motion —
  // gives a living, video-like feel without an actual video file.
  const blades = Array.from({ length: 34 }, (_, i) => {
    const x = (i / 33) * 100;
    const h = 60 + ((i * 37) % 50);
    const tilt = (i % 2 === 0 ? 1 : -1) * (4 + (i % 5));
    const dur = 2.6 + (i % 5) * 0.35;
    const delay = (i % 7) * 0.18;
    const color = i % 3 === 0 ? "#3d8055" : i % 3 === 1 ? "#2c6642" : "#679a51";
    return { x, h, tilt, dur, delay, color, key: i };
  });

  return (
    <div
      className="absolute bottom-0 left-0 right-0 -z-10 overflow-hidden pointer-events-none"
      style={{ height, opacity }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full">
        {blades.map((b) => (
          <motion.path
            key={b.key}
            d={`M ${b.x} 40 Q ${b.x + b.tilt * 0.3} ${40 - b.h / 100 * 25} ${b.x + b.tilt} ${40 - b.h / 100 * 40}`}
            stroke={b.color}
            strokeWidth="0.6"
            strokeLinecap="round"
            fill="none"
            initial={{ rotate: 0 }}
            animate={{ rotate: [0, b.tilt > 0 ? 3 : -3, 0] }}
            transition={{ duration: b.dur, delay: b.delay, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: `${b.x}px 40px` }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 bg-gradient-to-t from-white via-white/40 to-transparent" />
    </div>
  );
}

const LANDING_STATS = [
  { value: "10,000+", label: "Leaves Analyzed", icon: ScanLine },
  { value: "9+", label: "Tomato Diseases Detected", icon: Bug },
  { value: "250+", label: "Villages Covered", icon: MapPin },
  { value: "95%+", label: "Model Classification Accuracy", icon: Target },
  { value: "1,200+", label: "Farmers & Agronomists Supported", icon: Users },
  { value: "24/7", label: "Real-time Instant Diagnosis", icon: Clock },
];

function HomeView() {
  return (
    <div>
      {/* Hero */}
      <section className="relative h-[70vh] min-h-[420px] overflow-hidden flex items-center rounded-b-3xl">
        <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover">
          <source src={homeHeroVideo} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-r from-forest-950/85 via-forest-950/55 to-forest-950/30" />
        <div className="relative max-w-7xl mx-auto px-6 w-full">
          <div className="max-w-2xl">
            <div className="w-10 h-1 bg-leaf-400 mb-6 rounded-full" />
            <h1 className="font-display font-extrabold text-white text-4xl md:text-5xl leading-tight mb-5">
              India's AI-Powered Tomato Crop Health &amp; Disease Detection Platform
            </h1>
            <p className="text-forest-100/90 text-base md:text-lg max-w-xl">
              Autonomous field robotics, real-time leaf disease detection, and precision spraying — built to protect every tomato plant in the field.
            </p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="font-display font-bold text-3xl text-center mb-2 text-forest-950">
            Welcome to <span className="text-forest-600">CropGuardian AI</span>
          </h2>
          <p className="text-center text-gray-500 mb-14">Precision agriculture, built for India's tomato farmers</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
            {LANDING_STATS.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                whileHover={{ y: -6 }}
                className="flex flex-col items-center text-center"
              >
                <div className="w-16 h-16 rounded-full bg-forest-600 flex items-center justify-center mb-4 shadow-lg shadow-forest-600/20">
                  <s.icon size={26} className="text-white" />
                </div>
                <p className="font-display font-extrabold text-3xl text-forest-700 mb-1">{s.value}</p>
                <p className="text-sm text-gray-600 font-medium">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Split: About */}
      <section className="py-20 px-6 bg-forest-50">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs font-bold text-leaf-700 tracking-widest uppercase mb-3">About the platform</p>
            <h3 className="font-display font-bold text-3xl text-forest-950 mb-5">Deep learning built for the tomato leaf</h3>
            <p className="text-gray-600 leading-relaxed mb-4">
              CropGuardian AI pairs a field-ready camera rover with a trained disease-classification model so pathogens are caught within hours of symptoms appearing, not days.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Every detection is logged, every spray is dosage-limited, and every reading — soil, climate, and visual — feeds back into a single dashboard built for real field decisions.
            </p>
          </div>
          <div className="relative rounded-2xl overflow-hidden shadow-xl aspect-[4/3] bg-forest-900 flex items-center justify-center">
            <BrainCircuit size={120} className="text-leaf-400/40" />
          </div>
        </div>
      </section>

      {/* Split: Infra */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div className="relative rounded-2xl overflow-hidden shadow-xl aspect-[4/3] bg-forest-900 flex items-center justify-center order-2 md:order-1">
            <Satellite size={120} className="text-leaf-400/40" />
          </div>
          <div className="order-1 md:order-2">
            <p className="text-xs font-bold text-leaf-700 tracking-widest uppercase mb-3">Infrastructure &amp; AI tech</p>
            <h3 className="font-display font-bold text-3xl text-forest-950 mb-5">CNN-based detection, field-tested hardware</h3>
            <p className="text-gray-600 leading-relaxed mb-4">
              An onboard camera rover streams leaf imagery to a trained classification model, mapping detections back to precise field zones village by village.
            </p>
            <p className="text-gray-600 leading-relaxed">
              From autonomous spraying to cold-storage climate tracking, the same intelligence layer runs the whole operation end to end.
            </p>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="py-20 px-6 bg-leaf-400">
        <div className="max-w-7xl mx-auto">
          <h3 className="font-display font-bold text-3xl text-center text-forest-950 mb-14">Pillars of CropGuardian AI</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { icon: ScanLine, title: "Real-time detection", desc: "Leaf-level diagnosis within hours of symptoms." },
              { icon: Droplet, title: "Precision spraying", desc: "Dosage-limited, overdose-locked automation." },
              { icon: Warehouse, title: "Storage intelligence", desc: "Live climate tracking for post-harvest safety." },
              { icon: Users, title: "Farmer-first design", desc: "Built around real field workflows, not dashboards for their own sake." },
            ].map((p) => (
              <div key={p.title} className="text-center">
                <div className="w-16 h-16 rounded-full border-2 border-forest-900/30 flex items-center justify-center mx-auto mb-4">
                  <p.icon size={26} className="text-forest-900" />
                </div>
                <p className="font-display font-bold text-forest-950 mb-1.5">{p.title}</p>
                <p className="text-xs text-forest-900/70 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-10 px-6 bg-forest-950 text-center rounded-t-none">
        <p className="text-forest-400 text-xs">Grown with care, guarded by AI 🌱</p>
      </section>
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("Farm Operator");

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onLogin({ name: name.trim(), role });
  };

  return (
    <div className="login-legacy-fonts min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-earth-900">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src={loginBgVideo} type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-gradient-to-b from-earth-900/60 via-earth-900/35 to-earth-900/70" />
      <LeafyBokeh />
      <div className="w-full max-w-sm relative">
        <div className="rounded-3xl overflow-hidden shadow-xl shadow-brand-900/10 border border-gold-200/60">
          {/* Banner header */}
          <div className="relative bg-gradient-to-br from-brand-900 via-earth-800 to-gold-700 px-6 py-8 flex flex-col items-center text-center overflow-hidden">
            <LeafyBokeh variant="inline" />
            <motion.div
              initial={{ scale: 0.7, rotate: -8, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="w-12 h-12 rounded-2xl bg-white/15 ring-1 ring-gold-200/50 flex items-center justify-center mb-3 relative z-10"
            >
              <Sprout size={24} className="text-gold-100" />
            </motion.div>
            <h1 className="font-display font-bold text-white text-2xl tracking-tight relative z-10">CropGuardian AI</h1>
            <p className="text-xs text-gold-100/90 mt-1.5 relative z-10 italic tracking-wide">Where every leaf is seen</p>
          </div>

          {/* Form body */}
          <div className="bg-gradient-to-b from-earth-50 to-sage-50/60 px-6 py-7">
            <p className="text-sm font-semibold text-gray-700 mb-4">Welcome back to the field</p>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">Full name</label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ramesh Patil"
                  className="w-full bg-white border border-earth-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-gold-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-white border border-earth-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-gold-400"
                >
                  <option>Farm Operator</option>
                  <option>Agronomist</option>
                  <option>Farm Owner</option>
                  <option>Field Technician</option>
                </select>
              </div>
              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="w-full bg-gradient-to-r from-earth-700 via-earth-600 to-gold-600 hover:from-earth-800 hover:via-earth-700 hover:to-gold-700 text-white text-sm font-semibold py-3 rounded-full shadow-md shadow-earth-700/25 transition-colors"
              >
                Continue
              </motion.button>
            </form>
          </div>
        </div>
        <p className="text-xs text-earth-600 text-center mt-5">Grown with care, guarded by AI 🌱</p>
      </div>
    </div>
  );
}


/* ---------------------------------------------------------------------- */
/*  Dashboard view                                                          */
/* ---------------------------------------------------------------------- */

function DashboardView({ telemetry, pumpOverride, setPumpOverride, fanOverride, setFanOverride, overdoseLocked, cooldownRemaining, activityLog, alertCount, tankLevel }) {
  return (
    <div className="space-y-6">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        <motion.div variants={staggerItem}><KpiCard label="Crop Health Index" value="94" unit="%" icon={Leaf} tone="emerald" trend="+1.2% vs. yesterday" /></motion.div>
        <motion.div variants={staggerItem}><KpiCard label="AI Inference Confidence" value="98.7" unit="%" icon={Camera} tone="sky" trend="Model v2.3" /></motion.div>
        <motion.div variants={staggerItem}><KpiCard label="Storage Vault Status" value="Optimal" icon={Warehouse} tone="earth" trend="Within safe range" /></motion.div>
        <motion.div variants={staggerItem}><KpiCard label="Active Alerts" value={String(alertCount)} icon={AlertTriangle} tone={alertCount > 0 ? "amber" : "emerald"} trend={alertCount > 0 ? "Requires review" : "All clear"} /></motion.div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3 space-y-6">
          <Card className="p-5">
            <SectionTitle icon={Droplet} title="Greenhouse Soil Moisture" sub="Zone 1 · live" />
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={telemetry} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="soilFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2c6642" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#2c6642" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="time" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} domain={[30, 90]} unit="%" />
                <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="soilMoisture" name="Soil Moisture" stroke="#2c6642" strokeWidth={2} fill="url(#soilFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-5">
            <SectionTitle icon={Thermometer} title="Storage Climate Analytics" sub="Temp · Humidity · CO2" tone="sky" />
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={telemetry} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="time" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#6b7280" }} />
                <Line yAxisId="left" type="monotone" dataKey="temp" name="Temp (°C)" stroke="#8f6339" strokeWidth={2} dot={false} />
                <Line yAxisId="left" type="monotone" dataKey="humidity" name="Humidity (%)" stroke="#2f7aab" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="co2" name="CO2 (ppm)" stroke="#235235" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <div className="xl:col-span-2 space-y-6">
          <Card className="p-5">
            <SectionTitle icon={Radio} title="Live Hardware Matrix" />
            <div className="space-y-1">
              {HARDWARE.map((h) => (
                <motion.div
                  key={h.id}
                  whileHover={{ x: 3 }}
                  className="flex items-center justify-between py-2 px-2 -mx-2 rounded-lg border-b border-gray-100 last:border-0 hover:bg-forest-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-forest-50 to-aqua-50 flex items-center justify-center text-forest-600">
                      <h.icon size={15} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-800 font-medium leading-tight">{h.name}</p>
                      <p className="text-xs text-gray-400 leading-tight">{h.detail}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-forest-600 font-mono">Online</span>
                    <StatusDot online={true} />
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <SectionTitle icon={Droplets} title="Spray Tank Level" tone="sky" />
            </div>
            <div className="flex items-center justify-center gap-6">
              <TankGauge level={tankLevel} />
              <div className="text-sm text-gray-500 max-w-[10rem]">
                {tankLevel > 45 && "Sufficient liquid for autonomous operation."}
                {tankLevel <= 45 && tankLevel > 15 && "Getting low — plan a refill soon."}
                {tankLevel <= 15 && "Critically low — refill from Settings before next spray cycle."}
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle icon={Zap} title="Quick Actions" />
            <Toggle checked={pumpOverride} onChange={setPumpOverride} label="Manual Pump Override" sublabel="Zone 1 — Digital Pin D7" />
            <Toggle checked={fanOverride} onChange={setFanOverride} label="Manual 12V Fan Override" sublabel="Storage Vault Ventilation" />
            {(pumpOverride || fanOverride) && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <Badge tone="amber" icon={AlertTriangle}>Autonomous logic paused — manual control active</Badge>
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-gray-100">
              {overdoseLocked ? (
                <Badge tone="amber" icon={Lock}>Overdose Prevention Active — Spray Suppressed ({cooldownRemaining}s)</Badge>
              ) : (
                <Badge tone="emerald" icon={ShieldCheck}>Overdose Lock — Ready</Badge>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Card className="p-5">
        <SectionTitle icon={Activity} title="Real-Time Activity Feed" sub="Live" />
        <div className="space-y-0 max-h-64 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {activityLog.map((log) => (
              <motion.div
                key={log.id}
                layout
                initial={{ opacity: 0, x: -12, height: 0 }}
                animate={{ opacity: 1, x: 0, height: "auto" }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0"
              >
                <span className="text-xs font-mono text-gray-400 mt-0.5 shrink-0 w-20">{log.time}</span>
                <LogIcon type={log.type} />
                <span className="text-sm text-gray-700 leading-snug">{log.message}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </Card>
    </div>
  );
}

function LogIcon({ type }) {
  const map = {
    info: <Info size={14} className="text-aqua-500 mt-0.5 shrink-0" />,
    detect: <Bug size={14} className="text-rose-500 mt-0.5 shrink-0" />,
    spray: <Droplet size={14} className="text-forest-500 mt-0.5 shrink-0" />,
    lock: <Lock size={14} className="text-rose-500 mt-0.5 shrink-0" />,
    alert: <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />,
    system: <Cpu size={14} className="text-gray-400 mt-0.5 shrink-0" />,
  };
  return map[type] || map.info;
}

/* ---------------------------------------------------------------------- */
/*  Disease Detection view — photo upload flow                             */
/* ---------------------------------------------------------------------- */

function DiseaseDetectionView({ onScanComplete, overdoseLocked, cooldownRemaining, sprayState, tankLevel }) {
  const [imgSrc, setImgSrc] = useState(null);
  const [fileName, setFileName] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => setImgSrc(e.target.result);
    reader.readAsDataURL(file);
  };

  const analyze = () => {
    if (!imgSrc) return;
    setAnalyzing(true);
    setTimeout(() => {
      const detected = Math.random() < 0.6;
      const count = detected ? (Math.random() < 0.25 ? 2 : 1) : 0;
      const disease = DISEASES[Math.floor(Math.random() * DISEASES.length)];
      const confidence = Math.round(rand(91, 99.4) * 10) / 10;
      const outcome = { detected, count, disease: detected ? disease.name : "Healthy Leaf Tissue", confidence, record: detected ? disease : null };
      setResult(outcome);
      setAnalyzing(false);
      onScanComplete(outcome);
    }, 1600);
  };

  const reset = () => {
    setImgSrc(null);
    setFileName("");
    setResult(null);
  };

  return (
    <div className="relative -m-6 p-6 overflow-hidden">
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-20 left-10 w-96 h-96 rounded-full bg-amber-200/50 blur-3xl"
          animate={{ x: [0, 30, -10, 0], y: [0, 20, -15, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/3 right-10 w-80 h-80 rounded-full bg-rose-200/50 blur-3xl"
          animate={{ x: [0, -25, 15, 0], y: [0, -20, 10, 0] }}
          transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-0 left-1/3 w-72 h-72 rounded-full bg-yellow-100/60 blur-3xl"
          animate={{ x: [0, 20, -20, 0], y: [0, -10, 15, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-amber-50/70 via-white to-rose-50/60" />
      </div>

      <div className="relative grid grid-cols-1 xl:grid-cols-5 gap-6">
      <div className="xl:col-span-3 space-y-6">
        <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}>
        <Card className="p-5">
          <SectionTitle icon={ImageUp} title="Upload Leaf Photo" sub="JPG, PNG" />

          {!imgSrc && (
            <button
              onClick={() => inputRef.current?.click()}
              className="w-full border-2 border-dashed border-forest-200 hover:border-forest-400 rounded-2xl aspect-video flex flex-col items-center justify-center gap-2 text-forest-500/70 hover:text-forest-600 transition-colors bg-forest-50/50 hover:bg-forest-50"
            >
              <UploadCloud size={32} />
              <p className="text-sm font-medium">Click to upload a tomato leaf photo</p>
              <p className="text-xs">or drag and drop an image here</p>
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />

          {imgSrc && (
            <div>
              <div className="relative rounded-lg overflow-hidden border border-rose-200/70 bg-rose-50">
                <img src={imgSrc} alt="Uploaded leaf" className="w-full max-h-96 object-contain" />
              </div>
              <p className="text-xs text-gray-400 mt-2 truncate">{fileName}</p>

              <div className="flex items-center gap-3 mt-4">
                <motion.button
                  onClick={analyze}
                  disabled={analyzing}
                  whileHover={{ scale: analyzing ? 1 : 1.03 }}
                  whileTap={{ scale: analyzing ? 1 : 0.96 }}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-forest-600 to-forest-500 hover:from-forest-700 hover:to-forest-600 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-md shadow-forest-600/20 transition-colors"
                >
                  {analyzing ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
                  {analyzing ? "Analyzing photo..." : "Analyze Photo"}
                </motion.button>
                <button
                  onClick={reset}
                  className="text-sm font-medium text-gray-500 hover:text-gray-700 px-3 py-2.5"
                >
                  Upload a different photo
                </button>
              </div>
            </div>
          )}
        </Card>
        </motion.div>

        {result && (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
          <Card className="p-5">
            <SectionTitle icon={Bug} title="Detection Result" />
            {!result.detected ? (
              <div className="flex items-start gap-3 bg-forest-50 ring-1 ring-forest-100 rounded-lg p-4">
                <CheckCircle2 size={20} className="text-forest-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-forest-800">No disease detected</p>
                  <p className="text-sm text-forest-700 mt-0.5">This leaf appears healthy — {result.confidence}% confidence. No action needed.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3 bg-rose-50 ring-1 ring-rose-100 rounded-lg p-4">
                  <AlertTriangle size={20} className="text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-rose-800">
                      {result.count} disease indicator{result.count > 1 ? "s" : ""} detected — {result.disease}
                    </p>
                    <p className="text-sm text-rose-700 mt-0.5">Confidence: {result.confidence}%</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">What should be done</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{result.record.treatment}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-rose-50 rounded-lg p-3">
                    <p className="text-xs text-gray-400 mb-1">Estimated recovery</p>
                    <p className="text-sm font-semibold text-gray-800">{result.record.recoveryDays}</p>
                  </div>
                  <div className="bg-rose-50 rounded-lg p-3">
                    <p className="text-xs text-gray-400 mb-1">Severity</p>
                    <p className="text-sm font-semibold text-gray-800">{result.record.severity}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Precautions to take</p>
                  <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                    {result.record.precautions.map((p) => <li key={p}>{p}</li>)}
                  </ul>
                </div>
              </div>
            )}
          </Card>
          </motion.div>
        )}
      </div>

      <div className="xl:col-span-2 space-y-6">
        <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}>
        <Card className="p-5">
          <SectionTitle icon={Camera} title="Inference Details" />
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">Model</span><span className="text-gray-700 font-mono">MobileNetV3-Leaf</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Classes</span><span className="text-gray-700 font-mono">6 pathogens + healthy</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Confidence threshold</span><span className="text-gray-700 font-mono">90.0%</span></div>
          </div>
        </Card>
        </motion.div>

        <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}>
        <Card className="p-5">
          <SectionTitle icon={Droplets} title="Spray Tank" tone="sky" />
          <TankGauge level={tankLevel} />
        </Card>
        </motion.div>

        <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut", delay: 0.9 }}>
        <Card className="p-5">
          <SectionTitle icon={Droplet} title="Single-Tank Spray Channel" sub="Pin D7" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">Active state</span>
            <Badge tone={sprayState === "fungicide" ? "amber" : sprayState === "irrigation" ? "sky" : "slate"}>
              {sprayState === "fungicide" ? "Targeted Fungicide Spray" : sprayState === "irrigation" ? "Clean Water Irrigation" : "Idle"}
            </Badge>
          </div>
          {overdoseLocked ? (
            <div className="rounded-lg bg-rose-50 ring-1 ring-rose-100 p-3">
              <p className="text-xs text-rose-700 font-medium flex items-center gap-1.5"><Lock size={13} /> Overdose Prevention Active — Spray Suppressed</p>
              <p className="text-xs text-gray-400 mt-1">Cooldown resets in {cooldownRemaining}s</p>
            </div>
          ) : (
            <div className="rounded-lg bg-forest-50 ring-1 ring-forest-100 p-3">
              <p className="text-xs text-forest-700 font-medium flex items-center gap-1.5"><ShieldCheck size={13} /> Tank ready — next detection may trigger a spray</p>
            </div>
          )}
        </Card>
        </motion.div>
      </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Storage Monitoring view — single vault + conclusion                    */
/* ---------------------------------------------------------------------- */

function deriveStorageConclusion(latest) {
  const notes = [];
  let status = "Optimal";
  let tone = "emerald";

  if (latest.temp > 16) {
    notes.push("Temperature is trending above the ideal 10–16°C storage band — increase cooling to slow ripening and spoilage.");
    status = "Attention needed"; tone = "amber";
  } else if (latest.temp < 9) {
    notes.push("Temperature is close to the lower safe limit — chilling injury is possible if it drops further.");
    status = "Attention needed"; tone = "amber";
  } else {
    notes.push("Temperature is within the ideal 10–16°C range for post-harvest tomato storage.");
  }

  if (latest.humidity > 90) {
    notes.push("Humidity is high — this raises the risk of mold and bacterial rot. Increase ventilation.");
    status = "Attention needed"; tone = "amber";
  } else {
    notes.push("Humidity is within the safe 80–90% band, minimizing shrivel and rot risk.");
  }

  if (latest.co2 > 550) {
    notes.push("CO2 concentration is elevated — improve air exchange to prevent fermentation off-flavors.");
    status = "Attention needed"; tone = "amber";
  } else {
    notes.push("CO2 concentration is within the safe range for the current ventilation cycle.");
  }

  return { status, tone, notes };
}

function StorageMonitoringView({ telemetry }) {
  const latest = telemetry[telemetry.length - 1];
  const conclusion = deriveStorageConclusion(latest);

  const noteStyles = [
    { bg: "bg-aqua-50", ring: "ring-aqua-200", text: "text-aqua-800", iconBg: "bg-aqua-500", shape: "rounded-3xl" },
    { bg: "bg-amber-50", ring: "ring-amber-200", text: "text-amber-800", iconBg: "bg-amber-500", shape: "rounded-tl-none rounded-2xl" },
    { bg: "bg-lime-50", ring: "ring-lime-300", text: "text-lime-900", iconBg: "bg-lime-500", shape: "rounded-br-none rounded-2xl" },
    { bg: "bg-rose-50", ring: "ring-rose-200", text: "text-rose-800", iconBg: "bg-rose-500", shape: "rounded-full px-6" },
  ];

  return (
    <div className="relative -m-6 p-6 overflow-hidden">
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-16 right-16 w-96 h-96 rounded-full bg-aqua-200/50 blur-3xl"
          animate={{ x: [0, -25, 15, 0], y: [0, 20, -10, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/2 -left-20 w-80 h-80 rounded-full bg-lime-200/50 blur-3xl"
          animate={{ x: [0, 25, -15, 0], y: [0, -15, 20, 0] }}
          transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-0 right-1/4 w-72 h-72 rounded-full bg-amber-100/60 blur-3xl"
          animate={{ x: [0, -20, 15, 0], y: [0, 15, -10, 0] }}
          transition={{ duration: 19, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-aqua-50/60 via-white to-lime-50/50" />
      </div>

      <div className="relative space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Storage Temperature" value={latest.temp} unit="°C" icon={Thermometer} tone="amber" />
        <KpiCard label="Storage Humidity" value={latest.humidity} unit="%" icon={CloudRain} tone="sky" />
        <KpiCard label="CO2 Concentration" value={latest.co2} unit="ppm" icon={Wind} tone="emerald" />
      </div>

      <Card className="p-5">
        <SectionTitle icon={Warehouse} title="Storage Vault — Climate Trend" sub="Last 60 minutes" tone="earth" />
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={telemetry} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="time" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis yAxisId="left" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11, color: "#6b7280" }} />
            <Line yAxisId="left" type="monotone" dataKey="temp" name="Temp (°C)" stroke="#f2a609" strokeWidth={2} dot={false} />
            <Line yAxisId="left" type="monotone" dataKey="humidity" name="Humidity (%)" stroke="#0284c7" strokeWidth={2} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="co2" name="CO2 (ppm)" stroke="#3f8a2f" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-4">
          <SectionTitle icon={Info} title="What this means" sub="" />
          <Badge tone={conclusion.tone} icon={conclusion.tone === "emerald" ? CheckCircle2 : AlertTriangle}>{conclusion.status}</Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {conclusion.notes.map((n, i) => {
            const s = noteStyles[i % noteStyles.length];
            return (
              <motion.div
                key={n}
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                whileHover={{ scale: 1.03, rotate: i % 2 === 0 ? 0.5 : -0.5 }}
                transition={{ duration: 0.3, delay: i * 0.08 }}
                className={`${s.bg} ring-1 ${s.ring} ${s.shape} p-4 flex items-start gap-3 shadow-sm`}
              >
                <div className={`w-8 h-8 rounded-full ${s.iconBg} flex items-center justify-center shrink-0 shadow-sm`}>
                  <Droplet size={14} className="text-white" />
                </div>
                <p className={`text-sm font-medium leading-relaxed ${s.text}`}>{n}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Spraying History view                                                  */
/* ---------------------------------------------------------------------- */

function HistoryView({ sprayLog }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filters = [
    { id: "all", label: "All Actions" },
    { id: "Executed", label: "Executed" },
    { id: "Suppressed", label: "Suppressed" },
    { id: "Info", label: "Logged" },
  ];

  const statusStyle = {
    Executed: { badge: "emerald", icon: CheckCircle2, ring: "ring-forest-200", accent: "bg-forest-500" },
    Suppressed: { badge: "amber", icon: Lock, ring: "ring-amber-200", accent: "bg-amber-500" },
    Info: { badge: "slate", icon: Info, ring: "ring-gray-200", accent: "bg-gray-400" },
  };

  const rows = sprayLog.filter((r) => {
    const matchesFilter = filter === "all" || r.status === filter;
    const matchesSearch = !search || r.trigger.toLowerCase().includes(search.toLowerCase()) || r.action.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by trigger or action…"
              className="w-full bg-forest-50/60 border border-forest-100 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-400"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`relative px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  filter === f.id ? "text-white" : "text-gray-500 bg-gray-100 hover:bg-gray-200"
                }`}
              >
                {filter === f.id && (
                  <motion.span
                    layoutId="historyFilterPill"
                    className="absolute inset-0 rounded-full bg-gradient-to-r from-forest-600 to-leaf-500"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative z-10">{f.label}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-gray-400">No events match this filter yet.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {rows.map((row, i) => {
              const s = statusStyle[row.status] || statusStyle.Info;
              return (
                <motion.div
                  key={row.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
                >
                  <Card className={`p-4 flex items-center gap-4 ring-1 ${s.ring}`}>
                    <div className={`w-2 self-stretch rounded-full ${s.accent}`} />
                    <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                      <s.icon size={16} className="text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-800">{row.trigger}</p>
                        <span className="text-xs font-mono text-gray-400">{row.time}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{row.action}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {row.confidence != null && (
                        <p className="text-xs font-mono text-gray-500 mb-1">{row.confidence}% conf.</p>
                      )}
                      <Badge tone={s.badge} icon={s.icon}>{row.status === "Info" ? "Logged" : row.status}</Badge>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Disease Library view                                                   */
/* ---------------------------------------------------------------------- */

const PLANT_LEAF_LAYOUT = [
  { x: 150, y: 620, side: -1 },
  { x: 450, y: 560, side: 1 },
  { x: 130, y: 470, side: -1 },
  { x: 470, y: 400, side: 1 },
  { x: 160, y: 310, side: -1 },
  { x: 440, y: 230, side: 1 },
];

function PlantLeaf({ x, y, side, color, name, onClick, delay }) {
  const rot = side === -1 ? -18 : 18;
  return (
    <motion.g
      style={{ cursor: "pointer" }}
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1, rotate: [0, side * 3, 0] }}
      transition={{ opacity: { duration: 0.4, delay }, scale: { duration: 0.4, delay }, rotate: { duration: 4 + delay, repeat: Infinity, ease: "easeInOut" } }}
      whileHover={{ scale: 1.12 }}
      whileTap={{ scale: 0.95 }}
    >
      {/* branch connecting to stem */}
      <line x1={300} y1={y + 10} x2={x} y2={y} stroke="#3f8a2f" strokeWidth="4" strokeLinecap="round" />
      <g transform={`translate(${x},${y}) rotate(${rot})`}>
        <path
          d="M0,-45 C32,-40 42,-8 0,45 C-42,-8 -32,-40 0,-45 Z"
          fill={color}
          stroke="white"
          strokeWidth="3"
        />
        <line x1="0" y1="-38" x2="0" y2="38" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
      </g>
      <text x={x} y={y + (side === -1 ? 62 : 62)} textAnchor="middle" className="fill-forest-900 text-[13px] font-bold font-display" style={{ pointerEvents: "none" }}>
        {name.length > 18 ? name.split(" ").slice(0, 2).join(" ") : name}
      </text>
    </motion.g>
  );
}

function DiseaseDetailModal({ disease, onClose }) {
  const severityTone = { Critical: "red", High: "amber", Moderate: "amber", Low: "emerald" };
  const stageColors = ["bg-lime-400", "bg-amber-400", "bg-orange-500", "bg-rose-600"];
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-950/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
      >
        <div className="p-6 border-b border-gray-100 flex items-start justify-between sticky top-0 bg-white rounded-t-3xl">
          <div>
            <h3 className="font-display text-2xl font-bold text-gray-900">{disease.name}</h3>
            <p className="text-sm text-gray-400 italic">{disease.sci}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={severityTone[disease.severity]} icon={AlertTriangle}>{disease.severity}</Badge>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X size={18} /></button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5 flex items-center gap-1.5"><Bug size={13} /> Symptoms</p>
              <p className="text-sm text-gray-700 leading-relaxed">{disease.symptoms}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5 flex items-center gap-1.5"><Flame size={13} /> Favorable Conditions</p>
              <p className="text-sm text-gray-700 leading-relaxed">{disease.conditions}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5"><Activity size={13} /> Progression Timeline</p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {disease.stages.map((s, i) => (
                <motion.div
                  key={s.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="relative rounded-2xl p-3 bg-gray-50 border border-gray-100"
                >
                  <div className={`w-6 h-6 rounded-full ${stageColors[i]} text-white text-[11px] font-bold flex items-center justify-center mb-2`}>{i + 1}</div>
                  <p className="text-xs font-bold text-gray-800">{s.title}</p>
                  <p className="text-[10px] text-gray-400 mb-1.5">{s.days}</p>
                  <p className="text-xs text-gray-600 leading-snug">{s.desc}</p>
                  {i < disease.stages.length - 1 && (
                    <div className="hidden sm:block absolute top-6 -right-2 w-3 h-0.5 bg-gray-300" />
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5 flex items-center gap-1.5"><Beaker size={13} /> Recommended Response</p>
            <p className="text-sm text-gray-700 leading-relaxed">{disease.treatment}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5 flex items-center gap-1.5"><ShieldCheck size={13} /> Precautions</p>
            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
              {disease.precautions.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </div>
          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">Estimated recovery</p>
            <p className="text-sm font-semibold text-gray-800">{disease.recoveryDays}</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function DiseaseLibraryView() {
  const [selected, setSelected] = useState(null);
  const severityColor = { Critical: "#e11d48", High: "#f59e0b", Moderate: "#f59e0b", Low: "#4e9f3d" };

  return (
    <div className="relative -m-6 overflow-hidden">
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-sky-50 via-white to-lime-50" />
      <div className="px-6 pt-6 pb-2 text-center">
        <h2 className="font-display text-xl font-bold text-forest-900">Tap a leaf to learn about that disease</h2>
        <p className="text-sm text-gray-500">Six common tomato pathogens, mapped onto the plant</p>
      </div>
      <div className="w-full flex justify-center">
        <svg viewBox="0 0 600 800" className="w-full max-w-2xl h-[calc(100vh-14rem)] min-h-[520px]">
          {/* pot */}
          <path d="M230,760 L370,760 L350,800 L250,800 Z" fill="#8f6339" />
          <rect x="220" y="745" width="160" height="20" rx="6" fill="#6f4e2e" />
          {/* stem */}
          <path d="M300,745 C295,600 305,400 300,120" fill="none" stroke="#3f8a2f" strokeWidth="10" strokeLinecap="round" />
          {PLANT_LEAF_LAYOUT.map((pos, i) => (
            <PlantLeaf
              key={DISEASES[i].name}
              x={pos.x}
              y={pos.y}
              side={pos.side}
              color={severityColor[DISEASES[i].severity]}
              name={DISEASES[i].name}
              delay={i * 0.12}
              onClick={() => setSelected(DISEASES[i])}
            />
          ))}
          {/* top sprout */}
          <circle cx="300" cy="115" r="10" fill="#6bd67e" />
        </svg>
      </div>

      <AnimatePresence>
        {selected && <DiseaseDetailModal disease={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Reports Center view — proper written report                           */
/* ---------------------------------------------------------------------- */

function ReportsView({ sprayLog, history }) {
  const detections = sprayLog.filter((r) => r.confidence != null);
  const executed = sprayLog.filter((r) => r.status === "Executed" && r.action.includes("fungicide"));
  const suppressed = sprayLog.filter((r) => r.status === "Suppressed");
  const totalDetected = detections.reduce((sum, r) => sum + (r.count || 1), 0);

  const [liveHistory, setLiveHistory] = useState(history);
  useEffect(() => setLiveHistory(history), [history]);
  useEffect(() => {
    const t = setInterval(() => {
      setLiveHistory((prev) => {
        const copy = [...prev];
        const idx = copy.length - 1;
        const jitter = Math.random() < 0.5 ? -1 : 1;
        copy[idx] = { ...copy[idx], detections: Math.max(0, copy[idx].detections + (Math.random() < 0.35 ? jitter : 0)) };
        return copy;
      });
    }, 3000);
    return () => clearInterval(t);
  }, []);

  const diseaseBreakdown = DISEASES.map((d, i) => ({
    name: d.name.length > 16 ? d.name.slice(0, 15) + "…" : d.name,
    fullName: d.name,
    count: history.reduce((sum, day) => sum + (day.byDisease[d.name] || 0), 0),
    fill: ["#ec4899", "#8b5cf6", "#06b6d4", "#f97316", "#10b981", "#f43f5e"][i % 6],
  })).filter((d) => d.count > 0).sort((a, b) => b.count - a.count);

  const totalHistoryDetections = history.reduce((sum, day) => sum + day.detections, 0);

  const exportReport = () => {
    const lines = [
      "CropGuardian AI — Field Operations Report",
      `Generated: ${new Date().toLocaleString("en-IN")}`,
      "",
      "Summary",
      `Total disease indicators detected: ${totalDetected}`,
      `Fungicide sprays executed: ${executed.length}`,
      `Sprays suppressed by overdose lock: ${suppressed.length}`,
      "",
      "Detection & Spraying Log",
      ...sprayLog.map((r) =>
        `  [${r.time}] ${r.trigger} — detected: ${r.count || 0}, action: ${r.action}, duration: ${r.durationSec ? r.durationSec + "s" : "—"}, recovery: ${r.recoveryDays || "—"}, status: ${r.status}`
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "CropGuardian_Report.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-gray-900 font-semibold text-lg">Field Operations Report</h3>
          <p className="text-sm text-gray-500 mt-0.5">Generated {new Date().toLocaleString("en-IN")}</p>
        </div>
        <motion.button
          onClick={exportReport}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-700 hover:to-violet-700 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-md shadow-fuchsia-600/25 transition-colors"
        >
          <Download size={16} /> Export Report
        </motion.button>
      </div>

      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div variants={staggerItem}><KpiCard label="Diseases Detected" value={String(totalDetected)} icon={Bug} tone="amber" /></motion.div>
        <motion.div variants={staggerItem}><KpiCard label="Sprays Executed" value={String(executed.length)} icon={Droplet} tone="emerald" /></motion.div>
        <motion.div variants={staggerItem}><KpiCard label="Sprays Suppressed" value={String(suppressed.length)} icon={Lock} tone="sky" trend="By overdose lock" /></motion.div>
      </motion.div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-1">
          <SectionTitle icon={Activity} title="Trends & Analytics" sub={`Last 14 days · ${totalHistoryDetections} indicators total`} tone="earth" />
          <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
            <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.6, repeat: Infinity }} className="w-2 h-2 rounded-full bg-emerald-500" />
            Live
          </span>
        </div>
        <p className="text-xs text-gray-500 font-medium mb-2 mt-3">Detections per day</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={liveHistory} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ec4899" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="detections" name="Detections" fill="url(#barGradient)" radius={[6, 6, 0, 0]} animationDuration={500} />
          </BarChart>
        </ResponsiveContainer>

        {diseaseBreakdown.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-500 font-medium mb-2">Detections by disease type (14 days)</p>
            <ResponsiveContainer width="100%" height={Math.max(120, diseaseBreakdown.length * 34)}>
              <BarChart data={diseaseBreakdown} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis type="number" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} width={130} />
                <Tooltip
                  contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12 }}
                  formatter={(value, name, props) => [value, props.payload.fullName]}
                />
                <Bar dataKey="count" name="Detections" radius={[0, 6, 6, 0]} animationDuration={600}>
                  {diseaseBreakdown.map((d) => <Cell key={d.fullName} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <SectionTitle icon={FileText} title="Detection & Treatment Report" sub={`${detections.length} entries`} />
        {detections.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">No detections logged yet. Run a scan from Disease Detection to populate this report.</p>
        ) : (
          <div className="space-y-3">
            {detections.map((r) => (
              <div key={r.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-gray-400" />
                    <span className="text-xs font-mono text-gray-400">{r.time}</span>
                    <span className="font-semibold text-gray-800 text-sm">{r.trigger}</span>
                  </div>
                  {r.status === "Executed" && <Badge tone="emerald" icon={CheckCircle2}>Executed</Badge>}
                  {r.status === "Suppressed" && <Badge tone="amber" icon={Lock}>Suppressed</Badge>}
                  {r.status === "Info" && <Badge tone="slate" icon={Info}>Clear</Badge>}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                  <div>
                    <p className="text-xs text-gray-400">Detected</p>
                    <p className="text-sm font-medium text-gray-800">{r.count || 0} indicator{(r.count || 0) === 1 ? "" : "s"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 flex items-center gap-1"><Timer size={11} /> Spray duration</p>
                    <p className="text-sm font-medium text-gray-800">{r.durationSec ? `${r.durationSec}s` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Confidence</p>
                    <p className="text-sm font-medium text-gray-800">{r.confidence ? `${r.confidence}%` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Est. recovery</p>
                    <p className="text-sm font-medium text-gray-800">{r.recoveryDays || "—"}</p>
                  </div>
                </div>
                {r.precautions && r.precautions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400 mb-1">Precautions</p>
                    <p className="text-sm text-gray-600">{r.precautions.join(" · ")}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  AI Assistant — rule-based chat                                         */
/* ---------------------------------------------------------------------- */

function generateAssistantReply(text) {
  const q = text.toLowerCase();

  const diseaseMatch = DISEASES.find((d) => q.includes(d.name.toLowerCase().split(" ")[0]));
  if (diseaseMatch) {
    return `${diseaseMatch.name} (${diseaseMatch.sci}) favors: ${diseaseMatch.conditions} Recommended response: ${diseaseMatch.treatment} Typical recovery: ${diseaseMatch.recoveryDays}.`;
  }
  if (q.includes("tank") || q.includes("refill")) {
    return "The spray tank feeds both clean water irrigation and targeted fungicide spraying through the same pump channel (Digital Pin D7). Refill it once the level drops below 15% from the Settings page.";
  }
  if (q.includes("overdose") || q.includes("suppress")) {
    return "Smart Overdose Lock prevents back-to-back fungicide sprays. If a spray happened recently, new detections are logged as suppressed until the cooldown window passes, protecting the crop from over-treatment.";
  }
  if (q.includes("co2")) {
    return "Elevated CO2 in the storage vault usually means ventilation isn't keeping up with produce respiration. Increase air exchange to avoid fermentation off-flavors and spoilage.";
  }
  if (q.includes("humidity")) {
    return "Humidity above 90% in storage raises mold and bacterial rot risk. Below 80%, produce can shrivel. Aim to keep it in the 80–90% band.";
  }
  if (q.includes("water") || q.includes("moisture") || q.includes("irrigat")) {
    return "When soil moisture drops below the configured threshold, the system runs a short clean water irrigation cycle automatically. You can adjust the trigger point in Settings.";
  }
  if (q.includes("spray") || q.includes("pump")) {
    return "The pump on Zone 1 triggers automatically when a leaf disease is detected above the confidence threshold, delivering a short targeted fungicide spray — unless the overdose lock is currently active.";
  }
  return "I can help with disease symptoms and treatment, tank and spray logic, or storage climate questions. Try asking about a specific disease, or one of the suggestions below.";
}

function FloatingAssistant() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <motion.button
        onClick={() => setOpen((o) => !o)}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-forest-600 to-leaf-500 shadow-xl shadow-forest-700/30 flex items-center justify-center text-white"
        aria-label="Ask CropGuardian AI"
      >
        <span className="absolute inset-0 rounded-full bg-leaf-400 animate-ping opacity-30" />
        {open ? <X size={22} className="relative z-10" /> : <MessageCircle size={22} className="relative z-10" />}
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-24 right-6 z-40 w-96 max-w-[calc(100vw-3rem)] h-[500px] max-h-[70vh]"
          >
            <AssistantView floating onClose={() => setOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function AssistantView({ floating = false, onClose }) {
  const [messages, setMessages] = useState([
    { id: 0, role: "assistant", text: "Hello! I'm the CropGuardian Assistant. Ask me about a disease, the spray system, or storage conditions." },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const idRef = useRef(1);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const send = (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((prev) => [...prev, { id: idRef.current++, role: "user", text: trimmed }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      setMessages((prev) => [...prev, { id: idRef.current++, role: "assistant", text: generateAssistantReply(trimmed) }]);
      setTyping(false);
    }, 700);
  };

  return (
    <Card className={`p-0 flex flex-col ${floating ? "h-full shadow-2xl" : "h-[calc(100vh-11rem)]"}`}>
      <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageCircle size={16} className="text-forest-600" />
          <div>
            <p className="text-sm font-semibold text-gray-800">CropGuardian Assistant</p>
            <p className="text-xs text-gray-400">On-device crop advisory · works offline</p>
          </div>
        </div>
        {floating && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.2 }}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === "user" ? "bg-gradient-to-r from-forest-600 to-forest-500 text-white" : "bg-forest-50/70 text-gray-800"
                }`}
              >
                {m.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {typing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="bg-forest-50/70 text-gray-400 rounded-2xl px-3.5 py-2.5 text-sm flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-forest-400 animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-forest-400 animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-forest-400 animate-bounce" />
            </div>
          </motion.div>
        )}
        <div ref={endRef} />
      </div>

      <div className="p-3 border-t border-gray-100">
        <div className="flex flex-wrap gap-2 mb-2">
          {CHAT_SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="text-xs bg-aqua-50 text-aqua-700 ring-1 ring-aqua-100 px-2.5 py-1 rounded-full hover:bg-aqua-100 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="Ask about a disease, the spray tank, or storage..."
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500 focus:border-forest-500"
          />
          <motion.button
            onClick={() => send(input)}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            className="bg-gradient-to-r from-forest-600 to-forest-500 hover:from-forest-700 hover:to-forest-600 text-white rounded-full p-3 shadow-md shadow-forest-600/20 transition-colors"
          >
            <Send size={16} />
          </motion.button>
        </div>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------------- */
/*  Settings view                                                          */
/* ---------------------------------------------------------------------- */

function SettingsView({ tankLevel, onRefillTank, settings, onSaveSettings, calibration, onSaveCalibration, latestSoilRaw }) {
  const [draft, setDraft] = useState(settings);
  const [calDraft, setCalDraft] = useState(calibration);
  const [saved, setSaved] = useState(false);
  const [calMsg, setCalMsg] = useState(null);
  const [hwEnabled, setHwEnabled] = useState(Object.fromEntries(HARDWARE.map((h) => [h.id, true])));

  const setField = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const handleSave = () => {
    onSaveSettings(draft);
    onSaveCalibration(calDraft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const captureDry = () => {
    setCalDraft((c) => ({ ...c, dryRaw: latestSoilRaw }));
    setCalMsg("Dry reading captured — make sure the probe was actually in dry soil or air.");
  };
  const captureWet = () => {
    setCalDraft((c) => ({ ...c, wetRaw: latestSoilRaw }));
    setCalMsg("Wet reading captured — make sure the probe was actually in saturated soil.");
  };

  const previewPct = soilPercentFromRaw(latestSoilRaw, calDraft);
  const calibrationDrifted = calDraft.dryRaw !== calibration.dryRaw || calDraft.wetRaw !== calibration.wetRaw;

  const Slider = ({ label, value, setValue, min, max, unit }) => (
    <div className="mb-5">
      <div className="flex justify-between mb-2">
        <span className="text-sm text-gray-700 font-medium">{label}</span>
        <span className="text-sm text-forest-600 font-mono">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-gray-200 accent-forest-600 cursor-pointer"
      />
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <Card className="p-6">
          <SectionTitle icon={SlidersHorizontal} title="Threshold Management" sub="Drives real automation logic" />
          <Slider label="Soil Moisture — Trigger Irrigation Below" value={draft.soilThreshold} setValue={setField("soilThreshold")} min={30} max={80} unit="%" />
          <Slider label="Storage Temperature — Alert Above" value={draft.tempThreshold} setValue={setField("tempThreshold")} min={10} max={30} unit="°C" />
          <Slider label="Storage Humidity — Alert Above" value={draft.humidityThreshold} setValue={setField("humidityThreshold")} min={70} max={100} unit="%" />
          <Slider label="AI Detection Confidence — Minimum" value={draft.confidenceThreshold} setValue={setField("confidenceThreshold")} min={70} max={99} unit="%" />
        </Card>

        <Card className="p-6">
          <SectionTitle icon={Timer} title="Spray Control" sub="Matches the MCU relay logic" tone="earth" />
          <Slider label="Overdose Lock — Cooldown Window" value={draft.cooldownSec} setValue={setField("cooldownSec")} min={15} max={120} unit="s" />
          <Slider label="Spray Pulse — Pump-On Duration" value={draft.sprayDurationSec} setValue={setField("sprayDurationSec")} min={1} max={10} unit="s" />
          <p className="text-xs text-gray-400 -mt-1">These two settings mirror <code className="text-rose-600">SPRAY_DURATION_MS</code> and <code className="text-rose-600">SPRAY_COOLDOWN_MS</code> in the Arduino sketch — keep them in sync when you update the firmware.</p>
        </Card>

        <Card className="p-6">
          <SectionTitle icon={Droplet} title="Soil Sensor Calibration" sub="Raw ADC → % moisture" tone="sky" />
          <div className="flex items-center justify-between bg-aqua-50/60 rounded-lg px-4 py-3 mb-4">
            <div>
              <p className="text-xs text-gray-500">Live raw reading</p>
              <p className="text-lg font-mono text-aqua-700 font-semibold">{latestSoilRaw}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">With this calibration</p>
              <p className="text-lg font-mono text-forest-700 font-semibold">{previewPct}%</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs text-gray-500">Dry raw value</label>
              <div className="flex gap-2 mt-1">
                <input
                  type="number"
                  value={calDraft.dryRaw}
                  onChange={(e) => setCalDraft((c) => ({ ...c, dryRaw: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-aqua-500"
                />
              </div>
              <button onClick={captureDry} className="mt-1.5 text-xs text-aqua-600 hover:text-aqua-700 font-medium">Capture current as dry</button>
            </div>
            <div>
              <label className="text-xs text-gray-500">Wet raw value</label>
              <div className="flex gap-2 mt-1">
                <input
                  type="number"
                  value={calDraft.wetRaw}
                  onChange={(e) => setCalDraft((c) => ({ ...c, wetRaw: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-aqua-500"
                />
              </div>
              <button onClick={captureWet} className="mt-1.5 text-xs text-aqua-600 hover:text-aqua-700 font-medium">Capture current as wet</button>
            </div>
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">
            Remove the probe (or let the soil dry fully), wait for the raw reading to settle, then capture it as dry. Then insert the probe into saturated soil and capture it as wet. Capacitive probes read a <em>higher</em> raw value when dry.
          </p>
          {calMsg && (
            <p className="text-xs text-forest-600 mt-2 flex items-center gap-1.5"><Info size={12} /> {calMsg}</p>
          )}
          {calibrationDrifted && (
            <p className="text-xs text-rose-600 mt-2 flex items-center gap-1.5"><AlertTriangle size={12} /> Unsaved calibration changes — click Save Configuration below to apply.</p>
          )}
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="p-6">
          <SectionTitle icon={Droplets} title="Spray Tank" tone="sky" />
          <div className="flex items-center gap-6">
            <TankGauge level={tankLevel} compact />
            <motion.button
              onClick={onRefillTank}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-aqua-600 to-aqua-500 hover:from-aqua-700 hover:to-aqua-600 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-md shadow-aqua-600/20 transition-colors"
            >
              <RefreshCw size={15} /> Refill Tank
            </motion.button>
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle icon={Cpu} title="Hardware Configuration" tone="earth" />
          <div className="space-y-1">
            {HARDWARE.map((h) => (
              <div key={h.id} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-rose-50 flex items-center justify-center text-rose-500">
                    <h.icon size={15} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-800 font-medium leading-tight">{h.name}</p>
                    <p className="text-xs text-gray-400 leading-tight">{h.detail}</p>
                  </div>
                </div>
                <button
                  onClick={() => setHwEnabled((s) => ({ ...s, [h.id]: !s[h.id] }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 shrink-0 ${hwEnabled[h.id] ? "bg-forest-500" : "bg-gray-300"}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-300 ${hwEnabled[h.id] ? "translate-x-5" : "translate-x-1"}`} />
                </button>
              </div>
            ))}
          </div>
        </Card>

        <motion.button
          onClick={handleSave}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-forest-600 to-forest-500 hover:from-forest-700 hover:to-forest-600 text-white text-sm font-semibold px-4 py-3 rounded-full shadow-md shadow-forest-600/20 transition-colors"
        >
          {saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
          {saved ? "Configuration Saved" : "Save Configuration"}
        </motion.button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  App shell                                                               */
/* ---------------------------------------------------------------------- */

export default function CropGuardianAI() {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("cropguardian_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [view, setView] = useState("home");
  const [telemetry, setTelemetry] = useState(seedTelemetry);
  const [pumpOverride, setPumpOverride] = useState(false);
  const [fanOverride, setFanOverride] = useState(false);
  const [lastSprayAt, setLastSprayAt] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [sprayState, setSprayState] = useState("idle");
  const [clock, setClock] = useState(nowStr());
  const [tankLevel, setTankLevel] = useState(78);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settings, setSettings] = useState(() => loadPersisted("cropguardian_settings", DEFAULT_SETTINGS));
  const [calibration, setCalibration] = useState(() => loadPersisted("cropguardian_calibration", DEFAULT_CALIBRATION));
  const [history, setHistory] = useState(() => generateHistory(14));
  const tempAlertedRef = useRef(false);
  const humidityAlertedRef = useRef(false);
  const soilLowAlertedRef = useRef(false);
  const logIdRef = useRef(1);
  const sprayIdRef = useRef(1);

  const [activityLog, setActivityLog] = useState([
    { id: 0, time: nowStr(), type: "system", message: "CropGuardian AI initialized — all sensor nodes reporting" },
  ]);
  const [sprayLog, setSprayLog] = useState([]);
  const [lastSeenLogId, setLastSeenLogId] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const pushLog = useCallback((type, message) => {
    setActivityLog((prev) => [{ id: logIdRef.current++, time: nowStr(), type, message }, ...prev].slice(0, 40));
  }, []);

  const pushSprayRow = useCallback((row) => {
    setSprayLog((prev) => [{ id: sprayIdRef.current++, time: nowStr(), ...row }, ...prev].slice(0, 80));
  }, []);

  const saveSettings = useCallback((next) => {
    setSettings(next);
    try { localStorage.setItem("cropguardian_settings", JSON.stringify(next)); } catch {}
  }, []);

  const saveCalibration = useCallback((next) => {
    setCalibration(next);
    try { localStorage.setItem("cropguardian_calibration", JSON.stringify(next)); } catch {}
  }, []);

  const overdoseLocked = lastSprayAt > 0 && Date.now() - lastSprayAt < settings.cooldownSec * 1000;

  useEffect(() => {
    const t = setInterval(() => setClock(nowStr()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!overdoseLocked) {
      setCooldownRemaining(0);
      return;
    }
    const t = setInterval(() => {
      const remaining = Math.ceil((settings.cooldownSec * 1000 - (Date.now() - lastSprayAt)) / 1000);
      setCooldownRemaining(remaining > 0 ? remaining : 0);
    }, 500);
    return () => clearInterval(t);
  }, [overdoseLocked, lastSprayAt, settings.cooldownSec]);

  const bumpHistoryDetection = useCallback((diseaseName) => {
    setHistory((prev) => {
      const copy = [...prev];
      const todayIdx = copy.length - 1;
      const today = copy[todayIdx];
      copy[todayIdx] = {
        ...today,
        detections: today.detections + 1,
        byDisease: { ...today.byDisease, [diseaseName]: (today.byDisease[diseaseName] || 0) + 1 },
      };
      return copy;
    });
  }, []);

  const handleDetection = useCallback(
    (outcome) => {
      if (!outcome.detected) {
        pushLog("info", `Photo analysis complete — no pathogen detected (${outcome.confidence}% confidence)`);
        pushSprayRow({ trigger: outcome.disease, action: "Scan clear, no action taken", count: 0, confidence: outcome.confidence, status: "Info" });
        setSprayState("idle");
        return;
      }
      if (outcome.confidence < settings.confidenceThreshold) {
        pushLog("info", `Possible ${outcome.disease} detected but below confidence threshold (${outcome.confidence}% < ${settings.confidenceThreshold}%) — flagged for review, no action taken`);
        pushSprayRow({ trigger: outcome.disease, action: `Below confidence threshold (${settings.confidenceThreshold}%)`, count: outcome.count, confidence: outcome.confidence, status: "Info" });
        setSprayState("idle");
        return;
      }
      pushLog("detect", `AI classified ${outcome.disease} — ${outcome.confidence}% confidence (${outcome.count} indicator${outcome.count > 1 ? "s" : ""})`);
      bumpHistoryDetection(outcome.disease);
      const locked = lastSprayAt > 0 && Date.now() - lastSprayAt < settings.cooldownSec * 1000;
      if (locked || tankLevel <= 2) {
        pushLog("lock", locked ? "Overdose Prevention active — Pump suppressed" : "Tank empty — spray suppressed, refill required");
        pushSprayRow({
          trigger: outcome.disease, action: "Fungicide spray suppressed", count: outcome.count,
          confidence: outcome.confidence, status: "Suppressed", recoveryDays: outcome.record?.recoveryDays,
          precautions: outcome.record?.precautions,
        });
      } else {
        setSprayState("fungicide");
        setLastSprayAt(Date.now());
        setTankLevel((lvl) => clamp(lvl - rand(4, 7), 0, 100));
        pushLog("spray", `Auto-Response: Zone 1 pump tripped for ${settings.sprayDurationSec}-second fungicide spray`);
        pushSprayRow({
          trigger: outcome.disease, action: `Targeted fungicide spray (${settings.sprayDurationSec}s)`, count: outcome.count,
          confidence: outcome.confidence, status: "Executed", durationSec: settings.sprayDurationSec,
          recoveryDays: outcome.record?.recoveryDays, precautions: outcome.record?.precautions,
        });
        setTimeout(() => setSprayState("idle"), (settings.sprayDurationSec + 1) * 1000);
      }
    },
    [lastSprayAt, pushLog, pushSprayRow, tankLevel, settings.confidenceThreshold, settings.cooldownSec, settings.sprayDurationSec, bumpHistoryDetection]
  );

  const soilTrueRef = useRef(63);

  useEffect(() => {
    const t = setInterval(() => {
      setTelemetry((prev) => {
        const last = prev[prev.length - 1];
        soilTrueRef.current = clamp(soilTrueRef.current + rand(-3, 3), 42, 82);
        const soilRaw = Math.round(clamp(ACTUAL_DRY_RAW - (soilTrueRef.current / 100) * (ACTUAL_DRY_RAW - ACTUAL_WET_RAW) + rand(-15, 15), 300, 900));
        const soilMoisture = soilPercentFromRaw(soilRaw, calibration);
        const temp = clamp(last.temp + rand(-0.4, 0.4), 8, 18);
        const humidity = clamp(last.humidity + rand(-2, 2), 76, 94);
        const co2 = clamp(last.co2 + rand(-18, 18), 390, 580);
        const next = {
          time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }),
          soilRaw,
          soilMoisture,
          temp: Math.round(temp * 10) / 10,
          humidity: Math.round(humidity),
          co2: Math.round(co2),
        };

        if (next.soilMoisture < settings.soilThreshold) {
          if (!pumpOverride && tankLevel > 2) {
            setSprayState("irrigation");
            setTankLevel((lvl) => clamp(lvl - rand(2, 4), 0, 100));
            if (!soilLowAlertedRef.current) {
              soilLowAlertedRef.current = true;
              pushLog("water", `Soil moisture at ${next.soilMoisture}% (< ${settings.soilThreshold}% threshold) — plant needs water, Clean Water Irrigation cycle triggered`);
            }
            pushSprayRow({ trigger: "Low Soil Moisture", action: "Clean water irrigation cycle", count: 0, confidence: null, status: "Executed", durationSec: 4 });
            setTimeout(() => setSprayState("idle"), 3000);
          } else if (!soilLowAlertedRef.current) {
            soilLowAlertedRef.current = true;
            const reason = pumpOverride ? "manual override active" : "tank empty";
            pushLog("water", `Soil moisture at ${next.soilMoisture}% (< ${settings.soilThreshold}% threshold) — plant needs water, but irrigation is suppressed (${reason})`);
          }
        } else {
          soilLowAlertedRef.current = false;
        }

        if (next.temp > settings.tempThreshold) {
          if (!tempAlertedRef.current) {
            tempAlertedRef.current = true;
            pushLog("alert", `Storage temperature ${next.temp}°C exceeded threshold (${settings.tempThreshold}°C)`);
          }
        } else {
          tempAlertedRef.current = false;
        }

        if (next.humidity > settings.humidityThreshold) {
          if (!humidityAlertedRef.current) {
            humidityAlertedRef.current = true;
            pushLog("alert", `Storage humidity ${next.humidity}% exceeded threshold (${settings.humidityThreshold}%)`);
          }
        } else {
          humidityAlertedRef.current = false;
        }

        return [...prev.slice(1), next];
      });
    }, 5000);
    return () => clearInterval(t);
  }, [pumpOverride, pushLog, pushSprayRow, tankLevel, calibration, settings.soilThreshold, settings.tempThreshold, settings.humidityThreshold]);

  useEffect(() => {
    const t = setInterval(() => {
      const roll = Math.random();
      if (roll < 0.35) {
        const infoPool = [
          "Soil moisture nominal — Zone 1 within threshold band",
          "Storage climate stable — CO2 concentration within safe range",
          "Routine telemetry sync completed across all sensor nodes",
        ];
        pushLog("info", infoPool[Math.floor(Math.random() * infoPool.length)]);
      }
    }, 9000);
    return () => clearInterval(t);
  }, [pushLog]);

  useEffect(() => {
    if (pumpOverride) pushLog("alert", "Manual Pump Override engaged — autonomous irrigation paused");
  }, [pumpOverride]);
  useEffect(() => {
    if (fanOverride) pushLog("alert", "Manual Fan Override engaged — autonomous ventilation paused");
  }, [fanOverride]);

  const handleLogin = (u) => {
    setUser(u);
    try { localStorage.setItem("cropguardian_user", JSON.stringify(u)); } catch {}
  };
  const handleLogout = () => {
    setUser(null);
    setProfileOpen(false);
    try { localStorage.removeItem("cropguardian_user"); } catch {}
  };
  const handleRefillTank = () => {
    setTankLevel(100);
    pushLog("system", "Spray tank manually refilled to 100%");
  };

  if (!user) return <LoginScreen onLogin={handleLogin} />;

  const alertCount = activityLog.filter((l) => l.type === "alert" || l.type === "lock").length + (overdoseLocked ? 1 : 0);

  const NAV_MAP = {
    home: () => <HomeView />,
    detection: () => (
      <DiseaseDetectionView
        onScanComplete={handleDetection}
        overdoseLocked={overdoseLocked}
        cooldownRemaining={cooldownRemaining}
        sprayState={sprayState}
        tankLevel={tankLevel}
      />
    ),
    storage: () => <StorageMonitoringView telemetry={telemetry} />,
    history: () => <HistoryView sprayLog={sprayLog} />,
    library: () => <DiseaseLibraryView />,
    reports: () => <ReportsView sprayLog={sprayLog} history={history} />,
  };

  const activeNav = NAV_ITEMS.find((n) => n.id === view);
  const initials = user.name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen text-gray-800 flex flex-col relative bg-forest-50/40">
      <AmbientBackground imageOpacity={0} overlayOpacity={0.15} />

      {/* Top Nav */}
      <header className="sticky top-0 z-20 bg-forest-900/95 backdrop-blur-md border-b border-forest-800 shadow-lg">
        <div className="h-16 flex items-center justify-between px-6 gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-leaf-400/20 ring-1 ring-leaf-400/40 flex items-center justify-center">
              <Sprout size={18} className="text-leaf-400" />
            </div>
            <div>
              <p className="font-display font-bold text-white text-base leading-tight tracking-tight">CropGuardian AI</p>
              <p className="text-[10px] text-forest-300 leading-tight tracking-wide font-medium">CROP INTELLIGENCE ECOSYSTEM</p>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-1 overflow-x-auto">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  view === item.id ? "text-forest-900" : "text-forest-200 hover:text-white hover:bg-white/10"
                }`}
              >
                {view === item.id && (
                  <motion.span
                    layoutId="activeNavPill"
                    className="absolute inset-0 rounded-full bg-leaf-400 shadow-md shadow-leaf-400/30"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <item.icon size={14} className="relative z-10" />
                <span className="relative z-10">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden xl:flex items-center gap-1.5 text-xs text-leaf-300 font-mono bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
              <StatusDot online={true} /> System Nominal
            </div>
            <NotificationBell
              activityLog={activityLog}
              unreadCount={activityLog.filter((l) => l.id > lastSeenLogId && l.id !== 0).length}
              open={notificationsOpen}
              onToggle={() => {
                setNotificationsOpen((o) => !o);
                if (!notificationsOpen) setLastSeenLogId(activityLog[0]?.id ?? 0);
              }}
            />
            <div className="relative">
              <button
                onClick={() => setProfileOpen((o) => !o)}
                className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-leaf-400 to-forest-400 flex items-center justify-center text-forest-900 text-[11px] font-bold shrink-0">{initials}</div>
                <span className="hidden md:block text-xs font-medium text-white/90">{user.name}</span>
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-44 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden z-30">
                  <div className="px-3 py-2.5 border-b border-gray-100">
                    <p className="text-xs font-semibold text-slate-700 truncate">{user.name}</p>
                    <p className="text-[10px] text-slate-400">{user.role}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile/tablet nav row */}
        <nav className="lg:hidden flex items-center gap-1 px-4 pb-3 overflow-x-auto">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                view === item.id ? "bg-leaf-400 text-forest-900" : "text-forest-200 hover:text-white hover:bg-white/10"
              }`}
            >
              <item.icon size={13} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </header>

      {/* Page title bar */}
      {view !== "home" && (
        <div className="bg-white/70 backdrop-blur-sm border-b border-forest-100 px-6 py-4">
          <h1 className="font-display font-bold text-forest-900 text-xl">{activeNav.label}</h1>
          <p className="text-xs text-forest-500">Precision crop care, powered by AI · {clock}</p>
        </div>
      )}

      <main className={view === "home" ? "flex-1" : "flex-1 p-6 overflow-y-auto"}>
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {NAV_MAP[view] ? NAV_MAP[view]() : null}
          </motion.div>
        </AnimatePresence>
      </main>
      <FloatingAssistant />
    </div>
  );
}
