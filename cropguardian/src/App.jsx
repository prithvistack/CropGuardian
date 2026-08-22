import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea,
} from "recharts";
import {
  LayoutDashboard, Camera, Warehouse, History, BookOpen, FileText, Settings as SettingsIcon,
  Leaf, Cpu, Droplet, Wind, Thermometer, Activity, AlertTriangle, CheckCircle2, Lock,
  ChevronRight, ChevronLeft, Download, Radio, ShieldCheck, Info, Sprout, Bug,
  Flame, CloudRain, Beaker, UploadCloud, ImageUp, Play, Save, Zap, SlidersHorizontal,
  MessageCircle, Send, LogOut, User, RefreshCw, Calendar, Timer, Droplets, Bell, X,
  Users, Target, ScanLine, ChevronDown, ChevronUp, Gamepad2, Square,
} from "lucide-react";
import fieldBg from "./assets/field-bg.jpg";
import loginBgVideo from "./assets/video/login-bg.mp4";
import homeHeroVideo from "./assets/video/home-hero.mp4";
import { apiFetch, API_BASE_URL } from "./api";

/* ---------------------------------------------------------------------- */
/*  Reference data                                                         */
/* ---------------------------------------------------------------------- */

const NAV_ITEMS = [
  { id: "dashboard", label: "Home", icon: LayoutDashboard },
  { id: "home", label: "About", icon: Sprout },
  { id: "detection", label: "Disease Detection", icon: Camera },
  { id: "storage", label: "Storage Monitoring", icon: Warehouse },
  { id: "history", label: "Spraying History", icon: History },
];

const MORE_ITEMS = [
  { id: "library", label: "Disease Library", icon: BookOpen },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "car", label: "Car Control", icon: Gamepad2 },
  { id: "camera", label: "Camera Feed", icon: Camera },
];

const PAGE_META = {
  detection: { title: "Disease Detection", sub: "Upload a leaf photo — our AI identifies the pathogen and recommends action." },
  storage: { title: "Storage Monitoring", sub: "Live environmental tracking to protect your harvest after the field." },
  history: { title: "Spraying History", sub: "Every spray event logged — executed, suppressed, and flagged actions." },
  library: { title: "Disease Library", sub: "Know your enemy — symptoms, conditions, and treatment for every tomato pathogen." },
  reports: { title: "Reports", sub: "Field operations data — detections, spray events, and trends over time." },
  home: { title: "About CropGuardian AI", sub: "The story, the technology, and the mission behind the platform." },
  car: { title: "Car Control", sub: "Drive the CropGuardian rover manually over WiFi." },
  camera: { title: "Camera Feed", sub: "Turn this phone into the rover's mounted camera." },
};

const HARDWARE = [
  { id: "controller", name: "Controller", detail: "Arduino UNO Q", icon: Cpu },
  { id: "dht22", name: "DHT22 Sensor", detail: "Temperature / Humidity", icon: Thermometer },
  { id: "soil", name: "Soil Moisture Sensor", detail: "Capacitive v2.0", icon: Droplet },
  { id: "mq135", name: "MQ-135 Gas Sensor", detail: "Air Quality / CO2", icon: Wind },
  { id: "camera", name: "Camera Module", detail: "USB Webcam", icon: Camera },
];

const DISEASES = [
  {
    name: "Late Blight",
    sci: "Phytophthora infestans",
    image: "https://images.unsplash.com/photo-1586771107445-d3ca888129ff?w=800&q=80",
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
    image: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=800&q=80",
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
    image: "https://images.unsplash.com/photo-1592841200221-a6898f307baa?w=800&q=80",
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
    image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80",
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
    image: "https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=800&q=80",
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
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
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
  {
    name: "Spider Mites (Two-spotted)",
    sci: "Tetranychus urticae",
    image: "https://images.unsplash.com/photo-1622383563227-04401ab4e5ea?w=800&q=80",
    severity: "Moderate",
    symptoms: "Tiny yellow or white speckles on upper leaf surface, fine webbing on undersides, leaves eventually bronze and drop.",
    conditions: "Hot, dry conditions above 27°C with low humidity below 40%.",
    treatment: "Apply miticide or neem oil spray, increase humidity around plants, remove heavily infested leaves.",
    precautions: ["Avoid water stress", "Introduce predatory mites", "Inspect undersides of leaves regularly"],
    recoveryDays: "7–10 days",
    stages: [
      { title: "Infestation", days: "Days 1–3", desc: "Mites colonize leaf undersides; stippling just beginning, not yet visible from above." },
      { title: "Early Damage", days: "Days 4–7", desc: "Yellow speckles appear on upper surface as feeding damage accumulates." },
      { title: "Active Outbreak", days: "Days 8–12", desc: "Webbing visible, leaves bronze and curl; population exploding in hot dry conditions." },
      { title: "Severe Defoliation", days: "Days 13+", desc: "Leaves drop, plant weakened; fruit exposed to sunscald." },
    ],
  },
  {
    name: "Target Spot",
    sci: "Corynespora cassiicola",
    image: "https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?w=800&q=80",
    severity: "Moderate",
    symptoms: "Brown circular lesions with concentric rings and yellow halos on leaves, stems, and fruit.",
    conditions: "Warm temperatures 24–30°C, high humidity, prolonged leaf wetness.",
    treatment: "Apply chlorothalonil or mancozeb fungicide, improve airflow, avoid overhead irrigation.",
    precautions: ["Space plants adequately", "Remove infected debris", "Rotate fungicide classes"],
    recoveryDays: "8–12 days",
    stages: [
      { title: "Infection", days: "Days 1–3", desc: "Spores land on wet leaf surfaces; no visible symptoms." },
      { title: "Early Manifestation", days: "Days 4–6", desc: "Small brown spots appear, mostly on older lower leaves." },
      { title: "Active Outbreak", days: "Days 7–11", desc: "Lesions enlarge with concentric rings and yellow halos; spread to stems and fruit." },
      { title: "Severe Defoliation", days: "Days 12+", desc: "Heavy leaf drop and fruit lesions reduce marketability significantly." },
    ],
  },
  {
    name: "Tomato Mosaic Virus",
    sci: "ToMV (Tobamovirus)",
    image: "https://images.unsplash.com/photo-1592921870789-04563d55041c?w=800&q=80",
    severity: "High",
    symptoms: "Mottled light and dark green mosaic pattern on leaves, leaf distortion, stunted growth.",
    conditions: "Spreads through contact, contaminated tools, and infected seed — not insect-vectored.",
    treatment: "No cure — remove and destroy infected plants immediately, disinfect all tools with 10% bleach solution.",
    precautions: ["Use virus-free certified seed", "Disinfect tools between plants", "Wash hands before handling plants"],
    recoveryDays: "No cure — remove plant",
    stages: [
      { title: "Infection", days: "Days 1–5", desc: "Virus enters through wounds or contact; no visible symptoms during incubation." },
      { title: "Early Manifestation", days: "Days 6–10", desc: "Faint mosaic mottling appears on young leaves." },
      { title: "Active Outbreak", days: "Days 11–18", desc: "Pronounced mosaic pattern, leaf distortion, and stunting; fruit may show internal browning." },
      { title: "Severe Defoliation", days: "Days 19+", desc: "Plant growth halts; yield severely reduced or lost entirely." },
    ],
  },
  {
    name: "Healthy",
    sci: "No pathogen detected",
    image: "https://images.unsplash.com/photo-1592838064575-70ed626d3a0e?w=800&q=80",
    severity: "Low",
    symptoms: "No disease symptoms. Leaf tissue is uniformly green with no lesions, spots, or discoloration.",
    conditions: "Healthy plants thrive in balanced temperature, humidity, and soil moisture conditions.",
    treatment: "No treatment needed. Continue regular monitoring and maintain optimal growing conditions.",
    precautions: ["Monitor regularly", "Maintain balanced nutrition", "Ensure adequate airflow"],
    recoveryDays: "N/A",
    stages: [
      { title: "Monitoring", days: "Ongoing", desc: "Continue regular inspection to catch early signs of disease." },
      { title: "Prevention", days: "Ongoing", desc: "Maintain optimal environmental conditions to prevent disease onset." },
      { title: "Nutrition", days: "Ongoing", desc: "Ensure balanced fertilization to keep plants resilient." },
      { title: "Airflow", days: "Ongoing", desc: "Adequate spacing and pruning keeps humidity low around the canopy." },
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

const staggerContainer = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const staggerItem = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } } };

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

function NotificationBell({ activityLog, unreadCount, open, onToggle, onClose }) {
  const important = activityLog.slice(0, 20);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  return (
    <div className="relative" ref={containerRef}>
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
  { value: "10000", display: "10,000+", label: "Leaves Analyzed", icon: ScanLine },
  { value: "10", display: "10+", label: "Tomato Diseases Detected", icon: Bug },
  { value: "98", display: "98%+", label: "Model Classification Accuracy", icon: Target },
];

// value is the clean animatable number ("10000"); display is how it should
// read once formatted ("10,000+") -- the suffix is whatever's left after
// stripping display's own leading digits/commas, so it stays correct however
// display is formatted (+, %, %+, ...).
function AnimatedStatValue({ value, display }) {
  const [triggered, setTriggered] = useState(false);
  const target = parseFloat(value);
  const suffix = display.replace(/^[\d,]+/, "");
  const animated = useCountUp(triggered ? target : 0);

  return (
    <motion.span onViewportEnter={() => setTriggered(true)} viewport={{ once: true, amount: 0.6 }}>
      {animated.toLocaleString("en-IN")}
      {suffix}
    </motion.span>
  );
}

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
              AI-Powered Tomato Crop Health &amp; Disease Detection Platform
            </h1>
            <p className="text-forest-100/90 text-base md:text-lg max-w-xl">
              Autonomous field robotics, real-time leaf disease detection, and precision spraying — built to protect every tomato plant in the field.
            </p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 px-6 bg-gradient-to-br from-forest-50 to-leaf-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="font-display font-bold text-3xl text-center mb-2 text-forest-950">
            Welcome to <span className="text-forest-600">CropGuardian AI</span>
          </h2>
          <p className="text-center text-gray-600 mb-14">Precision agriculture, built for India's tomato farmers</p>
          <div className="grid grid-cols-1 md:grid-cols-3 max-w-3xl mx-auto gap-8">
            {LANDING_STATS.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                whileHover={{ y: -6 }}
                className="flex flex-col items-center text-center bg-white/20 backdrop-blur-sm border border-white/30 rounded-2xl px-6 py-8 shadow-lg"
              >
                <div className="w-14 h-14 rounded-full bg-white/30 flex items-center justify-center mb-4 shadow-md">
                  <s.icon size={24} className="text-forest-800" />
                </div>
                <p className="font-display font-extrabold text-4xl text-forest-900 mb-1"><AnimatedStatValue value={s.value} display={s.display} /></p>
                <p className="text-sm text-forest-800 font-medium">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Split: About */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs font-bold text-leaf-700 tracking-widest uppercase mb-3">About the platform</p>
            <h3 className="font-display font-bold text-3xl text-forest-950 mb-5">Built for the tomato farmer, powered by deep learning</h3>
            <p className="text-gray-600 leading-relaxed mb-4">
              CropGuardian AI combines a ground-level camera rover with a two-stage detection pipeline — YOLOv8 for leaf detection, EfficientNetV2 for disease classification — to catch pathogens within hours of symptoms appearing, not days.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Every detection is explained through Grad-CAM visual evidence, not just a label.
            </p>
          </div>
          <div className="relative rounded-2xl overflow-hidden shadow-xl aspect-[4/3] bg-forest-900 flex items-center justify-center">
            <div className="w-full h-full overflow-hidden rounded-2xl">
              <motion.img
                src="https://images.unsplash.com/photo-1592841200221-a6898f307baa?w=800&q=80"
                alt="Fresh tomatoes"
                className="w-full h-full object-cover"
                whileHover={{ scale: 1.08 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Split: Infra */}
      <section className="py-20 px-6 bg-forest-50">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div className="relative rounded-2xl overflow-hidden shadow-xl aspect-[4/3] bg-forest-900 flex items-center justify-center order-2 md:order-1">
            <div className="w-full h-full overflow-hidden rounded-2xl">
              <motion.img
                src="https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800&q=80"
                alt="Agricultural technology"
                className="w-full h-full object-cover"
                whileHover={{ scale: 1.08 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
          </div>
          <div className="order-1 md:order-2">
            <p className="text-xs font-bold text-leaf-700 tracking-widest uppercase mb-3">Infrastructure &amp; AI tech</p>
            <h3 className="font-display font-bold text-3xl text-forest-950 mb-5">From image to action — a closed loop no other system closes</h3>
            <p className="text-gray-600 leading-relaxed mb-4">
              Our CADRI engine fuses visual severity scores with live environmental sensor data — temperature, humidity, soil moisture, air quality — to make economically grounded spray decisions using the Economic Injury Level framework.
            </p>
            <p className="text-gray-600 leading-relaxed">
              The result: precision pesticide delivery, not blanket spraying.
            </p>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="py-20 px-6 bg-gradient-to-br from-forest-900 via-forest-800 to-forest-950">
        <div className="max-w-7xl mx-auto">
          <h3 className="font-display font-bold text-3xl text-center text-white mb-14">Pillars of CropGuardian AI</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { icon: ScanLine, title: "Real-time detection", desc: "Leaf-level diagnosis within hours of symptoms." },
              { icon: Droplet, title: "Precision spraying", desc: "Dosage-limited, overdose-locked automation." },
              { icon: Warehouse, title: "Storage intelligence", desc: "Live climate tracking for post-harvest safety." },
              { icon: Users, title: "Farmer-first design", desc: "Built around real field workflows, not dashboards for their own sake." },
            ].map((p) => (
              <div key={p.title} className="text-center">
                <div className="w-16 h-16 rounded-full border-2 border-white/20 flex items-center justify-center mx-auto mb-4">
                  <p.icon size={26} className="text-leaf-400" />
                </div>
                <p className="font-display font-bold text-white mb-1.5">{p.title}</p>
                <p className="text-xs text-forest-200/80 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

const CROPGUARDIAN_PASSWORD = "cropguardian2025";

function LoginScreen({ onLogin }) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (password !== CROPGUARDIAN_PASSWORD) {
      setError("Incorrect password");
      return;
    }
    onLogin({ name: name.trim() });
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
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="Enter password"
                  className="w-full bg-white border border-earth-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-gold-400"
                />
                {error && <p className="text-xs text-rose-600 mt-1.5">{error}</p>}
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

function StatusChip({ tone, label, icon: Icon }) {
  const palette = {
    emerald: { glow: "bg-emerald-400", ring: "ring-emerald-200/60", text: "text-forest-800", dot: "bg-emerald-500" },
    amber: { glow: "bg-amber-400", ring: "ring-amber-200/60", text: "text-amber-800", dot: "bg-amber-500" },
  };
  const p = palette[tone] || palette.emerald;
  return (
    <div
      className={`relative flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-sm font-medium backdrop-blur-md bg-white/50 ring-1 ${p.ring} shadow-[0_4px_18px_rgba(15,56,0,0.08)] overflow-hidden`}
    >
      <motion.span
        className={`absolute -left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full ${p.glow} blur-xl pointer-events-none`}
        animate={{ opacity: [0.2, 0.5, 0.2], scale: [1, 1.3, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
      {Icon ? <Icon size={14} className={`relative shrink-0 ${p.text}`} /> : <span className={`relative w-2 h-2 rounded-full shrink-0 ${p.dot}`} />}
      <span className={`relative ${p.text}`}>{label}</span>
    </div>
  );
}

function DashboardView({ telemetry, overdoseLocked, cooldownRemaining, activityLog, alertCount, onQuickScan, serialConnected, warehouseStatus }) {
  return (
    <div className="relative -m-6 p-6 overflow-hidden">
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-16 left-1/4 w-[26rem] h-[26rem] rounded-full bg-forest-200/50 blur-3xl"
          animate={{ x: [0, 30, -15, 0], y: [0, 20, -15, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/3 -right-24 w-96 h-96 rounded-full bg-leaf-200/50 blur-3xl"
          animate={{ x: [0, -25, 15, 0], y: [0, -20, 10, 0] }}
          transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-0 left-1/5 w-80 h-80 rounded-full bg-lime-100/60 blur-3xl"
          animate={{ x: [0, 20, -20, 0], y: [0, -10, 15, 0] }}
          transition={{ duration: 19, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-forest-50/60 via-white to-lime-50/50" />
      </div>

      <div className="relative space-y-6">

      {/* Tagline */}
      <div className="pt-2">
        <motion.h1
          className="font-display font-bold text-3xl md:text-4xl bg-clip-text text-transparent bg-gradient-to-r from-forest-700 via-leaf-500 to-forest-700"
          style={{ backgroundSize: "200% auto" }}
          animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          Guard every leaf.
        </motion.h1>
        <p className="text-sm text-gray-500 mt-1">AI-powered crop monitoring — field to storage.</p>
      </div>

      {/* Status chips */}
      <div className="flex flex-wrap gap-3">
        <StatusChip
          tone={warehouseStatus?.fan_action === "FAN_ON" ? "amber" : "emerald"}
          label={`Storage: ${warehouseStatus?.fan_action === "FAN_ON" ? "Attention needed" : "Optimal"}`}
        />
        <StatusChip
          tone={alertCount > 0 ? "amber" : "emerald"}
          icon={AlertTriangle}
          label={alertCount > 0 ? `${alertCount} Active Alert${alertCount > 1 ? "s" : ""}` : "No Active Alerts"}
        />
        {overdoseLocked && (
          <StatusChip tone="amber" icon={Lock} label={`Spray cooldown — ${cooldownRemaining}s remaining`} />
        )}
      </div>

      {/* Storage alert banner */}
      {warehouseStatus?.fan_action === "FAN_ON" && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4"
        >
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Storage Alert</p>
            <p className="text-sm text-amber-700 mt-0.5">
              {warehouseStatus?.reasons?.map(r =>
                r === "temperature_high" ? "Temperature exceeds 25°C." :
                r === "humidity_high" ? "Humidity exceeds 70%." :
                r === "gas_high" ? "Gas level elevated." : r
              ).join(" ")} Fan activated automatically.
            </p>
            <button
              onClick={() => onQuickScan("navigate_storage")}
              className="text-xs text-amber-600 hover:text-amber-800 font-medium mt-1.5 flex items-center gap-1"
            >
              View storage details →
            </button>
          </div>
        </motion.div>
      )}

      {/* Quick scan */}
      <Card className="p-6">
        <SectionTitle icon={Camera} title="Quick Disease Scan" sub="Upload a leaf photo" />
        <QuickScanWidget onScanComplete={onQuickScan} />
        <div className="mt-4 pt-4 border-t border-gray-100">
          <button
            onClick={() => onQuickScan("navigate")}
            className="text-sm text-forest-600 hover:text-forest-800 font-medium flex items-center gap-1.5 transition-colors"
          >
            For detailed analysis, CADRI scoring and spray decisions →
          </button>
        </div>
      </Card>

      {/* Activity feed */}
      <Card className="p-5">
        <SectionTitle icon={Activity} title="Real-Time Activity Feed" sub="Live" />
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {activityLog.map((log) => (
              <motion.div
                key={log.id}
                layout
                initial={{ opacity: 0, x: -12, height: 0 }}
                animate={{ opacity: 1, x: 0, height: "auto" }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className={`flex items-start gap-3 py-2 pl-3 pr-1 border-l-4 rounded-r-md hover:bg-forest-50/40 transition-colors ${LOG_ACCENT[log.type] || LOG_ACCENT.info}`}
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
    </div>
  );
}

function QuickScanWidget({ onScanComplete }) {
  const [imgSrc, setImgSrc] = useState(null);
  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [skipReason, setSkipReason] = useState(null);
  const inputRef = useRef(null);

  const handleFile = (f) => {
    if (!f || !f.type.startsWith("image/")) return;
    setFile(f);
    setResult(null);
    setSkipReason(null);
    const reader = new FileReader();
    reader.onload = (e) => setImgSrc(e.target.result);
    reader.readAsDataURL(f);
  };

  const analyze = async () => {
    if (!file) return;
    setAnalyzing(true);
    const formData = new FormData();
    formData.append("image", file);
    const res = await apiFetch("/analyze", { method: "POST", body: formData });
    setAnalyzing(false);
    if (!res || !res.ok) { setSkipReason("Backend unavailable."); return; }
    if (res.data.skipped) { setSkipReason(res.data.reason === "cooldown_active" ? `Cooldown active — ${Math.round(res.data.cooldown_seconds_remaining)}s remaining.` : "Pump already running."); return; }
    if (!res.data.leaves || res.data.leaves.length === 0) { setResult({ detected: false }); return; }
    const leaf = res.data.leaves[0];
    setResult({
      detected: leaf.decision !== "no_spray" && leaf.decision !== "manual_inspection",
      disease: leaf.disease,
      confidence: Math.round(leaf.confidence * 100),
      decision: leaf.decision,
    });
    onScanComplete(res.data);
  };

  return (
    <div className="space-y-4">
      {!imgSrc ? (
        <motion.div
          className="relative rounded-3xl p-[3px]"
          style={{ backgroundImage: "linear-gradient(120deg, #2c6642, #6bd67e, #2f7aab, #2c6642)", backgroundSize: "300% 300%" }}
          animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full h-60 rounded-[calc(1.5rem-3px)] bg-forest-50/80 hover:bg-forest-50 backdrop-blur-sm flex flex-col items-center justify-center gap-3 text-forest-600 transition-colors"
          >
            <div className="w-16 h-16 rounded-2xl bg-white/80 flex items-center justify-center shadow-sm">
              <Leaf size={34} className="text-forest-500" />
            </div>
            <p className="text-base font-semibold">Drop a leaf photo to scan instantly.</p>
            <p className="text-xs text-forest-500/70 flex items-center gap-1"><UploadCloud size={12} /> or click to browse</p>
          </button>
        </motion.div>
      ) : (
        <div className="flex items-center gap-4">
          <img src={imgSrc} alt="Leaf" className="w-20 h-20 object-cover rounded-xl border border-gray-200" />
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-4">
              {!result && !skipReason && (
                <motion.button
                  onClick={analyze}
                  disabled={analyzing}
                  whileHover={{ scale: analyzing ? 1 : 1.03 }}
                  whileTap={{ scale: analyzing ? 1 : 0.96 }}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-forest-600 to-forest-500 disabled:from-gray-300 disabled:to-gray-300 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-md transition-colors"
                >
                  {analyzing ? <RefreshCw size={15} className="animate-spin" /> : <Play size={15} />}
                  {analyzing ? "Analyzing..." : "Analyze"}
                </motion.button>
              )}
              <button onClick={() => { setImgSrc(null); setFile(null); setResult(null); setSkipReason(null); }} className="text-xs text-gray-400 hover:text-gray-600">
                Remove
              </button>
            </div>
            {skipReason && <p className="text-sm text-amber-700 font-medium">{skipReason}</p>}
            {result && result.decision === "sensors_unavailable" ? (
              <div className="rounded-xl px-4 py-3 text-sm bg-amber-50 border border-amber-100">
                <p className="font-medium text-amber-800">{result.disease} detected — {result.confidence}% confidence</p>
                <p className="text-amber-700 mt-0.5">Connect Arduino for spray decision.</p>
              </div>
            ) : result && (
              <div className={`rounded-xl px-4 py-3 text-sm font-medium ${result.detected ? "bg-rose-50 text-rose-800 border border-rose-100" : "bg-forest-50 text-forest-800 border border-forest-100"}`}>
                {result.detected
                  ? `${result.disease} detected — ${result.confidence}% confidence. Decision: ${result.decision?.replace("_", " ")}.`
                  : "No disease detected — leaf appears healthy."}
              </div>
            )}
          </div>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
    </div>
  );
}

const LOG_ACCENT = {
  info: "border-aqua-400",
  detect: "border-rose-400",
  spray: "border-forest-400",
  lock: "border-rose-500",
  alert: "border-red-500",
  system: "border-gray-300",
};

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

// Maps a CADRI display name (e.g. "Bacterial Spot") back to the matching
// local DISEASES entry for treatment/precautions detail. Matched both ways
// since local names are sometimes a superset of the API's (e.g. "Tomato
// Yellow Leaf Curl Virus" vs. "Yellow Leaf Curl Virus").
function matchDiseaseRecord(name) {
  if (!name) return null;
  const norm = name.toLowerCase();
  return DISEASES.find((d) => {
    const dn = d.name.toLowerCase();
    return dn.includes(norm) || norm.includes(dn);
  }) || null;
}

function DiseaseDetectionView({ onScanComplete, overdoseLocked, cooldownRemaining, sprayState, tankLevel }) {
  const [imgSrc, setImgSrc] = useState(null);
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  const handleFile = (selected) => {
    if (!selected || !selected.type.startsWith("image/")) return;
    setFileName(selected.name);
    setResult(null);
    setFile(selected);
    const reader = new FileReader();
    reader.onload = (e) => setImgSrc(e.target.result);
    reader.readAsDataURL(selected);
  };

  const analyze = async () => {
    if (!imgSrc || !file) return;
    setAnalyzing(true);
    const formData = new FormData();
    formData.append("image", file);
    const res = await apiFetch("/analyze", { method: "POST", body: formData });
    setAnalyzing(false);

    if (!res || !res.ok) {
      setResult({ error: true, message: res?.data?.detail || "Could not reach the analysis backend. Check the API server and try again." });
      return;
    }

    const data = res.data;
    if (data.skipped) {
      const outcome = {
        skipped: true,
        reason: data.reason,
        cooldownSecondsRemaining: data.cooldown_seconds_remaining,
      };
      setResult(outcome);
      onScanComplete(outcome);
      return;
    }

    if (!data.leaves || data.leaves.length === 0) {
      const outcome = { detected: false, count: 0, disease: "No Leaf Detected", confidence: 0, record: null };
      setResult(outcome);
      onScanComplete(outcome);
      return;
    }

    const leaf = data.leaves[0];
    const outcome = {
      detected: leaf.decision !== "no_spray" && leaf.decision !== "manual_inspection",
      count: data.leaves.length,
      disease: leaf.disease,
      confidence: Math.round(leaf.confidence * 100),
      cadri: leaf.cadri,
      eil: leaf.eil,
      decision: leaf.decision,
      reasoning: leaf.reasoning,
      sensors_available: leaf.sensors_available,
      record: matchDiseaseRecord(leaf.disease),
    };
    setResult(outcome);
    onScanComplete(outcome);
  };

  const reset = () => {
    setImgSrc(null);
    setFileName("");
    setFile(null);
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
            {result.error ? (
              <div className="flex items-start gap-3 bg-red-50 ring-1 ring-red-100 rounded-lg p-4">
                <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Analysis failed</p>
                  <p className="text-sm text-red-700 mt-0.5">{result.message}</p>
                </div>
              </div>
            ) : result.skipped ? (
              <div className="flex items-start gap-3 bg-amber-50 ring-1 ring-amber-100 rounded-lg p-4">
                <Lock size={20} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    Spray skipped — {result.reason === "cooldown_active" ? "cooldown active" : "pump already running"}
                  </p>
                  {result.cooldownSecondsRemaining != null && (
                    <p className="text-sm text-amber-700 mt-0.5">Cooldown resets in {result.cooldownSecondsRemaining}s.</p>
                  )}
                </div>
              </div>
            ) : !result.detected ? (
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

                {!result.sensors_available && (
                  <div className="flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2 text-xs text-amber-700">
                    <AlertTriangle size={13} />
                    Environmental risk unavailable — Arduino not connected. Spray decision skipped.
                  </div>
                )}

                {result.reasoning && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">CADRI Reasoning</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{result.reasoning}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-rose-50 rounded-lg p-3">
                    <p className="text-xs text-gray-400 mb-1">CADRI score</p>
                    <p className="text-sm font-semibold text-gray-800">{result.cadri != null ? result.cadri.toFixed(3) : "—"}</p>
                  </div>
                  <div className="bg-rose-50 rounded-lg p-3">
                    <p className="text-xs text-gray-400 mb-1">EIL threshold</p>
                    <p className="text-sm font-semibold text-gray-800">{result.eil != null ? result.eil.toFixed(3) : "No threshold"}</p>
                  </div>
                </div>
                {result.record && (
                  <>
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
                  </>
                )}
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
            <div className="flex justify-between"><span className="text-gray-400">Model</span><span className="text-gray-700 font-mono">EfficientNetV2</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Classes</span><span className="text-gray-700 font-mono">10 diseases + healthy</span></div>
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

  if (latest.temp > 25) {
    notes.push("Temperature exceeds 25°C — fan activated to prevent rapid spoilage and ripening.");
    status = "Attention needed"; tone = "amber";
  } else {
    notes.push("Temperature is within safe range for tomato storage.");
  }

  if (latest.humidity > 70) {
    notes.push("Humidity above 70% — risk of mold and fungal growth. Fan activated for ventilation.");
    status = "Attention needed"; tone = "amber";
  } else {
    notes.push("Humidity is within the safe range for post-harvest storage.");
  }

  if (latest.co2 > 60) {
    notes.push("Gas level elevated — ventilation triggered to clear air accumulation.");
    status = "Attention needed"; tone = "amber";
  } else {
    notes.push("Air quality is within safe limits for current storage conditions.");
  }

  return { status, tone, notes };
}

function StorageMonitoringView({ telemetry, warehouseStatus }) {
  const latest = telemetry[telemetry.length - 1];

  if (!latest) {
    return (
      <div className="relative -m-6 p-6">
        <Card className="p-10 text-center">
          <p className="text-sm text-gray-400">Waiting for live sensor data…</p>
        </Card>
      </div>
    );
  }

  // Prefer the backend's own warehouse decision (ground truth for what the
  // fan was actually commanded to do) over the locally-derived conclusion;
  // fall back to the local thresholds only while the poll hasn't landed yet.
  const conclusion = warehouseStatus
    ? {
        status: warehouseStatus.reasons.length > 0 ? "Attention needed" : "Optimal",
        tone: warehouseStatus.reasons.length > 0 ? "amber" : "emerald",
        notes: [
          warehouseStatus.status.temperature === "critical"
            ? "Temperature exceeds 25°C — fan activated to prevent rapid spoilage and ripening."
            : "Temperature is within safe range for tomato storage.",
          warehouseStatus.status.humidity === "critical"
            ? "Humidity above 70% — risk of mold and fungal growth. Fan activated for ventilation."
            : "Humidity is within the safe range for post-harvest storage.",
          warehouseStatus.status.gas === "critical"
            ? "Gas level elevated — ventilation triggered to clear air accumulation."
            : "Air quality is within safe limits for current storage conditions.",
        ],
      }
    : deriveStorageConclusion(latest);

  const kpiTone = (sensorKey, fallback) =>
    warehouseStatus ? (warehouseStatus.status[sensorKey] === "critical" ? "amber" : "emerald") : fallback;
  const fanOn = warehouseStatus?.fan_action === "FAN_ON";

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
        <KpiCard label="Storage Temperature" value={latest.temp} unit="°C" icon={Thermometer} tone={kpiTone("temperature", "amber")} />
        <KpiCard label="Storage Humidity" value={latest.humidity} unit="%" icon={CloudRain} tone={kpiTone("humidity", "sky")} />
        <KpiCard label="CO2 Concentration" value={latest.co2} unit="ppm" icon={Wind} tone={kpiTone("gas", "emerald")} />
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
          <div className="flex items-center gap-2">
            {warehouseStatus && (
              <Badge tone={fanOn ? "amber" : "slate"} icon={Wind}>{warehouseStatus.fan_action}</Badge>
            )}
            <Badge tone={conclusion.tone} icon={conclusion.tone === "emerald" ? CheckCircle2 : AlertTriangle}>{conclusion.status}</Badge>
          </div>
        </div>
        {warehouseStatus && warehouseStatus.reasons.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {warehouseStatus.reasons.map((r) => (
              <Badge key={r} tone="amber" icon={AlertTriangle}>{r.replace(/_/g, " ")}</Badge>
            ))}
          </div>
        )}
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
  { x: 155, y: 175, side: -1 },
  { x: 445, y: 130, side: 1 },
  { x: 180, y: 85, side: -1 },
  { x: 420, y: 55, side: 1 },
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

function DiseaseDetailModal({ disease, onClose, onNext, onPrev }) {
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
      <button
        onClick={(e) => { e.stopPropagation(); onPrev(); }}
        aria-label="Previous disease"
        className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white items-center justify-center transition-colors backdrop-blur-sm"
      >
        <ChevronLeft size={20} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onNext(); }}
        aria-label="Next disease"
        className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white items-center justify-center transition-colors backdrop-blur-sm"
      >
        <ChevronRight size={20} />
      </button>
      <motion.div
        key={disease.name}
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

        <div className="w-full h-52 overflow-hidden">
          <motion.img
            src={disease.image}
            alt={disease.name}
            className="w-full h-full object-cover"
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
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
  const [selected, setSelected] = useState(null); // index into DISEASES, or null when closed
  const severityColor = { Critical: "#e11d48", High: "#f59e0b", Moderate: "#f59e0b", Low: "#4e9f3d" };

  useEffect(() => {
    if (selected === null) return;
    const handler = (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        setSelected((i) => (i + 1) % DISEASES.length);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        setSelected((i) => (i - 1 + DISEASES.length) % DISEASES.length);
      } else if (e.key === "Escape") {
        setSelected(null);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [selected]);

  return (
    <div className="relative -m-6 overflow-hidden">
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-sky-50 via-white to-lime-50" />
      <div className="px-6 pt-6 pb-2 text-center">
        <h2 className="font-display text-xl font-bold text-forest-900">Tap a leaf to learn about that disease</h2>
        <p className="text-sm text-gray-500">Ten tomato pathogens and conditions, mapped onto the plant</p>
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
              onClick={() => setSelected(i)}
            />
          ))}
          {/* top sprout */}
          <circle cx="300" cy="115" r="10" fill="#6bd67e" />
        </svg>
      </div>

      <AnimatePresence>
        {selected !== null && (
          <DiseaseDetailModal
            disease={DISEASES[selected]}
            onClose={() => setSelected(null)}
            onNext={() => setSelected((i) => (i + 1) % DISEASES.length)}
            onPrev={() => setSelected((i) => (i - 1 + DISEASES.length) % DISEASES.length)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Reports Center view — proper written report                           */
/* ---------------------------------------------------------------------- */

function ReportsView({ sprayLog }) {
  const detections = sprayLog.filter((r) => r.confidence != null);
  const executed = sprayLog.filter((r) => r.status === "Executed");
  const suppressed = sprayLog.filter((r) => r.status === "Suppressed");
  const totalDetected = detections.reduce((sum, r) => sum + (r.count || 1), 0);

  // sprayLog is newest-first; walk it oldest-first so the chart reads
  // chronologically, grouping by day (r.time carries no date component today,
  // so this falls back to one bucket per distinct time value — still real
  // data, just as granular as what's actually being logged).
  const detectionsByDay = [...sprayLog].reverse().reduce((days, r) => {
    const day = r.time.split(",")[0];
    const bucket = days.find((d) => d.date === day);
    if (bucket) bucket.count += 1;
    else days.push({ date: day, count: 1 });
    return days;
  }, []);

  const diseaseBreakdown = Object.entries(
    sprayLog.reduce((counts, r) => {
      if (!r.trigger) return counts;
      counts[r.trigger] = (counts[r.trigger] || 0) + 1;
      return counts;
    }, {})
  )
    .map(([trigger, count], i) => ({
      name: trigger.length > 16 ? trigger.slice(0, 15) + "…" : trigger,
      fullName: trigger,
      count,
      fill: ["#ec4899", "#8b5cf6", "#06b6d4", "#f97316", "#10b981", "#f43f5e"][i % 6],
    }))
    .sort((a, b) => b.count - a.count);

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

      {sprayLog.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-gray-400">No spray events logged yet. Run a scan from Disease Detection to populate this report.</p>
        </Card>
      ) : (
        <>
          <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <motion.div variants={staggerItem}><KpiCard label="Diseases Detected" value={String(totalDetected)} icon={Bug} tone="amber" /></motion.div>
            <motion.div variants={staggerItem}><KpiCard label="Sprays Executed" value={String(executed.length)} icon={Droplet} tone="emerald" /></motion.div>
            <motion.div variants={staggerItem}><KpiCard label="Sprays Suppressed" value={String(suppressed.length)} icon={Lock} tone="sky" trend="By overdose lock" /></motion.div>
          </motion.div>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-1">
              <SectionTitle icon={Activity} title="Trends & Analytics" sub={`${sprayLog.length} event${sprayLog.length === 1 ? "" : "s"} logged`} tone="earth" />
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.6, repeat: Infinity }} className="w-2 h-2 rounded-full bg-emerald-500" />
                Live
              </span>
            </div>
            <p className="text-xs text-gray-500 font-medium mb-2 mt-3">Detections per day</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={detectionsByDay} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
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
                <Bar dataKey="count" name="Events" fill="url(#barGradient)" radius={[6, 6, 0, 0]} animationDuration={500} />
              </BarChart>
            </ResponsiveContainer>

            {diseaseBreakdown.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-100">
                <p className="text-xs text-gray-500 font-medium mb-2">Detections by trigger</p>
                <ResponsiveContainer width="100%" height={Math.max(120, diseaseBreakdown.length * 34)}>
                  <BarChart data={diseaseBreakdown} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                    <XAxis type="number" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} width={130} />
                    <Tooltip
                      contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12 }}
                      formatter={(value, name, props) => [value, props.payload.fullName]}
                    />
                    <Bar dataKey="count" name="Occurrences" radius={[0, 6, 6, 0]} animationDuration={600}>
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
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Car Control view — manual 4WD drive                                    */
/* ---------------------------------------------------------------------- */

function CarControlView() {
  const [status, setStatus] = useState("Idle");
  const [speed, setSpeed] = useState(255);
  const [error, setError] = useState(null);
  const heldRef = useRef(false);

  const sendCommand = async (command) => {
    const res = await apiFetch("/car/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command }),
    });
    if (!res || !res.ok) {
      setError("Car unreachable — check the board is powered and on the same network.");
    } else {
      setError(null);
    }
    return res;
  };

  const press = (command, label) => (e) => {
    e.preventDefault();
    heldRef.current = true;
    setStatus(label);
    sendCommand(command);
  };

  const release = (e) => {
    if (!heldRef.current) return;
    e?.preventDefault();
    heldRef.current = false;
    setStatus("Stopped");
    sendCommand("S");
  };

  const bumpSpeed = (delta, command) => () => {
    setSpeed((s) => clamp(s + delta, 60, 255));
    sendCommand(command);
  };

  const DirButton = ({ command, label, icon: Icon, className = "" }) => (
    <motion.button
      onPointerDown={press(command, label)}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      whileTap={{ scale: 0.92 }}
      className={`w-20 h-20 rounded-2xl bg-forest-600 hover:bg-forest-700 text-white flex items-center justify-center shadow-lg shadow-forest-700/30 transition-colors select-none touch-none ${className}`}
    >
      <Icon size={30} />
    </motion.button>
  );

  return (
    <div className="flex flex-col items-center gap-8 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={status === "Stopped" || status === "Idle" ? "slate" : "sky"} icon={Gamepad2}>
          {status}
        </Badge>
        <Badge tone="slate">Speed {speed}</Badge>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-rose-50 ring-1 ring-rose-100 rounded-lg px-4 py-2.5 text-sm text-rose-700">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      <Card className="p-8">
        <div className="grid grid-cols-3 grid-rows-3 gap-3 place-items-center">
          <div />
          <DirButton command="F" label="Forward" icon={ChevronUp} />
          <div />

          <DirButton command="L" label="Left" icon={ChevronLeft} />
          <motion.button
            onClick={() => sendCommand("S")}
            whileTap={{ scale: 0.92 }}
            className="w-20 h-20 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg shadow-rose-700/30 transition-colors"
          >
            <Square size={26} fill="currentColor" />
          </motion.button>
          <DirButton command="R" label="Right" icon={ChevronRight} />

          <div />
          <DirButton command="B" label="Backward" icon={ChevronDown} />
          <div />
        </div>
        <p className="text-xs text-gray-400 text-center mt-4">Hold a direction to move — release to stop</p>
      </Card>

      <Card className="p-5 w-full max-w-xs">
        <SectionTitle icon={Zap} title="Speed" tone="sky" />
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={bumpSpeed(-20, "-")}
            className="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-lg flex items-center justify-center transition-colors"
          >
            −
          </button>
          <span className="font-mono text-2xl font-bold text-gray-800 w-16 text-center">{speed}</span>
          <button
            onClick={bumpSpeed(20, "+")}
            className="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-lg flex items-center justify-center transition-colors"
          >
            +
          </button>
        </div>
      </Card>

      <LiveCameraPanel />
    </div>
  );
}

/** Shown on the driver's phone alongside the D-pad -- polls the last frame
 * the camera phone pushed (see CameraFeedView) and can trigger a real CADRI
 * analysis of whatever's currently in view. */
function LiveCameraPanel() {
  const [tick, setTick] = useState(0);
  const [hasFrame, setHasFrame] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const analyze = async () => {
    setAnalyzing(true);
    setResult(null);
    const res = await apiFetch("/camera/analyze", { method: "POST" });
    setAnalyzing(false);
    if (!res || !res.ok) {
      setResult({ error: true, message: res?.data?.detail || "Could not analyze the current frame." });
      return;
    }
    const data = res.data;
    if (data.skipped) {
      setResult({ skipped: true, reason: data.reason });
      return;
    }
    const leaf = data.leaves?.[0];
    if (!leaf) {
      setResult({ detected: false });
      return;
    }
    setResult({
      detected: leaf.decision !== "no_spray" && leaf.decision !== "manual_inspection",
      disease: leaf.disease,
      confidence: Math.round(leaf.confidence * 100),
      decision: leaf.decision,
      reasoning: leaf.reasoning,
    });
  };

  return (
    <Card className="p-4 w-full max-w-md">
      <SectionTitle icon={Camera} title="Live Camera" sub="Rover feed" tone="sky" />
      <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
        <img
          src={`${API_BASE_URL}/camera/frame?t=${tick}`}
          alt="Live feed"
          className="w-full h-full object-cover"
          onLoad={() => setHasFrame(true)}
          onError={() => setHasFrame(false)}
        />
        {!hasFrame && (
          <div className="absolute inset-0 flex items-center justify-center text-white/60 text-sm text-center px-6">
            No camera feed yet — start streaming from the phone mounted on the rover
          </div>
        )}
      </div>

      <motion.button
        onClick={analyze}
        disabled={analyzing}
        whileTap={{ scale: 0.96 }}
        className="w-full mt-4 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-forest-600 to-forest-500 disabled:from-gray-300 disabled:to-gray-300 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-md transition-colors"
      >
        {analyzing ? <RefreshCw size={15} className="animate-spin" /> : <ScanLine size={15} />}
        {analyzing ? "Analyzing..." : "Analyze This Frame"}
      </motion.button>

      {result && (
        <div className="mt-3">
          {result.error ? (
            <p className="text-sm text-rose-700 bg-rose-50 rounded-lg px-3 py-2">{result.message}</p>
          ) : result.skipped ? (
            <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              Spray skipped — {result.reason === "cooldown_active" ? "cooldown active" : "pump already running"}
            </p>
          ) : !result.detected ? (
            <p className="text-sm text-forest-700 bg-forest-50 rounded-lg px-3 py-2">No disease detected — leaf appears healthy.</p>
          ) : (
            <div className="text-sm text-rose-800 bg-rose-50 rounded-lg px-3 py-2 space-y-1">
              <p className="font-medium">{result.disease} — {result.confidence}% confidence</p>
              {result.reasoning && <p className="text-xs text-rose-700">{result.reasoning}</p>}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/** Run on the phone physically mounted on the rover -- captures its own
 * camera and pushes a frame every ~1.5s for the driver's phone to see. */
function CameraFeedView() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState(null);
  const [framesSent, setFramesSent] = useState(0);

  const sendFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      async (blob) => {
        if (!blob) return;
        const formData = new FormData();
        formData.append("image", blob, "frame.jpg");
        const res = await apiFetch("/camera/frame", { method: "POST", body: formData });
        if (res && res.ok) setFramesSent((n) => n + 1);
      },
      "image/jpeg",
      0.7
    );
  };

  const stop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  };

  const start = async () => {
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        `The browser won't expose the camera on this page (insecure origin). Go to chrome://flags/#unsafely-treat-insecure-origin-as-secure, add exactly "${window.location.origin}", set it to Enabled, then tap Relaunch (a reload isn't enough — Chrome needs a full restart for this to take effect).`
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
      intervalRef.current = setInterval(sendFrame, 1500);
    } catch (e) {
      setError(e?.message || "Could not access the camera — permission denied or no camera available.");
    }
  };

  useEffect(() => () => stop(), []);

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <Card className="p-4 w-full max-w-md">
        <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
          <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
          {!active && (
            <div className="absolute inset-0 flex items-center justify-center text-white/60 text-sm">Camera off</div>
          )}
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </Card>

      {error && (
        <div className="flex items-start gap-2 bg-rose-50 ring-1 ring-rose-100 rounded-lg px-4 py-3 text-sm text-rose-700 max-w-md">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <motion.button
        onClick={active ? stop : start}
        whileTap={{ scale: 0.96 }}
        className={`inline-flex items-center gap-2 text-white text-sm font-semibold px-6 py-3 rounded-full shadow-md transition-colors ${
          active ? "bg-rose-600 hover:bg-rose-700" : "bg-forest-600 hover:bg-forest-700"
        }`}
      >
        <Camera size={16} /> {active ? "Stop Streaming" : "Start Streaming"}
      </motion.button>

      {active && <p className="text-xs text-gray-400">{framesSent} frame{framesSent === 1 ? "" : "s"} sent</p>}
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
  const [view, setView] = useState("dashboard");
  const [telemetry, setTelemetry] = useState([]);
  const [warehouseStatus, setWarehouseStatus] = useState(null);
  const [overdoseLocked, setOverdoseLocked] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [serialConnected, setSerialConnected] = useState(true);
  const [sprayState, setSprayState] = useState("idle");
  const [tankLevel, setTankLevel] = useState(78);
  const [profileOpen, setProfileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [settings, setSettings] = useState(() => loadPersisted("cropguardian_settings", DEFAULT_SETTINGS));
  const [calibration, setCalibration] = useState(() => loadPersisted("cropguardian_calibration", DEFAULT_CALIBRATION));
  const logIdRef = useRef(1);
  const sprayIdRef = useRef(1);
  const profileRef = useRef(null);

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

  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest("[data-more-menu]")) setMoreOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [profileOpen]);

  const handleDetection = useCallback(
    (outcome) => {
      if (outcome.skipped) {
        const reasonText = outcome.reason === "cooldown_active" ? "overdose cooldown active" : "pump already running";
        pushLog("lock", `Spray skipped — ${reasonText}`);
        pushSprayRow({ trigger: "CADRI Analysis", action: `Spray skipped (${reasonText})`, count: 0, confidence: null, status: "Suppressed" });
        setSprayState("idle");
        return;
      }
      if (outcome.decision === "sensors_unavailable") {
        pushLog("info", `${outcome.disease} detected (${outcome.confidence}% confidence) — Arduino not connected, spray decision skipped`);
        pushSprayRow({
          trigger: outcome.disease, action: "Spray decision skipped (sensors unavailable)", count: outcome.count || 0,
          confidence: outcome.confidence, status: "Info",
        });
        setSprayState("idle");
        return;
      }
      if (!outcome.detected) {
        const isAmbiguous = outcome.decision === "manual_inspection";
        pushLog(
          "info",
          isAmbiguous
            ? `${outcome.disease} detected but confidence too ambiguous (${outcome.confidence}%) — flagged for manual inspection`
            : `Photo analysis complete — ${outcome.disease || "no pathogen"} detected (${outcome.confidence}% confidence), no action needed`
        );
        pushSprayRow({
          trigger: outcome.disease, action: isAmbiguous ? "Flagged for manual inspection" : "Scan clear, no action taken",
          count: outcome.count || 0, confidence: outcome.confidence, status: "Info",
        });
        setSprayState("idle");
        return;
      }
      pushLog("detect", `AI classified ${outcome.disease} — ${outcome.confidence}% confidence (${outcome.count} indicator${outcome.count > 1 ? "s" : ""})`);
      setSprayState("fungicide");
      setTankLevel((lvl) => clamp(lvl - rand(4, 7), 0, 100));
      pushLog("spray", `Auto-Response: CADRI triggered a ${outcome.decision.replace(/_/g, " ")} — ${outcome.reasoning || ""}`);
      pushSprayRow({
        trigger: outcome.disease, action: `${outcome.decision.replace(/_/g, " ")} executed`, count: outcome.count,
        confidence: outcome.confidence, status: "Executed",
        recoveryDays: outcome.record?.recoveryDays, precautions: outcome.record?.precautions,
      });
      setTimeout(() => setSprayState("idle"), (settings.sprayDurationSec + 1) * 1000);
    },
    [pushLog, pushSprayRow, settings.sprayDurationSec]
  );

  // QuickScanWidget (Dashboard) hands back either a navigation intent or the
  // raw /analyze response — map the latter into handleDetection's outcome
  // shape so both entry points share one decision/logging path.
  const handleQuickScan = useCallback(
    (payload) => {
      if (payload === "navigate") {
        setView("detection");
        return;
      }
      if (payload === "navigate_storage") {
        setView("storage");
        return;
      }
      if (payload.skipped) {
        handleDetection({ skipped: true, reason: payload.reason, cooldownSecondsRemaining: payload.cooldown_seconds_remaining });
        return;
      }
      const leaf = payload.leaves?.[0];
      if (!leaf) {
        handleDetection({ detected: false, count: 0, disease: "No Leaf Detected", confidence: 0, record: null });
        return;
      }
      handleDetection({
        detected: leaf.decision !== "no_spray" && leaf.decision !== "manual_inspection",
        count: payload.leaves.length,
        disease: leaf.disease,
        confidence: Math.round(leaf.confidence * 100),
        cadri: leaf.cadri,
        eil: leaf.eil,
        decision: leaf.decision,
        reasoning: leaf.reasoning,
        record: matchDiseaseRecord(leaf.disease),
      });
    },
    [handleDetection]
  );

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const res = await apiFetch("/sensors");
      if (cancelled) return;
      if (!res || !res.ok) {
        setSerialConnected(false);
        return;
      }
      const data = res.data;
      setSerialConnected(!!data.serial_connected);
      setOverdoseLocked(!!data.cooldown_active);
      setCooldownRemaining(Math.max(0, Math.round(data.cooldown_seconds_remaining || 0)));
      const next = {
        time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }),
        soilMoisture: data.soil_moisture,
        soilRaw: null,
        temp: data.temperature,
        humidity: data.humidity,
        co2: data.gas_level,
      };
      setTelemetry((prev) => [...prev.slice(-11), next]);
    };
    poll();
    const t = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const res = await apiFetch("/warehouse/status");
      if (cancelled) return;
      if (res && res.ok) setWarehouseStatus(res.data);
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

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
    dashboard: () => (
      <DashboardView
        telemetry={telemetry}
        overdoseLocked={overdoseLocked}
        cooldownRemaining={cooldownRemaining}
        activityLog={activityLog}
        alertCount={alertCount}
        onQuickScan={handleQuickScan}
        serialConnected={serialConnected}
        warehouseStatus={warehouseStatus}
      />
    ),
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
    storage: () => <StorageMonitoringView telemetry={telemetry} warehouseStatus={warehouseStatus} />,
    history: () => <HistoryView sprayLog={sprayLog} />,
    library: () => <DiseaseLibraryView />,
    reports: () => <ReportsView sprayLog={sprayLog} />,
    car: () => <CarControlView />,
    camera: () => <CameraFeedView />,
  };

  const initials = user.name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen text-gray-800 flex flex-col relative bg-forest-50/40">
      <AmbientBackground imageOpacity={0} overlayOpacity={0.15} />

      {/* Top Nav */}
      <header className="sticky top-0 z-20 bg-forest-900/95 backdrop-blur-md border-b border-forest-800 shadow-lg">
        <div className="h-20 flex items-center justify-between px-8 gap-4">
          <button onClick={() => setView("dashboard")} className="flex items-center gap-2.5 shrink-0 hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 rounded-xl bg-leaf-400/20 ring-1 ring-leaf-400/40 flex items-center justify-center">
              <Sprout size={18} className="text-leaf-400" />
            </div>
            <p className="font-display font-bold text-white text-base leading-tight tracking-tight">CropGuardian AI</p>
          </button>

          <div className="hidden lg:flex items-center gap-2">
            <nav className="flex items-center gap-2 overflow-x-auto">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setView(item.id)}
                  className={`relative flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
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

            {/* More dropdown — kept outside the overflow-x-auto nav above, since
                setting only overflow-x forces the browser to compute overflow-y
                as auto too, which clipped this absolutely-positioned menu to the
                nav's own row instead of letting it float over the page. */}
            <div className="relative shrink-0" data-more-menu>
              <button
                onClick={() => setMoreOpen((o) => !o)}
                className={`relative flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                  MORE_ITEMS.some((i) => i.id === view)
                    ? "bg-leaf-400 text-forest-900"
                    : "text-forest-200 hover:text-white hover:bg-white/10"
                }`}
              >
                <ChevronDown size={14} />
                <span>More</span>
              </button>
              {moreOpen && (
                <div className="absolute top-full mt-2 left-0 w-48 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden z-30">
                  {MORE_ITEMS.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => { setView(item.id); setMoreOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-4 py-3 text-sm font-medium transition-colors hover:bg-forest-50 ${
                        view === item.id ? "text-forest-700 bg-forest-50" : "text-gray-700"
                      }`}
                    >
                      <item.icon size={14} className="text-forest-500" />
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden xl:flex items-center gap-1.5 text-xs text-leaf-300 font-mono bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
              <StatusDot online={serialConnected} /> {serialConnected ? "System Nominal" : "Arduino Offline"}
            </div>
            <NotificationBell
              activityLog={activityLog}
              unreadCount={activityLog.filter((l) => l.id > lastSeenLogId && l.id !== 0).length}
              open={notificationsOpen}
              onToggle={() => {
                setNotificationsOpen((o) => !o);
                setProfileOpen(false);
                if (!notificationsOpen) setLastSeenLogId(activityLog[0]?.id ?? 0);
              }}
              onClose={() => setNotificationsOpen(false)}
            />
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => {
                  setProfileOpen((o) => !o);
                  setNotificationsOpen(false);
                }}
                className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-leaf-400 to-forest-400 flex items-center justify-center text-forest-900 text-[11px] font-bold shrink-0">{initials}</div>
                <span className="hidden md:block text-xs font-medium text-white/90">{user.name}</span>
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-44 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden z-30">
                  <div className="px-3 py-2.5 border-b border-gray-100">
                    <p className="text-xs font-semibold text-slate-700 truncate">{user.name}</p>
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
          {[...NAV_ITEMS, ...MORE_ITEMS].map((item) => (
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

        {!serialConnected && (
          <div className="bg-rose-600 text-white text-xs font-medium px-6 py-2 flex items-center justify-center gap-2">
            <AlertTriangle size={14} />
            Arduino not connected — sensor readings and relay commands are unavailable.
          </div>
        )}
      </header>

      {/* Page title bar */}
      {view !== "dashboard" && PAGE_META[view] && (
        <div className="bg-white/70 backdrop-blur-sm border-b border-forest-100 px-6 py-4">
          <h1 className="font-display font-bold text-forest-900 text-xl">{PAGE_META[view].title}</h1>
          <p className="text-xs text-forest-500">{PAGE_META[view].sub}</p>
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
