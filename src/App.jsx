import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import { ShoppingBasket, Plus, Minus, ClipboardList, LogOut, Leaf, ShieldCheck, CalendarDays, PackageCheck, Mail, LockKeyhole, UserRound, CheckCircle2, ArrowRight, History, Euro, Boxes, UsersRound, Search, Download, Printer, MapPin, Dog, School, CalendarCheck, ChevronRight, Egg, PawPrint, Heart, RefreshCw, HelpCircle, Copy, MessageSquareText, Star, ExternalLink, Eye, MousePointerClick, AlertTriangle, Snowflake, Image as ImageIcon } from "lucide-react";
import "./App.css";

const canUseBrowser = typeof window !== "undefined";
const isEggSummarySubdomain =
  canUseBrowser && window.location.hostname.toLowerCase().startsWith("commandes.");
const isStandaloneDisplay =
  canUseBrowser &&
  (window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true);
const isIosDevice =
  canUseBrowser && /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
const installWasRequested =
  canUseBrowser && new URLSearchParams(window.location.search).get("install") === "1";
const installBannerWasDismissed =
  canUseBrowser && localStorage.getItem("pwa-install-dismissed") === "true";
const updateNoticeDismissedKey = "pwa-update-notice-dismissed-at";
const updateNoticeDismissMs = 60 * 60 * 1000;
const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";
const publicSiteUrl = (import.meta.env.VITE_PUBLIC_SITE_URL || "").replace(/\/+$/, "");
const appBuildVersion = import.meta.env.VITE_APP_VERSION || "0.0.0";
const appBuildTime = import.meta.env.VITE_APP_BUILD_TIME || "";
const appCommitRef = import.meta.env.VITE_APP_COMMIT || "";
const appShortCommit = appCommitRef ? appCommitRef.slice(0, 7) : "local";

const AVAILABLE_IMAGE_OPTIONS = [
  "/images/ane-1.jpg",
  "/images/bambi-1.jpg",
  "/images/beurre-1.jpg",
  "/images/beurre-2.jpg",
  "/images/beurre-3.jpg",
  "/images/beurre-4.jpg",
  "/images/canicross.png",
  "/images/chevres-1.jpg",
  "/images/chevres-2.jpg",
  "/images/chevres-3.jpg",
  "/images/courgettes.jpg",
  "/images/ficelle-1.jpg",
  "/images/groupe-scolaire-1.jpg",
  "/images/groupe-scolaire-2.jpg",
  "/images/groupe-scolaire-3.jpg",
  "/images/groupe-scolaire-4.jpg",
  "/images/groupe-scolaire-5.jpg",
  "/images/hares-1.jpg",
  "/images/hares-2.jpg",
  "/images/hares-chamallow-1.jpg",
  "/images/hares-chamallow-2.jpg",
  "/images/jeu-de-piste-1.jpg",
  "/images/jeu-de-piste-2.jpg",
  "/images/jouets-perdus-1.jpg",
  "/images/jouets-perdus-2.jpg",
  "/images/jouets-perdus-3.jpg",
  "/images/jouets-perdus-4.jpg",
  "/images/jouets-perdus-5.jpg",
  "/images/kiri-1.png",
  "/images/marais.jpg",
  "/images/marais-1.jpg",
  "/images/marais-2.jpg",
  "/images/marais-3.jpg",
  "/images/marais-4.jpg",
  "/images/oeufs-12.jpg",
  "/images/oeufs-6.jpg",
  "/images/patate-1.jpg",
  "/images/pelote-1.jpg",
  "/images/pension-canine-1.jpg",
  "/images/pension-canine-2.jpg",
  "/images/pension-canine-3.jpg",
  "/images/pension-canine-4.jpg",
  "/images/pension-canine-5.jpg",
  "/images/pension-canine-6.jpg",
  "/images/pension-canine-7.jpg",
  "/images/pension-canine-8.jpg",
  "/images/prince-1.jpg",
  "/images/rallye-photo-1.jpg",
  "/images/rallye-photo-2.jpg",
  "/images/snow-1.jpg",
  "/images/tonte-mouton-1.png",
  "/images/vache-1.jpg",
  "/images/vente-oeufs-1.jpg",
  "/images/vente-oeufs-2.jpg",
  "/images/vente-oeufs-3.jpg",
  "/images/vente-oeufs-4.png",
  "/images/vente-oeufs-5.jpg",
  "/images/vente-oeufs-6.jpg",
  "/images/vente-oeufs-7.jpg",
  "/images/visite-libre-1.jpg",
  "/images/visite-libre-2.jpg",
  "/images/visite-libre-3.jpg",
];

const GOOGLE_REVIEW_URL =
  "https://www.google.com/maps/search/?api=1&query=Les%20Poulettes%20du%20Marais%20Bourneuf-en-Retz";
const GOOGLE_REVIEW_WRITE_URL = "https://g.page/r/CSmAsTCUXluPEBM/review";
const GOOGLE_REVIEW_HIGHLIGHTS = [
  {
    title: "Accueil à la ferme",
    text: "Un contact simple, chaleureux et proche des visiteurs.",
  },
  {
    title: "Produits frais",
    text: "Des commandes pratiques pour retrouver les oeufs et produits de la ferme.",
  },
  {
    title: "Ferme et pension",
    text: "Des retours utiles pour choisir une visite, une activité ou un séjour canin.",
  },
];

const PUBLIC_SCREEN_LABELS = {
  home: "Accueil",
  tutorials: "Tutoriels",
  about: "La ferme",
  event: "Événement",
  shop: "Boutique",
  education: "Ferme pédagogique",
  kennel: "Pension canine",
  contact: "Contact",
  faq: "Aide / FAQ",
  legal: "Mentions légales",
  privacy: "Confidentialité",
  terms: "Conditions",
  login: "Connexion",
  register: "Création de compte",
  confirmation: "Confirmation commande",
  myOrders: "Mes commandes",
  profile: "Mon profil",
};

const TUTORIAL_GUIDES = [
  {
    id: "eggs",
    title: "Commander des oeufs",
    intro: "Le chemin le plus simple pour créer votre compte, activer les notifications et passer une commande.",
    pdfUrl: "/tutoriels/tutoriel-commande-oeufs.pdf",
    icon: "eggs",
    steps: [
      {
        title: "Créer votre compte",
        text: "Depuis l'accueil, cliquez sur Créer un compte, puis indiquez votre nom, votre e-mail, votre téléphone et votre adresse.",
      },
      {
        title: "Activer les notifications",
        text: "Une fois connecté, acceptez les notifications pour recevoir les informations importantes de la ferme.",
      },
      {
        title: "Choisir vos oeufs",
        text: "Ouvrez la boutique, choisissez vos boîtes de 6 ou de 12, puis vérifiez votre panier.",
      },
      {
        title: "Valider la commande",
        text: "Choisissez le créneau proposé, vérifiez l'adresse et envoyez votre commande.",
      },
    ],
    memo: ["Compte client créé", "Notifications activées", "Panier vérifié", "Commande envoyée"],
  },
  {
    id: "kennel",
    title: "Réserver la pension canine",
    intro: "Un guide pour demander un séjour, choisir les dates et compléter la fiche de votre chien.",
    pdfUrl: "/tutoriels/tutoriel-pension-canine.pdf",
    icon: "dog",
    steps: [
      {
        title: "Ouvrir la pension canine",
        text: "Depuis l'accueil, cliquez sur Pension canine pour voir les informations, les photos et les disponibilités.",
      },
      {
        title: "Choisir les dates",
        text: "Sélectionnez la date d'arrivée et la date de départ souhaitées dans le formulaire.",
      },
      {
        title: "Remplir la fiche chien",
        text: "Ajoutez le nom, la race, l'âge, les habitudes, l'alimentation, les vaccins et les consignes importantes.",
      },
      {
        title: "Envoyer la demande",
        text: "La demande est ensuite vérifiée par la ferme, puis confirmée selon les places disponibles.",
      },
    ],
    memo: ["Dates choisies", "Téléphone vérifié", "Fiche chien complète", "Demande envoyée"],
  },
  {
    id: "education",
    title: "Réserver une activité",
    intro: "Le mode d'emploi pour choisir une activité à la ferme pédagogique et envoyer une demande.",
    pdfUrl: "/tutoriels/tutoriel-ferme-pedagogique.pdf",
    icon: "farm",
    steps: [
      {
        title: "Ouvrir la ferme pédagogique",
        text: "Depuis l'accueil, cliquez sur Ferme pédagogique pour découvrir les activités proposées.",
      },
      {
        title: "Choisir l'activité",
        text: "Sélectionnez la visite, l'atelier ou l'animation qui vous intéresse.",
      },
      {
        title: "Indiquer les participants",
        text: "Ajoutez les enfants, les âges, l'accompagnant et un numéro de téléphone joignable.",
      },
      {
        title: "Envoyer la réservation",
        text: "La ferme vous répond ensuite pour confirmer l'activité selon le créneau et les places.",
      },
    ],
    memo: ["Activité choisie", "Date vérifiée", "Participants indiqués", "Demande envoyée"],
  },
];

const DEFAULT_PRODUCTS = [
  {
  id: "box6",
  name: "Boîte de 6 œufs",
  size_eggs: 6,
  price: 2.4,
  image: "/images/oeufs-6.jpg",
  unit_label: "boite",
  active: true,
},
{
  id: "box12",
  name: "Boîte de 12 œufs",
  size_eggs: 12,
  price: 4.8,
  image: "/images/oeufs-12.jpg",
  unit_label: "boite",
  active: true,
},
];

const emptyProductForm = {
  id: "",
  name: "",
  price: "",
  unit_label: "piece",
  image: "",
  size_eggs: 0,
};

const emptyDeliverySlotForm = {
  delivery_date: "",
  label: "",
  max_orders: "",
};

const DEFAULT_EDUCATION_ACTIVITIES = [
  {
    id: "farm-visit",
    name: "Visite de la ferme",
    description: "Rencontre avec les animaux et découverte du quotidien de la ferme.",
    price: 0,
    season_label: "Toute l'année",
    image_url: "",
    gallery_images: [],
    active: true,
  },
  {
    id: "butter-workshop",
    name: "Atelier fabrication beurre",
    description: "Un atelier pratique pour fabriquer du beurre et comprendre les produits de la ferme.",
    price: 0,
    season_label: "Selon saison",
    image_url: "",
    gallery_images: [],
    active: true,
  },
  {
    id: "birthday-group",
    name: "Groupes et anniversaires",
    description: "Une demande dédiée pour organiser une sortie sur mesure.",
    price: 0,
    season_label: "Sur demande",
    image_url: "",
    gallery_images: [],
    active: true,
  },
];

const emptyEducationActivityForm = {
  id: "",
  name: "",
  description: "",
  price: "",
  season_label: "",
  image_url: "",
  gallery_images: "",
};

const emptyEducationDateForm = {
  id: "",
  activity_id: "",
  activity_date: "",
  label: "",
  capacity: 10,
};

const emptyEducationBookingForm = {
  activityId: DEFAULT_EDUCATION_ACTIVITIES[0].id,
  dateSlotId: "",
  children: [{ firstName: "", age: "" }],
  accompanistName: "",
  phone: "",
  notes: "",
};

const emptyBirthdayBookingForm = {
  desiredDate: "",
  childName: "",
  childAge: "",
  guestCount: "",
  parentName: "",
  phone: "",
  notes: "",
};

const emptyKennelBookingForm = {
  startDate: "",
  endDate: "",
  phone: "",
  dogName: "",
  dogPhotoUrl: "",
  dogBreed: "",
  dogBirthYear: "",
  dogSex: "",
  vaccinesUpToDate: false,
  sterilized: false,
  notes: "",
};

const emptyAdminKennelBookingForm = {
  clientName: "",
  clientEmail: "",
  clientPhone: "",
  clientAddress: "",
  startDate: "",
  endDate: "",
  status: "Confirmée",
  amountConfirmed: "",
  depositAmount: "",
  paymentReceived: false,
  paymentMethod: "Non renseigné",
  dogName: "",
  dogPhotoUrl: "",
  dogBreed: "",
  dogBirthYear: "",
  dogSex: "",
  vaccinesUpToDate: false,
  sterilized: false,
  notes: "",
};

const emptyKennelBlockedDateForm = {
  blocked_date: "",
  reason: "",
};

const emptyContactForm = {
  fullName: "",
  email: "",
  phone: "",
  subject: "",
  message: "",
};

const emptyAdminReminderForm = {
  title: "",
  dueDate: "",
  profileId: "",
  priority: "Normal",
  notes: "",
};

const emptyAnnouncementForm = {
  title: "",
  message: "",
  sendPush: true,
  sendEmail: true,
};

const emptyHomeNewsForm = {
  id: "",
  title: "",
  text: "",
  image_url: "",
  published_at: "",
  active: true,
};

const DEFAULT_HOME_NEWS_CONTENT = {
  items: [],
};

const DEFAULT_KENNEL_SERVICES = [
  {
    id: "day-care",
    name: "Journée pension",
    description: "Accueil à la journée avec suivi manuel des disponibilités.",
    price: 0,
    unit_label: "jour",
    active: true,
  },
  {
    id: "overnight",
    name: "Nuitée pension",
    description: "Séjour avec nuitée, fiche chien et habitudes à préciser.",
    price: 0,
    unit_label: "nuit",
    active: true,
  },
  {
    id: "long-stay",
    name: "Séjour longue durée",
    description: "Demande personnalisée pour les vacances ou absences prolongées.",
    price: 0,
    unit_label: "séjour",
    active: true,
  },
];

const emptyKennelServiceForm = {
  id: "",
  name: "",
  description: "",
  price: "",
  unit_label: "jour",
};

const DEFAULT_ABOUT_CONTENT = {
  image_url: "/images/marais.jpg",
  gallery_images: "",
  eyebrow: "Les Poulettes du Marais",
  title: "Une ferme familiale au rythme du marais",
  intro:
    "Ici, les journées se construisent autour des animaux, des saisons et du lien avec les familles qui viennent chercher leurs œufs, découvrir la ferme ou confier leur chien le temps d'un séjour.",
  block1_title: "Notre quotidien",
  block1_text:
    "Les Poulettes du Marais réunit trois activités complémentaires : la vente d'œufs frais, la ferme pédagogique et la pension canine. L'idée est simple : proposer un lieu vivant, accueillant et proche des gens, où chaque activité garde une dimension humaine.",
  block2_title: "Ce que vous trouverez ici",
  block2_text:
    "Des œufs frais à commander en ligne pour les clients fidèles.\nDes ateliers et visites pour découvrir les animaux et les gestes de la ferme.\nUne pension canine avec suivi des disponibilités et fiche chien complète.",
  block3_title: "Notre esprit",
  block3_text:
    "Nous avançons avec le souci du bien-être animal, du contact simple et de l'organisation claire. Cette application sert justement à rendre les commandes et réservations plus faciles, tout en gardant un fonctionnement chaleureux.",
};

const DEFAULT_KENNEL_CONTENT = {
  image_url: "/images/pension-canine-1.jpg",
  gallery_images: "",
};

const DEFAULT_HOME_FEATURED_EVENT = {
  enabled: true,
  eyebrow: "Événement à l'honneur",
  title: "Canicross aux Poulettes du Marais",
  text:
    "Retour sur une belle matinée sportive et conviviale autour des chiens, des coureurs et de la ferme.",
  image_url: "/images/pension-canine-1.jpg",
  event_date: "",
  event_details:
    "Le canicross des Poulettes du Marais est un rendez-vous convivial autour des chiens et de leurs humains. Vous pouvez retrouver ici les informations pratiques, les photos et les prochaines dates.",
  gallery_images: "",
  cta_label: "Voir l'événement",
  cta_screen: "event",
};

const reservationStatusOptions = ["Demandée", "Confirmée", "Terminée", "Annulée"];
const paymentMethodOptions = ["Non renseigné", "Espèces", "Carte bancaire", "Chèque", "Virement", "PayPal", "Autre"];

const DEFAULT_CUSTOM_PHOTO_LIBRARY = {
  images: "",
};

const AUTOMATIC_DELIVERY_WEEKDAYS = new Set([1, 2, 4, 5]);
const AUTOMATIC_DELIVERY_DAYS_AHEAD = 70;
const KENNEL_MAX_BOOKINGS_PER_NIGHT = 4;
const DEFAULT_APP_SETTINGS = {
  farm_name: "Les Poulettes du Marais",
  contact_email: "",
  contact_phone: "",
  site_url: publicSiteUrl,
  google_review_url: GOOGLE_REVIEW_WRITE_URL,
  google_maps_url: GOOGLE_REVIEW_URL,
  kennel_capacity_note: `${KENNEL_MAX_BOOKINGS_PER_NIGHT} chiens par nuit`,
  admin_note: "",
};
const MESSAGE_TEMPLATES = [
  {
    category: "Commandes",
    title: "Commande prête",
    body: "Bonjour,\n\nVotre commande est prête. Vous pouvez venir la récupérer au créneau prévu.\n\nMerci et à bientôt,\nLes Poulettes du Marais",
  },
  {
    category: "Commandes",
    title: "Commande confirmée",
    body: "Bonjour,\n\nVotre commande est bien prise en compte. Nous vous préviendrons dès qu'elle sera prête.\n\nMerci,\nLes Poulettes du Marais",
  },
  {
    category: "Ferme pédagogique",
    title: "Réservation ferme confirmée",
    body: "Bonjour,\n\nVotre demande de réservation pour la ferme pédagogique est confirmée.\n\nMerci de nous prévenir en cas d'empêchement.\n\nÀ bientôt,\nLes Poulettes du Marais",
  },
  {
    category: "Ferme pédagogique",
    title: "Demande d'informations complémentaires",
    body: "Bonjour,\n\nMerci pour votre demande. Pouvez-vous nous préciser le nombre de participants, l'âge des enfants et le créneau souhaité ?\n\nMerci,\nLes Poulettes du Marais",
  },
  {
    category: "Pension canine",
    title: "Pension confirmée",
    body: "Bonjour,\n\nLa demande de pension pour votre chien est confirmée sous réserve de la pré-visite et des vaccins à jour.\n\nNous restons disponibles pour préparer son séjour.\n\nLes Poulettes du Marais",
  },
  {
    category: "Pension canine",
    title: "Pension complète",
    body: "Bonjour,\n\nNous sommes désolés, la pension canine est complète sur la période demandée.\n\nNous pouvons regarder ensemble une autre période si vous le souhaitez.\n\nLes Poulettes du Marais",
  },
  {
    category: "Pension canine",
    title: "Rappel pré-visite",
    body: "Bonjour,\n\nPetit rappel : une pré-visite est à prévoir avant le séjour de votre chien afin de valider son accueil à la pension.\n\nMerci,\nLes Poulettes du Marais",
  },
  {
    category: "Relance",
    title: "Relance douce",
    body: "Bonjour,\n\nJe reviens vers vous concernant votre demande. Souhaitez-vous toujours maintenir la réservation ?\n\nMerci,\nLes Poulettes du Marais",
  },
];

function getLocalIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getCalendarGridDates(monthValue) {
  const [year, month] = String(monthValue || getLocalIsoDate().slice(0, 7)).split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const start = new Date(firstDay);
  const firstWeekDay = (firstDay.getDay() + 6) % 7;

  start.setDate(firstDay.getDate() - firstWeekDay);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    return {
      date: getLocalIsoDate(date),
      dayNumber: date.getDate(),
      inMonth: date >= firstDay && date <= lastDay,
    };
  });
}

function getMonthLabel(monthValue) {
  const [year, month] = String(monthValue || getLocalIsoDate().slice(0, 7)).split("-").map(Number);

  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function shiftMonth(monthValue, delta) {
  const [year, month] = String(monthValue || getLocalIsoDate().slice(0, 7)).split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);

  return getLocalIsoDate(date).slice(0, 7);
}

function getKennelNights(startDate, endDate) {
  const nights = [];
  const current = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  while (current < end) {
    nights.push(getLocalIsoDate(current));
    current.setDate(current.getDate() + 1);
  }

  return nights;
}

function getAutomaticDeliverySlots() {
  const today = new Date();
  const slots = [];

  for (let offset = 0; offset <= AUTOMATIC_DELIVERY_DAYS_AHEAD; offset += 1) {
    const date = new Date(today);

    date.setDate(today.getDate() + offset);

    if (AUTOMATIC_DELIVERY_WEEKDAYS.has(date.getDay())) {
      const deliveryDate = getLocalIsoDate(date);

      slots.push({
        id: `auto-${deliveryDate}`,
        delivery_date: deliveryDate,
        label: "Livraison habituelle",
        max_orders: null,
        active: true,
        automatic: true,
      });
    }
  }

  return slots;
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replaceAll("-", "+").replaceAll("_", "/");
  const rawData = window.atob(base64);

  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function parseGalleryImages(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeImageUrl).filter(Boolean);
  }

  return String(value || "")
    .split(/[\n,]+/)
    .map(normalizeImageUrl)
    .filter(Boolean);
}

function appendImageToGallery(value, imageUrl) {
  const images = parseGalleryImages(value);
  const normalizedImageUrl = normalizeImageUrl(imageUrl);

  if (!normalizedImageUrl || images.includes(normalizedImageUrl)) {
    return images.join("\n");
  }

  return [...images, normalizedImageUrl].join("\n");
}

function getImageOptionLabel(imageUrl) {
  return String(imageUrl || "").split("/").pop()?.replace(/\.(jpe?g|png|webp|gif|avif)$/i, "") || "Photo";
}

function PhotoQuickPicker({ onPick, label = "Choisir une photo existante", imageOptions = AVAILABLE_IMAGE_OPTIONS }) {
  return (
    <details className="photo-quick-picker">
      <summary>{label}</summary>
      <div className="photo-quick-picker__grid">
        {imageOptions.map((imageUrl) => (
          <button key={imageUrl} type="button" onClick={() => onPick(imageUrl)}>
            <img src={imageUrl} alt={getImageOptionLabel(imageUrl)} loading="lazy" />
            <span>{getImageOptionLabel(imageUrl)}</span>
          </button>
        ))}
      </div>
    </details>
  );
}

function normalizeImageUrl(value) {
  const rawValue = String(value || "").trim();

  if (!rawValue) {
    return "";
  }

  const normalizedValue = rawValue.replaceAll("\\", "/");
  const lowerValue = normalizedValue.toLowerCase();

  if (
    lowerValue.startsWith("http://") ||
    lowerValue.startsWith("https://") ||
    lowerValue.startsWith("data:") ||
    lowerValue.startsWith("blob:")
  ) {
    return rawValue;
  }

  if (normalizedValue.startsWith("/")) {
    return encodeURI(normalizedValue);
  }

  if (lowerValue.startsWith("public/images/")) {
    return encodeURI(`/${normalizedValue.slice("public/".length)}`);
  }

  if (lowerValue.startsWith("images/")) {
    return encodeURI(`/${normalizedValue}`);
  }

  if (/^[a-z]:\/.+/i.test(normalizedValue)) {
    const filename = normalizedValue.split("/").pop();

    return filename ? encodeURI(`/images/${filename}`) : "";
  }

  if (/\.(avif|gif|jpe?g|png|webp)$/i.test(normalizedValue)) {
    return encodeURI(`/images/${normalizedValue}`);
  }

  return encodeURI(normalizedValue);
}

function DogAvatar({ dog, size = "medium" }) {
  const imageUrl = normalizeImageUrl(dog?.photo_url);
  const name = dog?.name || "Chien";

  return (
    <div className={`dog-avatar dog-avatar--${size}`}>
      {imageUrl ? (
        <img src={imageUrl} alt={`Photo de ${name}`} loading="lazy" />
      ) : (
        <Dog size={size === "large" ? 34 : 22} />
      )}
    </div>
  );
}

function wasUpdateNoticeRecentlyDismissed() {
  if (!canUseBrowser) {
    return false;
  }

  const dismissedAt = Number(localStorage.getItem(updateNoticeDismissedKey) || 0);

  return dismissedAt > 0 && Date.now() - dismissedAt < updateNoticeDismissMs;
}

function normalizeOrderStatus(status) {
  const legacyStatuses = {
    "Récupérée": "Livrée",
  };

  return legacyStatuses[status] || status;
}

function getOrderStatusStep(status) {
  const normalizedStatus = normalizeOrderStatus(status || "À préparer");

  if (normalizedStatus === "Livrée") {
    return 3;
  }

  if (normalizedStatus === "Prête") {
    return 2;
  }

  if (normalizedStatus === "Annulée") {
    return 0;
  }

  return 1;
}

export default function EggSalesPWA() {
  const toastIdRef = useRef(0);
  const confirmDialogResolveRef = useRef(null);
  const isEggSummaryPage =
    isEggSummarySubdomain ||
    (canUseBrowser && window.location.pathname.replace(/\/+$/, "") === "/admin-commandes-oeufs");
  const [screen, setScreen] = useState("home");
  const [activeTutorialId, setActiveTutorialId] = useState("eggs");
  const [isLogged, setIsLogged] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canOrderEggs, setCanOrderEggs] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [passwordResetEmailSent, setPasswordResetEmailSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [products, setProducts] = useState(DEFAULT_PRODUCTS);
  const [cart, setCart] = useState({});
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [orderComment, setOrderComment] = useState("");
  const [orders, setOrders] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [customerProfiles, setCustomerProfiles] = useState([]);
  const [clientPushSubscriptions, setClientPushSubscriptions] = useState([]);
  const [adminPushSubscriptions, setAdminPushSubscriptions] = useState([]);
  const [trafficEvents, setTrafficEvents] = useState([]);
  const [stockEggs, setStockEggs] = useState(0);
  const [stockInput, setStockInput] = useState(0);
  const [adminFilter, setAdminFilter] = useState("En cours");
  const [adminOrderShortcut, setAdminOrderShortcut] = useState("all");
  const [adminArchiveView, setAdminArchiveView] = useState("active");
  const [adminSearch, setAdminSearch] = useState("");
  const [adminGlobalSearch, setAdminGlobalSearch] = useState("");
  const [adminSort, setAdminSort] = useState("date-asc");
  const [clientSearch, setClientSearch] = useState("");
  const [clientAccessFilter, setClientAccessFilter] = useState("all");
  const [clientQuickFilter, setClientQuickFilter] = useState("all");
  const [clientSort, setClientSort] = useState("created-desc");
  const [selectedClientProfileId, setSelectedClientProfileId] = useState("");
  const [adminView, setAdminView] = useState("overview");
  const [educationReservationFilter, setEducationReservationFilter] = useState("pending");
  const [kennelReservationFilter, setKennelReservationFilter] = useState("pending");
  const [accountingStartDate, setAccountingStartDate] = useState("");
  const [accountingEndDate, setAccountingEndDate] = useState("");
  const [accountingActivity, setAccountingActivity] = useState("all");
  const [aboutContent, setAboutContent] = useState(DEFAULT_ABOUT_CONTENT);
  const [aboutForm, setAboutForm] = useState(DEFAULT_ABOUT_CONTENT);
  const [folderImageOptions, setFolderImageOptions] = useState(AVAILABLE_IMAGE_OPTIONS);
  const [customPhotoLibrary, setCustomPhotoLibrary] = useState(DEFAULT_CUSTOM_PHOTO_LIBRARY);
  const [customPhotoLibraryForm, setCustomPhotoLibraryForm] = useState(DEFAULT_CUSTOM_PHOTO_LIBRARY);
  const [customPhotoInput, setCustomPhotoInput] = useState("");
  const [mediaSearch, setMediaSearch] = useState("");
  const [homeNewsContent, setHomeNewsContent] = useState(DEFAULT_HOME_NEWS_CONTENT);
  const [homeNewsForm, setHomeNewsForm] = useState(emptyHomeNewsForm);
  const [activeHomeNewsIndex, setActiveHomeNewsIndex] = useState(0);
  const [homeFeaturedEvent, setHomeFeaturedEvent] = useState(DEFAULT_HOME_FEATURED_EVENT);
  const [homeFeaturedEventForm, setHomeFeaturedEventForm] = useState(DEFAULT_HOME_FEATURED_EVENT);
  const [kennelContent, setKennelContent] = useState(DEFAULT_KENNEL_CONTENT);
  const [kennelContentForm, setKennelContentForm] = useState(DEFAULT_KENNEL_CONTENT);
  const [appSettings, setAppSettings] = useState(DEFAULT_APP_SETTINGS);
  const [appSettingsForm, setAppSettingsForm] = useState(DEFAULT_APP_SETTINGS);
  const [eggSummaryReady, setEggSummaryReady] = useState(!isEggSummaryPage);
  const [routeDate, setRouteDate] = useState("");
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [deliverySlots, setDeliverySlots] = useState([]);
  const [deliverySlotForm, setDeliverySlotForm] = useState(emptyDeliverySlotForm);
  const [educationActivities, setEducationActivities] = useState(DEFAULT_EDUCATION_ACTIVITIES);
  const [educationActivityForm, setEducationActivityForm] = useState(emptyEducationActivityForm);
  const [selectedEducationDetailId, setSelectedEducationDetailId] = useState(DEFAULT_EDUCATION_ACTIVITIES[0].id);
  const [educationDateSlots, setEducationDateSlots] = useState([]);
  const [educationDateForm, setEducationDateForm] = useState(emptyEducationDateForm);
  const [educationBookings, setEducationBookings] = useState([]);
  const [educationBookingForm, setEducationBookingForm] = useState(emptyEducationBookingForm);
  const [birthdayBookingForm, setBirthdayBookingForm] = useState(emptyBirthdayBookingForm);
  const [kennelServices, setKennelServices] = useState(DEFAULT_KENNEL_SERVICES);
  const [kennelServiceForm, setKennelServiceForm] = useState(emptyKennelServiceForm);
  const [kennelBookings, setKennelBookings] = useState([]);
  const [kennelAvailability, setKennelAvailability] = useState([]);
  const [educationCalendarMonth, setEducationCalendarMonth] = useState(getLocalIsoDate().slice(0, 7));
  const [clientKennelCalendarMonth, setClientKennelCalendarMonth] = useState(getLocalIsoDate().slice(0, 7));
  const [kennelCalendarMonth, setKennelCalendarMonth] = useState(getLocalIsoDate().slice(0, 7));
  const [kennelBookingForm, setKennelBookingForm] = useState(emptyKennelBookingForm);
  const [adminKennelBookingForm, setAdminKennelBookingForm] = useState(emptyAdminKennelBookingForm);
  const [kennelBlockedDates, setKennelBlockedDates] = useState([]);
  const [kennelBlockedDateForm, setKennelBlockedDateForm] = useState(emptyKennelBlockedDateForm);
  const [contactMessages, setContactMessages] = useState([]);
  const [contactMessageArchiveView, setContactMessageArchiveView] = useState("active");
  const [contactForm, setContactForm] = useState(emptyContactForm);
  const [adminReminders, setAdminReminders] = useState([]);
  const [adminReminderForm, setAdminReminderForm] = useState(emptyAdminReminderForm);
  const [adminActionLogs, setAdminActionLogs] = useState([]);
  const [announcementForm, setAnnouncementForm] = useState(emptyAnnouncementForm);
  const [announcementHistory, setAnnouncementHistory] = useState([]);
  const [announcementSending, setAnnouncementSending] = useState(false);
  const [pushStatus, setPushStatus] = useState("idle");
  const [clientPushStatus, setClientPushStatus] = useState("idle");
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showUpdateNotice, setShowUpdateNotice] = useState(false);
  const [updateServiceWorker, setUpdateServiceWorker] = useState(null);
  const [checkingAppUpdate, setCheckingAppUpdate] = useState(false);
  const [isOnline, setIsOnline] = useState(canUseBrowser ? window.navigator.onLine : true);
  const [toastMessage, setToastMessage] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(
    (installWasRequested || isIosDevice) && !isStandaloneDisplay && (!installBannerWasDismissed || installWasRequested)
  );
  const [isIosInstallHelp, setIsIosInstallHelp] = useState(isIosDevice || installWasRequested);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    deliveryAddress: "",
  });
  const [profileForm, setProfileForm] = useState({
    fullName: "",
    phone: "",
    deliveryAddress: "",
  });

  const imageOptions = useMemo(() => {
    const customImages = parseGalleryImages(customPhotoLibrary.images);
    return Array.from(new Set([...folderImageOptions, ...customImages])).sort((a, b) =>
      getImageOptionLabel(a).localeCompare(getImageOptionLabel(b), "fr", { sensitivity: "base" })
    );
  }, [customPhotoLibrary.images, folderImageOptions]);
  const homeNewsItems = useMemo(
    () =>
      (homeNewsContent.items || [])
        .filter((item) => item.active !== false && item.title)
        .sort((a, b) => String(b.published_at || "").localeCompare(String(a.published_at || ""))),
    [homeNewsContent.items]
  );
  const activeHomeNews = homeNewsItems[activeHomeNewsIndex] || homeNewsItems[0] || null;
  const publicFarmName = appSettings.farm_name || DEFAULT_APP_SETTINGS.farm_name;
  const publicContactEmail = appSettings.contact_email || "lespoulettesdumarais@gmail.com";
  const publicContactPhone = appSettings.contact_phone || "06 70 20 38 91";
  const publicGoogleMapsUrl = appSettings.google_maps_url || GOOGLE_REVIEW_URL;
  const publicGoogleReviewUrl = appSettings.google_review_url || GOOGLE_REVIEW_WRITE_URL;
  const publicSiteDisplayUrl = appSettings.site_url || publicSiteUrl || "Site en ligne";
  const activeTutorial = useMemo(
    () => TUTORIAL_GUIDES.find((guide) => guide.id === activeTutorialId) || TUTORIAL_GUIDES[0],
    [activeTutorialId]
  );

  function showToast(message, tone = "info") {
    const normalizedMessage = String(message || "").trim();

    if (!normalizedMessage) {
      return;
    }

    setToastMessage({
      id: toastIdRef.current + 1,
      message: normalizedMessage,
      tone: normalizedMessage.toLowerCase().includes("erreur") || normalizedMessage.toLowerCase().includes("impossible")
        ? "error"
        : tone,
    });
    toastIdRef.current += 1;
  }

  function closeToast() {
    setToastMessage(null);
  }

  function requestConfirm({ title, message, confirmLabel = "Confirmer", cancelLabel = "Annuler", tone = "warning" }) {
    return new Promise((resolve) => {
      confirmDialogResolveRef.current = resolve;
      setConfirmDialog({
        title,
        message,
        confirmLabel,
        cancelLabel,
        tone,
      });
    });
  }

  function closeConfirmDialog(confirmed) {
    if (confirmDialogResolveRef.current) {
      confirmDialogResolveRef.current(confirmed);
    }

    confirmDialogResolveRef.current = null;
    setConfirmDialog(null);
  }

  function openImagePreview(imageUrl, altText) {
    setPreviewImage({
      src: normalizeImageUrl(imageUrl),
      alt: altText || "Photo",
    });
  }

  function openTutorialGuide(event, tutorialId, label) {
    event.preventDefault();
    void trackSiteEvent("click", "home", "Accueil", { action: "tutorial", label });
    setActiveTutorialId(tutorialId);
    setScreen("tutorials");
  }

  function getTrafficSessionId() {
    if (!canUseBrowser) {
      return "server";
    }

    const storageKey = "poulettes-traffic-session-id";
    const existingId = window.sessionStorage.getItem(storageKey);

    if (existingId) {
      return existingId;
    }

    const newId =
      window.crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    window.sessionStorage.setItem(storageKey, newId);
    return newId;
  }

  const trackSiteEvent = useCallback(async (eventType, pageKey, pageLabel, metadata = {}) => {
    if (!canUseBrowser || isEggSummaryPage || isAdmin) {
      return;
    }

    const { error } = await supabase
      .from("site_traffic_events")
      .insert({
        event_type: eventType,
        page_key: pageKey,
        page_label: pageLabel,
        visitor_id: getTrafficSessionId(),
        metadata,
      });

    if (error) {
      console.warn("Suivi trafic indisponible.", error.message);
    }
  }, [isAdmin, isEggSummaryPage]);

  const loadTrafficEvents = useCallback(async () => {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const { data, error } = await supabase
      .from("site_traffic_events")
      .select("*")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      console.warn("Trafic indisponible.", error.message);
      setTrafficEvents([]);
      return;
    }

    setTrafficEvents(data || []);
  }, []);

  useEffect(() => {
    if (!toastMessage) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setToastMessage(null);
    }, toastMessage.tone === "error" ? 6500 : 4200);

    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    if (screen !== "home" || homeNewsItems.length <= 1) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setActiveHomeNewsIndex((current) => (current + 1) % homeNewsItems.length);
    }, 6500);

    return () => window.clearInterval(timer);
  }, [homeNewsItems.length, screen]);

  useEffect(() => {
    if (!canUseBrowser) {
      return undefined;
    }

    const updateOnlineState = () => {
      setIsOnline(window.navigator.onLine);
    };

    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);

    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setForm((currentForm) => ({ ...currentForm, password: "" }));
        setPasswordResetEmailSent(false);
        setScreen("reset-password");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (screen === "admin" || !PUBLIC_SCREEN_LABELS[screen]) {
      return;
    }

    const timer = window.setTimeout(() => {
      void trackSiteEvent("page_view", screen, PUBLIC_SCREEN_LABELS[screen]);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [screen, trackSiteEvent]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadTrafficEvents();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isAdmin, loadTrafficEvents]);

  const total = useMemo(() => {
    return products.reduce((sum, p) => sum + (cart[p.id] || 0) * p.price, 0);
  }, [cart, products]);

  const totalEggs = useMemo(() => {
    return products.reduce((sum, p) => {
      if (!isEggProduct(p)) {
        return sum;
      }

      return sum + (cart[p.id] || 0) * (p.size_eggs || 0);
    }, 0);
  }, [cart, products]);

  const selectedCartItems = useMemo(() => {
    return products
      .map((product) => ({
        ...product,
        quantity: cart[product.id] || 0,
      }))
      .filter((product) => product.quantity > 0);
  }, [cart, products]);

  const hasSelectedEggProducts = selectedCartItems.some(
    (product) => isEggProduct(product) && product.size_eggs > 0
  );

  const availableDeliverySlots = useMemo(() => {
    const today = getLocalIsoDate();
    const slotsByDate = new Map(
      getAutomaticDeliverySlots().map((slot) => [slot.delivery_date, slot])
    );

    deliverySlots.forEach((slot) => {
      slotsByDate.set(slot.delivery_date, {
        ...slot,
        automatic: false,
      });
    });

    return Array.from(slotsByDate.values())
      .filter((slot) => slot.active !== false && String(slot.delivery_date || "") >= today)
      .sort((a, b) => String(a.delivery_date || "").localeCompare(String(b.delivery_date || "")));
  }, [deliverySlots]);

  function updateQty(id, delta) {
    setCart((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) + delta),
    }));
  }

  const loadProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      console.warn("Produits Supabase indisponibles, produits par defaut utilises.", error.message);
      setProducts(DEFAULT_PRODUCTS);
      return;
    }

    if (!data || data.length === 0) {
      setProducts(DEFAULT_PRODUCTS);
      return;
    }

    setProducts(
      data.map((product) => ({
        id: product.id,
        name: product.name,
        price: Number(product.price || 0),
        image: product.image_url || "",
        unit_label: product.unit_label || "piece",
        size_eggs: Number(product.size_eggs || 0),
        active: product.active !== false,
      }))
    );
  }, []);

  const loadFolderImages = useCallback(async () => {
    if (!canUseBrowser) {
      return;
    }

    try {
      const response = await fetch(`/images-manifest.json?t=${Date.now()}`, { cache: "no-store" });

      if (!response.ok) {
        return;
      }

      const manifest = await response.json();
      const images = Array.isArray(manifest?.images)
        ? manifest.images.map((imageUrl) => normalizeImageUrl(imageUrl)).filter(Boolean)
        : [];

      if (images.length > 0) {
        setFolderImageOptions(Array.from(new Set([...AVAILABLE_IMAGE_OPTIONS, ...images])));
      }
    } catch (error) {
      console.warn("Liste des images locales indisponible.", error);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadFolderImages();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadFolderImages]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProducts();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadProducts]);

  const loadDeliverySlots = useCallback(async () => {
    const { data, error } = await supabase
      .from("delivery_slots")
      .select("*")
      .order("delivery_date", { ascending: true });

    if (error) {
      console.warn("Créneaux de livraison indisponibles.", error.message);
      setDeliverySlots([]);
      return;
    }

    setDeliverySlots(data || []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDeliverySlots();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadDeliverySlots]);

  const loadAboutContent = useCallback(async () => {
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "about_page")
      .maybeSingle();

    if (error) {
      console.warn("Présentation de la ferme indisponible.", error.message);
      setAboutContent(DEFAULT_ABOUT_CONTENT);
      setAboutForm(DEFAULT_ABOUT_CONTENT);
      return;
    }

    const content = {
      ...DEFAULT_ABOUT_CONTENT,
      ...(data?.value || {}),
    };

    setAboutContent(content);
    setAboutForm(content);
  }, []);

  const loadCustomPhotoLibrary = useCallback(async () => {
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "custom_photo_library")
      .maybeSingle();

    if (error) {
      console.warn("Bibliothèque photos indisponible.", error.message);
      setCustomPhotoLibrary(DEFAULT_CUSTOM_PHOTO_LIBRARY);
      setCustomPhotoLibraryForm(DEFAULT_CUSTOM_PHOTO_LIBRARY);
      return;
    }

    const content = {
      ...DEFAULT_CUSTOM_PHOTO_LIBRARY,
      ...(data?.value || {}),
    };

    const normalizedContent = {
      ...content,
      images: parseGalleryImages(content.images).join("\n"),
    };

    setCustomPhotoLibrary(normalizedContent);
    setCustomPhotoLibraryForm(normalizedContent);
  }, []);

  const loadKennelContent = useCallback(async () => {
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "kennel_page")
      .maybeSingle();

    if (error) {
      console.warn("Photos de la pension indisponibles.", error.message);
      setKennelContent(DEFAULT_KENNEL_CONTENT);
      setKennelContentForm(DEFAULT_KENNEL_CONTENT);
      return;
    }

    const content = {
      ...DEFAULT_KENNEL_CONTENT,
      ...(data?.value || {}),
    };

    const normalizedContent = {
      ...content,
      image_url: normalizeImageUrl(content.image_url),
      gallery_images: parseGalleryImages(content.gallery_images).join("\n"),
    };

    setKennelContent(normalizedContent);
    setKennelContentForm(normalizedContent);
  }, []);

  const loadHomeFeaturedEvent = useCallback(async () => {
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "home_featured_event")
      .maybeSingle();

    if (error) {
      console.warn("Evenement d'accueil indisponible.", error.message);
      setHomeFeaturedEvent(DEFAULT_HOME_FEATURED_EVENT);
      setHomeFeaturedEventForm(DEFAULT_HOME_FEATURED_EVENT);
      return;
    }

    const content = {
      ...DEFAULT_HOME_FEATURED_EVENT,
      ...(data?.value || {}),
    };

    const normalizedContent = {
      ...content,
      image_url: normalizeImageUrl(content.image_url),
      gallery_images: parseGalleryImages(content.gallery_images).join("\n"),
    };

    setHomeFeaturedEvent(normalizedContent);
    setHomeFeaturedEventForm(normalizedContent);
  }, []);

  const loadHomeNews = useCallback(async () => {
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "home_news")
      .maybeSingle();

    if (error) {
      console.warn("Actualités d'accueil indisponibles.", error.message);
      setHomeNewsContent(DEFAULT_HOME_NEWS_CONTENT);
      return;
    }

    const content = {
      ...DEFAULT_HOME_NEWS_CONTENT,
      ...(data?.value || {}),
    };

    const normalizedItems = Array.isArray(content.items)
      ? content.items.map((item) => ({
          id: item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title: item.title || "",
          text: item.text || "",
          image_url: normalizeImageUrl(item.image_url),
          published_at: item.published_at || "",
          active: item.active !== false,
        }))
      : [];

    setHomeNewsContent({ items: normalizedItems });
  }, []);

  const loadAppSettings = useCallback(async () => {
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "app_settings")
      .maybeSingle();

    if (error) {
      console.warn("Réglages admin indisponibles.", error.message);
      setAppSettings(DEFAULT_APP_SETTINGS);
      setAppSettingsForm(DEFAULT_APP_SETTINGS);
      return;
    }

    const settings = {
      ...DEFAULT_APP_SETTINGS,
      ...(data?.value || {}),
    };

    setAppSettings(settings);
    setAppSettingsForm(settings);
  }, []);

  useEffect(() => {
    if (!canUseBrowser || !("serviceWorker" in navigator)) {
      return;
    }

    const pendingUpdateTimer = window.setTimeout(() => {
      if (window.__poulettesUpdateServiceWorker && !wasUpdateNoticeRecentlyDismissed()) {
        setUpdateServiceWorker(() => window.__poulettesUpdateServiceWorker);
        setShowUpdateNotice(true);
      }
    }, 0);

    const showNotice = (event) => {
      if (wasUpdateNoticeRecentlyDismissed()) {
        return;
      }

      setUpdateServiceWorker(() => event.detail?.updateServiceWorker || null);
      setShowUpdateNotice(true);
    };

    window.addEventListener("pwa-update-available", showNotice);

    return () => {
      window.clearTimeout(pendingUpdateTimer);
      window.removeEventListener("pwa-update-available", showNotice);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAboutContent();
      void loadCustomPhotoLibrary();
      void loadHomeFeaturedEvent();
      void loadHomeNews();
      void loadKennelContent();
      void loadAppSettings();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadAboutContent, loadAppSettings, loadCustomPhotoLibrary, loadHomeFeaturedEvent, loadHomeNews, loadKennelContent]);

  const loadEducationActivities = useCallback(async () => {
    const { data, error } = await supabase
      .from("education_activities")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      console.warn("Activités pédagogiques Supabase indisponibles.", error.message);
      setEducationActivities(DEFAULT_EDUCATION_ACTIVITIES);
      return;
    }

    if (!data || data.length === 0) {
      setEducationActivities(DEFAULT_EDUCATION_ACTIVITIES);
      return;
    }

    setEducationActivities(
      data.map((activity) => ({
        id: activity.id,
        name: activity.name,
        description: activity.description || "",
        price: Number(activity.price || 0),
        season_label: activity.season_label || "",
        image_url: normalizeImageUrl(activity.image_url),
        gallery_images: parseGalleryImages(activity.gallery_images),
        active: activity.active !== false,
      }))
    );
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadEducationActivities();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadEducationActivities]);

  const loadEducationDateSlots = useCallback(async () => {
    const { data, error } = await supabase
      .from("education_activity_dates")
      .select("*")
      .order("activity_date", { ascending: true });

    if (error) {
      console.warn("Dates pédagogiques indisponibles.", error.message);
      setEducationDateSlots([]);
      return;
    }

    setEducationDateSlots(data || []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadEducationDateSlots();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadEducationDateSlots]);

  const loadKennelServices = useCallback(async () => {
    const { data, error } = await supabase
      .from("kennel_services")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      console.warn("Tarifs pension canine Supabase indisponibles.", error.message);
      setKennelServices(DEFAULT_KENNEL_SERVICES);
      return;
    }

    if (!data || data.length === 0) {
      setKennelServices(DEFAULT_KENNEL_SERVICES);
      return;
    }

    setKennelServices(
      data.map((service) => ({
        id: service.id,
        name: service.name,
        description: service.description || "",
        price: Number(service.price || 0),
        unit_label: service.unit_label || "jour",
        active: service.active !== false,
      }))
    );
  }, []);

  useEffect(() => {
  const timer = window.setTimeout(() => {
      void loadKennelServices();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadKennelServices]);

  const loadKennelBlockedDates = useCallback(async () => {
    const { data, error } = await supabase
      .from("kennel_blocked_dates")
      .select("*")
      .order("blocked_date", { ascending: true });

    if (error) {
      console.warn("Dates fermées pension indisponibles.", error.message);
      setKennelBlockedDates([]);
      return;
    }

    setKennelBlockedDates(data || []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadKennelBlockedDates();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadKennelBlockedDates]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!isAdmin || !("Notification" in window) || Notification.permission !== "granted") {
        setPushStatus("idle");
        return;
      }

      setPushStatus("enabled");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isAdmin]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (
        deliveryDate &&
        deliverySlots.length > 0 &&
        !availableDeliverySlots.some((slot) => slot.delivery_date === deliveryDate)
      ) {
        setDeliveryDate("");
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [availableDeliverySlots, deliveryDate, deliverySlots.length]);

  async function register(e) {
    e.preventDefault();

    const cleanFullName = form.fullName.trim();
    const cleanEmail = form.email.trim();
    const cleanPhone = form.phone.trim();
    const cleanDeliveryAddress = form.deliveryAddress.trim();

    if (!cleanFullName || !cleanEmail || form.password.length < 6 || !cleanPhone || !cleanDeliveryAddress) {
      showToast("Merci de remplir le nom, l'email, le téléphone, l'adresse de livraison et un mot de passe de 6 caractères minimum.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: form.password,
      options: {
        data: {
          full_name: cleanFullName,
          phone: cleanPhone,
          delivery_address: cleanDeliveryAddress,
        },
      },
    });

    if (error) {
      showToast("Erreur création compte : " + error.message);
      return;
    }

    if (!data.user) {
      showToast("Compte créé. Vérifie ton email si Supabase demande une confirmation.");
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: data.user.id,
        full_name: cleanFullName,
        email: data.user.email || cleanEmail,
        phone: cleanPhone,
        delivery_address: cleanDeliveryAddress,
        is_admin: false,
        can_order_eggs: false,
      }, { onConflict: "id" });

    if (profileError) {
      console.warn("Profil client non créé immédiatement.", profileError.message);
    }

    setCurrentUser(null);
setName("");
setIsLogged(false);
setIsAdmin(false);
setCanOrderEggs(false);
setScreen("login");

showToast("Compte créé avec succès ! Connecte-toi maintenant pour passer commande.");
  }

  async function loginAsClient(e) {
    e.preventDefault();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });

    if (error) {
      showToast("Erreur connexion : " + error.message);
      return;
    }

    const user = data.user;

    let { data: profiles, error: profileError } = await supabase
  .from("profiles")
  .select("*")
  .eq("id", user.id)
  .limit(1);

if (profileError) {
  showToast("Erreur récupération profil : " + profileError.message);
  return;
}

if (!profiles || profiles.length === 0) {
    const profileToCreate = {
    id: user.id,
    full_name: form.fullName || user.email,
    email: user.email,
    phone: form.phone.trim() || user.user_metadata?.phone || "",
    delivery_address: form.deliveryAddress.trim() || user.user_metadata?.delivery_address || "",
    is_admin: false,
    can_order_eggs: false,
  };

  const { error: insertProfileError } = await supabase
    .from("profiles")
    .insert(profileToCreate);

  if (insertProfileError) {
    const insertProfileMessage = String(insertProfileError.message || "");
    const missingOptionalProfileColumn =
      insertProfileMessage.includes("delivery_address") ||
      insertProfileMessage.includes("phone") ||
      insertProfileMessage.includes("can_order_eggs");

    if (!missingOptionalProfileColumn) {
      showToast("Erreur création profil : " + insertProfileError.message);
      return;
    }

    const { error: fallbackProfileError } = await supabase
      .from("profiles")
      .insert({
        id: profileToCreate.id,
        full_name: profileToCreate.full_name,
        email: profileToCreate.email,
        is_admin: profileToCreate.is_admin,
      });

    if (fallbackProfileError) {
      showToast("Erreur création profil : " + fallbackProfileError.message);
      return;
    }
  }

  const { data: newProfiles, error: reloadProfileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .limit(1);

  if (reloadProfileError || !newProfiles || newProfiles.length === 0) {
    showToast("Impossible de récupérer le profil après création.");
    return;
  }

  profiles = newProfiles;
}

const profile = profiles[0];
const savedDeliveryAddress = profile.delivery_address || user.user_metadata?.delivery_address || "";
const savedPhone = profile.phone || user.user_metadata?.phone || "";
const missingProfileContact =
  (!profile.phone && savedPhone) ||
  (!profile.delivery_address && savedDeliveryAddress);

if (missingProfileContact) {
  const { error: syncProfileError } = await supabase
    .from("profiles")
    .update({
      phone: savedPhone,
      delivery_address: savedDeliveryAddress,
    })
    .eq("id", user.id);

  if (!syncProfileError) {
    profile.phone = savedPhone;
    profile.delivery_address = savedDeliveryAddress;
  }
}

    setCurrentUser(user);
    setName(profile.full_name || form.email);
    setDeliveryAddress(savedDeliveryAddress);
    setCanOrderEggs(profile.is_admin === true || profile.can_order_eggs === true);
    setProfileForm({
      fullName: profile.full_name || "",
      phone: savedPhone,
      deliveryAddress: savedDeliveryAddress,
    });
    setIsLogged(true);

    if (profile.is_admin) {
      setIsAdmin(true);
      await loadOrders();
      await loadCustomerProfiles();
      await loadClientPushSubscriptions();
      await loadAdminPushSubscriptions();
      await loadDeliverySlots();
      await loadEducationDateSlots();
      await loadEducationBookings();
      await loadKennelBookings();
      await loadKennelBlockedDates();
      await loadContactMessages();
      await loadAdminReminders();
      await loadAdminActionLogs();
      await loadAnnouncementHistory();
      await loadAppSettings();
      await loadTrafficEvents();
      setScreen("admin");
    } else {
      setIsAdmin(false);
      await loadMyOrders(user.id);
      setScreen("shop");
      await loadStock();
    }

    showToast("Connexion réussie !");
  }

  async function requestPasswordReset(e) {
    e.preventDefault();

    const cleanEmail = form.email.trim();

    if (!cleanEmail) {
      showToast("Renseigne ton email pour recevoir le lien de réinitialisation.");
      return;
    }

    const currentOrigin = canUseBrowser ? window.location.origin : "";
    const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(currentOrigin);
    const redirectBaseUrl = publicSiteUrl || (!isLocalOrigin ? currentOrigin : "");

    if (!redirectBaseUrl) {
      showToast("Impossible d'envoyer le lien depuis l'adresse locale. Configure VITE_PUBLIC_SITE_URL avec l'adresse du site en ligne.");
      return;
    }

    const redirectTo = `${redirectBaseUrl}${canUseBrowser ? window.location.pathname : "/"}`;

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo,
    });

    if (error) {
      showToast("Impossible d'envoyer l'email : " + error.message);
      return;
    }

    setPasswordResetEmailSent(true);
    showToast("Email envoyé. Regarde ta boîte mail pour créer un nouveau mot de passe.");
  }

  async function updateForgottenPassword(e) {
    e.preventDefault();

    if (form.password.length < 6) {
      showToast("Choisis un mot de passe de 6 caractères minimum.");
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: form.password,
    });

    if (error) {
      showToast("Impossible de modifier le mot de passe : " + error.message);
      return;
    }

    await supabase.auth.signOut();
    setForm({ ...form, password: "" });
    setCurrentUser(null);
    setIsLogged(false);
    setIsAdmin(false);
    setScreen("login");
    showToast("Mot de passe modifié. Vous pouvez maintenant vous connecter.");
  }

  async function openAdmin() {
    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      showToast("Tu dois d'abord te connecter avec ton compte admin.");
      setScreen("login");
      return;
    }

    const user = sessionData.session.user;

    const { data: profiles, error } = await supabase
  .from("profiles")
  .select("*")
  .eq("id", user.id)
  .limit(1);

if (error) {
  showToast("Erreur profil admin : " + error.message);
  return;
}

if (!profiles || profiles.length === 0) {
  showToast("Profil admin introuvable.");
  return;
}

const profile = profiles[0];

    if (error) {
      showToast("Erreur profil admin : " + error.message);
      return;
    }

    if (!profile.is_admin) {
      showToast("Accès refusé : ce compte n'est pas administrateur.");
      return;
    }

    setCurrentUser(user);
    setName(profile.full_name || user.email);
    setCanOrderEggs(true);
    setProfileForm({
      fullName: profile.full_name || "",
      phone: profile.phone || user.user_metadata?.phone || "",
      deliveryAddress: profile.delivery_address || user.user_metadata?.delivery_address || "",
    });
    setIsLogged(true);
    setIsAdmin(true);
    await loadOrders();
    await loadCustomerProfiles();
    await loadClientPushSubscriptions();
    await loadAdminPushSubscriptions();
    await loadDeliverySlots();
    await loadEducationDateSlots();
    await loadEducationBookings();
    await loadKennelBookings();
    await loadKennelBlockedDates();
    await loadContactMessages();
    await loadAdminReminders();
    await loadAdminActionLogs();
    await loadAnnouncementHistory();
    await loadTrafficEvents();
    setScreen("admin");
  }

async function placeOrder() {
  if (!isLogged || selectedCartItems.length === 0 || !deliveryDate || !currentUser) {
    showToast("Connecte-toi, choisis des produits et une date.");
    return;
  }

  if (!canOrderEggs && !isAdmin) {
    showToast("La commande d'œufs est réservée aux clients fidèles. Demande l'accès à la ferme.");
    return;
  }

  const selectedDeliverySlot = availableDeliverySlots.find(
    (slot) => slot.delivery_date === deliveryDate && slot.active !== false
  );

  if (!selectedDeliverySlot) {
    showToast("Choisis une date de livraison disponible.");
    return;
  }

  if (Number(selectedDeliverySlot.max_orders || 0) > 0) {
    const { count, error: countError } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("delivery_date", deliveryDate)
      .neq("status", "Annulée");

    if (countError) {
      showToast("Impossible de vérifier le créneau de livraison : " + countError.message);
      return;
    }

    if ((count || 0) >= Number(selectedDeliverySlot.max_orders)) {
      showToast("Ce créneau est complet. Choisis une autre date de livraison.");
      await loadDeliverySlots();
      return;
    }
  }

  const cleanDeliveryAddress = deliveryAddress.trim();

  if (!cleanDeliveryAddress) {
    showToast("Merci d'indiquer l'adresse de livraison.");
    return;
  }

  const eggsNeeded = totalEggs;

  const orderItems = selectedCartItems.map((item) => ({
    product_id: item.id,
    name: item.name,
    quantity: item.quantity,
    unit_label: item.unit_label,
    price: item.price,
    size_eggs: item.size_eggs || 0,
  }));
  const baseOrder = {
    user_id: currentUser.id,
    client_email: currentUser.email,
    client_name: name,
    box6: cart.box6 || 0,
    box12: cart.box12 || 0,
    delivery_date: deliveryDate,
    status: "À préparer",
  };
  const legacyOrder = {
    ...baseOrder,
    delivery_address: cleanDeliveryAddress,
    comment: orderComment.trim(),
  };
  const { data: insertedOrder, error } = await supabase
    .rpc("place_order", {
      p_client_email: currentUser.email,
      p_client_name: name,
      p_box6: cart.box6 || 0,
      p_box12: cart.box12 || 0,
      p_delivery_date: deliveryDate,
      p_delivery_address: cleanDeliveryAddress,
      p_comment: orderComment.trim(),
      p_items: orderItems,
      p_eggs_needed: eggsNeeded,
      p_status: "À préparer",
    })
    .single();

  if (error) {
    const message = String(error.message || "");

    if (message.includes("delivery_slot_full")) {
      showToast("Ce créneau est complet. Choisis une autre date de livraison.");
    } else if (message.includes("delivery_slot_closed") || message.includes("delivery_slot_unavailable")) {
      showToast("Choisis une date de livraison disponible.");
    } else if (message.includes("stock_insufficient")) {
      showToast("Stock insuffisant.");
    } else if (message.includes("stock_not_found")) {
      showToast("Impossible de trouver le stock.");
    } else if (message.includes("egg_order_access_denied")) {
      showToast("La commande d'œufs est réservée aux clients fidèles. Demande l'accès à la ferme.");
    } else {
      showToast("Erreur commande : " + error.message);
    }

    await loadStock();
    await loadDeliverySlots();
    return;
  }

  const { error: profileAddressError } = await supabase
    .from("profiles")
    .update({ delivery_address: cleanDeliveryAddress })
    .eq("id", currentUser.id);

  if (profileAddressError && !String(profileAddressError.message || "").includes("delivery_address")) {
    console.warn("Adresse de livraison non mise à jour dans le profil.", profileAddressError.message);
  }

  setStockEggs(insertedOrder?.stock_remaining ?? stockEggs);
  await loadStock();
  await loadMyOrders(currentUser.id);
  await notifyAdminsAboutOrder({ ...legacyOrder, items: orderItems, id: insertedOrder?.order_id });

  setCart({});
  setDeliveryDate("");
  setOrderComment("");
  setScreen("confirmation");

  showToast("Commande enregistrée !");
}

  async function changeStatus(id, status) {

  const order = orders.find((o) => o.id === id);
  const previousStatus = order?.status;

  if (!order) {
    showToast("Commande introuvable.");
    return;
  }

  // EMAIL SI COMMANDE PRÊTE
  if (status === "Prête") {

    if (!order.email) {
      showToast("Aucun email trouvé pour ce client.");
    } else {

      const { data, error } = await supabase.functions.invoke("send-order-ready-email", {
        body: {
          clientEmail: order.email,
          clientName: order.client,
        },
      });

      console.log("Reponse email :", data);

      if (error) {
        showToast("Erreur email : " + error.message);
      }
    }
  }

  // MAJ STATUT COMMANDE
  const { error } = await supabase.rpc("update_order_status", {
    p_order_id: String(id),
    p_status: status,
  });

  if (error) {
    showToast("Erreur mise à jour statut : " + error.message);
    return;
  }

  await loadStock();
  await logAdminAction({
    actionType: "order_status",
    title: `Commande passée en ${status}`,
    targetType: "Commande",
    targetId: id,
    targetLabel: order.client || order.email || "Commande",
    details: { ancien_statut: previousStatus || "", nouveau_statut: status, date: order.date || "" },
  });

  setOrders((prev) =>
    prev.map((o) =>
      o.id === id ? { ...o, status } : o
    )
  );

  if (status !== previousStatus && (status === "Prête" || status === "Livrée")) {
    await notifyClientAboutStatus(id, status);
  }
}
const loadOrders = useCallback(async () => {
  const { data: ordersData, error: ordersError } = await supabase
    .from("orders")
    .select("*")
    .order("delivery_date", { ascending: true });

  if (ordersError) {
    showToast("Erreur chargement commandes : " + ordersError.message);
    return;
  }

  const formattedOrders = (ordersData || []).map((o) => ({
    id: o.id,
    client: o.client_name || "Client",
    email: o.client_email || "",
    box6: o.box6 || 0,
    box12: o.box12 || 0,
    items: o.items || null,
    address: o.delivery_address || "",
    comment: o.comment || "",
    status: normalizeOrderStatus(o.status),
    date: o.delivery_date,
    archived_at: o.archived_at || null,
  }));

  setOrders(formattedOrders);
}, []);

  useEffect(() => {
    if (!isEggSummaryPage) {
      return;
    }

    let cancelled = false;

    async function restoreEggSummarySession() {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        if (!cancelled) {
          setEggSummaryReady(true);
        }
        return;
      }

      const user = sessionData.session.user;
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .limit(1);

      if (cancelled) {
        return;
      }

      if (error || !profiles || profiles.length === 0 || profiles[0].is_admin !== true) {
        setCurrentUser(user);
        setIsLogged(true);
        setIsAdmin(false);
        setEggSummaryReady(true);
        return;
      }

      const profile = profiles[0];

      setCurrentUser(user);
      setName(profile.full_name || user.email);
      setCanOrderEggs(true);
      setProfileForm({
        fullName: profile.full_name || "",
        phone: profile.phone || user.user_metadata?.phone || "",
        deliveryAddress: profile.delivery_address || user.user_metadata?.delivery_address || "",
      });
      setIsLogged(true);
      setIsAdmin(true);
      await loadOrders();

      if (!cancelled) {
        setEggSummaryReady(true);
      }
    }

    void restoreEggSummarySession();

    return () => {
      cancelled = true;
    };
  }, [isEggSummaryPage, loadOrders]);

  async function loginEggSummaryAdmin(e) {
    e.preventDefault();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });

    if (error) {
      showToast("Erreur connexion : " + error.message);
      return;
    }

    const user = data.user;
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .limit(1);

    if (profileError) {
      showToast("Erreur profil admin : " + profileError.message);
      return;
    }

    if (!profiles || profiles.length === 0 || profiles[0].is_admin !== true) {
      await supabase.auth.signOut();
      setIsLogged(false);
      setIsAdmin(false);
      setCurrentUser(null);
      showToast("Accès refusé : cette page est réservée à l'administrateur.");
      return;
    }

    const profile = profiles[0];

    setCurrentUser(user);
    setName(profile.full_name || user.email);
    setCanOrderEggs(true);
    setProfileForm({
      fullName: profile.full_name || "",
      phone: profile.phone || user.user_metadata?.phone || "",
      deliveryAddress: profile.delivery_address || user.user_metadata?.delivery_address || "",
    });
    setIsLogged(true);
    setIsAdmin(true);
    await loadOrders();
  }

async function loadCustomerProfiles() {
  const { data, error } = await supabase.rpc("list_customer_profiles");

  if (error) {
    console.warn("Liste clients indisponible.", error.message);
    setCustomerProfiles([]);
    return;
  }

  setCustomerProfiles(data || []);
}

async function loadClientPushSubscriptions() {
  const { data, error } = await supabase
    .from("client_push_subscriptions")
    .select("id, user_id, user_agent, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    console.warn("Abonnements notifications clients indisponibles.", error.message);
    setClientPushSubscriptions([]);
    return;
  }

  setClientPushSubscriptions(data || []);
}

async function loadAdminPushSubscriptions() {
  const { data, error } = await supabase
    .from("admin_push_subscriptions")
    .select("id, user_id, user_agent, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    console.warn("Abonnements notifications admin indisponibles.", error.message);
    setAdminPushSubscriptions([]);
    return;
  }

  setAdminPushSubscriptions(data || []);
}

async function loadContactMessages() {
  const { data, error } = await supabase
    .from("contact_messages")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Messages de contact indisponibles.", error.message);
    setContactMessages([]);
    return;
  }

  setContactMessages(data || []);
}

async function loadAdminReminders() {
  const { data, error } = await supabase
    .from("admin_reminders")
    .select("*")
    .order("due_date", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Rappels internes indisponibles.", error.message);
    setAdminReminders([]);
    return;
  }

  setAdminReminders(data || []);
}

async function loadAdminActionLogs() {
  const { data, error } = await supabase
    .from("admin_action_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) {
    console.warn("Journal admin indisponible.", error.message);
    setAdminActionLogs([]);
    return;
  }

  setAdminActionLogs(data || []);
}

async function logAdminAction({ actionType, title, targetType = "", targetId = null, targetLabel = "", details = {} }) {
  if (!isAdmin || !currentUser?.id) {
    return;
  }

  const { error } = await supabase.from("admin_action_logs").insert({
    action_type: actionType,
    title,
    target_type: targetType,
    target_id: targetId ? String(targetId) : null,
    target_label: targetLabel,
    details,
    created_by: currentUser.id,
    created_by_email: currentUser.email || "",
  });

  if (error) {
    console.warn("Action admin non enregistrée.", error.message);
    return;
  }

  await loadAdminActionLogs();
}

async function saveAdminReminder(event) {
  event.preventDefault();

  const cleanTitle = adminReminderForm.title.trim();

  if (!cleanTitle || !adminReminderForm.dueDate) {
    showToast("Renseigne un rappel et une date.");
    return;
  }

  const { error } = await supabase.from("admin_reminders").insert({
    title: cleanTitle,
    due_date: adminReminderForm.dueDate,
    profile_id: adminReminderForm.profileId || null,
    priority: adminReminderForm.priority,
    notes: adminReminderForm.notes.trim(),
    status: "À faire",
    created_by: currentUser?.id || null,
  });

  if (error) {
    showToast("Impossible d'enregistrer le rappel : " + error.message);
    return;
  }

  setAdminReminderForm(emptyAdminReminderForm);
  await loadAdminReminders();
  showToast("Rappel interne ajouté.");
}

async function updateAdminReminder(id, changes) {
  const { error } = await supabase
    .from("admin_reminders")
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    showToast("Impossible de modifier le rappel : " + error.message);
    return;
  }

  await loadAdminReminders();
}

async function submitContactMessage(e) {
  e.preventDefault();

  const cleanName = contactForm.fullName.trim();
  const cleanEmail = contactForm.email.trim();
  const cleanMessage = contactForm.message.trim();

  if (!cleanName || !cleanEmail || !cleanMessage) {
    showToast("Merci de renseigner votre nom, votre email et votre message.");
    return;
  }

  const { error } = await supabase.from("contact_messages").insert({
    user_id: currentUser?.id || null,
    full_name: cleanName,
    email: cleanEmail,
    phone: contactForm.phone.trim(),
    subject: contactForm.subject.trim() || "Demande depuis le site",
    message: cleanMessage,
    status: "Nouveau",
  });

  if (error) {
    showToast("Impossible d'envoyer le message : " + error.message);
    return;
  }

  setContactForm(emptyContactForm);
  showToast("Message envoyé. Nous vous répondrons dès que possible.");
  setScreen("home");
}

async function updateContactMessageStatus(id, status) {
  const isHandled = status === "Traité";
  const updatedAt = new Date().toISOString();
  const { error } = await supabase
    .from("contact_messages")
    .update({
      status,
      archived_at: isHandled ? updatedAt : null,
      updated_at: updatedAt,
    })
    .eq("id", id);

  if (error) {
    showToast("Impossible de mettre à jour le message : " + error.message);
    return;
  }

  const message = contactMessages.find((item) => item.id === id);
  await logAdminAction({
    actionType: "contact_status",
    title: isHandled ? "Message client traité" : `Message client passé en ${status}`,
    targetType: "Message",
    targetId: id,
    targetLabel: message?.full_name || message?.email || "Message client",
    details: { statut: status, sujet: message?.subject || "" },
  });
  await loadContactMessages();
  showToast(isHandled ? "Message traité et archivé." : "Message remis dans les messages actifs.");
}

async function loadAnnouncementHistory() {
  const { data, error } = await supabase
    .from("broadcast_announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.warn("Historique des annonces indisponible.", error.message);
    setAnnouncementHistory([]);
    return;
  }

  setAnnouncementHistory(data || []);
}

async function sendBroadcastAnnouncement(event) {
  event.preventDefault();

  const cleanTitle = announcementForm.title.trim();
  const cleanMessage = announcementForm.message.trim();

  if (!cleanTitle || !cleanMessage) {
    showToast("Renseigne un titre et un message pour l'annonce.");
    return;
  }

  if (!announcementForm.sendPush && !announcementForm.sendEmail) {
    showToast("Choisis au moins un canal : push ou email.");
    return;
  }

  const confirmed = await requestConfirm({
    title: "Envoyer cette annonce ?",
    message: `${cleanTitle}\n\n${cleanMessage}`,
    confirmLabel: "Envoyer l'annonce",
  });

  if (!confirmed) {
    return;
  }

  setAnnouncementSending(true);

  try {
    const { data, error } = await supabase.functions.invoke("send-broadcast-announcement", {
      body: {
        title: cleanTitle,
        message: cleanMessage,
        sendPush: announcementForm.sendPush,
        sendEmail: announcementForm.sendEmail,
      },
    });

    if (error) {
      throw error;
    }

    const { error: historyError } = await supabase.from("broadcast_announcements").insert({
      title: cleanTitle,
      message: cleanMessage,
      send_push: announcementForm.sendPush,
      send_email: announcementForm.sendEmail,
      push_sent: data?.push?.sent ?? 0,
      push_total: data?.push?.total ?? 0,
      push_failed: data?.push?.failed ?? 0,
      push_expired: data?.push?.expired ?? 0,
      email_sent: data?.email?.sent ?? 0,
      email_total: data?.email?.total ?? 0,
      email_failed: data?.email?.failed ?? 0,
      status: "Envoyée",
      result: data || null,
      created_by: currentUser?.id || null,
    });

    if (historyError) {
      console.warn("Historique annonce non enregistré.", historyError.message);
    }

    await logAdminAction({
      actionType: "broadcast_sent",
      title: "Annonce groupée envoyée",
      targetType: "Annonce",
      targetLabel: cleanTitle,
      details: {
        push: `${data?.push?.sent ?? 0}/${data?.push?.total ?? 0}`,
        email: `${data?.email?.sent ?? 0}/${data?.email?.total ?? 0}`,
      },
    });
    setAnnouncementForm(emptyAnnouncementForm);
    await loadAnnouncementHistory();
    showToast(
      `Annonce envoyée.\nPush : ${data?.push?.sent ?? 0}/${data?.push?.total ?? 0} abonnement(s)` +
        (data?.push?.expired ? `, ${data.push.expired} expiré(s) nettoyé(s)` : "") +
        `\nEmails : ${data?.email?.sent ?? 0}/${data?.email?.total ?? 0} client(s)` +
        (data?.push?.failed || data?.email?.failed ? `\nÉchecs : ${(data?.push?.failed ?? 0) + (data?.email?.failed ?? 0)}` : "")
    );
  } catch (error) {
    showToast(
      "Annonce non envoyée : " +
        (error.message || "erreur inconnue") +
        "\n\nVérifie que la fonction Supabase send-broadcast-announcement est bien déployée et que les secrets email/push sont renseignés."
    );
    const { error: historyError } = await supabase.from("broadcast_announcements").insert({
      title: cleanTitle,
      message: cleanMessage,
      send_push: announcementForm.sendPush,
      send_email: announcementForm.sendEmail,
      status: "Erreur",
      error_message: error.message || "Erreur inconnue",
      created_by: currentUser?.id || null,
    });

    if (!historyError) {
      await loadAnnouncementHistory();
    }
  } finally {
    setAnnouncementSending(false);
  }
}

async function updateCustomerEggAccess(profile, allowed) {
  const { error } = await supabase.rpc("set_customer_egg_access", {
    p_profile_id: profile.id,
    p_allowed: allowed,
  });

  if (error) {
    showToast("Impossible de modifier l'accès commande d'œufs : " + error.message);
    return;
  }

  await loadCustomerProfiles();
}

function updateCustomerInternalNotesDraft(profileId, value) {
  setCustomerProfiles((previous) =>
    previous.map((profile) =>
      profile.id === profileId ? { ...profile, internal_notes: value } : profile
    )
  );
}

async function saveCustomerInternalNotes(profile) {
  const { error } = await supabase.rpc("update_customer_internal_notes", {
    p_profile_id: profile.id,
    p_internal_notes: profile.internal_notes || "",
  });

  if (error) {
    showToast("Impossible d'enregistrer la note interne : " + error.message);
    return;
  }

  await loadCustomerProfiles();
  showToast("Note interne enregistrée.");
}

async function copyMessageTemplate(template) {
  const text = `${template.title}\n\n${template.body}`;

  try {
    await navigator.clipboard.writeText(text);
    showToast("Modèle copié.");
  } catch {
    showToast("Impossible de copier automatiquement. Sélectionne le texte du modèle.");
  }
}

function prepareAnnouncementFromTemplate(template) {
  setAnnouncementForm({
    ...announcementForm,
    title: template.title,
    message: template.body,
  });
  setAdminView("announcements");
  showToast("Modèle chargé dans l'annonce.");
}

function getProfileByEmail(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  return customerProfiles.find((profile) => String(profile.email || "").trim().toLowerCase() === normalizedEmail) || null;
}

function getPreparedMessage(kind, item) {
  if (kind === "order-ready") {
    return {
      subject: "Votre commande est prête",
      body: `Bonjour ${item.client || ""},\n\nVotre commande est prête : ${getOrderSummary(item)}.\nVous pouvez venir la récupérer au créneau prévu.\n\nMerci et à bientôt,\n${publicFarmName}`,
      email: item.email,
      phone: getProfileByEmail(item.email)?.phone || "",
    };
  }

  if (kind === "education-confirmed") {
    return {
      subject: "Réservation ferme pédagogique confirmée",
      body: `Bonjour ${item.client_name || ""},\n\nVotre réservation pour "${item.activity_type}" est confirmée pour le ${formatDeliveryDate(item.booking_date)}.\n\nMerci de nous prévenir en cas d'empêchement.\n\nÀ bientôt,\n${publicFarmName}`,
      email: item.client_email,
      phone: item.phone,
    };
  }

  if (kind === "kennel-confirmed") {
    return {
      subject: "Réservation pension canine confirmée",
      body: `Bonjour ${item.client_name || ""},\n\nLa réservation pension pour ${item.dog?.name || "votre chien"} est confirmée du ${formatDeliveryDate(item.start_date)} au ${formatDeliveryDate(item.end_date)}.\n\nMerci de prévoir les vaccins à jour et les consignes nécessaires pour son séjour.\n\n${publicFarmName}`,
      email: item.client_email,
      phone: item.phone,
    };
  }

  if (kind === "kennel-reminder") {
    return {
      subject: "Rappel avant séjour pension canine",
      body: `Bonjour ${item.client_name || ""},\n\nPetit rappel pour le séjour de ${item.dog?.name || "votre chien"} prévu du ${formatDeliveryDate(item.start_date)} au ${formatDeliveryDate(item.end_date)}.\nPensez à préparer ses vaccins, son alimentation, les consignes et tout traitement éventuel.\n\nMerci,\n${publicFarmName}`,
      email: item.client_email,
      phone: item.phone,
    };
  }

  if (kind === "kennel-full") {
    return {
      subject: "Pension canine complète",
      body: `Bonjour ${item.client_name || ""},\n\nNous sommes désolés, la pension canine est complète sur la période demandée.\nNous pouvons regarder ensemble une autre période si vous le souhaitez.\n\n${publicFarmName}`,
      email: item.client_email,
      phone: item.phone,
    };
  }

  return { subject: "Message", body: "", email: "", phone: "" };
}

async function copyPreparedMessage(kind, item) {
  const message = getPreparedMessage(kind, item);

  try {
    await navigator.clipboard.writeText(`${message.subject}\n\n${message.body}`);
    showToast("Message copié.");
  } catch {
    showToast("Impossible de copier automatiquement.");
  }
}

async function copyMediaPath(imageUrl) {
  try {
    await navigator.clipboard.writeText(imageUrl);
    showToast("Chemin de la photo copié.");
  } catch (error) {
    console.warn("Copie du chemin photo impossible.", error);
    showToast("Impossible de copier automatiquement le chemin.");
  }
}

function applyMediaTo(target, imageUrl) {
  const normalizedImageUrl = normalizeImageUrl(imageUrl);

  if (!normalizedImageUrl) {
    return;
  }

  if (target === "about-main") {
    setAboutForm((current) => ({ ...current, image_url: normalizedImageUrl }));
    setAdminView("content");
    showToast("Photo placée en photo principale de présentation.");
    return;
  }

  if (target === "about-gallery") {
    setAboutForm((current) => ({ ...current, gallery_images: appendImageToGallery(current.gallery_images, normalizedImageUrl) }));
    setAdminView("content");
    showToast("Photo ajoutée à la galerie de présentation.");
    return;
  }

  if (target === "kennel-main") {
    setKennelContentForm((current) => ({ ...current, image_url: normalizedImageUrl }));
    setAdminView("kennelPhotos");
    showToast("Photo placée en photo principale de pension.");
    return;
  }

  if (target === "kennel-gallery") {
    setKennelContentForm((current) => ({ ...current, gallery_images: appendImageToGallery(current.gallery_images, normalizedImageUrl) }));
    setAdminView("kennelPhotos");
    showToast("Photo ajoutée à la galerie pension.");
    return;
  }

  if (target === "event-main") {
    setHomeFeaturedEventForm((current) => ({ ...current, image_url: normalizedImageUrl }));
    setAdminView("content");
    showToast("Photo placée sur l'événement à l'honneur.");
    return;
  }

  if (target === "event-gallery") {
    setHomeFeaturedEventForm((current) => ({ ...current, gallery_images: appendImageToGallery(current.gallery_images, normalizedImageUrl) }));
    setAdminView("content");
    showToast("Photo ajoutée à la galerie événement.");
    return;
  }

  if (target === "news") {
    setHomeNewsForm((current) => ({ ...current, image_url: normalizedImageUrl }));
    setAdminView("news");
    showToast("Photo placée dans le formulaire actualité.");
  }
}

function getSmsPhoneNumber(value) {
  return String(value || "").replace(/[^\d+]/g, "");
}

function getWhatsappPhoneNumber(value) {
  const phone = getSmsPhoneNumber(value);

  if (phone.startsWith("+")) {
    return phone.slice(1);
  }

  if (phone.startsWith("00")) {
    return phone.slice(2);
  }

  if (phone.startsWith("0")) {
    return `33${phone.slice(1)}`;
  }

  return phone;
}

function openContactReplyInGmail(message) {
  const email = String(message.email || "").trim();

  if (!email) {
    showToast("Aucun email disponible pour répondre à ce message.");
    return;
  }

  const subject = message.subject ? `Re: ${message.subject}` : "Re: votre message";
  const body = [
    `Bonjour ${message.full_name || ""},`,
    "",
    "",
    "Merci pour votre message.",
    "",
    "Bien cordialement,",
    publicFarmName,
    "",
    "---- Message reçu ----",
    message.message || "",
  ].join("\n");
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: email,
    su: subject,
    body,
  });

  window.open(`https://mail.google.com/mail/?${params.toString()}`, "_blank", "noopener,noreferrer");
}

function openPreparedMessage(kind, item, channel) {
  const message = getPreparedMessage(kind, item);

  if (channel === "sms") {
    const phone = getSmsPhoneNumber(message.phone);

    if (!phone) {
      showToast("Aucun téléphone disponible pour ce message.");
      return;
    }

    window.location.assign(`sms:${phone}?body=${encodeURIComponent(message.body)}`);
    return;
  }

  if (channel === "whatsapp") {
    const phone = getWhatsappPhoneNumber(message.phone);

    if (!phone) {
      showToast("Aucun téléphone disponible pour WhatsApp.");
      return;
    }

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message.body)}`, "_blank", "noopener,noreferrer");
    return;
  }

  const email = String(message.email || "").trim();

  if (!email || email.includes("@les-poulettes.local")) {
    showToast("Aucun email disponible pour ce message.");
    return;
  }

  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: email,
    su: message.subject,
    body: message.body,
  });

  window.open(`https://mail.google.com/mail/?${params.toString()}`, "_blank", "noopener,noreferrer");
}

function addCustomPhotoToLibrary() {
  const normalizedImageUrl = normalizeImageUrl(customPhotoInput);

  if (!normalizedImageUrl) {
    showToast("Ajoutez d'abord le chemin de la photo, par exemple /images/ma-photo.jpg.");
    return;
  }

  setCustomPhotoLibraryForm((current) => ({
    ...current,
    images: appendImageToGallery(current.images, normalizedImageUrl),
  }));
  setCustomPhotoInput("");
}

async function saveCustomPhotoLibrary(e) {
  e.preventDefault();

  const payload = {
    images: parseGalleryImages(customPhotoLibraryForm.images).join("\n"),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: "custom_photo_library", value: payload }, { onConflict: "key" });

  if (error) {
    showToast("Impossible d'enregistrer la bibliothèque photos : " + error.message);
    return;
  }

  setCustomPhotoLibrary(payload);
  setCustomPhotoLibraryForm(payload);
  showToast("Bibliothèque photos enregistrée.");
}

async function saveHomeNewsItems(nextItems, successMessage = "Actualités enregistrées.") {
  const normalizedItems = nextItems
    .map((item) => ({
      id: item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: String(item.title || "").trim(),
      text: String(item.text || "").trim(),
      image_url: normalizeImageUrl(item.image_url),
      published_at: item.published_at || getLocalIsoDate(),
      active: item.active !== false,
    }))
    .filter((item) => item.title || item.text || item.image_url)
    .sort((a, b) => String(b.published_at || "").localeCompare(String(a.published_at || "")));

  const payload = {
    items: normalizedItems,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: "home_news", value: payload }, { onConflict: "key" });

  if (error) {
    showToast("Impossible d'enregistrer les actualités : " + error.message);
    return false;
  }

  setHomeNewsContent(payload);
  showToast(successMessage);
  return true;
}

async function saveHomeNewsItem(e) {
  e.preventDefault();

  if (!homeNewsForm.title.trim()) {
    showToast("Ajoutez un titre pour l'actualité.");
    return;
  }

  const item = {
    ...homeNewsForm,
    id: homeNewsForm.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    image_url: normalizeImageUrl(homeNewsForm.image_url),
    published_at: homeNewsForm.published_at || getLocalIsoDate(),
  };
  const currentItems = homeNewsContent.items || [];
  const nextItems = homeNewsForm.id
    ? currentItems.map((newsItem) => (newsItem.id === homeNewsForm.id ? item : newsItem))
    : [item, ...currentItems];
  const saved = await saveHomeNewsItems(nextItems, "Actualité enregistrée.");

  if (saved) {
    setHomeNewsForm(emptyHomeNewsForm);
    setActiveHomeNewsIndex(0);
  }
}

function editHomeNewsItem(item) {
  setHomeNewsForm({
    ...emptyHomeNewsForm,
    ...item,
    image_url: normalizeImageUrl(item.image_url),
    published_at: item.published_at || getLocalIsoDate(),
  });
}

async function toggleHomeNewsItem(item) {
  const nextItems = (homeNewsContent.items || []).map((newsItem) =>
    newsItem.id === item.id ? { ...newsItem, active: newsItem.active === false } : newsItem
  );
  await saveHomeNewsItems(nextItems, item.active === false ? "Actualité affichée." : "Actualité masquée.");
}

async function deleteHomeNewsItem(item) {
  const confirmed = await requestConfirm({
    title: "Supprimer cette actualité ?",
    message: `L'actualité "${item.title}" sera retirée de l'accueil.`,
    confirmLabel: "Supprimer",
    tone: "danger",
  });

  if (!confirmed) {
    return;
  }

  await saveHomeNewsItems(
    (homeNewsContent.items || []).filter((newsItem) => newsItem.id !== item.id),
    "Actualité supprimée."
  );
}

async function saveAboutContent(e) {
  e.preventDefault();

  const payload = {
    ...aboutForm,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: "about_page", value: payload }, { onConflict: "key" });

  if (error) {
    showToast("Impossible d'enregistrer la présentation : " + error.message);
    return;
  }

  setAboutContent(payload);
  setAboutForm(payload);
  showToast("Présentation de la ferme enregistrée.");
}

async function saveHomeFeaturedEvent(e) {
  e.preventDefault();

  const payload = {
    ...homeFeaturedEventForm,
    enabled: homeFeaturedEventForm.enabled === true,
    image_url: normalizeImageUrl(homeFeaturedEventForm.image_url),
    gallery_images: parseGalleryImages(homeFeaturedEventForm.gallery_images).join("\n"),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: "home_featured_event", value: payload }, { onConflict: "key" });

  if (error) {
    showToast("Impossible d'enregistrer l'événement à l'honneur : " + error.message);
    return;
  }

  setHomeFeaturedEvent(payload);
  setHomeFeaturedEventForm(payload);
  showToast("Événement à l'honneur enregistré.");
}

async function saveKennelContent(e) {
  e.preventDefault();

  const payload = {
    ...kennelContentForm,
    image_url: normalizeImageUrl(kennelContentForm.image_url),
    gallery_images: parseGalleryImages(kennelContentForm.gallery_images).join("\n"),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: "kennel_page", value: payload }, { onConflict: "key" });

  if (error) {
    showToast("Impossible d'enregistrer les photos de la pension : " + error.message);
    return;
  }

  setKennelContent(payload);
  setKennelContentForm(payload);
  showToast("Photos de la pension canine enregistrées.");
}

async function saveAppSettings(e) {
  e.preventDefault();

  const payload = {
    farm_name: String(appSettingsForm.farm_name || "").trim() || DEFAULT_APP_SETTINGS.farm_name,
    contact_email: String(appSettingsForm.contact_email || "").trim(),
    contact_phone: String(appSettingsForm.contact_phone || "").trim(),
    site_url: String(appSettingsForm.site_url || "").trim(),
    google_review_url: String(appSettingsForm.google_review_url || "").trim(),
    google_maps_url: String(appSettingsForm.google_maps_url || "").trim(),
    kennel_capacity_note: String(appSettingsForm.kennel_capacity_note || "").trim(),
    admin_note: String(appSettingsForm.admin_note || "").trim(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: "app_settings", value: payload }, { onConflict: "key" });

  if (error) {
    showToast("Impossible d'enregistrer les réglages : " + error.message);
    return;
  }

  setAppSettings(payload);
  setAppSettingsForm(payload);
  await logAdminAction({
    actionType: "settings_update",
    title: "Réglages admin modifiés",
    targetType: "Réglages",
    targetLabel: payload.farm_name,
    details: {
      téléphone: payload.contact_phone,
      email: payload.contact_email,
      site: payload.site_url,
    },
  });
  showToast("Réglages admin enregistrés.");
}

async function loadEducationBookings() {
  const { data, error } = await supabase
    .from("educational_bookings")
    .select("*")
    .order("booking_date", { ascending: true });

  if (error) {
    console.warn("Réservations pédagogiques indisponibles.", error.message);
    setEducationBookings([]);
    return;
  }

  setEducationBookings(data || []);
}

function getEducationSlotParticipants(slot) {
  return educationBookings
    .filter((booking) => {
      const activity = educationActivities.find((item) => item.id === slot.activity_id);
      const sameSlot = booking.date_slot_id
        ? booking.date_slot_id === slot.id
        : booking.activity_type === activity?.name && booking.booking_date === slot.activity_date;

      return sameSlot && !String(booking.status || "").toLowerCase().startsWith("annul");
    })
    .reduce((sum, booking) => sum + Number(booking.participants || 0), 0);
}

function getEducationSlotRemaining(slot) {
  return Math.max(0, Number(slot.capacity || 0) - getEducationSlotParticipants(slot));
}

function getEducationSlotLabel(slot) {
  const remaining = getEducationSlotRemaining(slot);
  const labelParts = [formatDeliveryDate(slot.activity_date), slot.label].filter(Boolean);

  return `${labelParts.join(" - ")} - ${remaining > 0 ? `${remaining} place${remaining > 1 ? "s" : ""} restante${remaining > 1 ? "s" : ""}` : "Complet"}`;
}

function setEducationChild(index, field, value) {
  setEducationBookingForm((previous) => ({
    ...previous,
    children: previous.children.map((child, childIndex) =>
      childIndex === index ? { ...child, [field]: value } : child
    ),
  }));
}

function addEducationChild() {
  setEducationBookingForm((previous) => ({
    ...previous,
    children: [...previous.children, { firstName: "", age: "" }],
  }));
}

function removeEducationChild(index) {
  setEducationBookingForm((previous) => ({
    ...previous,
    children: previous.children.filter((_, childIndex) => childIndex !== index),
  }));
}

async function loadKennelBookings() {
  const { data, error } = await supabase
    .from("kennel_bookings")
    .select("*, dog:dogs(*)")
    .order("start_date", { ascending: true });

  if (error) {
    console.warn("Réservations pension canine indisponibles.", error.message);
    setKennelBookings([]);
    return;
  }

  setKennelBookings(data || []);
}

const loadKennelAvailability = useCallback(async (monthValue = clientKennelCalendarMonth) => {
  const days = getCalendarGridDates(monthValue);
  const startDate = days[0]?.date;
  const endDate = days[days.length - 1]?.date;

  if (!startDate || !endDate) {
    setKennelAvailability([]);
    return;
  }

  const { data, error } = await supabase.rpc("get_kennel_availability", {
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) {
    console.warn("Disponibilités pension indisponibles.", error.message);
    setKennelAvailability([]);
    return;
  }

  setKennelAvailability(data || []);
}, [clientKennelCalendarMonth]);

useEffect(() => {
  if (screen !== "kennel") {
    return undefined;
  }

  const timer = window.setTimeout(() => {
    void loadKennelAvailability(clientKennelCalendarMonth);
  }, 0);

  return () => window.clearTimeout(timer);
}, [screen, clientKennelCalendarMonth, loadKennelAvailability]);

function getBlockedKennelDate(date) {
  return kennelBlockedDates.find((blockedDate) => blockedDate.blocked_date === date);
}

function getBlockedKennelNights(startDate, endDate) {
  if (!startDate || !endDate || endDate <= startDate) {
    return [];
  }

  return getKennelNights(startDate, endDate)
    .map((date) => getBlockedKennelDate(date))
    .filter(Boolean);
}

async function saveKennelBlockedDate(event) {
  event.preventDefault();

  if (!kennelBlockedDateForm.blocked_date) {
    showToast("Choisis une date à fermer.");
    return;
  }

  const { error } = await supabase
    .from("kennel_blocked_dates")
    .upsert(
      {
        blocked_date: kennelBlockedDateForm.blocked_date,
        reason: kennelBlockedDateForm.reason.trim(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "blocked_date" }
    );

  if (error) {
    showToast("Impossible de fermer cette date : " + error.message);
    return;
  }

  setKennelBlockedDateForm(emptyKennelBlockedDateForm);
  await loadKennelBlockedDates();
}

async function deleteKennelBlockedDate(blockedDate) {
  const { error } = await supabase
    .from("kennel_blocked_dates")
    .delete()
    .eq("id", blockedDate.id);

  if (error) {
    showToast("Impossible de rouvrir cette date : " + error.message);
    return;
  }

  await loadKennelBlockedDates();
}

async function updateEducationBooking(id, changes) {
  const { error } = await supabase
    .from("educational_bookings")
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    showToast("Impossible de modifier la réservation pédagogique : " + error.message);
    return;
  }

  const booking = educationBookings.find((item) => item.id === id);
  await logAdminAction({
    actionType: "education_booking_update",
    title: "Réservation ferme modifiée",
    targetType: "Réservation ferme",
    targetId: id,
    targetLabel: booking?.client_name || booking?.activity_type || "Réservation ferme",
    details: changes,
  });
  await loadEducationBookings();
}

async function setOrderArchived(order, archived) {
  const { error } = await supabase
    .from("orders")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", order.id);

  if (error) {
    showToast("Impossible de modifier l'archivage de cette commande : " + error.message);
    return;
  }

  await logAdminAction({
    actionType: "order_archive",
    title: archived ? "Commande archivée" : "Commande restaurée",
    targetType: "Commande",
    targetId: order.id,
    targetLabel: order.client || order.email || "Commande",
    details: { archive: archived },
  });
  await loadOrders();
}

async function setEducationBookingArchived(booking, archived) {
  const { error } = await supabase
    .from("educational_bookings")
    .update({ archived_at: archived ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("id", booking.id);

  if (error) {
    showToast("Impossible de modifier l'archivage de cette réservation : " + error.message);
    return;
  }

  await logAdminAction({
    actionType: "education_archive",
    title: archived ? "Réservation ferme archivée" : "Réservation ferme restaurée",
    targetType: "Réservation ferme",
    targetId: booking.id,
    targetLabel: booking.client_name || booking.activity_type || "Réservation ferme",
    details: { archive: archived },
  });
  await loadEducationBookings();
}

async function setKennelBookingArchived(booking, archived) {
  const { error } = await supabase
    .from("kennel_bookings")
    .update({ archived_at: archived ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("id", booking.id);

  if (error) {
    showToast("Impossible de modifier l'archivage de ce séjour : " + error.message);
    return;
  }

  await logAdminAction({
    actionType: "kennel_archive",
    title: archived ? "Séjour pension archivé" : "Séjour pension restauré",
    targetType: "Séjour pension",
    targetId: booking.id,
    targetLabel: booking.dog?.name || booking.client_name || "Séjour pension",
    details: { archive: archived },
  });
  await loadKennelBookings();
}

async function archiveOldRecords() {
  const oldOrders = orders.filter(
    (order) => !order.archived_at && order.date < todayIso && ["Livrée", "Annulée"].includes(order.status)
  );
  const oldEducationBookings = educationBookings.filter(
    (booking) =>
      !booking.archived_at &&
      String(booking.booking_date || "") < todayIso &&
      ["Terminée", "Annulée"].includes(booking.status || "")
  );
  const oldKennelBookings = kennelBookings.filter(
    (booking) =>
      !booking.archived_at &&
      String(booking.end_date || booking.start_date || "") < todayIso &&
      ["Terminée", "Annulée"].includes(booking.status || "")
  );
  const totalRecords = oldOrders.length + oldEducationBookings.length + oldKennelBookings.length;

  if (totalRecords === 0) {
    showToast("Aucun ancien élément terminé à archiver.");
    return;
  }

  const confirmed = await requestConfirm({
    title: "Archiver les anciens éléments ?",
    message: `${totalRecords} élément${totalRecords > 1 ? "s" : ""} terminé${totalRecords > 1 ? "s" : ""} ou annulé${totalRecords > 1 ? "s" : ""} vont être déplacés dans les archives sans être supprimés.`,
    confirmLabel: "Archiver",
  });

  if (!confirmed) {
    return;
  }

  const archivedAt = new Date().toISOString();
  const updates = [];

  if (oldOrders.length > 0) {
    updates.push(supabase.from("orders").update({ archived_at: archivedAt }).in("id", oldOrders.map((order) => order.id)));
  }

  if (oldEducationBookings.length > 0) {
    updates.push(
      supabase
        .from("educational_bookings")
        .update({ archived_at: archivedAt, updated_at: archivedAt })
        .in("id", oldEducationBookings.map((booking) => booking.id))
    );
  }

  if (oldKennelBookings.length > 0) {
    updates.push(
      supabase
        .from("kennel_bookings")
        .update({ archived_at: archivedAt, updated_at: archivedAt })
        .in("id", oldKennelBookings.map((booking) => booking.id))
    );
  }

  const results = await Promise.all(updates);
  const failedUpdate = results.find((result) => result.error);

  if (failedUpdate) {
    showToast("Impossible d'archiver certains éléments : " + failedUpdate.error.message);
    return;
  }

  await logAdminAction({
    actionType: "bulk_archive",
    title: "Archivage automatique des anciens éléments",
    targetType: "Archives",
    details: {
      commandes: oldOrders.length,
      reservations_ferme: oldEducationBookings.length,
      sejours_pension: oldKennelBookings.length,
    },
  });
  await Promise.all([loadOrders(), loadEducationBookings(), loadKennelBookings()]);
  showToast(`${totalRecords} élément${totalRecords > 1 ? "s archivés" : " archivé"}.`);
}

async function updateKennelBooking(id, changes) {
  const { error } = await supabase
    .from("kennel_bookings")
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    if (String(error.message || "").includes("kennel_night_full")) {
      showToast("La pension est complète sur au moins une nuit demandée.");
    } else if (String(error.message || "").includes("kennel_night_closed")) {
      showToast("La pension est fermée sur au moins une nuit demandée.");
    } else if (String(error.message || "").includes("kennel_invalid_dates")) {
      showToast("La date de départ doit être après la date d'arrivée.");
    } else {
      showToast("Impossible de modifier la réservation pension : " + error.message);
    }
    return;
  }

  const booking = kennelBookings.find((item) => item.id === id);
  await logAdminAction({
    actionType: "kennel_booking_update",
    title: "Séjour pension modifié",
    targetType: "Séjour pension",
    targetId: id,
    targetLabel: booking?.dog?.name || booking?.client_name || "Séjour pension",
    details: changes,
  });
  await loadKennelBookings();
}

async function updateDogProfile(id, changes) {
  if (!id) {
    showToast("Fiche chien introuvable.");
    return;
  }

  const { error } = await supabase
    .from("dogs")
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    showToast("Impossible de modifier la fiche chien : " + error.message);
    return;
  }

  const booking = kennelBookings.find((item) => item.dog?.id === id);
  await logAdminAction({
    actionType: "dog_update",
    title: "Fiche chien modifiée",
    targetType: "Chien",
    targetId: id,
    targetLabel: booking?.dog?.name || "Fiche chien",
    details: changes,
  });
  await loadKennelBookings();
}

async function createAdminKennelBooking(event) {
  event.preventDefault();

  if (!currentUser || !isAdmin) {
    showToast("Connecte-toi avec le compte admin pour ajouter une réservation.");
    return;
  }

  const cleanClientName = adminKennelBookingForm.clientName.trim();
  const cleanClientPhone = adminKennelBookingForm.clientPhone.trim();
  const cleanDogName = adminKennelBookingForm.dogName.trim();
  const cleanStartDate = adminKennelBookingForm.startDate;
  const cleanEndDate = adminKennelBookingForm.endDate;

  if (!cleanClientName || !cleanClientPhone || !cleanDogName || !cleanStartDate || !cleanEndDate) {
    showToast("Renseigne au minimum le client, le téléphone, le chien et les dates du séjour.");
    return;
  }

  if (cleanEndDate <= cleanStartDate) {
    showToast("La date de départ doit être après la date d'arrivée.");
    return;
  }

  const blockedNights = getBlockedKennelNights(cleanStartDate, cleanEndDate);

  if (blockedNights.length > 0) {
    showToast(`La pension est fermée sur cette période, notamment le ${formatDeliveryDate(blockedNights[0].blocked_date)}.`);
    return;
  }

  const { data: dog, error: dogError } = await supabase
    .from("dogs")
    .insert({
      user_id: currentUser.id,
      name: cleanDogName,
      photo_url: normalizeImageUrl(adminKennelBookingForm.dogPhotoUrl),
      breed: adminKennelBookingForm.dogBreed.trim(),
      birth_year: adminKennelBookingForm.dogBirthYear ? Number(adminKennelBookingForm.dogBirthYear) : null,
      sex: adminKennelBookingForm.dogSex,
      vaccines_up_to_date: adminKennelBookingForm.vaccinesUpToDate,
      sterilized: adminKennelBookingForm.sterilized,
      notes: adminKennelBookingForm.notes.trim(),
    })
    .select("id")
    .single();

  if (dogError) {
    showToast("Impossible d'enregistrer la fiche chien : " + dogError.message);
    return;
  }

  const fallbackEmail = `hors-appli+${dog.id}@les-poulettes.local`;
  const { error } = await supabase.from("kennel_bookings").insert({
    user_id: currentUser.id,
    dog_id: dog.id,
    start_date: cleanStartDate,
    end_date: cleanEndDate,
    client_name: cleanClientName,
    client_email: adminKennelBookingForm.clientEmail.trim() || fallbackEmail,
    client_address: adminKennelBookingForm.clientAddress.trim(),
    phone: cleanClientPhone,
    notes: adminKennelBookingForm.notes.trim(),
    status: adminKennelBookingForm.status,
    amount_confirmed:
      adminKennelBookingForm.amountConfirmed === ""
        ? null
        : Number(adminKennelBookingForm.amountConfirmed),
    deposit_amount:
      adminKennelBookingForm.depositAmount === ""
        ? 0
        : Number(adminKennelBookingForm.depositAmount),
    payment_received: adminKennelBookingForm.paymentReceived,
    payment_method: adminKennelBookingForm.paymentMethod,
    payment_received_at: adminKennelBookingForm.paymentReceived ? new Date().toISOString() : null,
  });

  if (error) {
    if (String(error.message || "").includes("kennel_night_full")) {
      showToast("La pension est complète sur au moins une nuit demandée.");
    } else if (String(error.message || "").includes("kennel_night_closed")) {
      showToast("La pension est fermée sur au moins une nuit demandée.");
    } else if (String(error.message || "").includes("kennel_invalid_dates")) {
      showToast("La date de départ doit être après la date d'arrivée.");
    } else {
      showToast("Impossible d'ajouter la réservation pension : " + error.message);
    }
    return;
  }

  setAdminKennelBookingForm(emptyAdminKennelBookingForm);
  await loadKennelBookings();
  showToast("Réservation pension ajoutée dans le planning.");
}

  async function loadMyOrders(userId) {
    if (!userId) {
      showToast("Utilisateur introuvable. Reconnecte-toi.");
      return;
    }

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", userId)
      .order("delivery_date", { ascending: false });

    if (error) {
      showToast("Erreur chargement historique : " + error.message);
      return;
    }

    setMyOrders((data || []).map((order) => ({
      ...order,
      status: normalizeOrderStatus(order.status),
    })));
  }

  async function goToMyOrders() {
    setScreen("myOrders");

    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      showToast("Tu dois être connecté.");
      setScreen("login");
      return;
    }

    const user = sessionData.session.user;
    setCurrentUser(user);
    await Promise.all([
      loadMyOrders(user.id),
      loadCustomerProfiles(),
      loadEducationBookings(),
      loadKennelBookings(),
    ]);
  }

  async function goToProfile() {
    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      showToast("Tu dois être connecté.");
      setScreen("login");
      return;
    }

    const user = sessionData.session.user;
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .limit(1);

    if (error) {
      showToast("Erreur chargement profil : " + error.message);
      return;
    }

    const profile = profiles?.[0];
    const savedDeliveryAddress = profile?.delivery_address || user.user_metadata?.delivery_address || deliveryAddress;
    const savedPhone = profile?.phone || user.user_metadata?.phone || profileForm.phone;
    const savedName = profile?.full_name || name || user.email || "";

    setCurrentUser(user);
    setName(savedName);
    setDeliveryAddress(savedDeliveryAddress);
    setProfileForm({
      fullName: savedName,
      phone: savedPhone,
      deliveryAddress: savedDeliveryAddress,
    });
    setScreen("profile");
  }

  async function saveProfile(e) {
    e.preventDefault();

    if (!currentUser) {
      showToast("Tu dois être connecté.");
      setScreen("login");
      return;
    }

    const cleanName = profileForm.fullName.trim();
    const cleanPhone = profileForm.phone.trim();
    const cleanDeliveryAddress = profileForm.deliveryAddress.trim();

    if (!cleanName || !cleanPhone || !cleanDeliveryAddress) {
      showToast("Merci de renseigner le nom, le téléphone et l'adresse de livraison.");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: cleanName,
        phone: cleanPhone,
        delivery_address: cleanDeliveryAddress,
      })
      .eq("id", currentUser.id);

    if (error) {
      if (String(error.message || "").includes("delivery_address")) {
        showToast("Applique d'abord la migration Supabase de l'adresse client.");
        return;
      }

      showToast("Erreur mise à jour profil : " + error.message);
      return;
    }

    setName(cleanName);
    setDeliveryAddress(cleanDeliveryAddress);
    showToast("Profil mis à jour !");
  }

  async function requestEducationBooking(event) {
    event.preventDefault();

    if (!currentUser || !isLogged) {
      showToast("Connecte-toi pour demander une réservation.");
      setScreen("login");
      return;
    }

    const activity = educationActivities.find((item) => item.id === educationBookingForm.activityId);
    const slot = educationDateSlots.find((item) => item.id === educationBookingForm.dateSlotId);
    const children = educationBookingForm.children
      .map((child) => ({
        firstName: child.firstName.trim(),
        age: child.age ? Number(child.age) : null,
      }))
      .filter((child) => child.firstName && Number(child.age) > 0);

    if (!activity || !slot) {
      showToast("Choisis une activité et une date proposée.");
      return;
    }

    if (children.length === 0 || !educationBookingForm.accompanistName.trim()) {
      showToast("Renseigne au minimum un enfant et le nom de l'accompagnateur.");
      return;
    }

    if (getEducationSlotRemaining(slot) < children.length) {
      showToast("Ce créneau est complet ou ne dispose plus d'assez de places.");
      return;
    }

    const { error } = await supabase.rpc("create_education_booking", {
      p_activity_id: activity.id,
      p_date_slot_id: slot.id,
      p_activity_type: activity.name,
      p_booking_date: slot.activity_date,
      p_participants: children.length,
      p_accompanist_name: educationBookingForm.accompanistName.trim(),
      p_children: children,
      p_client_name: name || currentUser.email,
      p_client_email: currentUser.email,
      p_phone: educationBookingForm.phone.trim(),
      p_notes: educationBookingForm.notes.trim(),
    });

    if (error) {
      if (String(error.message || "").includes("education_slot_full")) {
        showToast("Ce créneau est complet ou ne dispose plus d'assez de places.");
      } else {
        showToast("Impossible d'enregistrer la demande : " + error.message);
      }
      return;
    }

    setEducationBookingForm(emptyEducationBookingForm);
    await loadEducationBookings();
    showToast("Demande de réservation envoyée. Nous confirmerons le créneau rapidement.");
  }

  async function requestBirthdayBooking(event) {
    event.preventDefault();

    if (!currentUser || !isLogged) {
      showToast("Connecte-toi pour envoyer une demande d'anniversaire.");
      setScreen("login");
      return;
    }

    const activity =
      educationActivities.find((item) => item.id === "birthday-group") ||
      educationActivities.find((item) => /anniversaire/i.test(item.name || ""));
    const childName = birthdayBookingForm.childName.trim();
    const childAge = Number(birthdayBookingForm.childAge || 0);
    const guestCount = Number(birthdayBookingForm.guestCount || 0);
    const parentName = birthdayBookingForm.parentName.trim();
    const desiredDate = birthdayBookingForm.desiredDate;

    if (!activity || !desiredDate || !childName || childAge <= 0 || guestCount <= 0 || !parentName || !birthdayBookingForm.phone.trim()) {
      showToast("Renseigne la date souhaitée, l'enfant, l'âge, le nombre d'invités, le parent et le téléphone.");
      return;
    }

    const notes = [
      "Demande anniversaire",
      `Enfant : ${childName}`,
      `Âge : ${childAge} ans`,
      `Nombre d'invités/enfants : ${guestCount}`,
      birthdayBookingForm.notes.trim() ? `Précisions : ${birthdayBookingForm.notes.trim()}` : "",
    ].filter(Boolean).join("\n");

    const { error } = await supabase.from("educational_bookings").insert({
      user_id: currentUser.id,
      activity_id: activity.id,
      date_slot_id: null,
      activity_type: "Anniversaire à la ferme",
      booking_date: desiredDate,
      participants: guestCount,
      accompanist_name: parentName,
      children: [{ firstName: childName, age: childAge, birthday: true }],
      client_name: name || parentName || currentUser.email,
      client_email: currentUser.email,
      phone: birthdayBookingForm.phone.trim(),
      notes,
      status: "Demandée",
    });

    if (error) {
      showToast("Impossible d'envoyer la demande d'anniversaire : " + error.message);
      return;
    }

    setBirthdayBookingForm(emptyBirthdayBookingForm);
    await loadEducationBookings();
    showToast("Demande d'anniversaire envoyée. Nous reviendrons vers vous pour organiser la fête.");
  }

  async function requestKennelBooking(event) {
    event.preventDefault();

    if (!currentUser || !isLogged) {
      showToast("Connecte-toi pour demander une réservation.");
      setScreen("login");
      return;
    }

    if (!kennelBookingForm.startDate || !kennelBookingForm.endDate || !kennelBookingForm.dogName.trim()) {
      showToast("Indique les dates de séjour et le nom du chien.");
      return;
    }

    if (kennelBookingForm.endDate <= kennelBookingForm.startDate) {
      showToast("La date de départ doit être après la date d'arrivée.");
      return;
    }

    const blockedNights = getBlockedKennelNights(kennelBookingForm.startDate, kennelBookingForm.endDate);

    if (blockedNights.length > 0) {
      showToast(`La pension est fermée sur cette période, notamment le ${formatDeliveryDate(blockedNights[0].blocked_date)}.`);
      return;
    }

    const { data: dog, error: dogError } = await supabase
      .from("dogs")
      .insert({
        user_id: currentUser.id,
        name: kennelBookingForm.dogName.trim(),
        photo_url: normalizeImageUrl(kennelBookingForm.dogPhotoUrl),
        breed: kennelBookingForm.dogBreed.trim(),
        birth_year: kennelBookingForm.dogBirthYear ? Number(kennelBookingForm.dogBirthYear) : null,
        sex: kennelBookingForm.dogSex,
        vaccines_up_to_date: kennelBookingForm.vaccinesUpToDate,
        sterilized: kennelBookingForm.sterilized,
        notes: kennelBookingForm.notes.trim(),
      })
      .select("id")
      .single();

    if (dogError) {
      showToast("Impossible d'enregistrer la fiche chien : " + dogError.message);
      return;
    }

    const { error } = await supabase.from("kennel_bookings").insert({
      user_id: currentUser.id,
      dog_id: dog.id,
      start_date: kennelBookingForm.startDate,
      end_date: kennelBookingForm.endDate,
      client_name: name || currentUser.email,
      client_email: currentUser.email,
      phone: kennelBookingForm.phone.trim(),
      notes: kennelBookingForm.notes.trim(),
    });

    if (error) {
      if (String(error.message || "").includes("kennel_night_full")) {
        showToast("La pension est complète sur au moins une nuit demandée. Choisis d'autres dates.");
      } else if (String(error.message || "").includes("kennel_night_closed")) {
        showToast("La pension est fermée sur au moins une nuit demandée. Choisis d'autres dates.");
      } else if (String(error.message || "").includes("kennel_invalid_dates")) {
        showToast("La date de départ doit être après la date d'arrivée.");
      } else {
        showToast("Impossible d'enregistrer la demande : " + error.message);
      }
      return;
    }

    setKennelBookingForm(emptyKennelBookingForm);
    await loadKennelAvailability(clientKennelCalendarMonth);
    showToast("Demande de pension envoyée. Nous confirmerons la disponibilité rapidement.");
  }

  const loadStock = useCallback(async () => {
    const { data, error } = await supabase
      .from("stock")
      .select("*")
      .order("id", { ascending: true })
      .limit(1);

    if (error) {
      showToast("Erreur chargement stock : " + error.message);
      return;
    }

    if (!data || data.length === 0) {
      showToast("Aucune ligne de stock trouvée.");
      return;
    }

    setStockEggs(data[0].eggs_available);
  }, []);

  useEffect(() => {
    if (screen === "shop" || screen === "admin") {
      void loadStock();
    }
  }, [screen, loadStock]);

  useEffect(() => {
    if (isStandaloneDisplay || (installBannerWasDismissed && !installWasRequested)) {
      return;
    }

    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setInstallPrompt(event);
      setIsIosInstallHelp(false);
      setShowInstallBanner(true);
    }

    function handleAppInstalled() {
      setInstallPrompt(null);
      setShowInstallBanner(false);
      localStorage.setItem("pwa-install-dismissed", "true");
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) {
      setIsIosInstallHelp(true);
      setShowInstallBanner(true);
      return;
    }

    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
    setShowInstallBanner(false);
  }

  function dismissUpdateNotice() {
    localStorage.setItem(updateNoticeDismissedKey, String(Date.now()));
    setShowUpdateNotice(false);
  }

  function refreshAppVersion() {
    localStorage.removeItem(updateNoticeDismissedKey);
    setShowUpdateNotice(false);

    if (updateServiceWorker) {
      void updateServiceWorker(true);
      return;
    }

    window.location.reload();
  }

  async function checkForAppUpdate() {
    if (!canUseBrowser || !("serviceWorker" in navigator)) {
      window.location.reload();
      return;
    }

    setCheckingAppUpdate(true);
    localStorage.removeItem(updateNoticeDismissedKey);

    try {
      const registrations = await navigator.serviceWorker.getRegistrations();

      await Promise.all(registrations.map((registration) => registration.update()));
      const refreshedRegistrations = await navigator.serviceWorker.getRegistrations();
      const waitingRegistration = refreshedRegistrations.find((registration) => registration.waiting);
      const hasWaitingServiceWorker = Boolean(waitingRegistration);

      if (updateServiceWorker || hasWaitingServiceWorker) {
        if (!updateServiceWorker && waitingRegistration) {
          setUpdateServiceWorker(() => () => {
            navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
            waitingRegistration.waiting?.postMessage({ type: "SKIP_WAITING" });
            window.setTimeout(() => window.location.reload(), 1500);
          });
        }
        setShowUpdateNotice(true);
        showToast("Une nouvelle version est disponible. Touchez le bouton de mise à jour.");
        return;
      }

      showToast("L'application est déjà à jour.");
    } catch (error) {
      console.warn("Impossible de vérifier la mise à jour PWA.", error);
      showToast("Impossible de vérifier les mises à jour pour le moment.");
    } finally {
      setCheckingAppUpdate(false);
    }
  }

  async function installAdminSummaryApp() {
    if (installPrompt) {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
      return;
    }

    showToast(
      "Pour créer l'icône de la synthèse commandes : ouvre cette page dans le navigateur du téléphone, puis utilise le menu Partager / Ajouter à l'écran d'accueil."
    );
  }

  function dismissInstallBanner() {
    localStorage.setItem("pwa-install-dismissed", "true");
    setShowInstallBanner(false);
  }

function editProduct(product) {
  setProductForm({
    id: product.id,
    name: product.name,
    price: String(product.price),
    unit_label: product.unit_label || "piece",
    image: product.image || "",
    size_eggs: product.size_eggs || 0,
  });
}

async function saveProduct(event) {
  event.preventDefault();

  const name = productForm.name.trim();
  const price = Number(productForm.price);
  const productId =
    productForm.id ||
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  if (!name || !productId || Number.isNaN(price) || price < 0) {
    showToast("Renseigne au minimum un nom et un prix valide.");
    return;
  }

  const productPayload = {
    id: productId,
    name,
    price,
    unit_label: productForm.unit_label.trim() || "piece",
    image_url: productForm.image.trim(),
    size_eggs: Number(productForm.size_eggs || 0),
    active: true,
  };
  const { error } = await supabase.from("products").upsert(productPayload);

  if (error) {
    showToast(
      "Impossible d'enregistrer le produit : " +
        error.message +
        "\n\nSi la table products n'existe pas encore, applique la migration Supabase products."
    );
    return;
  }

  setProductForm(emptyProductForm);
  await loadProducts();
}

async function toggleProductActive(product) {
  const { error } = await supabase
    .from("products")
    .update({ active: !product.active })
    .eq("id", product.id);

  if (error) {
    showToast(
      "Impossible de modifier ce produit : " +
        error.message +
        "\n\nSi la table products n'existe pas encore, applique la migration Supabase products."
    );
    return;
  }

  await loadProducts();
}

async function deleteProduct(product) {
  const confirmed = await requestConfirm({
    title: `Supprimer le produit "${product.name}" ?`,
    message: "Cette suppression est définitive. Si ce produit a déjà été commandé, il vaut mieux utiliser Masquer.",
    confirmLabel: "Supprimer",
    tone: "danger",
  });

  if (!confirmed) {
    return;
  }

  const { error } = await supabase.from("products").delete().eq("id", product.id);

  if (error) {
    showToast(
      "Impossible de supprimer ce produit : " +
        error.message +
        "\n\nTu peux utiliser Masquer pour le retirer de la boutique sans le supprimer."
    );
    return;
  }

  if (productForm.id === product.id) {
    setProductForm(emptyProductForm);
  }

  await loadProducts();
}

async function saveDeliverySlot(event) {
  event.preventDefault();

  if (!deliverySlotForm.delivery_date) {
    showToast("Choisis une date de livraison.");
    return;
  }

  const slotPayload = {
    delivery_date: deliverySlotForm.delivery_date,
    label: deliverySlotForm.label.trim(),
    max_orders: deliverySlotForm.max_orders ? Number(deliverySlotForm.max_orders) : null,
    active: true,
  };

  const { error } = await supabase
    .from("delivery_slots")
    .upsert(slotPayload, { onConflict: "delivery_date" });

  if (error) {
    showToast(
      "Impossible d'enregistrer ce créneau : " +
        error.message +
        "\n\nApplique d'abord la migration Supabase delivery_slots."
    );
    return;
  }

  setDeliverySlotForm(emptyDeliverySlotForm);
  await loadDeliverySlots();
}

async function toggleDeliverySlotActive(slot) {
  const { error } = await supabase
    .from("delivery_slots")
    .update({ active: !slot.active })
    .eq("id", slot.id);

  if (error) {
    showToast("Impossible de modifier ce créneau : " + error.message);
    return;
  }

  await loadDeliverySlots();
}

async function deleteDeliverySlot(slot) {
  const confirmed = await requestConfirm({
    title: "Supprimer ce créneau ?",
    message: `Créneau du ${formatDeliveryDate(slot.delivery_date)}.`,
    confirmLabel: "Supprimer",
    tone: "danger",
  });

  if (!confirmed) {
    return;
  }

  const { error } = await supabase.from("delivery_slots").delete().eq("id", slot.id);

  if (error) {
    showToast("Impossible de supprimer ce créneau : " + error.message);
    return;
  }

  if (deliveryDate === slot.delivery_date) {
    setDeliveryDate("");
  }

  await loadDeliverySlots();
}

function editEducationActivity(activity) {
  setEducationActivityForm({
    id: activity.id,
    name: activity.name,
    description: activity.description || "",
    price: activity.price,
    season_label: activity.season_label || "",
    image_url: activity.image_url || "",
    gallery_images: parseGalleryImages(activity.gallery_images).join("\n"),
  });
}

async function saveEducationActivity(event) {
  event.preventDefault();

  const activityName = educationActivityForm.name.trim();
  const price = Number(educationActivityForm.price || 0);

  if (!activityName || Number.isNaN(price) || price < 0) {
    showToast("Renseigne au minimum un nom et un tarif valide.");
    return;
  }

  const activityId =
    educationActivityForm.id ||
    activityName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const { error } = await supabase.from("education_activities").upsert({
    id: activityId,
    name: activityName,
    description: educationActivityForm.description.trim(),
    price,
    season_label: educationActivityForm.season_label.trim(),
    image_url: normalizeImageUrl(educationActivityForm.image_url),
    gallery_images: parseGalleryImages(educationActivityForm.gallery_images),
    active: true,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    showToast("Impossible d'enregistrer l'activité : " + error.message);
    return;
  }

  setEducationActivityForm(emptyEducationActivityForm);
  await loadEducationActivities();
}

async function toggleEducationActivityActive(activity) {
  const { error } = await supabase
    .from("education_activities")
    .update({ active: !activity.active, updated_at: new Date().toISOString() })
    .eq("id", activity.id);

  if (error) {
    showToast("Impossible de modifier l'activité : " + error.message);
    return;
  }

  await loadEducationActivities();
}

async function deleteEducationActivity(activity) {
  const confirmed = await requestConfirm({
    title: `Supprimer l'activité "${activity.name}" ?`,
    message: "Cette suppression est définitive. Pour une activité saisonnière, il vaut souvent mieux utiliser Masquer.",
    confirmLabel: "Supprimer",
    tone: "danger",
  });

  if (!confirmed) {
    return;
  }

  const { error } = await supabase.from("education_activities").delete().eq("id", activity.id);

  if (error) {
    showToast("Impossible de supprimer l'activité : " + error.message);
    return;
  }

  await loadEducationActivities();
}

function editEducationDateSlot(slot) {
  setEducationDateForm({
    id: slot.id,
    activity_id: slot.activity_id,
    activity_date: slot.activity_date,
    label: slot.label || "",
    capacity: slot.capacity || 10,
  });
}

async function saveEducationDateSlot(event) {
  event.preventDefault();

  if (!educationDateForm.activity_id || !educationDateForm.activity_date || Number(educationDateForm.capacity) < 1) {
    showToast("Choisis une activité, une date et une capacité valide.");
    return;
  }

  const payload = {
    activity_id: educationDateForm.activity_id,
    activity_date: educationDateForm.activity_date,
    label: educationDateForm.label.trim(),
    capacity: Number(educationDateForm.capacity),
    active: true,
    updated_at: new Date().toISOString(),
  };
  const query = educationDateForm.id
    ? supabase.from("education_activity_dates").update(payload).eq("id", educationDateForm.id)
    : supabase.from("education_activity_dates").insert(payload);
  const { error } = await query;

  if (error) {
    showToast("Impossible d'enregistrer cette date : " + error.message);
    return;
  }

  setEducationDateForm(emptyEducationDateForm);
  await loadEducationDateSlots();
}

async function toggleEducationDateSlotActive(slot) {
  const { error } = await supabase
    .from("education_activity_dates")
    .update({ active: !slot.active, updated_at: new Date().toISOString() })
    .eq("id", slot.id);

  if (error) {
    showToast("Impossible de modifier cette date : " + error.message);
    return;
  }

  await loadEducationDateSlots();
}

async function deleteEducationDateSlot(slot) {
  const confirmed = await requestConfirm({
    title: "Supprimer cette date ?",
    message: `Date du ${formatDeliveryDate(slot.activity_date)}.`,
    confirmLabel: "Supprimer",
    tone: "danger",
  });

  if (!confirmed) {
    return;
  }

  const { error } = await supabase.from("education_activity_dates").delete().eq("id", slot.id);

  if (error) {
    showToast("Impossible de supprimer cette date : " + error.message);
    return;
  }

  await loadEducationDateSlots();
}

function editKennelService(service) {
  setKennelServiceForm({
    id: service.id,
    name: service.name,
    description: service.description || "",
    price: service.price,
    unit_label: service.unit_label || "jour",
  });
}

async function saveKennelService(event) {
  event.preventDefault();

  const serviceName = kennelServiceForm.name.trim();
  const price = Number(kennelServiceForm.price || 0);

  if (!serviceName || Number.isNaN(price) || price < 0) {
    showToast("Renseigne au minimum un nom et un tarif valide.");
    return;
  }

  const serviceId =
    kennelServiceForm.id ||
    serviceName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const { error } = await supabase.from("kennel_services").upsert({
    id: serviceId,
    name: serviceName,
    description: kennelServiceForm.description.trim(),
    price,
    unit_label: kennelServiceForm.unit_label.trim() || "jour",
    active: true,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    showToast("Impossible d'enregistrer le tarif pension : " + error.message);
    return;
  }

  setKennelServiceForm(emptyKennelServiceForm);
  await loadKennelServices();
}

async function toggleKennelServiceActive(service) {
  const { error } = await supabase
    .from("kennel_services")
    .update({ active: !service.active, updated_at: new Date().toISOString() })
    .eq("id", service.id);

  if (error) {
    showToast("Impossible de modifier ce tarif pension : " + error.message);
    return;
  }

  await loadKennelServices();
}

async function deleteKennelService(service) {
  const confirmed = await requestConfirm({
    title: `Supprimer le tarif "${service.name}" ?`,
    message: "Cette suppression est définitive. Pour un tarif saisonnier, il vaut souvent mieux utiliser Masquer.",
    confirmLabel: "Supprimer",
    tone: "danger",
  });

  if (!confirmed) {
    return;
  }

  const { error } = await supabase.from("kennel_services").delete().eq("id", service.id);

  if (error) {
    showToast("Impossible de supprimer ce tarif pension : " + error.message);
    return;
  }

  await loadKennelServices();
}

async function enableAdminPushNotifications() {
  if (!currentUser || !isAdmin) {
    showToast("Connecte-toi avec le compte admin pour activer les notifications.");
    return;
  }

  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    showToast("Ce téléphone ou ce navigateur ne prend pas en charge les notifications push PWA.");
    return;
  }

  if (!vapidPublicKey) {
    showToast("Ajoute d'abord VITE_VAPID_PUBLIC_KEY dans la configuration Netlify.");
    return;
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    showToast("Les notifications n'ont pas été autorisées sur ce téléphone.");
    return;
  }

  setPushStatus("saving");

  try {
    const registration = await navigator.serviceWorker.ready;
    const existingSubscription = await registration.pushManager.getSubscription();

    const subscription =
      existingSubscription ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      }));
    const subscriptionJson = subscription.toJSON();

    const { error } = await supabase.from("admin_push_subscriptions").upsert(
      {
        user_id: currentUser.id,
        endpoint: subscription.endpoint,
        p256dh: subscriptionJson.keys?.p256dh,
        auth: subscriptionJson.keys?.auth,
        user_agent: window.navigator.userAgent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );

    if (error) {
      showToast(
        "Impossible d'activer les notifications : " +
          error.message +
          "\n\nApplique d'abord la migration Supabase admin_push_subscriptions."
      );
      setPushStatus("idle");
      return;
    }

    setPushStatus("enabled");
    await loadAdminPushSubscriptions();
    showToast("Notifications admin activées sur ce téléphone.");
  } catch (error) {
    console.warn("Activation push impossible.", error);
    setPushStatus("idle");
    showToast("Impossible d'activer les notifications sur ce téléphone.");
  }
}

async function enableClientPushNotifications() {
  if (!currentUser) {
    showToast("Connecte-toi pour activer les notifications de commande.");
    setScreen("login");
    return;
  }

  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    showToast("Ce téléphone ou ce navigateur ne prend pas en charge les notifications push PWA.");
    return;
  }

  if (!vapidPublicKey) {
    showToast("Ajoute d'abord VITE_VAPID_PUBLIC_KEY dans la configuration Netlify.");
    return;
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    showToast("Les notifications n'ont pas été autorisées sur ce téléphone.");
    return;
  }

  setClientPushStatus("saving");

  try {
    const registration = await navigator.serviceWorker.ready;
    const existingSubscription = await registration.pushManager.getSubscription();

    const subscription =
      existingSubscription ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      }));
    const subscriptionJson = subscription.toJSON();

    const { error } = await supabase.from("client_push_subscriptions").upsert(
      {
        user_id: currentUser.id,
        endpoint: subscription.endpoint,
        p256dh: subscriptionJson.keys?.p256dh,
        auth: subscriptionJson.keys?.auth,
        user_agent: window.navigator.userAgent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );

    if (error) {
      showToast(
        "Impossible d'activer les notifications : " +
          error.message +
          "\n\nApplique d'abord la migration Supabase client_push_subscriptions."
      );
      setClientPushStatus("idle");
      return;
    }

    setClientPushStatus("enabled");
    await loadClientPushSubscriptions();
    showToast("Notifications de commande activées sur ce téléphone.");
  } catch (error) {
    console.warn("Activation push client impossible.", error);
    setClientPushStatus("idle");
    showToast("Impossible d'activer les notifications sur ce téléphone.");
  }
}

async function notifyAdminsAboutOrder(order, showResult = false) {
  try {
    const { data, error } = await supabase.functions.invoke("send-admin-push", {
      body: order.id
        ? { orderId: order.id }
        : {
            title: "Nouvelle commande",
            body: `${order.client_name} - ${getOrderSummary(order)} - ${formatDeliveryDate(order.delivery_date)}`,
            url: "/",
          },
    });

    if (error) {
      throw error;
    }

    if (showResult) {
      showToast(
        `Test notification envoyé. Téléphones touchés : ${data?.sent ?? 0}/${data?.total ?? 0}` +
          (data?.failed ? `\nÉchecs : ${data.failed}` : "") +
          (data?.expired ? `\nAbonnements expirés nettoyés : ${data.expired}` : "")
      );
    }
  } catch (error) {
    console.warn("Notification admin non envoyée.", error);

    if (showResult) {
      showToast(
        "Notification non envoyée : " +
          (error.message || "erreur inconnue") +
          "\n\nVérifie que la fonction Supabase send-admin-push est bien déployée et que les secrets VAPID sont renseignés."
      );
    }
  }
}

async function testAdminPushNotification() {
  await notifyAdminsAboutOrder(
    {
      client_name: "Test admin",
      delivery_date: getLocalIsoDate(),
      items: [
        {
          name: "Notification test",
          quantity: 1,
          unit_label: "test",
          size_eggs: 0,
        },
      ],
    },
    true
  );
}

async function notifyClientAboutStatus(orderId, status) {
  try {
    const { data, error } = await supabase.functions.invoke("send-client-push", {
      body: {
        orderId,
        status,
      },
    });

    if (error) {
      throw error;
    }

    console.log("Notification client :", data);
  } catch (error) {
    console.warn("Notification client non envoyée.", error);
  }
}

async function updateStock() {

  const { data: stockRows, error: stockLoadError } =
    await supabase
      .from("stock")
      .select("id, eggs_available")
      .limit(1);

  if (
    stockLoadError ||
    !stockRows ||
    stockRows.length === 0
  ) {
    showToast("Impossible de charger le stock.");
    return;
  }

  const stockId = stockRows[0].id;

  const currentStock =
    stockRows[0].eggs_available;

  const newStock =
    currentStock + Number(stockInput);

  if (newStock < 0) {
    showToast("Le stock ne peut pas être négatif.");
    return;
  }

  const { error } = await supabase
    .from("stock")
    .update({
      eggs_available: newStock,
    })
    .eq("id", stockId);

  if (error) {
    showToast("Erreur mise à jour stock : " + error.message);
    return;
  }

  setStockEggs(newStock);

  setStockInput(0);

  await loadStock();

  showToast("Stock mis à jour !");
}
const todayIso = getLocalIsoDate();
const recentClientCutoffDate = new Date();
recentClientCutoffDate.setDate(recentClientCutoffDate.getDate() - 7);
const recentClientCutoffIso = getLocalIsoDate(recentClientCutoffDate);
const filteredOrdersBase =
  (adminFilter === "En cours"
    ? orders.filter(
        (o) =>
          o.status === "À préparer" ||
          o.status === "Prête"
      )
    : adminFilter === "Toutes"
    ? orders
    : orders.filter((o) => o.status === adminFilter))
      .filter((order) => (adminArchiveView === "archived" ? Boolean(order.archived_at) : !order.archived_at));

const filteredOrders = filteredOrdersBase
  .filter((order) => {
    if (adminOrderShortcut === "today") {
      return order.date === todayIso;
    }

    return true;
  })
  .filter((order) => {
    const search = adminSearch.trim().toLowerCase();

    if (!search) {
      return true;
    }

    return [order.client, order.email, order.date, order.address, order.comment, order.status]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search));
  })
  .sort((a, b) => {
    if (adminSort === "date-desc") {
      return String(b.date || "").localeCompare(String(a.date || ""));
    }

    if (adminSort === "client") {
      return String(a.client || "").localeCompare(String(b.client || ""));
    }

    if (adminSort === "eggs-desc") {
      return getOrderEggs(b) - getOrderEggs(a);
    }

    return String(a.date || "").localeCompare(String(b.date || ""));
  });

const adminStats = {
  totalOrders: orders.length,
  toPrepare: orders.filter((o) => o.status === "À préparer").length,
  ready: orders.filter((o) => o.status === "Prête").length,
  eggsSold: orders
    .filter((o) => o.status !== "Annulée")
    .reduce((sum, o) => sum + getOrderEggs(o), 0),
  revenue: orders
    .filter((o) => o.status !== "Annulée")
    .reduce((sum, o) => sum + getOrderRevenue(o), 0),
};

const filteredCustomerProfiles = customerProfiles
  .filter((profile) => {
    if (clientQuickFilter === "recent" && String(profile.created_at || "").slice(0, 10) < recentClientCutoffIso) {
      return false;
    }

    if (clientAccessFilter === "allowed" && !profile.can_order_eggs && !profile.is_admin) {
      return false;
    }

    if (clientAccessFilter === "blocked" && (profile.can_order_eggs || profile.is_admin)) {
      return false;
    }

    if (clientAccessFilter === "admin" && !profile.is_admin) {
      return false;
    }

    const search = clientSearch.trim().toLowerCase();

    if (!search) {
      return true;
    }

    return [
      profile.full_name,
      profile.email,
      profile.phone,
      profile.delivery_address,
      formatCreatedAtDateTime(profile.created_at),
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search));
  })
  .sort((a, b) => {
    if (clientSort === "created-asc") {
      return String(a.created_at || "").localeCompare(String(b.created_at || ""));
    }

    if (clientSort === "name") {
      return String(a.full_name || a.email || "").localeCompare(String(b.full_name || b.email || ""));
    }

    if (clientSort === "access") {
      return Number(b.can_order_eggs || b.is_admin) - Number(a.can_order_eggs || a.is_admin);
    }

    return String(b.created_at || "").localeCompare(String(a.created_at || ""));
  });

function getClientPushSubscriptions(profileId) {
  return clientPushSubscriptions.filter((subscription) => subscription.user_id === profileId);
}

function getClientPushSummary(profileId) {
  const clientSubscriptions = getClientPushSubscriptions(profileId);
  const adminSubscriptions = adminPushSubscriptions.filter((subscription) => subscription.user_id === profileId);
  const subscriptions = [...clientSubscriptions, ...adminSubscriptions].sort((a, b) =>
    String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || ""))
  );
  const latest = subscriptions[0];

  return {
    active: clientSubscriptions.length > 0,
    count: clientSubscriptions.length,
    totalCount: subscriptions.length,
    adminActive: adminSubscriptions.length > 0,
    adminCount: adminSubscriptions.length,
    clientCount: clientSubscriptions.length,
    updatedAt: latest?.updated_at || latest?.created_at || "",
    clientUpdatedAt: clientSubscriptions[0]?.updated_at || clientSubscriptions[0]?.created_at || "",
    adminUpdatedAt: adminSubscriptions[0]?.updated_at || adminSubscriptions[0]?.created_at || "",
  };
}

const selectedClientProfile = customerProfiles.find((profile) => profile.id === selectedClientProfileId) || null;
  const selectedClientEmail = String(selectedClientProfile?.email || "").trim().toLowerCase();
const selectedClientOrders = selectedClientEmail
  ? orders.filter((order) => String(order.email || "").trim().toLowerCase() === selectedClientEmail)
  : [];
const selectedClientEducationBookings = selectedClientEmail
  ? educationBookings.filter((booking) => String(booking.client_email || "").trim().toLowerCase() === selectedClientEmail)
  : [];
const selectedClientKennelBookings = selectedClientEmail
  ? kennelBookings.filter((booking) => String(booking.client_email || "").trim().toLowerCase() === selectedClientEmail)
  : [];
const selectedClientReminders = selectedClientProfile
  ? adminReminders.filter((reminder) => reminder.profile_id === selectedClientProfile.id)
  : [];
  const selectedClientStats = {
  orders: selectedClientOrders.length,
  eggs: selectedClientOrders.reduce((sum, order) => sum + getOrderEggs(order), 0),
  orderRevenue: selectedClientOrders.reduce((sum, order) => sum + getOrderRevenue(order), 0),
  education: selectedClientEducationBookings.length,
  kennel: selectedClientKennelBookings.length,
};
const selectedClientPhone = getSmsPhoneNumber(selectedClientProfile?.phone);
const selectedClientMessages = selectedClientProfile
  ? contactMessages.filter((message) => {
      const messageEmail = String(message.email || "").trim().toLowerCase();
      const messagePhone = getSmsPhoneNumber(message.phone);
      const messageName = String(message.full_name || "").trim().toLowerCase();
      const profileName = String(selectedClientProfile.full_name || "").trim().toLowerCase();

      return (
        (selectedClientEmail && messageEmail === selectedClientEmail) ||
        (selectedClientPhone && messagePhone === selectedClientPhone) ||
        (profileName && messageName === profileName)
      );
    })
  : [];
const selectedClientTimeline = selectedClientProfile
  ? [
      {
        id: `client-created-${selectedClientProfile.id}`,
        type: "Compte",
        date: selectedClientProfile.created_at,
        title: "Compte client créé",
        detail: [selectedClientProfile.email, selectedClientProfile.phone].filter(Boolean).join(" - ") || "Informations client enregistrées",
        tone: "account",
      },
      {
        id: `client-access-${selectedClientProfile.id}`,
        type: "Suivi",
        date: selectedClientProfile.updated_at || selectedClientProfile.created_at,
        title: selectedClientProfile.is_admin || selectedClientProfile.can_order_eggs ? "Accès œufs autorisé" : "Accès œufs à autoriser",
        detail: selectedClientProfile.is_admin ? "Compte administrateur" : "Statut actuel du compte client",
        tone: "change",
      },
      selectedClientProfile.internal_notes && {
        id: `client-note-${selectedClientProfile.id}`,
        type: "Note",
        date: selectedClientProfile.updated_at || selectedClientProfile.created_at,
        title: "Note interne",
        detail: selectedClientProfile.internal_notes,
        tone: "note",
      },
      ...selectedClientReminders.map((reminder) => ({
        id: `timeline-reminder-${reminder.id}`,
        type: "Rappel",
        date: reminder.due_date,
        title: reminder.title,
        detail: [reminder.status || "À faire", reminder.priority, reminder.notes].filter(Boolean).join(" - "),
        tone: "reminder",
      })),
      ...selectedClientOrders.map((order) => ({
        id: `timeline-order-${order.id}`,
        type: "Commande",
        date: order.date,
        title: `${getOrderSummary(order)} - ${order.status}`,
        detail: [order.address, `${getOrderRevenue(order).toFixed(2)} EUR`].filter(Boolean).join(" - "),
        tone: "order",
      })),
      ...selectedClientEducationBookings.map((booking) => ({
        id: `timeline-education-${booking.id}`,
        type: "Ferme",
        date: booking.booking_date,
        title: `${booking.activity_type || "Activité"} - ${booking.status || "Demandée"}`,
        detail: `${booking.participants} participant${Number(booking.participants || 0) > 1 ? "s" : ""} - ${getEducationBookingAmount(booking).toFixed(2)} EUR`,
        tone: "education",
      })),
      ...selectedClientKennelBookings.map((booking) => ({
        id: `timeline-kennel-${booking.id}`,
        type: "Pension",
        date: booking.start_date,
        title: `${booking.dog?.name || "Chien"} - ${booking.status || "Demandée"}`,
        detail: `${formatDeliveryDate(booking.start_date)} au ${formatDeliveryDate(booking.end_date)} - ${getKennelBookingAmount(booking).toFixed(2)} EUR`,
        tone: "kennel",
      })),
      ...selectedClientMessages.map((message) => ({
        id: `timeline-message-${message.id}`,
        type: "Message",
        date: message.created_at,
        title: message.subject || "Message client",
        detail: [message.status || "Nouveau", message.message].filter(Boolean).join(" - "),
        tone: "message",
      })),
    ]
      .filter(Boolean)
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
  : [];
const normalizedAdminGlobalSearch = adminGlobalSearch.trim().toLowerCase();
const adminGlobalSearchResults = normalizedAdminGlobalSearch
  ? [
  ...customerProfiles.map((profile) => ({
        id: `client-${profile.id}`,
        type: "Client",
        title: profile.full_name || profile.email || "Client",
        detail: [profile.email, profile.phone, profile.delivery_address].filter(Boolean).join(" - "),
        haystack: [profile.full_name, profile.email, profile.phone, profile.delivery_address, profile.internal_notes],
        action: () => {
          setAdminView("clients");
          setClientSearch(profile.full_name || profile.email || "");
          setSelectedClientProfileId(profile.id);
        },
      })),
      ...adminReminders.map((reminder) => {
        const profile = customerProfiles.find((item) => item.id === reminder.profile_id);

        return {
          id: `reminder-${reminder.id}`,
          type: "Rappel",
          title: reminder.title || "Rappel interne",
          detail: [formatDeliveryDate(reminder.due_date), profile?.full_name, reminder.status, reminder.priority].filter(Boolean).join(" - "),
          haystack: [
            reminder.title,
            reminder.notes,
            reminder.due_date,
            reminder.status,
            reminder.priority,
            profile?.full_name,
            profile?.email,
            profile?.phone,
          ],
          action: () => {
            setAdminView("clients");
            if (profile?.id) {
              setSelectedClientProfileId(profile.id);
              setClientSearch(profile.full_name || profile.email || "");
            }
          },
        };
      }),
      ...orders.map((order) => ({
        id: `order-${order.id}`,
        type: "Commande",
        title: `${order.client || "Client"} - ${formatDeliveryDate(order.date)}`,
        detail: [getOrderSummary(order), order.email, order.address, order.status].filter(Boolean).join(" - "),
        haystack: [
          order.client,
          order.email,
          order.address,
          order.comment,
          order.status,
          order.date,
          getOrderSummary(order),
        ],
        action: () => {
          setAdminView("eggs");
          setAdminArchiveView(order.archived_at ? "archived" : "active");
          setAdminFilter("Toutes");
          setAdminOrderShortcut("all");
          setAdminSearch(order.client || order.email || order.date || "");
        },
      })),
      ...educationBookings.map((booking) => ({
        id: `education-${booking.id}`,
        type: "Réservation ferme",
        title: `${booking.client_name || "Client"} - ${booking.activity_type || "Activité"}`,
        detail: [formatDeliveryDate(booking.booking_date), booking.client_email, booking.phone, booking.status].filter(Boolean).join(" - "),
        haystack: [
          booking.client_name,
          booking.client_email,
          booking.phone,
          booking.activity_type,
          booking.booking_date,
          booking.notes,
          booking.status,
        ],
        action: () => {
          setAdminView("education");
          setEducationReservationFilter("all");
        },
      })),
      ...kennelBookings.map((booking) => ({
        id: `kennel-${booking.id}`,
        type: "Réservation pension",
        title: `${booking.dog?.name || "Chien"} - ${booking.client_name || "Client"}`,
        detail: [
          `${formatDeliveryDate(booking.start_date)} au ${formatDeliveryDate(booking.end_date)}`,
          booking.phone,
          booking.status,
        ].filter(Boolean).join(" - "),
        haystack: [
          booking.client_name,
          booking.client_email,
          booking.client_address,
          booking.phone,
          booking.notes,
          booking.status,
          booking.start_date,
          booking.end_date,
          booking.dog?.name,
          booking.dog?.breed,
          booking.dog?.sex,
          booking.dog?.birth_year,
          booking.dog?.notes,
          booking.dog?.food_notes,
          booking.dog?.behavior_notes,
          booking.dog?.medical_notes,
          booking.dog?.emergency_contact_name,
          booking.dog?.emergency_contact_phone,
        ],
        action: () => {
          setAdminView("kennel");
          setKennelReservationFilter("all");
        },
      })),
    ]
      .filter((result) =>
        result.haystack
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedAdminGlobalSearch))
      )
      .slice(0, 12)
  : [];

function getFilteredReservationBookings(bookings, filter, dateField = "booking_date") {
  return bookings
    .filter((booking) => (adminArchiveView === "archived" ? Boolean(booking.archived_at) : !booking.archived_at))
    .filter((booking) => {
      const status = booking.status || "Demandée";

      if (filter === "pending") {
        return status === "Demandée";
      }

      if (filter === "active") {
        return !["Terminée", "Annulée"].includes(status);
      }

      if (filter === "confirmed") {
        return status === "Confirmée";
      }

      if (filter === "today") {
        return String(booking[dateField] || "") === todayIso || String(booking.end_date || "") === todayIso;
      }

      return true;
    })
    .sort((a, b) => String(a[dateField] || "").localeCompare(String(b[dateField] || "")));
}

const activeEducationActivities = educationActivities.filter((activity) => activity.active);
const selectedEducationActivity =
  activeEducationActivities.find((activity) => activity.id === educationBookingForm.activityId) ||
  activeEducationActivities[0] ||
  null;
const isBirthdayEducationActivity =
  selectedEducationActivity?.id === "birthday-group" ||
  /anniversaire/i.test(selectedEducationActivity?.name || "");
const selectedEducationDetail =
  activeEducationActivities.find((activity) => activity.id === selectedEducationDetailId) ||
  activeEducationActivities[0] ||
  null;
const selectedEducationGallery = selectedEducationDetail
  ? [
      selectedEducationDetail.image_url,
      ...parseGalleryImages(selectedEducationDetail.gallery_images),
    ].filter(Boolean)
  : [];
const kennelGalleryImages = [
  kennelContent.image_url,
  ...parseGalleryImages(kennelContent.gallery_images),
].filter(Boolean);
const availableEducationDateSlots = educationDateSlots
  .filter((slot) => {
    return (
      slot.active !== false &&
      slot.activity_id === selectedEducationActivity?.id &&
      String(slot.activity_date || "") >= getLocalIsoDate()
    );
  })
  .map((slot) => ({
    ...slot,
    remaining: getEducationSlotRemaining(slot),
  }));
const educationSlotsByDate = availableEducationDateSlots.reduce((days, slot) => {
  const date = slot.activity_date || "";
  const slots = days.get(date) || [];
  slots.push(slot);
  days.set(date, slots);
  return days;
}, new Map());
const educationCalendarDays = getCalendarGridDates(educationCalendarMonth).map((day) => {
  const slots = educationSlotsByDate.get(day.date) || [];
  const remaining = slots.reduce((sum, slot) => sum + Math.max(0, slot.remaining || 0), 0);

  return {
    ...day,
    slots,
    remaining,
    available: slots.some((slot) => slot.remaining > 0),
  };
});
const clientAccountEmail = String(currentUser?.email || "").trim().toLowerCase();
const clientAccountProfile = clientAccountEmail
  ? customerProfiles.find((profile) => String(profile.email || "").trim().toLowerCase() === clientAccountEmail)
  : null;
const clientAccountEducationBookings = clientAccountEmail
  ? educationBookings
      .filter((booking) => String(booking.client_email || "").trim().toLowerCase() === clientAccountEmail)
      .sort((a, b) => String(b.booking_date || "").localeCompare(String(a.booking_date || "")))
  : [];
const clientAccountKennelBookings = clientAccountEmail
  ? kennelBookings
      .filter((booking) => String(booking.client_email || "").trim().toLowerCase() === clientAccountEmail)
      .sort((a, b) => String(b.start_date || "").localeCompare(String(a.start_date || "")))
  : [];
const clientAccountDogs = Object.values(
  clientAccountKennelBookings.reduce((dogs, booking) => {
    const key = booking.dog?.id || booking.dog?.name || booking.id;
    const current = dogs[key] || {
      dog: booking.dog || { name: booking.dog?.name || "Chien" },
      bookings: [],
    };

    current.bookings.push(booking);
    dogs[key] = current;
    return dogs;
  }, {})
);
const latestClientOrder = myOrders[0] || null;
const latestClientOrderStatus = latestClientOrder
  ? normalizeOrderStatus(latestClientOrder.status || "À préparer")
  : "";
const clientNotificationLabel = clientPushStatus === "enabled" ? "Notifications actives" : "Notifications à activer";
const kennelCalendarDays = (() => {
  const days = [];

  getCalendarGridDates(kennelCalendarMonth).forEach((day) => {
    const bookingsForNight = kennelBookings.filter((booking) => {
      if (String(booking.status || "").toLowerCase().startsWith("annul")) {
        return false;
      }

      return getKennelNights(booking.start_date, booking.end_date).includes(day.date);
    });
    const blockedDate = getBlockedKennelDate(day.date);

    days.push({
      ...day,
      bookings: bookingsForNight,
      blockedDate,
    });
  });

  return days;
})();
const clientKennelCalendarDays = getCalendarGridDates(clientKennelCalendarMonth).map((day) => {
  const availabilityForNight = kennelAvailability.find((availability) => availability.night_date === day.date);
  const bookingsCount =
    Number(availabilityForNight?.bookings_count ?? availabilityForNight?.bookingsCount ?? 0) ||
    kennelBookings.filter((booking) => {
      if (String(booking.status || "").toLowerCase().startsWith("annul")) {
        return false;
      }

      return getKennelNights(booking.start_date, booking.end_date).includes(day.date);
    }).length;
  const blockedDate = getBlockedKennelDate(day.date);
  const remainingSpots = Math.max(0, KENNEL_MAX_BOOKINGS_PER_NIGHT - bookingsCount);
  const isFull = bookingsCount >= KENNEL_MAX_BOOKINGS_PER_NIGHT;
  const isNearlyFull = !isFull && remainingSpots <= 1;

  return {
    ...day,
    bookingsCount,
    blockedDate,
    remainingSpots,
    isFull,
    isNearlyFull,
    available:
      day.date >= getLocalIsoDate() &&
      !blockedDate &&
      !isFull,
  };
});

function selectEducationCalendarDay(day) {
  if (!day.available) {
    return;
  }

  const slot = day.slots.find((item) => item.remaining > 0);

  if (!slot) {
    return;
  }

  setEducationBookingForm({
    ...educationBookingForm,
    activityId: slot.activity_id,
    dateSlotId: slot.id,
  });
}

function selectKennelCalendarDay(day) {
  if (!day.available) {
    return;
  }

  const currentStartDate = kennelBookingForm.startDate;

  if (!currentStartDate || day.date <= currentStartDate || kennelBookingForm.endDate) {
    setKennelBookingForm({
      ...kennelBookingForm,
      startDate: day.date,
      endDate: "",
    });
    return;
  }

  setKennelBookingForm({
    ...kennelBookingForm,
    endDate: day.date,
  });
}

const deliveryPlanning = (() => {
  const days = new Map();

  orders
    .filter((order) => order.status !== "Annulée")
    .filter((order) => !order.archived_at)
    .forEach((order) => {
      const date = order.date || "Sans date";

      if (!days.has(date)) {
        days.set(date, {
          date,
          orders: [],
          eggs: 0,
          revenue: 0,
          products: new Map(),
        });
      }

      const day = days.get(date);

      day.orders.push(order);
      day.eggs += getOrderEggs(order);
      day.revenue += getOrderRevenue(order);

      getOrderItems(order).forEach((item) => {
        const key = `${item.name}-${item.unit_label || ""}`;
        const current = day.products.get(key) || {
          name: item.name,
          unitLabel: item.unit_label || "piece",
          quantity: 0,
        };

        current.quantity += item.quantity;
        day.products.set(key, current);
      });
    });

  return Array.from(days.values())
    .map((day) => ({
      ...day,
      products: Array.from(day.products.values()),
      orders: day.orders.sort((a, b) =>
        `${a.client || ""} ${a.address || ""}`.localeCompare(`${b.client || ""} ${b.address || ""}`)
      ),
    }))
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
})();

const selectedPlanningDay =
  deliveryPlanning.find((day) => day.date === routeDate) || deliveryPlanning[0] || null;

const upcomingDeliveryDay =
  deliveryPlanning.find((day) => day.date !== "Sans date" && String(day.date || "") >= todayIso) ||
  deliveryPlanning[0] ||
  null;
const pendingEducationBookings = educationBookings
  .filter((booking) => !booking.archived_at && !["Terminée", "Annulée"].includes(booking.status || ""))
  .sort((a, b) => String(a.booking_date || "").localeCompare(String(b.booking_date || "")));
const upcomingEducationSlot = educationDateSlots
  .filter((slot) => slot.active !== false && String(slot.activity_date || "") >= todayIso)
  .sort((a, b) => String(a.activity_date || "").localeCompare(String(b.activity_date || "")))[0];
const pendingKennelBookings = kennelBookings
  .filter((booking) => !booking.archived_at && !["Terminée", "Annulée"].includes(booking.status || ""))
  .sort((a, b) => String(a.start_date || "").localeCompare(String(b.start_date || "")));
const filteredEducationBookings = getFilteredReservationBookings(
  educationBookings,
  educationReservationFilter,
  "booking_date"
);
const filteredKennelBookings = getFilteredReservationBookings(
  kennelBookings,
  kennelReservationFilter,
  "start_date"
);
const todayOrdersCount = orders.filter((order) => !order.archived_at && order.date === todayIso).length;
const todayOrders = orders
  .filter((order) => !order.archived_at && order.date === todayIso && order.status !== "Annulée")
  .sort((a, b) => `${a.client || ""} ${a.address || ""}`.localeCompare(`${b.client || ""} ${b.address || ""}`));
const todayEducationBookings = educationBookings
  .filter(
    (booking) =>
      !booking.archived_at &&
      String(booking.booking_date || "") === todayIso &&
      !["Annulée", "Terminée"].includes(booking.status || "")
  )
  .sort((a, b) => String(a.activity_type || "").localeCompare(String(b.activity_type || "")));
const activeContactMessages = contactMessages.filter((message) => !message.archived_at);
const archivedContactMessages = contactMessages.filter((message) => Boolean(message.archived_at));
const visibleContactMessages =
  contactMessageArchiveView === "archived" ? archivedContactMessages : activeContactMessages;
const urgentContactMessages = activeContactMessages
  .filter((message) => !["Traité", "Traitee", "Traité"].includes(message.status || "Nouveau"))
  .slice(0, 6);
const pendingEducationRequestsCount = educationBookings.filter(
  (booking) => !booking.archived_at && (booking.status || "Demandée") === "Demandée"
).length;
const pendingKennelRequestsCount = kennelBookings.filter(
  (booking) => !booking.archived_at && (booking.status || "Demandée") === "Demandée"
).length;
const pendingReservationsCount = pendingEducationRequestsCount + pendingKennelRequestsCount;
const recentClientsCount = customerProfiles.filter(
  (profile) => String(profile.created_at || "").slice(0, 10) >= recentClientCutoffIso
).length;
const monthlySalesStats = (() => {
  const months = new Map();

  orders
    .filter((order) => !order.archived_at && order.status !== "Annulée" && order.date)
    .forEach((order) => {
      const month = String(order.date).slice(0, 7);
      const current = months.get(month) || { month, orders: 0, eggs: 0, revenue: 0 };

      current.orders += 1;
      current.eggs += getOrderEggs(order);
      current.revenue += getOrderRevenue(order);
      months.set(month, current);
    });

  return Array.from(months.values()).sort((a, b) => b.month.localeCompare(a.month)).slice(0, 6);
})();
const topEducationActivities = (() => {
  const activities = new Map();

  educationBookings
    .filter((booking) => !booking.archived_at && booking.status !== "Annulée")
    .forEach((booking) => {
      const name = booking.activity_type || "Activité";
      const current = activities.get(name) || { name, bookings: 0, participants: 0 };

      current.bookings += 1;
      current.participants += Number(booking.participants || 0);
      activities.set(name, current);
    });

  return Array.from(activities.values())
    .sort((a, b) => b.bookings - a.bookings || b.participants - a.participants)
    .slice(0, 5);
})();
const kennelOccupancyStats = (() => {
  const month = getLocalIsoDate().slice(0, 7);
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  let occupiedNights = 0;

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const bookingsForNight = kennelBookings.filter((booking) => {
      if (booking.archived_at || String(booking.status || "").toLowerCase().startsWith("annul")) {
        return false;
      }

      return getKennelNights(booking.start_date, booking.end_date).includes(date);
    });

    occupiedNights += bookingsForNight.length;
  }

  const capacityNights = daysInMonth * KENNEL_MAX_BOOKINGS_PER_NIGHT;
  const occupancyRate = capacityNights > 0 ? Math.round((occupiedNights / capacityNights) * 100) : 0;

  return {
    month,
    occupiedNights,
    capacityNights,
    occupancyRate,
  };
})();
const activeClientStats = (() => {
  const activeEmails = new Set();
  const recentLimit = new Date();

  recentLimit.setDate(recentLimit.getDate() - 90);
  const recentLimitIso = getLocalIsoDate(recentLimit);

  orders
    .filter((order) => !order.archived_at && order.date >= recentLimitIso && order.email)
    .forEach((order) => activeEmails.add(String(order.email).toLowerCase()));
  educationBookings
    .filter((booking) => !booking.archived_at && String(booking.booking_date || "") >= recentLimitIso && booking.client_email)
    .forEach((booking) => activeEmails.add(String(booking.client_email).toLowerCase()));
  kennelBookings
    .filter((booking) => !booking.archived_at && String(booking.start_date || "") >= recentLimitIso && booking.client_email)
    .forEach((booking) => activeEmails.add(String(booking.client_email).toLowerCase()));

  return {
    total: customerProfiles.length,
    active90Days: activeEmails.size,
    eggAccess: customerProfiles.filter((profile) => profile.can_order_eggs || profile.is_admin).length,
    recent: recentClientsCount,
  };
})();

function applyAdminShortcut(shortcut) {
  if (shortcut === "todayOrders") {
    setAdminView("eggs");
    setAdminFilter("Toutes");
    setAdminOrderShortcut("today");
    setAdminSort("date-asc");
    setAdminSearch("");
    return;
  }

  if (shortcut === "toPrepare") {
    setAdminView("eggs");
    setAdminFilter("À préparer");
    setAdminOrderShortcut("all");
    setAdminSort("date-asc");
    setAdminSearch("");
    return;
  }

  if (shortcut === "pendingReservations") {
    setEducationReservationFilter("pending");
    setKennelReservationFilter("pending");
    setAdminArchiveView("active");
    setAdminView(pendingEducationRequestsCount > 0 || pendingKennelRequestsCount === 0 ? "education" : "kennel");
    return;
  }

  if (shortcut === "recentClients") {
    setAdminView("clients");
    setClientQuickFilter("recent");
    setClientAccessFilter("all");
    setClientSort("created-desc");
    setClientSearch("");
  }
}

const currentKennelGuests = kennelBookings.filter((booking) => {
  if (booking.archived_at) {
    return false;
  }

  if (String(booking.status || "").toLowerCase().startsWith("annul")) {
    return false;
  }

  return String(booking.start_date || "") <= todayIso && String(booking.end_date || "") > todayIso;
});
const activeKennelBookings = kennelBookings.filter((booking) => {
  if (booking.archived_at) {
    return false;
  }

  return !String(booking.status || "").toLowerCase().startsWith("annul");
});
const todayKennelArrivals = activeKennelBookings
  .filter((booking) => String(booking.start_date || "") === todayIso)
  .sort((a, b) => String(a.dog?.name || a.client_name || "").localeCompare(String(b.dog?.name || b.client_name || "")));
const todayKennelDepartures = activeKennelBookings
  .filter((booking) => String(booking.end_date || "") === todayIso)
  .sort((a, b) => String(a.dog?.name || a.client_name || "").localeCompare(String(b.dog?.name || b.client_name || "")));
const kennelDogProfiles = Object.values(
  kennelBookings.reduce((dogs, booking) => {
    const dogId = booking.dog?.id || `missing-${booking.id}`;
    const current = dogs[dogId] || {
      id: dogId,
      dog: booking.dog || null,
      bookings: [],
      clients: new Map(),
      phones: new Set(),
    };

    current.bookings.push(booking);
    if (booking.client_name) {
      current.clients.set(booking.client_name, booking.client_email || "");
    }
    if (booking.phone) {
      current.phones.add(booking.phone);
    }
    dogs[dogId] = current;
    return dogs;
  }, {})
)
  .map((profile) => ({
    ...profile,
    bookings: profile.bookings.sort((a, b) => String(b.start_date || "").localeCompare(String(a.start_date || ""))),
    clientsList: Array.from(profile.clients.entries()).map(([clientName, email]) => ({ clientName, email })),
    phonesList: Array.from(profile.phones),
  }))
  .sort((a, b) => String(a.dog?.name || "").localeCompare(String(b.dog?.name || "")));
const fullKennelNights = kennelCalendarDays
  .filter((day) => day.date >= todayIso && day.bookings.length >= KENNEL_MAX_BOOKINGS_PER_NIGHT)
  .slice(0, 3);
const kennelNearlyFullNights = kennelCalendarDays
  .filter(
    (day) =>
      day.date >= todayIso &&
      !day.blockedDate &&
      day.bookings.length >= Math.max(1, KENNEL_MAX_BOOKINGS_PER_NIGHT - 1)
  )
  .slice(0, 5);
const ordersMissingAddress = orders
  .filter((order) => !order.archived_at && order.status !== "Annulée" && !String(order.address || "").trim())
  .slice(0, 5);
const openEducationBookings = educationBookings.filter(
  (booking) => !booking.archived_at && !String(booking.status || "").toLowerCase().startsWith("annul")
);
const openKennelBookings = activeKennelBookings.filter((booking) => String(booking.end_date || "") >= todayIso);
const reservationsMissingPhone = [
  ...openEducationBookings
    .filter((booking) => !String(booking.phone || "").trim())
    .map((booking) => ({
      id: `education-phone-${booking.id}`,
      type: "Ferme",
      client: booking.client_name || "Client",
      date: booking.booking_date,
    })),
  ...openKennelBookings
    .filter((booking) => !String(booking.phone || "").trim())
    .map((booking) => ({
      id: `kennel-phone-${booking.id}`,
      type: "Pension",
      client: booking.client_name || "Client",
      date: booking.start_date,
    })),
].slice(0, 6);
const dogsMissingVaccines = Object.values(
  openKennelBookings.reduce((dogs, booking) => {
    if (booking.dog?.vaccines_up_to_date === true) {
      return dogs;
    }

    const key = booking.dog?.id || `${booking.client_email || booking.client_name || "client"}-${booking.dog?.name || booking.id}`;
    dogs[key] = dogs[key] || {
      id: key,
      name: booking.dog?.name || "Chien non renseigné",
      client: booking.client_name || "Client",
      date: booking.start_date,
    };
    return dogs;
  }, {})
).slice(0, 6);
const educationBookingsMissingPayment = openEducationBookings
  .filter((booking) => hasMissingBookingPayment(booking, getEducationBookingAmount(booking)))
  .slice(0, 6);
const kennelBookingsMissingPayment = openKennelBookings
  .filter((booking) => hasMissingBookingPayment(booking, getKennelBookingAmount(booking)))
  .slice(0, 6);
const bookingsMissingPayment = [
  ...educationBookingsMissingPayment.map((booking) => ({
    id: `education-payment-${booking.id}`,
    type: "Ferme",
    client: booking.client_name || "Client",
    amount: getEducationBookingAmount(booking),
  })),
  ...kennelBookingsMissingPayment.map((booking) => ({
    id: `kennel-payment-${booking.id}`,
    type: "Pension",
    client: booking.client_name || "Client",
    amount: getKennelBookingAmount(booking),
  })),
].slice(0, 6);
const dueAdminReminders = adminReminders
  .filter((reminder) => (reminder.status || "À faire") !== "Fait" && String(reminder.due_date || "") <= todayIso)
  .sort((a, b) => String(a.due_date || "").localeCompare(String(b.due_date || "")))
  .slice(0, 6);
const importantAdminAlerts = [
  dueAdminReminders.length > 0 && {
    id: "due-admin-reminders",
    tone: dueAdminReminders.some((reminder) => reminder.priority === "Urgent") ? "danger" : "warning",
    priorityLabel: dueAdminReminders.some((reminder) => reminder.priority === "Urgent") ? "Rouge" : "Orange",
    title: "Rappel interne à faire",
    detail: `${dueAdminReminders.length} rappel${dueAdminReminders.length > 1 ? "s" : ""} à traiter, dont "${dueAdminReminders[0].title}" pour le ${formatDeliveryDate(dueAdminReminders[0].due_date)}.`,
    actionLabel: "Voir les rappels",
    action: () => setAdminView("clients"),
  },
  kennelNearlyFullNights.length > 0 && {
    id: "kennel-nearly-full",
    tone: "warning",
    priorityLabel: "Orange",
    title: "Pension bientôt complète",
    detail: `${kennelNearlyFullNights.length} nuit${kennelNearlyFullNights.length > 1 ? "s" : ""} à ${KENNEL_MAX_BOOKINGS_PER_NIGHT - 1}/${KENNEL_MAX_BOOKINGS_PER_NIGHT} ou complète, première le ${formatDeliveryDate(kennelNearlyFullNights[0].date)}.`,
    actionLabel: "Voir la pension",
    action: () => setAdminView("kennelDogs"),
  },
  ordersMissingAddress.length > 0 && {
    id: "orders-missing-address",
    tone: "danger",
    priorityLabel: "Rouge",
    title: "Commande sans adresse",
    detail: `${ordersMissingAddress.length} commande${ordersMissingAddress.length > 1 ? "s" : ""} à compléter, dont ${ordersMissingAddress[0].client}.`,
    actionLabel: "Voir les commandes",
    action: () => {
      setAdminView("eggs");
      setAdminFilter("Toutes");
      setAdminOrderShortcut("all");
      setAdminSearch(ordersMissingAddress[0].client || "");
    },
  },
  dogsMissingVaccines.length > 0 && {
    id: "dogs-missing-vaccines",
    tone: "warning",
    priorityLabel: "Orange",
    title: "Vaccins chien à vérifier",
    detail: `${dogsMissingVaccines.length} chien${dogsMissingVaccines.length > 1 ? "s" : ""} sans vaccin indiqué à jour, dont ${dogsMissingVaccines[0].name}.`,
    actionLabel: "Voir les chiens",
    action: () => setAdminView("kennel"),
  },
  reservationsMissingPhone.length > 0 && {
    id: "reservations-missing-phone",
    tone: "danger",
    priorityLabel: "Rouge",
    title: "Réservation sans téléphone",
    detail: `${reservationsMissingPhone.length} réservation${reservationsMissingPhone.length > 1 ? "s" : ""} sans téléphone, dont ${reservationsMissingPhone[0].type} - ${reservationsMissingPhone[0].client}.`,
    actionLabel: "Voir les réservations",
    action: () => setAdminView(reservationsMissingPhone[0].type === "Ferme" ? "education" : "kennel"),
  },
  bookingsMissingPayment.length > 0 && {
    id: "missing-payments",
    tone: "danger",
    priorityLabel: "Rouge",
    title: "Paiement manquant",
    detail: `${bookingsMissingPayment.length} réservation${bookingsMissingPayment.length > 1 ? "s" : ""} avec un reste à payer, dont ${bookingsMissingPayment[0].type} - ${bookingsMissingPayment[0].client} (${bookingsMissingPayment[0].amount.toFixed(2)} EUR).`,
    actionLabel: "Voir les paiements",
    action: () => setAdminView(bookingsMissingPayment[0].type === "Ferme" ? "education" : "kennel"),
  },
  urgentContactMessages.length > 0 && {
    id: "unhandled-messages",
    tone: "info",
    priorityLabel: "Info",
    title: "Message client non traité",
    detail: `${urgentContactMessages.length} message${urgentContactMessages.length > 1 ? "s" : ""} en attente, dernier de ${urgentContactMessages[0].full_name || "Client"}.`,
    actionLabel: "Voir les messages",
    action: () => setAdminView("contacts"),
  },
].filter(Boolean);
const adminAlertCounts = importantAdminAlerts.reduce(
  (counts, alert) => ({
    ...counts,
    [alert.tone]: (counts[alert.tone] || 0) + 1,
    total: counts.total + 1,
  }),
  { danger: 0, warning: 0, info: 0, total: 0 }
);
const adminUrgentAlertCount = adminAlertCounts.danger + adminAlertCounts.warning;
const adminAlertBadgeTone = adminAlertCounts.danger > 0 ? "danger" : adminAlertCounts.warning > 0 ? "warning" : "info";
const adminTodoItems = [
  ...importantAdminAlerts.map((alert) => ({
    ...alert,
    source: "Alerte",
  })),
  adminStats.toPrepare > 0 && {
    id: "todo-orders-to-prepare",
    tone: "warning",
    priorityLabel: "Orange",
    source: "Commandes",
    title: "Commandes à préparer",
    detail: `${adminStats.toPrepare} commande${adminStats.toPrepare > 1 ? "s" : ""} encore à préparer.`,
    actionLabel: "Préparer",
    action: () => applyAdminShortcut("toPrepare"),
  },
  todayOrders.length > 0 && {
    id: "todo-today-orders",
    tone: "info",
    priorityLabel: "Info",
    source: "Aujourd'hui",
    title: "Commandes du jour",
    detail: `${todayOrders.length} commande${todayOrders.length > 1 ? "s" : ""} prévue${todayOrders.length > 1 ? "s" : ""} aujourd'hui.`,
    actionLabel: "Voir",
    action: () => applyAdminShortcut("todayOrders"),
  },
  todayEducationBookings.length > 0 && {
    id: "todo-today-education",
    tone: "info",
    priorityLabel: "Info",
    source: "Ferme pédagogique",
    title: "Réservation ferme aujourd'hui",
    detail: `${todayEducationBookings.length} réservation${todayEducationBookings.length > 1 ? "s" : ""} prévue${todayEducationBookings.length > 1 ? "s" : ""} aujourd'hui.`,
    actionLabel: "Voir",
    action: () => setAdminView("education"),
  },
  (todayKennelArrivals.length + todayKennelDepartures.length + currentKennelGuests.length) > 0 && {
    id: "todo-today-kennel",
    tone: todayKennelArrivals.length + todayKennelDepartures.length > 0 ? "warning" : "info",
    priorityLabel: todayKennelArrivals.length + todayKennelDepartures.length > 0 ? "Orange" : "Info",
    source: "Pension canine",
    title: "Mouvements pension",
    detail: `${todayKennelArrivals.length} arrivée${todayKennelArrivals.length > 1 ? "s" : ""}, ${todayKennelDepartures.length} départ${todayKennelDepartures.length > 1 ? "s" : ""}, ${currentKennelGuests.length} chien${currentKennelGuests.length > 1 ? "s" : ""} présent${currentKennelGuests.length > 1 ? "s" : ""}.`,
    actionLabel: "Planning",
    action: () => setAdminView("kennel"),
  },
].filter(Boolean).sort((a, b) => {
  const rank = { danger: 0, warning: 1, info: 2 };
  return (rank[a.tone] ?? 3) - (rank[b.tone] ?? 3);
}).slice(0, 9);
const configuredImageUrls = [
  aboutContent.image_url,
  ...parseGalleryImages(aboutContent.gallery_images),
  kennelContent.image_url,
  ...parseGalleryImages(kennelContent.gallery_images),
  homeFeaturedEvent.image_url,
  ...parseGalleryImages(homeFeaturedEvent.gallery_images),
  ...(homeNewsContent.items || []).map((item) => item.image_url),
]
  .map(normalizeImageUrl)
  .filter(Boolean);
const missingLibraryImages = configuredImageUrls
  .filter((imageUrl) => imageUrl.startsWith("/images/") && !imageOptions.includes(imageUrl))
  .filter((imageUrl, index, list) => list.indexOf(imageUrl) === index);
const usedImageSet = new Set(configuredImageUrls);
const filteredMediaImages = imageOptions.filter((imageUrl) => {
  const search = mediaSearch.trim().toLowerCase();

  if (!search) {
    return true;
  }

  return imageUrl.toLowerCase().includes(search) || getImageOptionLabel(imageUrl).toLowerCase().includes(search);
});
const unusedMediaImagesCount = imageOptions.filter((imageUrl) => !usedImageSet.has(imageUrl)).length;
const clientsMissingContactInfo = customerProfiles.filter(
  (profile) => !profile.is_admin && (!String(profile.phone || "").trim() || !String(profile.delivery_address || "").trim())
);
const lastAnnouncementWithIssue = announcementHistory.find(
  (announcement) =>
    Number(announcement.push_failed || 0) > 0 ||
    Number(announcement.email_failed || 0) > 0 ||
    Number(announcement.push_expired || 0) > 0 ||
    announcement.error_message
);
const activeNewsCount = (homeNewsContent.items || []).filter((item) => item.active !== false).length;
const healthChecks = [
  {
    id: "settings-contact",
    tone: appSettings.contact_email && appSettings.contact_phone && appSettings.site_url ? "success" : "warning",
    title: "Réglages de contact",
    detail:
      appSettings.contact_email && appSettings.contact_phone && appSettings.site_url
        ? "Email, téléphone et adresse du site sont renseignés."
        : "Complétez email, téléphone et adresse du site dans Réglages.",
    actionLabel: "Ouvrir réglages",
    action: () => setAdminView("settings"),
  },
  {
    id: "settings-google",
    tone: appSettings.google_review_url && appSettings.google_maps_url ? "success" : "warning",
    title: "Liens Google",
    detail:
      appSettings.google_review_url && appSettings.google_maps_url
        ? "Les liens avis Google et Google Maps sont prêts."
        : "Ajoutez les liens Google pour éviter les boutons vides côté client.",
    actionLabel: "Voir réglages",
    action: () => setAdminView("settings"),
  },
  {
    id: "images",
    tone: missingLibraryImages.length > 0 ? "danger" : configuredImageUrls.length > 0 ? "success" : "warning",
    title: "Photos de présentation",
    detail:
      missingLibraryImages.length > 0
        ? `${missingLibraryImages.length} photo${missingLibraryImages.length > 1 ? "s" : ""} utilisée${missingLibraryImages.length > 1 ? "s" : ""} mais absente${missingLibraryImages.length > 1 ? "s" : ""} de la bibliothèque.`
        : configuredImageUrls.length > 0
        ? "Les photos configurées correspondent à la bibliothèque connue."
        : "Aucune photo configurée dans présentation, pension, événement ou actualités.",
    actionLabel: "Voir présentation",
    action: () => setAdminView("content"),
  },
  {
    id: "tutorials",
    tone: TUTORIAL_GUIDES.length >= 3 && TUTORIAL_GUIDES.every((guide) => guide.pdfUrl) ? "success" : "warning",
    title: "Tutoriels clients",
    detail:
      TUTORIAL_GUIDES.length >= 3 && TUTORIAL_GUIDES.every((guide) => guide.pdfUrl)
        ? "Les 3 tutoriels sont bien configurés sur l'accueil."
        : "Un tutoriel ou un lien PDF manque dans la page d'accueil.",
    actionLabel: "Accueil",
    action: () => setScreen("home"),
  },
  {
    id: "announcements",
    tone: lastAnnouncementWithIssue ? "warning" : announcementHistory.length > 0 ? "success" : "info",
    title: "Annonces groupées",
    detail: lastAnnouncementWithIssue
      ? `Dernier point à vérifier : ${lastAnnouncementWithIssue.error_message || "échecs email/push détectés"}.`
      : announcementHistory.length > 0
      ? "Aucune erreur récente dans l'historique chargé."
      : "Aucune annonce groupée enregistrée pour le moment.",
    actionLabel: "Voir annonces",
    action: () => setAdminView("announcements"),
  },
  {
    id: "clients-contact",
    tone: clientsMissingContactInfo.length > 0 ? "danger" : customerProfiles.length > 0 ? "success" : "info",
    title: "Fiches clients",
    detail:
      clientsMissingContactInfo.length > 0
        ? `${clientsMissingContactInfo.length} client${clientsMissingContactInfo.length > 1 ? "s" : ""} sans téléphone ou adresse complète.`
        : customerProfiles.length > 0
        ? "Les clients chargés ont leurs coordonnées principales."
        : "Aucun client chargé pour le moment.",
    actionLabel: "Voir clients",
    action: () => setAdminView("clients"),
  },
  {
    id: "notifications",
    tone: clientPushSubscriptions.length > 0 ? "success" : "info",
    title: "Notifications clients",
    detail:
      clientPushSubscriptions.length > 0
        ? `${clientPushSubscriptions.length} abonnement${clientPushSubscriptions.length > 1 ? "s" : ""} notification client connu${clientPushSubscriptions.length > 1 ? "s" : ""}.`
        : "Aucun abonnement notification client chargé, utile à vérifier si vous envoyez des annonces.",
    actionLabel: "Voir clients",
    action: () => setAdminView("clients"),
  },
  {
    id: "news",
    tone: activeNewsCount > 0 ? "success" : "info",
    title: "Actualités accueil",
    detail:
      activeNewsCount > 0
        ? `${activeNewsCount} actualité${activeNewsCount > 1 ? "s" : ""} visible${activeNewsCount > 1 ? "s" : ""} sur l'accueil.`
        : "Aucune actualité active sur l'accueil.",
    actionLabel: "Voir actualités",
    action: () => setAdminView("news"),
  },
];
const healthCheckCounts = healthChecks.reduce(
  (counts, check) => ({
    ...counts,
    [check.tone]: (counts[check.tone] || 0) + 1,
    total: counts.total + 1,
  }),
  { danger: 0, warning: 0, info: 0, success: 0, total: 0 }
);
const healthIssueCount = healthCheckCounts.danger + healthCheckCounts.warning;
const adminAssistantTodayItems = [
  {
    id: "assistant-orders-today",
    title: "Commandes à préparer aujourd'hui",
    detail: `${todayOrders.length} commande${todayOrders.length > 1 ? "s" : ""}`,
    count: todayOrders.length,
    actionLabel: "Voir commandes",
    action: () => applyAdminShortcut("todayOrders"),
  },
  {
    id: "assistant-education-today",
    title: "Animations ferme du jour",
    detail: `${todayEducationBookings.length} réservation${todayEducationBookings.length > 1 ? "s" : ""}`,
    count: todayEducationBookings.length,
    actionLabel: "Voir ferme",
    action: () => setAdminView("education"),
  },
  {
    id: "assistant-kennel-arrivals",
    title: "Arrivées pension",
    detail: `${todayKennelArrivals.length} arrivée${todayKennelArrivals.length > 1 ? "s" : ""}`,
    count: todayKennelArrivals.length,
    actionLabel: "Voir pension",
    action: () => setAdminView("kennel"),
  },
  {
    id: "assistant-kennel-departures",
    title: "Départs pension",
    detail: `${todayKennelDepartures.length} départ${todayKennelDepartures.length > 1 ? "s" : ""}`,
    count: todayKennelDepartures.length,
    actionLabel: "Voir pension",
    action: () => setAdminView("kennel"),
  },
  {
    id: "assistant-current-dogs",
    title: "Chiens présents",
    detail: `${currentKennelGuests.length} chien${currentKennelGuests.length > 1 ? "s" : ""}`,
    count: currentKennelGuests.length,
    actionLabel: "Voir planning",
    action: () => setAdminView("kennel"),
  },
  {
    id: "assistant-messages",
    title: "Messages à traiter",
    detail: `${urgentContactMessages.length} message${urgentContactMessages.length > 1 ? "s" : ""}`,
    count: urgentContactMessages.length,
    actionLabel: "Voir messages",
    action: () => setAdminView("contacts"),
  },
];
const adminAssistantFollowups = [
  ...dueAdminReminders.map((reminder) => ({
    id: `assistant-reminder-${reminder.id}`,
    tone: reminder.priority === "Urgent" ? "danger" : "warning",
    title: reminder.title || "Rappel interne",
    detail: `${reminder.due_date ? formatDeliveryDate(reminder.due_date) : "Sans date"} - ${reminder.notes || "À traiter"}`,
    actionLabel: "Voir client",
    action: () => setAdminView("clients"),
  })),
  ...bookingsMissingPayment.map((booking) => ({
    id: `assistant-payment-${booking.id}`,
    tone: "danger",
    title: `Paiement manquant - ${booking.type}`,
    detail: `${booking.client} - ${booking.amount.toFixed(2)} EUR`,
    actionLabel: "Voir",
    action: () => setAdminView(booking.type === "Ferme" ? "education" : "kennel"),
  })),
  ...reservationsMissingPhone.map((booking) => ({
    id: `assistant-phone-${booking.id}`,
    tone: "danger",
    title: `Téléphone manquant - ${booking.type}`,
    detail: `${booking.client} - ${formatDeliveryDate(booking.date)}`,
    actionLabel: "Voir",
    action: () => setAdminView(booking.type === "Ferme" ? "education" : "kennel"),
  })),
  ...dogsMissingVaccines.map((dog) => ({
    id: `assistant-vaccine-${dog.id}`,
    tone: "warning",
    title: "Vaccins à vérifier",
    detail: `${dog.name} - ${dog.client}`,
    actionLabel: "Voir chiens",
    action: () => setAdminView("kennelDogs"),
  })),
  ...clientsMissingContactInfo.slice(0, 4).map((profile) => ({
    id: `assistant-client-${profile.id}`,
    tone: "warning",
    title: "Fiche client incomplète",
    detail: [profile.full_name || profile.email || "Client", !profile.phone ? "téléphone manquant" : "", !profile.delivery_address ? "adresse manquante" : ""].filter(Boolean).join(" - "),
    actionLabel: "Voir clients",
    action: () => {
      setClientSearch(profile.full_name || profile.email || "");
      setAdminView("clients");
    },
  })),
].slice(0, 10);
const upcomingKennelBlockedDates = kennelBlockedDates
  .filter((blockedDate) => String(blockedDate.blocked_date || "") >= todayIso)
  .slice(0, 8);

const eggSummaryPlanning = deliveryPlanning.filter((day) => {
  if (day.date === "Sans date") {
    return true;
  }

  return String(day.date || "") >= getLocalIsoDate();
});

const eggSummaryTotals = eggSummaryPlanning.reduce(
  (totals, day) => ({
    orders: totals.orders + day.orders.length,
    eggs: totals.eggs + day.eggs,
    boxes: totals.boxes + day.orders.reduce(
      (sum, order) => sum + getOrderItems(order).reduce(
        (count, item) => count + (item.size_eggs > 0 ? item.quantity : 0),
        0
      ),
      0
    ),
  }),
  { orders: 0, eggs: 0, boxes: 0 }
);

function getEducationBookingAmount(booking) {
  if (booking.amount_confirmed !== null && booking.amount_confirmed !== undefined && booking.amount_confirmed !== "") {
    return Number(booking.amount_confirmed || 0);
  }

  const activity = educationActivities.find((item) => item.name === booking.activity_type);
  return Number(activity?.price || 0) * Number(booking.participants || 0);
}

function getKennelBookingAmount(booking) {
  if (booking.amount_confirmed !== null && booking.amount_confirmed !== undefined && booking.amount_confirmed !== "") {
    return Number(booking.amount_confirmed || 0);
  }

  const nightlyService =
    kennelServices.find((service) => String(service.unit_label || "").toLowerCase().includes("nuit")) ||
    kennelServices.find((service) => service.id === "overnight") ||
    kennelServices[0];
  return getKennelNights(booking.start_date, booking.end_date).length * Number(nightlyService?.price || 0);
}

function getBookingPaymentSummary(booking, amount) {
  const deposit = Number(booking.deposit_amount || 0);
  const received = booking.payment_received === true;
  const paidAmount = received ? amount : Math.min(deposit, amount);
  const remaining = Math.max(0, amount - paidAmount);
  const method = booking.payment_method || "Non renseigné";

  return {
    deposit,
    received,
    paidAmount,
    remaining,
    method,
    label: received ? "Paiement reçu" : deposit > 0 ? "Acompte payé" : "Paiement à suivre",
    tone: received ? "paid" : deposit > 0 ? "partial" : "missing",
  };
}

function hasMissingBookingPayment(booking, amount) {
  const status = booking.status || "Demandée";

  if (booking.archived_at || status === "Annulée" || amount <= 0) {
    return false;
  }

  return booking.payment_received !== true;
}

function getKennelOperationalNotes(booking) {
  return [
    booking.client_address,
    booking.notes,
    booking.dog?.notes,
    booking.dog?.food_notes,
    booking.dog?.behavior_notes,
    booking.dog?.medical_notes,
  ].filter((note) => String(note || "").trim());
}

const accountingRows = [
  ...orders
    .filter((order) => order.status !== "Annulée")
    .map((order) => ({
      id: `eggs-${order.id}`,
      activity: "eggs",
      activityLabel: "Œufs",
      date: order.date,
      client: order.client,
      detail: getOrderSummary(order),
      amount: getOrderRevenue(order),
      amountSource: "Commande",
      paymentLabel: order.status === "Livrée" ? "Paiement reçu" : "À suivre",
      paymentMethod: "Non renseigné",
      paymentRemaining: order.status === "Livrée" ? 0 : getOrderRevenue(order),
      status: order.status,
    })),
  ...educationBookings
    .filter((booking) => booking.status !== "Annulée")
    .map((booking) => ({
      id: `education-${booking.id}`,
      activity: "education",
      activityLabel: "Ferme pédagogique",
      date: booking.booking_date,
      client: booking.client_name,
      detail: `${booking.activity_type} - ${booking.participants} participant${Number(booking.participants || 0) > 1 ? "s" : ""}`,
      amount: getEducationBookingAmount(booking),
      amountSource: booking.amount_confirmed !== null && booking.amount_confirmed !== undefined ? "Confirmé" : "Estimé",
      paymentLabel: getBookingPaymentSummary(booking, getEducationBookingAmount(booking)).label,
      paymentMethod: getBookingPaymentSummary(booking, getEducationBookingAmount(booking)).method,
      paymentRemaining: getBookingPaymentSummary(booking, getEducationBookingAmount(booking)).remaining,
      status: booking.status || "Demandée",
    })),
  ...kennelBookings
    .filter((booking) => booking.status !== "Annulée")
    .map((booking) => ({
      id: `kennel-${booking.id}`,
      activity: "kennel",
      activityLabel: "Pension canine",
      date: booking.start_date,
      client: booking.client_name,
      detail: `${booking.dog?.name || "Chien"} - ${getKennelNights(booking.start_date, booking.end_date).length} nuitée${getKennelNights(booking.start_date, booking.end_date).length > 1 ? "s" : ""}`,
      amount: getKennelBookingAmount(booking),
      amountSource: booking.amount_confirmed !== null && booking.amount_confirmed !== undefined ? "Confirmé" : "Estimé",
      paymentLabel: getBookingPaymentSummary(booking, getKennelBookingAmount(booking)).label,
      paymentMethod: getBookingPaymentSummary(booking, getKennelBookingAmount(booking)).method,
      paymentRemaining: getBookingPaymentSummary(booking, getKennelBookingAmount(booking)).remaining,
      status: booking.status || "Demandée",
    })),
]
  .filter((row) => {
    if (accountingActivity !== "all" && row.activity !== accountingActivity) {
      return false;
    }

    if (accountingStartDate && String(row.date || "") < accountingStartDate) {
      return false;
    }

    if (accountingEndDate && String(row.date || "") > accountingEndDate) {
      return false;
    }

    return true;
  })
  .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));

const accountingTotals = accountingRows.reduce(
  (totals, row) => ({
    ...totals,
    global: totals.global + row.amount,
    [row.activity]: totals[row.activity] + row.amount,
  }),
  { global: 0, eggs: 0, education: 0, kennel: 0 }
);

const trafficTodayIso = getLocalIsoDate();
const traffic7DaysAgo = new Date();
traffic7DaysAgo.setDate(traffic7DaysAgo.getDate() - 6);
const traffic7DaysAgoIso = traffic7DaysAgo.toISOString().slice(0, 10);

const trafficPageViews = trafficEvents.filter((event) => event.event_type === "page_view");
const trafficClicks = trafficEvents.filter((event) => event.event_type === "click");
const trafficTodayEvents = trafficEvents.filter((event) => String(event.created_at || "").slice(0, 10) === trafficTodayIso);
const traffic7DayEvents = trafficEvents.filter((event) => String(event.created_at || "").slice(0, 10) >= traffic7DaysAgoIso);
const trafficUniqueVisitorsToday = new Set(
  trafficTodayEvents.map((event) => event.visitor_id).filter(Boolean)
).size;
const trafficUniqueVisitors30Days = new Set(
  trafficEvents.map((event) => event.visitor_id).filter(Boolean)
).size;
const trafficPageRows = Object.values(
  trafficPageViews.reduce((pages, event) => {
    const key = event.page_key || "unknown";
    const current = pages[key] || {
      key,
      label: event.page_label || key,
      views: 0,
      visitors: new Set(),
      lastSeen: event.created_at,
    };

    current.views += 1;
    if (event.visitor_id) {
      current.visitors.add(event.visitor_id);
    }
    if (String(event.created_at || "") > String(current.lastSeen || "")) {
      current.lastSeen = event.created_at;
    }
    pages[key] = current;
    return pages;
  }, {})
)
  .map((page) => ({
    ...page,
    visitorsCount: page.visitors.size,
  }))
  .sort((a, b) => b.views - a.views);
const trafficClickRows = Object.values(
  trafficClicks.reduce((clicks, event) => {
    const key = `${event.page_key || "unknown"}-${event.metadata?.action || "click"}`;
    const current = clicks[key] || {
      key,
      label: event.metadata?.label || event.page_label || "Clic",
      pageLabel: event.page_label || event.page_key || "Page",
      clicks: 0,
    };

    current.clicks += 1;
    clicks[key] = current;
    return clicks;
  }, {})
).sort((a, b) => b.clicks - a.clicks);
const trafficDailyRows = Array.from({ length: 7 }, (_, index) => {
  const date = new Date();
  date.setDate(date.getDate() - index);
  const isoDate = date.toISOString().slice(0, 10);
  const dayEvents = trafficEvents.filter((event) => String(event.created_at || "").slice(0, 10) === isoDate);
  const dayPageViews = dayEvents.filter((event) => event.event_type === "page_view");
  const dayClicks = dayEvents.filter((event) => event.event_type === "click");
  const visitorsCount = new Set(dayEvents.map((event) => event.visitor_id).filter(Boolean)).size;
  const topPage = Object.values(
    dayPageViews.reduce((pages, event) => {
      const key = event.page_key || "unknown";
      const current = pages[key] || {
        key,
        label: event.page_label || key,
        views: 0,
      };

      current.views += 1;
      pages[key] = current;
      return pages;
    }, {})
  ).sort((a, b) => b.views - a.views)[0];

  return {
    date: isoDate,
    label: index === 0 ? "Aujourd'hui" : index === 1 ? "Hier" : formatDeliveryDate(isoDate),
    pageViews: dayPageViews.length,
    clicks: dayClicks.length,
    visitorsCount,
    topPage,
  };
});

const adminFilterOptions = [
  { label: "En cours", value: "En cours" },
  { label: "Toutes", value: "Toutes" },
  { label: "À préparer", value: "À préparer" },
  { label: "Prête", value: "Prête" },
  { label: "Livrée", value: "Livrée" },
  { label: "Annulée", value: "Annulée" },
];
const orderStatusOptions = [
  { label: "À préparer", value: "À préparer" },
  { label: "Prête", value: "Prête" },
  { label: "Livrée", value: "Livrée" },
  { label: "Annulée", value: "Annulée" },
];

function getOrderItems(order) {
  if (Array.isArray(order.items) && order.items.length > 0) {
    return order.items;
  }

  return [
    {
      product_id: "box6",
      name: "Boite de 6 œufs",
      quantity: order.box6 || 0,
      unit_label: "boite",
      size_eggs: 6,
    },
    {
      product_id: "box12",
      name: "Boite de 12 œufs",
      quantity: order.box12 || 0,
      unit_label: "boite",
      size_eggs: 12,
    },
  ].filter((item) => item.quantity > 0);
}

function getOrderEggs(order) {
  return getOrderItems(order).reduce(
    (sum, item) => sum + item.quantity * (item.size_eggs || 0),
    0
  );
}

function getOrderSummary(order) {
  const items = getOrderItems(order);

  if (items.length === 0) {
    return "Aucun produit";
  }

  return items
    .map((item) => `${item.quantity} x ${item.name}`)
    .join(" - ");
}

function getOrderRevenue(order) {
  if (Array.isArray(order.items) && order.items.length > 0) {
    return order.items.reduce(
      (sum, item) => sum + item.quantity * Number(item.price || 0),
      0
    );
  }

  const box6Price = products.find((product) => product.id === "box6")?.price || 0;
  const box12Price = products.find((product) => product.id === "box12")?.price || 0;

  return (order.box6 || 0) * box6Price + (order.box12 || 0) * box12Price;
}

function isEggProduct(product) {
  const normalizedName = String(product.name || "").toLowerCase().replaceAll("œ", "oe");

  return normalizedName.includes("oeuf");
}

function getProductUnitPriceLabel(product) {
  if (isEggProduct(product) && product.size_eggs > 0) {
    return `${(product.price / product.size_eggs).toFixed(2)} EUR / oeuf`;
  }

  return `${product.price.toFixed(2)} EUR / ${product.unit_label || "piece"}`;
}

function exportAdminCsv() {
  const headers = ["Client", "Email", "Date", "Adresse", "Commentaire", "Produits", "Total œufs", "Statut"];
  const rows = filteredOrders.map((order) => [
    order.client,
    order.email,
    order.date,
    order.address,
    order.comment,
    getOrderSummary(order),
    getOrderEggs(order),
    order.status,
  ]);
  downloadCsv(`commandes-poulettes-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}

function isDateInExportPeriod(dateValue) {
  const date = String(dateValue || "").slice(0, 10);

  if (!date) {
    return !accountingStartDate && !accountingEndDate;
  }

  if (accountingStartDate && date < accountingStartDate) {
    return false;
  }

  if (accountingEndDate && date > accountingEndDate) {
    return false;
  }

  return true;
}

function getExportRangeLabel() {
  return [accountingStartDate || "debut", accountingEndDate || "fin"].join("-");
}

function downloadCsv(filename, headers, rows) {
  const csv = [headers, ...rows]
    .map((row) =>
      row
        .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
        .join(";")
    )
    .join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportOrdersPeriodCsv() {
  const headers = ["Client", "Email", "Date", "Adresse", "Commentaire", "Produits", "Total œufs", "Montant EUR", "Statut", "Archive"];
  const rows = orders
    .filter((order) => isDateInExportPeriod(order.date))
    .map((order) => [
      order.client,
      order.email,
      order.date,
      order.address,
      order.comment,
      getOrderSummary(order),
      getOrderEggs(order),
      getOrderRevenue(order).toFixed(2),
      order.status,
      order.archived_at ? "Oui" : "Non",
    ]);

  downloadCsv(`commandes-poulettes-${getExportRangeLabel()}.csv`, headers, rows);
}

function exportEducationPeriodCsv() {
  const headers = ["Date", "Activité", "Client", "Email", "Téléphone", "Accompagnateur", "Participants", "Enfants", "Notes", "Montant EUR", "Acompte EUR", "Reste EUR", "Paiement reçu", "Moyen paiement", "Statut", "Archive"];
  const rows = educationBookings
    .filter((booking) => isDateInExportPeriod(booking.booking_date))
    .map((booking) => [
      booking.booking_date,
      booking.activity_type,
      booking.client_name,
      booking.client_email,
      booking.phone,
      booking.accompanist_name,
      booking.participants,
      Array.isArray(booking.children)
        ? booking.children.map((child) => `${child.firstName || child.first_name || "Enfant"} (${child.age || "âge non renseigné"})`).join(", ")
        : "",
      booking.notes,
      getEducationBookingAmount(booking).toFixed(2),
      getBookingPaymentSummary(booking, getEducationBookingAmount(booking)).deposit.toFixed(2),
      getBookingPaymentSummary(booking, getEducationBookingAmount(booking)).remaining.toFixed(2),
      booking.payment_received ? "Oui" : "Non",
      booking.payment_method || "Non renseigné",
      booking.status || "Demandée",
      booking.archived_at ? "Oui" : "Non",
    ]);

  downloadCsv(`reservations-ferme-pedagogique-${getExportRangeLabel()}.csv`, headers, rows);
}

function exportKennelPeriodCsv() {
  const headers = ["Arrivée", "Départ", "Client", "Email", "Téléphone", "Chien", "Race", "Sexe", "Année naissance", "Vaccins", "Stérilisé", "Notes", "Montant EUR", "Acompte EUR", "Reste EUR", "Paiement reçu", "Moyen paiement", "Statut", "Archive"];
  const rows = kennelBookings
    .filter((booking) => isDateInExportPeriod(booking.start_date))
    .map((booking) => [
      booking.start_date,
      booking.end_date,
      booking.client_name,
      booking.client_email,
      booking.phone,
      booking.dog?.name,
      booking.dog?.breed,
      booking.dog?.sex,
      booking.dog?.birth_year,
      booking.dog?.vaccines_up_to_date ? "Oui" : "Non",
      booking.dog?.sterilized ? "Oui" : "Non",
      booking.notes || booking.dog?.notes || "",
      getKennelBookingAmount(booking).toFixed(2),
      getBookingPaymentSummary(booking, getKennelBookingAmount(booking)).deposit.toFixed(2),
      getBookingPaymentSummary(booking, getKennelBookingAmount(booking)).remaining.toFixed(2),
      booking.payment_received ? "Oui" : "Non",
      booking.payment_method || "Non renseigné",
      booking.status || "Demandée",
      booking.archived_at ? "Oui" : "Non",
    ]);

  downloadCsv(`reservations-pension-canine-${getExportRangeLabel()}.csv`, headers, rows);
}

function exportClientsPeriodCsv() {
  const headers = ["Nom", "Email", "Téléphone", "Adresse", "Date inscription", "Admin", "Accès œufs", "Notes internes"];
  const rows = customerProfiles
    .filter((profile) => isDateInExportPeriod(profile.created_at))
    .map((profile) => [
      profile.full_name,
      profile.email,
      profile.phone,
      profile.delivery_address,
      formatCreatedAtDateTime(profile.created_at),
      profile.is_admin ? "Oui" : "Non",
      profile.can_order_eggs || profile.is_admin ? "Oui" : "Non",
      profile.internal_notes || "",
    ]);

  downloadCsv(`clients-poulettes-${getExportRangeLabel()}.csv`, headers, rows);
}

function exportAccountingCsv() {
  const headers = ["Date", "Activité", "Client", "Détail", "Montant EUR", "Type montant", "Paiement", "Reste EUR", "Moyen paiement", "Statut"];
  const rows = accountingRows.map((row) => [
    row.date,
    row.activityLabel,
    row.client,
    row.detail,
    row.amount.toFixed(2),
    row.amountSource,
    row.paymentLabel,
    row.paymentRemaining.toFixed(2),
    row.paymentMethod,
    row.status,
  ]);

  downloadCsv(`comptabilite-poulettes-${accountingActivity}-${getExportRangeLabel()}.csv`, headers, rows);
}

function exportAllDataBackup() {
  const exportDate = new Date().toISOString();
  const backup = {
    app: publicFarmName,
    generated_at: exportDate,
    totals: {
      clients: customerProfiles.length,
      commandes: orders.length,
      reservations_ferme: educationBookings.length,
      reservations_pension: kennelBookings.length,
      fiches_chiens: kennelDogProfiles.length,
      rappels_internes: adminReminders.length,
      lignes_comptables: accountingRows.length,
    },
    clients: customerProfiles.map((profile) => ({
      id: profile.id,
      nom: profile.full_name,
      email: profile.email,
      telephone: profile.phone,
      adresse: profile.delivery_address,
      date_inscription: profile.created_at,
      admin: profile.is_admin === true,
      acces_oeufs: profile.can_order_eggs === true || profile.is_admin === true,
      notes_internes: profile.internal_notes || "",
    })),
    commandes: orders.map((order) => ({
      id: order.id,
      client: order.client,
      email: order.email,
      date: order.date,
      adresse: order.address,
      commentaire: order.comment,
      produits: getOrderSummary(order),
      total_oeufs: getOrderEggs(order),
      montant_eur: getOrderRevenue(order),
      statut: order.status,
      archive: Boolean(order.archived_at),
      cree_le: order.created_at,
    })),
    rappels_internes: adminReminders.map((reminder) => ({
      id: reminder.id,
      titre: reminder.title,
      date: reminder.due_date,
      client_id: reminder.profile_id,
      priorite: reminder.priority,
      statut: reminder.status,
      notes: reminder.notes || "",
      fait_le: reminder.completed_at || "",
      cree_le: reminder.created_at,
    })),
    reservations_ferme: educationBookings.map((booking) => ({
      id: booking.id,
      date: booking.booking_date,
      activite: booking.activity_type,
      client: booking.client_name,
      email: booking.client_email,
      telephone: booking.phone,
      accompagnateur: booking.accompanist_name,
      participants: booking.participants,
      enfants: booking.children || [],
      notes: booking.notes,
      montant_eur: getEducationBookingAmount(booking),
      acompte_eur: getBookingPaymentSummary(booking, getEducationBookingAmount(booking)).deposit,
      reste_a_payer_eur: getBookingPaymentSummary(booking, getEducationBookingAmount(booking)).remaining,
      paiement_recu: booking.payment_received === true,
      moyen_paiement: booking.payment_method || "Non renseigné",
      paiement_recu_le: booking.payment_received_at || "",
      statut: booking.status || "Demandée",
      archive: Boolean(booking.archived_at),
      cree_le: booking.created_at,
    })),
    reservations_pension: kennelBookings.map((booking) => ({
      id: booking.id,
      arrivee: booking.start_date,
      depart: booking.end_date,
      client: booking.client_name,
      email: booking.client_email,
      telephone: booking.phone,
      adresse_consigne: booking.client_address,
      chien: booking.dog?.name,
      photo_chien: booking.dog?.photo_url || "",
      race: booking.dog?.breed,
      sexe: booking.dog?.sex,
      annee_naissance: booking.dog?.birth_year,
      vaccins_a_jour: booking.dog?.vaccines_up_to_date === true,
      sterilise: booking.dog?.sterilized === true,
      notes: booking.notes || booking.dog?.notes || "",
      montant_eur: getKennelBookingAmount(booking),
      acompte_eur: getBookingPaymentSummary(booking, getKennelBookingAmount(booking)).deposit,
      reste_a_payer_eur: getBookingPaymentSummary(booking, getKennelBookingAmount(booking)).remaining,
      paiement_recu: booking.payment_received === true,
      moyen_paiement: booking.payment_method || "Non renseigné",
      paiement_recu_le: booking.payment_received_at || "",
      statut: booking.status || "Demandée",
      archive: Boolean(booking.archived_at),
      cree_le: booking.created_at,
    })),
    fiches_chiens: kennelDogProfiles.map((profile) => ({
      id: profile.dog?.id || profile.id,
      nom: profile.dog?.name,
      photo: profile.dog?.photo_url || "",
      race: profile.dog?.breed,
      sexe: profile.dog?.sex,
      annee_naissance: profile.dog?.birth_year,
      vaccins_a_jour: profile.dog?.vaccines_up_to_date === true,
      sterilise: profile.dog?.sterilized === true,
      alimentation: profile.dog?.food_notes || "",
      comportement: profile.dog?.behavior_notes || "",
      sante_traitement: profile.dog?.medical_notes || "",
      contact_urgence: profile.dog?.emergency_contact_name || "",
      telephone_urgence: profile.dog?.emergency_contact_phone || "",
      notes: profile.dog?.notes || "",
      sejours: profile.bookings.map((booking) => ({
        id: booking.id,
        arrivee: booking.start_date,
        depart: booking.end_date,
        client: booking.client_name,
        telephone: booking.phone,
        statut: booking.status || "Demandée",
        paiement: getBookingPaymentSummary(booking, getKennelBookingAmount(booking)).label,
        reste_a_payer_eur: getBookingPaymentSummary(booking, getKennelBookingAmount(booking)).remaining,
      })),
    })),
    comptabilite: accountingRows.map((row) => ({
      date: row.date,
      activite: row.activityLabel,
      client: row.client,
      detail: row.detail,
      montant_eur: row.amount,
      type_montant: row.amountSource,
      paiement: row.paymentLabel,
      reste_a_payer_eur: row.paymentRemaining,
      moyen_paiement: row.paymentMethod,
      statut: row.status,
    })),
  };

  downloadJson(`sauvegarde-poulettes-${exportDate.slice(0, 10)}.json`, backup);
  showToast("Sauvegarde complète téléchargée.");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDeliveryDate(value) {
  if (!value || value === "Sans date") {
    return "Sans date";
  }

  const [year, month, day] = String(value).split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function formatLongDeliveryDate(value) {
  if (!value || value === "Sans date") {
    return "Sans date";
  }

  const [year, month, day] = String(value).split("-").map(Number);

  if (!year || !month || !day) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function formatCreatedAtDateTime(value) {
  if (!value) {
    return "Date inconnue";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date inconnue";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getDeliveryDateBadge(value) {
  if (!value || value === "Sans date") {
    return "À planifier";
  }

  const today = getLocalIsoDate();
  const tomorrowDate = new Date(`${today}T00:00:00`);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = getLocalIsoDate(tomorrowDate);

  if (value === today) {
    return "Aujourd'hui";
  }

  if (value === tomorrow) {
    return "Demain";
  }

  return value < today ? "Passée" : "À venir";
}

function printPreparationSheet() {
  if (!routeDate) {
    showToast("Choisis une date de livraison pour imprimer la feuille de route.");
    return;
  }

  const routeOrders = filteredOrders.filter((order) => order.date === routeDate);

  if (routeOrders.length === 0) {
    showToast("Aucune commande affichée pour cette date de livraison.");
    return;
  }

  const totals = routeOrders.reduce(
    (sum, order) => ({
      eggs: sum.eggs + getOrderEggs(order),
      products: sum.products + getOrderItems(order).reduce((count, item) => count + item.quantity, 0),
    }),
    { eggs: 0, products: 0 }
  );
  const rows = routeOrders
    .map(
      (order) => `
        <tr>
          <td>${escapeHtml(order.client)}</td>
          <td>${escapeHtml(order.date)}</td>
          <td>${escapeHtml(order.address)}</td>
          <td>${escapeHtml(getOrderSummary(order))}</td>
          <td>${getOrderEggs(order)}</td>
          <td>${escapeHtml(order.comment)}</td>
          <td>${escapeHtml(order.status)}</td>
        </tr>`
    )
    .join("");
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    showToast("Impossible d'ouvrir la fenetre d'impression.");
    return;
  }

  printWindow.document.write(`
    <!doctype html>
    <html lang="fr">
      <head>
        <title>Feuille de préparation</title>
        <style>
          body { font-family: Arial, sans-serif; color: #173a26; padding: 24px; }
          h1 { margin: 0 0 8px; }
          p { margin: 0 0 20px; color: #555; }
          .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0; }
          .summary div { border: 1px solid #ddd; padding: 12px; }
          .summary strong { display: block; font-size: 22px; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          th { background: #f5ead1; }
        </style>
      </head>
      <body>
        <h1>Feuille de route</h1>
        <p>Date de livraison : ${escapeHtml(routeDate)}</p>
        <div class="summary">
          <div>Commandes<strong>${routeOrders.length}</strong></div>
          <div>Articles<strong>${totals.products}</strong></div>
          <div>Total œufs<strong>${totals.eggs}</strong></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th>Date</th>
              <th>Adresse</th>
              <th>Produits</th>
              <th>Total œufs</th>
              <th>Commentaire</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function openHomeFeaturedEventTarget() {
  const targetScreen = homeFeaturedEvent.cta_screen || "contact";

  void trackSiteEvent("click", "home", "Accueil", {
    action: "home_featured_event",
    label: homeFeaturedEvent.title || "Événement à l'honneur",
    target: targetScreen,
  });

  setScreen(targetScreen);
}

function openHomeFeaturedEventPage() {
  void trackSiteEvent("click", "home", "Accueil", {
    action: "home_featured_event_page",
    label: homeFeaturedEvent.title || "Événement à l'honneur",
    target: "event",
  });

  setScreen("event");
}

  if (isEggSummaryPage) {
    return (
      <main className="egg-summary-app">
        <section className="egg-summary-shell">
          <header className="egg-summary-header">
            <div>
              <span className="egg-summary-kicker">{publicFarmName}</span>
              <h1>Commandes d'œufs</h1>
              <p>Vue rapide par date, réservée à l'administrateur.</p>
            </div>
            {isAdmin && (
              <div className="egg-summary-actions">
                {!isStandaloneDisplay && (
                  <button type="button" onClick={installAdminSummaryApp}>
                    Installer l'icône
                  </button>
                )}
                <button type="button" onClick={checkForAppUpdate} disabled={checkingAppUpdate}>
                  {checkingAppUpdate ? "Verification..." : "Mise a jour"}
                </button>
                <button type="button" onClick={() => void loadOrders()}>
                  Actualiser
                </button>
                <button type="button" onClick={() => { window.location.href = "/"; }}>
                  Grande appli
                </button>
                <button
                  type="button"
                  className="egg-summary-actions__logout"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setCurrentUser(null);
                    setName("");
                    setIsLogged(false);
                    setIsAdmin(false);
                    setOrders([]);
                  }}
                >
                  Déconnexion
                </button>
              </div>
            )}
          </header>

          {!eggSummaryReady ? (
            <div className="egg-summary-empty">Chargement des commandes...</div>
          ) : !isAdmin ? (
            <form className="egg-summary-login" onSubmit={loginEggSummaryAdmin}>
              <h2>Connexion admin</h2>
              <label>
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                Mot de passe
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  autoComplete="current-password"
                  required
                />
              </label>
              <button type="submit">Se connecter</button>
            </form>
          ) : (
            <>
              <div className="egg-summary-stats">
                <article>
                  <span>Commandes à venir</span>
                  <strong>{eggSummaryTotals.orders}</strong>
                </article>
                <article>
                  <span>Boîtes à préparer</span>
                  <strong>{eggSummaryTotals.boxes}</strong>
                </article>
                <article>
                  <span>Œufs au total</span>
                  <strong>{eggSummaryTotals.eggs}</strong>
                </article>
              </div>

              <div className="egg-summary-days">
                {eggSummaryPlanning.map((day) => (
                  <article key={day.date} className="egg-summary-day">
                    <div className="egg-summary-day__title">
                      <div>
                        <span>{getDeliveryDateBadge(day.date)}</span>
                        <strong>{formatLongDeliveryDate(day.date)}</strong>
                      </div>
                      <div className="egg-summary-day__totals">
                        <strong>{day.orders.length} commande{day.orders.length > 1 ? "s" : ""}</strong>
                        <span>{day.eggs} œufs</span>
                      </div>
                    </div>
                    <div className="egg-summary-products">
                      {day.products.map((product) => (
                        <span key={`${day.date}-${product.name}-${product.unitLabel}`}>
                          {product.quantity} {product.name}
                        </span>
                      ))}
                    </div>

                    <div className="egg-summary-list">
                      {day.orders.map((order) => (
                        <div key={order.id} className="egg-summary-order">
                          <div>
                            <strong>{order.client}</strong>
                            <span>{order.address || "Adresse non renseignée"}</span>
                            {order.comment && <em>{order.comment}</em>}
                          </div>
                          <div>
                            <span>{getOrderSummary(order)}</span>
                            <strong>{getOrderEggs(order)} œufs</strong>
                          </div>
                          <label className="egg-summary-status">
                            <span>Statut</span>
                            <select value={order.status} onChange={(e) => changeStatus(order.id, e.target.value)}>
                              {orderStatusOptions.map((status) => (
                                <option key={status.value} value={status.value}>
                                  {status.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}

                {eggSummaryPlanning.length === 0 && (
                  <div className="egg-summary-empty">Aucune commande d'œufs à venir pour le moment.</div>
                )}
              </div>
            </>
          )}
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-amber-50 text-stone-900">
      {screen !== "home" && (
        <header className="app-header">
          <div className="app-header__inner">
            <button onClick={() => setScreen("home")} className="app-brand">
              <span className="brand-mark" aria-hidden="true" />
              <span>Accueil</span>
            </button>

            <nav className="app-nav" aria-label="Navigation">
              <button onClick={() => setScreen("about")} className="app-nav__button">
                <Leaf size={17} />
                La ferme
              </button>
              <button onClick={() => setScreen("shop")} className="app-nav__button">
                <ShoppingBasket size={17} />
                Boutique
              </button>
              <button onClick={() => setScreen("education")} className="app-nav__button">
                <School size={17} />
                Ferme pédagogique
              </button>
              <button onClick={() => setScreen("kennel")} className="app-nav__button">
                <Dog size={17} />
                Pension canine
              </button>
              <button onClick={() => setScreen("contact")} className="app-nav__button">
                <Mail size={17} />
                Contact
              </button>
              <button onClick={() => setScreen("faq")} className="app-nav__button">
                <HelpCircle size={17} />
                Aide
              </button>
              <button onClick={() => setScreen("legal")} className="app-nav__button">
                Mentions
              </button>

              {isLogged && !isAdmin && (
                <>
                  <button onClick={goToMyOrders} className="app-nav__button">
                    <UserRound size={17} />
                    Mon compte
                  </button>
                  <button onClick={goToProfile} className="app-nav__button">
                    <UserRound size={17} />
                    Mon profil
                  </button>
                </>
              )}

              {!isAdmin && (
                <button
                  type="button"
                  onClick={checkForAppUpdate}
                  className="app-nav__button app-nav__button--update"
                  disabled={checkingAppUpdate}
                >
                  <RefreshCw size={17} />
                  {checkingAppUpdate ? "Vérification..." : "Vérifier mise à jour"}
                </button>
              )}

              {isAdmin && (
                <button
                  onClick={async () => {
                    await loadOrders();
                    await loadDeliverySlots();
                    await loadEducationDateSlots();
                    await loadEducationBookings();
                    setScreen("admin");
                  }}
                  className="app-nav__button app-nav__button--admin"
                >
                  <ShieldCheck size={17} />
                  Admin
                </button>
              )}

              {isLogged ? (
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setCurrentUser(null);
                    setIsLogged(false);
                    setIsAdmin(false);
                    setCanOrderEggs(false);
                    setName("");
                    setDeliveryAddress("");
                    setProfileForm({ fullName: "", phone: "", deliveryAddress: "" });
                    setCustomerProfiles([]);
                    setContactMessages([]);
                    setMyOrders([]);
                    setOrders([]);
                    setScreen("home");
                  }}
                  className="app-nav__button app-nav__button--ghost"
                >
                  <LogOut size={16} />
                  Sortir
                </button>
              ) : (
                <button onClick={() => setScreen("login")} className="app-nav__button app-nav__button--admin">
                  <UserRound size={17} />
                  Connexion
                </button>
              )}
            </nav>
          </div>
        </header>
      )}

      {showInstallBanner && (
        <aside className="install-banner" aria-label="Installer l'application">
          <div>
            <strong>Installer l'appli</strong>
            <p>
              {isIosInstallHelp
                ? "Sur iPhone, ouvrez le menu Partager puis choisissez Sur l'écran d'accueil. Sur Android, utilisez le menu du navigateur si le bouton Installer n'apparaît pas."
                : `Ajoutez ${publicFarmName} à votre écran d'accueil pour commander et recevoir les notifications.`}
            </p>
          </div>

          <div className="install-banner__actions">
            {!isIosInstallHelp && (
              <button type="button" onClick={installApp}>
                Installer
              </button>
            )}
            <button type="button" onClick={dismissInstallBanner} aria-label="Masquer">
              Plus tard
            </button>
          </div>
        </aside>
      )}

      {showUpdateNotice && (
        <aside className="update-notice" aria-label="Mise à jour de l'application">
          <div>
            <strong>Nouvelle version disponible</strong>
            <p>
              Touchez le bouton pour charger la dernière version de l'application et éviter l'ancien cache.
            </p>
          </div>
          <div className="update-notice__actions">
            <button type="button" onClick={refreshAppVersion}>
              Mettre à jour l'application
            </button>
            <button type="button" onClick={dismissUpdateNotice} className="update-notice__secondary">
              Plus tard
            </button>
          </div>
        </aside>
      )}

      {toastMessage && (
        <aside className={`app-toast app-toast--${toastMessage.tone}`} role="status" aria-live="polite">
          <div>
            <strong>{toastMessage.tone === "error" ? "À vérifier" : "Information"}</strong>
            <p>{toastMessage.message}</p>
          </div>
          <button type="button" onClick={closeToast} aria-label="Fermer la notification">
            Fermer
          </button>
        </aside>
      )}

      {confirmDialog && (
        <div className="confirm-modal" role="presentation" onClick={() => closeConfirmDialog(false)}>
          <section
            className={`confirm-modal__panel confirm-modal__panel--${confirmDialog.tone}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="confirm-modal__icon" aria-hidden="true">
              !
            </div>
            <div className="confirm-modal__content">
              <h2 id="confirm-modal-title">{confirmDialog.title}</h2>
              <p>{confirmDialog.message}</p>
            </div>
            <div className="confirm-modal__actions">
              <button type="button" className="confirm-modal__cancel" onClick={() => closeConfirmDialog(false)}>
                {confirmDialog.cancelLabel}
              </button>
              <button type="button" className="confirm-modal__confirm" onClick={() => closeConfirmDialog(true)}>
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      )}

      {previewImage && (
        <div className="image-lightbox" role="presentation" onClick={() => setPreviewImage(null)}>
          <section
            className="image-lightbox__panel"
            role="dialog"
            aria-modal="true"
            aria-label={previewImage.alt}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="image-lightbox__close" onClick={() => setPreviewImage(null)}>
              Fermer
            </button>
            <img src={previewImage.src} alt={previewImage.alt} />
          </section>
        </div>
      )}

      <main className={screen === "home" ? "home-main" : "mx-auto max-w-5xl px-4 py-8"}>
        {!isOnline && (
          <section className="offline-page" aria-live="polite">
            <div className="offline-page__icon">
              <RefreshCw size={34} />
            </div>
            <p className="shop-eyebrow">Mode hors connexion</p>
            <h1>La connexion est coupée</h1>
            <p>
              Vous pouvez garder l'application ouverte. Les commandes, réservations et actions admin
              nécessitent internet pour être envoyées correctement.
            </p>
            <div className="offline-page__actions">
              <button type="button" className="primary-action" onClick={() => window.location.reload()}>
                Réessayer
              </button>
              <button type="button" className="secondary-action" onClick={() => setScreen("home")}>
                Revenir à l'accueil
              </button>
            </div>
          </section>
        )}

        {screen === "home" && (
          <section className="landing" aria-label={`Accueil ${publicFarmName}`}>
            <div className="landing__background" />
            <div className="landing__mist" />

            <header className="landing__nav">
              <button onClick={() => setScreen("home")} className="brand-button">
                <span className="brand-mark" aria-hidden="true" />
                <span>{publicFarmName}</span>
              </button>

              <nav className="landing__links landing__links--access" aria-label="Accès">
                <button onClick={() => setScreen("about")} className="nav-pill">
                  La ferme
                </button>
                <button onClick={() => setScreen("login")} className="nav-pill">
                  Connexion
                </button>
                <button onClick={openAdmin} className="nav-pill nav-pill--admin">
                  Admin
                </button>
              </nav>
            </header>

            <div className="landing__hero">
              <div className="landing__logo-wrap">
                <img
                  src="/logo-poulettes.png"
                  alt={publicFarmName}
                  className="landing__logo"
                />
              </div>

              <div className="landing__content">
                <div className="landing__ornament">
                  <span />
                  <Heart size={16} fill="currentColor" />
                  <span />
                </div>
                <h1>
                  Les Poulettes
                  <br />
                  du Marais
                </h1>
                <p className="landing__subtitle">Ferme pédagogique, œufs de poules élevées en plein air et pension canine</p>
                <div className="landing__divider">
                  <span />
                  <Heart size={15} fill="currentColor" />
                  <span />
                </div>
                <p className="landing__text">
                  Commandez vos œufs, réservez une activité à la ferme
                  <br />
                  ou préparez le séjour de votre chien.
                </p>

                <div className="landing__actions">
                  <div className="landing__actions-main" aria-label="Activités de la ferme">
                    <button
                      onClick={() => {
                        void trackSiteEvent("click", "home", "Accueil", { action: "home_cta_shop", label: "Commander mes oeufs" });
                        setScreen("shop");
                      }}
                      className="cta cta--primary"
                    >
                      <Egg size={24} fill="currentColor" />
                      <span>Commander mes œufs</span>
                      <ChevronRight size={22} />
                    </button>
                    <button
                      onClick={() => {
                        void trackSiteEvent("click", "home", "Accueil", { action: "home_cta_about", label: "Découvrir la ferme" });
                        setScreen("about");
                      }}
                      className="cta cta--light"
                    >
                      <Leaf size={22} />
                      <span>Découvrir la ferme</span>
                      <ChevronRight size={21} />
                    </button>
                    <button
                      onClick={() => {
                        void trackSiteEvent("click", "home", "Accueil", { action: "home_cta_education", label: "Ferme pédagogique" });
                        setScreen("education");
                      }}
                      className="cta cta--light"
                    >
                      <School size={22} />
                      <span>Ferme pédagogique</span>
                      <ChevronRight size={21} />
                    </button>
                    <button
                      onClick={() => {
                        void trackSiteEvent("click", "home", "Accueil", { action: "home_cta_kennel", label: "Pension canine" });
                        setScreen("kennel");
                      }}
                      className="cta cta--light"
                    >
                      <PawPrint size={22} fill="currentColor" />
                      <span>Pension canine</span>
                      <ChevronRight size={21} />
                    </button>
                    <button
                      onClick={() => {
                        void trackSiteEvent("click", "home", "Accueil", { action: "home_cta_contact", label: "Nous contacter" });
                        setScreen("contact");
                      }}
                      className="cta cta--light"
                    >
                      <Mail size={22} />
                      <span>Nous contacter</span>
                      <ChevronRight size={21} />
                    </button>
                  </div>

                  <div className="landing__socials" aria-label="Réseaux sociaux">
                    <span>Suivez la ferme</span>
                    <a
                      href="https://www.facebook.com/share/1C2y2956FR/"
                      target="_blank"
                      rel="noreferrer"
                      className="social-link social-link--facebook"
                    >
                      <span className="social-link__mark" aria-hidden="true">f</span>
                      Facebook
                    </a>
                    <a
                      href="https://www.instagram.com/lafermedespoulettesdumarais?igsh=M2V6bzIzcnV1YTZu"
                      target="_blank"
                      rel="noreferrer"
                      className="social-link social-link--instagram"
                    >
                      <span className="social-link__mark" aria-hidden="true">?</span>
                      Instagram
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {homeFeaturedEvent.enabled && (
                <section className="home-featured-event" aria-label="Événement à l'honneur">
                <div className="home-featured-event__media">
                  <img
                    src={homeFeaturedEvent.image_url || DEFAULT_HOME_FEATURED_EVENT.image_url}
                    alt={homeFeaturedEvent.title || "Événement à l'honneur"}
                  />
                </div>
                <div className="home-featured-event__content">
                  <p className="shop-eyebrow">{homeFeaturedEvent.eyebrow || "Événement à l'honneur"}</p>
                  <h2>{homeFeaturedEvent.title}</h2>
                  <p>{homeFeaturedEvent.text}</p>
                  <div className="home-featured-event__actions">
                    <button type="button" onClick={openHomeFeaturedEventPage}>
                      <Star size={18} fill="currentColor" />
                      <span>Voir la page événement</span>
                      <ChevronRight size={19} />
                    </button>
                    {homeFeaturedEvent.cta_screen && homeFeaturedEvent.cta_screen !== "event" && (
                      <button type="button" className="home-featured-event__secondary" onClick={openHomeFeaturedEventTarget}>
                        <span>{homeFeaturedEvent.cta_label || "Nous contacter"}</span>
                      </button>
                    )}
                  </div>
                </div>
              </section>
            )}

            {activeHomeNews && (
              <section className="home-news" aria-label="Actualités du moment">
                <div className="home-news__media">
                  <img
                    src={activeHomeNews.image_url || "/images/marais.jpg"}
                    alt={activeHomeNews.title}
                    loading="lazy"
                  />
                </div>
                <div className="home-news__content">
                  <p className="shop-eyebrow">Actualités du moment</p>
                  <time dateTime={activeHomeNews.published_at || undefined}>
                    {activeHomeNews.published_at ? formatDeliveryDate(activeHomeNews.published_at) : "Actualité"}
                  </time>
                  <h2>{activeHomeNews.title}</h2>
                  <p>{activeHomeNews.text}</p>
                  {homeNewsItems.length > 1 && (
                    <div className="home-news__controls" aria-label="Choisir une actualité">
                      {homeNewsItems.map((item, index) => (
                        <button
                          key={item.id}
                          type="button"
                          className={index === activeHomeNewsIndex ? "is-active" : ""}
                          onClick={() => setActiveHomeNewsIndex(index)}
                          aria-label={`Voir l'actualité ${item.title}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            <div className="landing__features" aria-label="Avantages">
              <article className="feature-card">
                <span className="feature-icon feature-icon--green">
                  <Egg size={34} fill="currentColor" strokeWidth={2.1} />
                </span>
                <div>
                  <h2>Œufs frais</h2>
                  <p>Commandes en ligne, stock suivi automatiquement et notifications.</p>
                </div>
              </article>

              <article className="feature-card">
                <span className="feature-icon feature-icon--yellow">
                  <School size={32} strokeWidth={2.1} />
                </span>
                <div>
                  <h2>Ferme pédagogique</h2>
                  <p>Visites et ateliers à réserver selon les créneaux disponibles.</p>
                </div>
              </article>

              <article className="feature-card">
                <span className="feature-icon feature-icon--olive">
                  <PawPrint size={34} fill="currentColor" strokeWidth={2.1} />
                </span>
                <div>
                  <h2>Pension canine</h2>
                  <p>Demandes de séjour avec fiche chien et suivi des disponibilités.</p>
                </div>
              </article>
            </div>

            <section className="home-guides" aria-label="Guides pratiques">
              <div className="home-guides__header">
                <p className="shop-eyebrow">Guides pratiques</p>
                <h2>Besoin d'un coup de main ?</h2>
                <p>Ces trois tutoriels sont consultables avant toute connexion au site.</p>
              </div>
              <div className="home-guides__grid">
                <button
                  type="button"
                  className="home-guide-card"
                  onClick={(event) => openTutorialGuide(event, "eggs", "Commander des oeufs")}
                >
                  <span className="home-guide-card__icon home-guide-card__icon--eggs">
                    <Egg size={28} fill="currentColor" strokeWidth={2.1} />
                  </span>
                  <span>
                    <strong>Commander des oeufs</strong>
                    <small>Créer un compte, activer les notifications et passer commande.</small>
                  </span>
                  <Download size={20} />
                </button>
                <button
                  type="button"
                  className="home-guide-card"
                  onClick={(event) => openTutorialGuide(event, "kennel", "Reserver la pension canine")}
                >
                  <span className="home-guide-card__icon home-guide-card__icon--dog">
                    <PawPrint size={28} fill="currentColor" strokeWidth={2.1} />
                  </span>
                  <span>
                    <strong>Réserver la pension canine</strong>
                    <small>Choisir les dates, remplir la fiche chien et envoyer la demande.</small>
                  </span>
                  <Download size={20} />
                </button>
                <button
                  type="button"
                  className="home-guide-card"
                  onClick={(event) => openTutorialGuide(event, "education", "Reserver une activite ferme")}
                >
                  <span className="home-guide-card__icon home-guide-card__icon--farm">
                    <School size={27} strokeWidth={2.1} />
                  </span>
                  <span>
                    <strong>Réserver une activité</strong>
                    <small>Choisir l'activité, le créneau et indiquer les participants.</small>
                  </span>
                  <Download size={20} />
                </button>
              </div>
            </section>

            <section className="google-reviews" aria-label="Avis Google">
              <div className="google-reviews__summary">
                <p className="shop-eyebrow">Avis Google</p>
                <h2>Vos retours font vivre la ferme</h2>
                <div className="google-reviews__stars" aria-label="Avis Google">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={index} size={20} fill="currentColor" strokeWidth={2.4} />
                  ))}
                  <span>Merci pour vos avis</span>
                </div>
                <p>
                  Retrouvez les avis publiés sur Google et partagez votre expérience après une commande,
                  une visite ou un séjour en pension canine.
                </p>
                <div className="google-reviews__actions">
                  <a
                    href={publicGoogleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => trackSiteEvent("click", "home", "Accueil", { action: "google_reviews", label: "Voir les avis Google" })}
                  >
                    Voir les avis
                    <ExternalLink size={17} />
                  </a>
                  <a
                    href={publicGoogleReviewUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => trackSiteEvent("click", "home", "Accueil", { action: "google_review_write", label: "Laisser un avis Google" })}
                  >
                    Laisser un avis
                    <ExternalLink size={17} />
                  </a>
                </div>
              </div>
              <div className="google-reviews__cards">
                {GOOGLE_REVIEW_HIGHLIGHTS.map((review) => (
                  <article className="google-review-card" key={review.title}>
                    <div className="google-review-card__stars" aria-hidden="true">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Star key={index} size={15} fill="currentColor" strokeWidth={2.2} />
                      ))}
                    </div>
                    <h3>{review.title}</h3>
                    <p>{review.text}</p>
                  </article>
                ))}
              </div>
            </section>

            <p className="landing__privacy">
              Les informations transmises via ce site sont utilisées uniquement pour gérer vos commandes,
              réservations et demandes auprès des Poulettes du Marais. Elles ne sont pas revendues et peuvent
              être consultées, corrigées ou supprimées sur simple demande.
            </p>
            <nav className="legal-links" aria-label="Informations légales">
              <button type="button" onClick={() => setScreen("faq")}>Aide / questions fréquentes</button>
              <button type="button" onClick={() => setScreen("legal")}>Mentions légales</button>
              <button type="button" onClick={() => setScreen("privacy")}>Confidentialité</button>
              <button type="button" onClick={() => setScreen("terms")}>Conditions</button>
            </nav>
          </section>
        )}

        {screen === "tutorials" && (
          <section className="tutorial-page">
            <div className="tutorial-hero">
              <button type="button" className="secondary-action" onClick={() => setScreen("home")}>
                Retour à l'accueil
              </button>
              <p className="shop-eyebrow">Guide pratique</p>
              <h1>{activeTutorial.title}</h1>
              <p>{activeTutorial.intro}</p>
              <div className="tutorial-tabs" aria-label="Choisir un tutoriel">
                {TUTORIAL_GUIDES.map((guide) => (
                  <button
                    key={guide.id}
                    type="button"
                    className={guide.id === activeTutorial.id ? "is-active" : ""}
                    onClick={() => setActiveTutorialId(guide.id)}
                  >
                    {guide.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="tutorial-content">
              <div className="tutorial-steps">
                {activeTutorial.steps.map((step, index) => (
                  <article key={step.title} className="tutorial-step">
                    <span>{index + 1}</span>
                    <div>
                      <h2>{step.title}</h2>
                      <p>{step.text}</p>
                    </div>
                  </article>
                ))}
              </div>

              <aside className="tutorial-memo">
                <h2>Petit mémo</h2>
                <ul>
                  {activeTutorial.memo.map((item) => (
                    <li key={item}>
                      <CheckCircle2 size={18} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <a href={activeTutorial.pdfUrl} download>
                  <Download size={18} />
                  Télécharger le PDF
                </a>
              </aside>
            </div>
          </section>
        )}

        {screen === "legal" && (
          <section className="legal-page">
            <div className="legal-hero">
              <p className="shop-eyebrow">Informations légales</p>
              <h1>Mentions légales</h1>
              <p>Ces informations identifient l'éditeur du site {publicFarmName}.</p>
            </div>
            <div className="legal-content">
              <article>
                <h2>Éditeur du site</h2>
                <p><strong>Nom de l'entreprise :</strong> {publicFarmName}</p>
                <p><strong>Forme juridique :</strong> Micro BA</p>
                <p><strong>Responsable de publication :</strong> Marie Auguste</p>
                <p><strong>Adresse professionnelle :</strong> 61 Les Ruelles, 44580 Bourneuf-en-Retz</p>
                <p><strong>SIRET :</strong> 8943132800013</p>
                <p><strong>RCS / RM :</strong> Non concerné</p>
              </article>
              <article>
                <h2>Contact</h2>
                <p><strong>Email :</strong> {publicContactEmail}</p>
                <p><strong>Téléphone :</strong> {publicContactPhone}</p>
                <p><strong>Site :</strong> {publicSiteDisplayUrl}</p>
              </article>
              <article>
                <h2>Hébergement</h2>
                <p>Le site est hébergé par Netlify, Inc., 44 Montgomery Street, Suite 300, San Francisco, CA 94104, États-Unis.</p>
              </article>
            </div>
          </section>
        )}

        {screen === "privacy" && (
          <section className="legal-page">
            <div className="legal-hero">
              <p className="shop-eyebrow">Données personnelles</p>
              <h1>Confidentialité et RGPD</h1>
              <p>Cette page explique comment sont utilisées les données transmises via l'application.</p>
            </div>
            <div className="legal-content">
              <article>
                <h2>Données collectées</h2>
                <p>Nom, prénom, email, téléphone, adresse de livraison, commandes, réservations, informations nécessaires à la pension canine, messages de contact et abonnements aux notifications push.</p>
              </article>
              <article>
                <h2>Finalités</h2>
                <p>Ces données servent uniquement à gérer les comptes clients, commandes d'œufs, réservations, demandes de contact, notifications et suivi administratif de la ferme.</p>
              </article>
              <article>
                <h2>Vos droits</h2>
                <p>Vous pouvez demander l'accès, la correction ou la suppression de vos données en contactant {publicFarmName} à l'adresse suivante : {publicContactEmail}.</p>
              </article>
              <article>
                <h2>Prestataires</h2>
                <p>Le site utilise notamment Supabase pour la base de données, Netlify pour l'hébergement et Resend pour l'envoi d'emails.</p>
              </article>
            </div>
          </section>
        )}

        {screen === "terms" && (
          <section className="legal-page">
            <div className="legal-hero">
              <p className="shop-eyebrow">Conditions</p>
              <h1>Conditions de vente et de réservation</h1>
              <p>Ces conditions encadrent les commandes d'œufs, les activités pédagogiques et la pension canine.</p>
            </div>
            <div className="legal-content">
              <article>
                <h2>Commandes d'œufs</h2>
                <p>Les commandes sont réservées aux clients autorisés. Les prix et disponibilités sont indiqués dans l'application et peuvent évoluer selon la production.</p>
              </article>
              <article>
                <h2>Ferme pédagogique</h2>
                <p>Les demandes de réservation sont soumises à confirmation. Les dates, tarifs, capacités et activités peuvent varier selon la saison.</p>
              </article>
              <article>
                <h2>Pension canine</h2>
                <p>La réservation est soumise à disponibilité et confirmation. Le chien doit être sociable avec ses congénères, les vaccins doivent être à jour et une pré-visite peut être demandée avant le séjour.</p>
              </article>
              <article>
                <h2>Annulation et modification</h2>
                <p>Pour toute modification ou annulation, le client doit contacter {publicFarmName} le plus tôt possible. Les modalités précises sont à compléter selon vos règles internes.</p>
              </article>
            </div>
          </section>
        )}

        {screen === "faq" && (
          <section className="legal-page faq-page">
            <div className="legal-hero faq-hero">
              <p className="shop-eyebrow">Aide</p>
              <h1>Questions fréquentes</h1>
              <p>Les réponses rapides pour commander, réserver une activité, préparer un séjour en pension canine ou gérer votre compte.</p>
            </div>

            <div className="faq-grid">
              <article className="faq-card">
                <span className="faq-card__icon"><ShoppingBasket size={22} /></span>
                <h2>Commandes d'œufs</h2>
                <details open>
                  <summary>Pourquoi je ne peux pas commander ?</summary>
                  <p>La boutique d'œufs est réservée aux clients autorisés par la ferme. Si votre compte n'a pas encore l'accès, contactez {publicFarmName}.</p>
                </details>
                <details>
                  <summary>Comment modifier une commande ?</summary>
                  <p>Envoyez un message via la page Contact le plus tôt possible. La ferme pourra ajuster la commande selon le stock et l'avancement de la préparation.</p>
                </details>
                <details>
                  <summary>Le stock affiché est-il définitif ?</summary>
                  <p>Le stock suit les commandes validées dans l'application. Il peut évoluer selon la ponte et les préparations en cours.</p>
                </details>
              </article>

              <article className="faq-card">
                <span className="faq-card__icon"><CalendarDays size={22} /></span>
                <h2>Livraison et suivi</h2>
                <details open>
                  <summary>Où voir mes commandes ?</summary>
                  <p>Une fois connecté, ouvrez “Mes commandes” dans le menu. Vous y retrouvez les dates, le contenu et le statut de vos commandes.</p>
                </details>
                <details>
                  <summary>À quoi sert mon adresse ?</summary>
                  <p>Elle permet de préparer la livraison ou le point de dépôt. Vous pouvez la corriger depuis “Mon profil”.</p>
                </details>
                <details>
                  <summary>Comment recevoir les notifications ?</summary>
                  <p>Dans “Mon profil”, touchez “Activer notifications”. Vous pouvez aussi utiliser le bouton “Vérifier mise à jour” si l'application semble ancienne.</p>
                </details>
              </article>

              <article className="faq-card">
                <span className="faq-card__icon"><School size={22} /></span>
                <h2>Ferme pédagogique</h2>
                <details open>
                  <summary>La réservation est-elle automatique ?</summary>
                  <p>Non, vous envoyez une demande. La ferme confirme ensuite le créneau selon les places disponibles et l'organisation du jour.</p>
                </details>
                <details>
                  <summary>Que faut-il renseigner ?</summary>
                  <p>Indiquez l'activité, la date souhaitée, les enfants participants, un téléphone et les précisions utiles.</p>
                </details>
              </article>

              <article className="faq-card">
                <span className="faq-card__icon"><Dog size={22} /></span>
                <h2>Pension canine</h2>
                <details open>
                  <summary>Comment demander un séjour ?</summary>
                  <p>Ouvrez “Pension canine”, choisissez les dates, renseignez le téléphone et la fiche chien, puis envoyez la demande.</p>
                </details>
                <details>
                  <summary>Y a-t-il une pré-visite ?</summary>
                  <p>Oui, une pré-visite peut être organisée avant le séjour. Le chien doit être sociable avec ses congénères et ses vaccins doivent être à jour.</p>
                </details>
              </article>

              <article className="faq-card">
                <span className="faq-card__icon"><UserRound size={22} /></span>
                <h2>Compte client</h2>
                <details open>
                  <summary>Pourquoi téléphone et adresse sont demandés ?</summary>
                  <p>Ces informations permettent de gérer les commandes, livraisons, réservations et demandes de contact plus facilement.</p>
                </details>
                <details>
                  <summary>Comment modifier mes informations ?</summary>
                  <p>Connectez-vous, ouvrez “Mon profil”, modifiez vos coordonnées puis enregistrez.</p>
                </details>
              </article>

              <article className="faq-card faq-card--contact">
                <span className="faq-card__icon"><Mail size={22} /></span>
                <h2>Besoin d'une réponse précise ?</h2>
                <p>La page Contact permet d'envoyer une question directement à la ferme. Votre message sera conservé dans l'espace admin pour faciliter le suivi.</p>
                <p>
                  {publicContactPhone && <span>{publicContactPhone}</span>}
                  {publicContactPhone && publicContactEmail && <span> - </span>}
                  {publicContactEmail && <span>{publicContactEmail}</span>}
                </p>
                <button type="button" className="primary-action" onClick={() => setScreen("contact")}>
                  Aller au contact
                  <ArrowRight size={18} />
                </button>
              </article>
            </div>
          </section>
        )}

        {screen === "event" && (
          <section className="event-page">
            <div
              className="event-hero"
              style={{
                backgroundImage: `linear-gradient(90deg, rgba(255, 253, 246, 0.96), rgba(255, 253, 246, 0.72)), url("${homeFeaturedEvent.image_url || DEFAULT_HOME_FEATURED_EVENT.image_url}")`,
              }}
            >
              <div>
                <p className="shop-eyebrow">{homeFeaturedEvent.eyebrow || "Événement"}</p>
                <h1>{homeFeaturedEvent.title || "Événement aux Poulettes du Marais"}</h1>
                <p>{homeFeaturedEvent.text}</p>
                {homeFeaturedEvent.event_date && (
                  <strong>
                    <CalendarDays size={19} />
                    {formatDeliveryDate(homeFeaturedEvent.event_date)}
                  </strong>
                )}
                <button type="button" className="primary-action" onClick={() => setScreen("contact")}>
                  Se renseigner
                </button>
              </div>
            </div>

            <div className="event-content">
              <article>
                <h2>Infos pratiques</h2>
                {String(homeFeaturedEvent.event_details || "")
                  .split("\n")
                  .filter(Boolean)
                  .map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
              </article>

              {parseGalleryImages(homeFeaturedEvent.gallery_images).length > 0 && (
                <div className="event-gallery" aria-label="Photos de l'événement">
                  {parseGalleryImages(homeFeaturedEvent.gallery_images).map((imageUrl, index) => (
                    <img key={`${imageUrl}-${index}`} src={imageUrl} alt={`Canicross ${index + 1}`} />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {screen === "about" && (
          <section className="about-page">
            <div className="about-hero">
              <img src={aboutContent.image_url || DEFAULT_ABOUT_CONTENT.image_url} alt="Paysage du marais autour de la ferme" />
              <div>
                <p className="shop-eyebrow">{aboutContent.eyebrow}</p>
                <h1>{aboutContent.title}</h1>
                <p>{aboutContent.intro}</p>
              </div>
            </div>

            <div className="about-content">
              <article>
                <h2>{aboutContent.block1_title}</h2>
                <p>{aboutContent.block1_text}</p>
              </article>

              <article>
                <h2>{aboutContent.block2_title}</h2>
                <ul>
                  {String(aboutContent.block2_text || "")
                    .split("\n")
                    .filter(Boolean)
                    .map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                </ul>
              </article>

              <article>
                <h2>{aboutContent.block3_title}</h2>
                <p>{aboutContent.block3_text}</p>
              </article>
            </div>

            {parseGalleryImages(aboutContent.gallery_images).length > 0 && (
              <div className="about-gallery" aria-label="Photos de la ferme">
                {parseGalleryImages(aboutContent.gallery_images).map((imageUrl, index) => (
                  <img
                    key={`${imageUrl}-${index}`}
                    src={imageUrl}
                    alt={`Photo de la ferme ${index + 1}`}
                  />
                ))}
              </div>
            )}

            <div className="about-actions">
              <button type="button" onClick={() => setScreen("shop")} className="primary-action">
                Commander des œufs
              </button>
              <button type="button" onClick={() => setScreen("education")} className="secondary-action">
                Voir la ferme pédagogique
              </button>
              <button type="button" onClick={() => setScreen("kennel")} className="secondary-action">
                Voir la pension canine
              </button>
            </div>
          </section>
        )}

        {screen === "education" && (
          <section className="service-page">
            <div className="service-hero service-hero--education">
              <div>
                <p className="shop-eyebrow">Ferme pédagogique</p>
                <h1>Découvrir la ferme autrement</h1>
                <p>
                  Visites, ateliers autour des animaux, découverte du marais et moments adaptés
                  aux familles, groupes et écoles.
                </p>
              </div>
              <span className="service-hero__icon">
                <School size={42} />
              </span>
            </div>

            <div className="service-layout">
              <div className="service-panel">
                <h2>Activités proposées</h2>
                <div className="service-list">
                  {activeEducationActivities.map((activity) => (
                    <button
                      key={activity.id}
                      type="button"
                      className={selectedEducationDetail?.id === activity.id ? "service-list__item is-active" : "service-list__item"}
                      onClick={() => {
                        setSelectedEducationDetailId(activity.id);
                        setEducationBookingForm({
                          ...educationBookingForm,
                          activityId: activity.id,
                          dateSlotId: "",
                        });
                      }}
                    >
                      {activity.image_url ? (
                        <img src={activity.image_url} alt={activity.name} className="service-list__image" />
                      ) : (
                        <CalendarCheck size={22} />
                      )}
                      <div>
                        <strong>{activity.name}</strong>
                        <p>{activity.description}</p>
                        <em>
                          {activity.price > 0 ? `${activity.price.toFixed(2)} EUR` : "Tarif sur demande"}
                          {activity.season_label ? ` - ${activity.season_label}` : ""}
                        </em>
                      </div>
                    </button>
                  ))}
                </div>

                {selectedEducationDetail && (
                  <div className="activity-detail">
                    <div>
                      <h3>{selectedEducationDetail.name}</h3>
                      <p>{selectedEducationDetail.description}</p>
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={() =>
                          setEducationBookingForm({
                            ...educationBookingForm,
                            activityId: selectedEducationDetail.id,
                            dateSlotId: "",
                          })
                        }
                      >
                        Réserver cet atelier
                      </button>
                    </div>

                    {selectedEducationGallery.length > 0 && (
                      <div className="activity-gallery">
                        {selectedEducationGallery.map((imageUrl, index) => (
                          <img key={`${imageUrl}-${index}`} src={imageUrl} alt={`${selectedEducationDetail.name} ${index + 1}`} />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!isBirthdayEducationActivity && (
                <div className="client-calendar">
                  <div className="client-calendar__header">
                    <div>
                      <span>Dates disponibles</span>
                      <strong>{getMonthLabel(educationCalendarMonth)}</strong>
                    </div>
                    <div>
                      <button type="button" onClick={() => setEducationCalendarMonth(shiftMonth(educationCalendarMonth, -1))}>
                        Précédent
                      </button>
                      <button type="button" onClick={() => setEducationCalendarMonth(shiftMonth(educationCalendarMonth, 1))}>
                        Suivant
                      </button>
                    </div>
                  </div>

                  <div className="client-calendar__grid">
                    {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => (
                      <span key={`education-${day}`} className="client-calendar__weekday">{day}</span>
                    ))}
                    {educationCalendarDays.map((day) => (
                      <button
                        key={`education-calendar-${day.date}`}
                        type="button"
                        className={`client-calendar__day ${day.inMonth ? "" : "is-muted"} ${day.available ? "is-available" : ""} ${educationBookingForm.dateSlotId && day.slots.some((slot) => slot.id === educationBookingForm.dateSlotId) ? "is-selected" : ""}`}
                        onClick={() => selectEducationCalendarDay(day)}
                        disabled={!day.available}
                      >
                        <strong>{day.dayNumber}</strong>
                        <span>{day.available ? `${day.remaining} place${day.remaining > 1 ? "s" : ""}` : "—"}</span>
                      </button>
                    ))}
                  </div>
                  <p className="client-calendar__note">Touchez une date disponible pour la choisir dans le formulaire.</p>
                </div>
                )}
              </div>

              {isBirthdayEducationActivity ? (
              <form className="service-form birthday-form" onSubmit={requestBirthdayBooking}>
                <h2>Demande d'anniversaire</h2>
                {!isLogged && <p className="login-note">Connecte-toi ou crée un compte pour envoyer une demande d'anniversaire.</p>}
                <p className="login-note">
                  Pour les anniversaires, envoyez une demande personnalisée : nous reviendrons vers vous pour organiser le moment ensemble.
                </p>

                <label>
                  <span>Date souhaitée</span>
                  <input
                    type="date"
                    value={birthdayBookingForm.desiredDate}
                    onChange={(e) => setBirthdayBookingForm({ ...birthdayBookingForm, desiredDate: e.target.value })}
                  />
                </label>
                <label>
                  <span>Prénom de l'enfant fêté</span>
                  <input
                    value={birthdayBookingForm.childName}
                    onChange={(e) => setBirthdayBookingForm({ ...birthdayBookingForm, childName: e.target.value })}
                    placeholder="Prénom"
                  />
                </label>
                <label>
                  <span>Âge fêté</span>
                  <input
                    type="number"
                    min="1"
                    max="18"
                    value={birthdayBookingForm.childAge}
                    onChange={(e) => setBirthdayBookingForm({ ...birthdayBookingForm, childAge: e.target.value })}
                    placeholder="Ex. 7"
                  />
                </label>
                <label>
                  <span>Nombre d'enfants invités</span>
                  <input
                    type="number"
                    min="1"
                    value={birthdayBookingForm.guestCount}
                    onChange={(e) => setBirthdayBookingForm({ ...birthdayBookingForm, guestCount: e.target.value })}
                    placeholder="Ex. 8"
                  />
                </label>
                <label>
                  <span>Nom du parent référent</span>
                  <input
                    value={birthdayBookingForm.parentName}
                    onChange={(e) => setBirthdayBookingForm({ ...birthdayBookingForm, parentName: e.target.value })}
                    placeholder="Nom et prénom"
                  />
                </label>
                <label>
                  <span>Téléphone</span>
                  <input
                    value={birthdayBookingForm.phone}
                    onChange={(e) => setBirthdayBookingForm({ ...birthdayBookingForm, phone: e.target.value })}
                    placeholder="Numéro de contact"
                  />
                </label>
                <label>
                  <span>Précisions</span>
                  <textarea
                    value={birthdayBookingForm.notes}
                    onChange={(e) => setBirthdayBookingForm({ ...birthdayBookingForm, notes: e.target.value })}
                    placeholder="Horaires souhaités, thème, allergies, besoins particuliers..."
                    rows="4"
                  />
                </label>

                <button type="submit" className="primary-action">
                  Envoyer la demande d'anniversaire
                </button>
              </form>
              ) : (
              <form className="service-form" onSubmit={requestEducationBooking}>
                <h2>Demande de réservation</h2>
                {!isLogged && <p className="login-note">Connecte-toi ou crée un compte pour envoyer une demande.</p>}

                <label>
                  <span>Activité</span>
                  <select
                    value={educationBookingForm.activityId}
                    onChange={(e) => setEducationBookingForm({ ...educationBookingForm, activityId: e.target.value, dateSlotId: "" })}
                  >
                    {activeEducationActivities.map((activity) => (
                      <option key={activity.id} value={activity.id}>
                        {activity.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Date proposée</span>
                  <select
                    value={educationBookingForm.dateSlotId}
                    onChange={(e) => setEducationBookingForm({ ...educationBookingForm, dateSlotId: e.target.value })}
                  >
                    <option value="">Choisir une date</option>
                    {availableEducationDateSlots.map((slot) => (
                      <option key={slot.id} value={slot.id} disabled={slot.remaining <= 0}>
                        {getEducationSlotLabel(slot)}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedEducationActivity && availableEducationDateSlots.length === 0 && (
                  <p className="login-note">Aucune date n'est ouverte pour cet atelier pour le moment.</p>
                )}
                <label>
                  <span>Nom de l'accompagnateur</span>
                  <input
                    value={educationBookingForm.accompanistName}
                    onChange={(e) => setEducationBookingForm({ ...educationBookingForm, accompanistName: e.target.value })}
                    placeholder="Nom et prénom"
                  />
                </label>
                <div className="children-fields">
                  <span>Enfants participants</span>
                  {educationBookingForm.children.map((child, index) => (
                    <div key={index} className="children-row">
                      <input
                        value={child.firstName}
                        onChange={(e) => setEducationChild(index, "firstName", e.target.value)}
                        placeholder="Prénom"
                      />
                      <input
                        type="number"
                        min="1"
                        max="18"
                        value={child.age}
                        onChange={(e) => setEducationChild(index, "age", e.target.value)}
                        placeholder="Âge"
                      />
                      {educationBookingForm.children.length > 1 && (
                        <button type="button" onClick={() => removeEducationChild(index)}>
                          Retirer
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" className="secondary-action" onClick={addEducationChild}>
                    Ajouter un enfant
                  </button>
                </div>
                <label>
                  <span>Téléphone</span>
                  <input
                    value={educationBookingForm.phone}
                    onChange={(e) => setEducationBookingForm({ ...educationBookingForm, phone: e.target.value })}
                    placeholder="Numéro de contact"
                  />
                </label>
                <label>
                  <span>Précisions</span>
                  <textarea
                    value={educationBookingForm.notes}
                    onChange={(e) => setEducationBookingForm({ ...educationBookingForm, notes: e.target.value })}
                    placeholder="Âges des enfants, besoins particuliers, horaires souhaités..."
                    rows="4"
                  />
                </label>

                <button type="submit" className="primary-action">
                  Envoyer la demande
                </button>
              </form>
              )}
            </div>
          </section>
        )}

        {screen === "kennel" && (
          <section className="service-page">
            <div
              className="service-hero service-hero--kennel"
              style={{
                backgroundImage: `linear-gradient(120deg, rgba(255, 253, 246, 0.96), rgba(230, 239, 226, 0.84)), url("${kennelContent.image_url || DEFAULT_KENNEL_CONTENT.image_url}")`,
              }}
            >
              <div>
                <p className="shop-eyebrow">Pension canine</p>
                <h1>Préparer le séjour de votre chien</h1>
                <p>
                  Envoyez une demande de pension avec les dates de séjour et les informations
                  essentielles sur votre chien.
                </p>
              </div>
              <span className="service-hero__icon">
                <Dog size={42} />
              </span>
            </div>

            <div className="service-layout">
              <div className="service-panel">
                <h2>Tarifs et séjour</h2>
                {kennelGalleryImages.length > 0 && (
                  <div className="kennel-photo-strip">
                    {kennelGalleryImages.map((imageUrl, index) => (
                      <button
                        key={`${imageUrl}-${index}`}
                        type="button"
                        onClick={() => openImagePreview(imageUrl, `Pension canine ${index + 1}`)}
                        aria-label={`Agrandir la photo pension canine ${index + 1}`}
                      >
                        <img src={imageUrl} alt={`Pension canine ${index + 1}`} />
                      </button>
                    ))}
                  </div>
                )}
                <div className="service-list">
                  {kennelServices.filter((service) => service.active).map((service) => (
                    <article key={service.id}>
                      <Euro size={22} />
                      <div>
                        <strong>{service.name}</strong>
                        <p>{service.description}</p>
                        <em>
                          {service.price > 0 ? `${service.price.toFixed(2)} EUR / ${service.unit_label}` : "Tarif sur demande"}
                        </em>
                      </div>
                    </article>
                  ))}
                  <article>
                    <CalendarDays size={22} />
                    <div>
                      <strong>Dates du séjour</strong>
                      <p>Indiquez l'arrivée et le départ pour vérifier les disponibilités.</p>
                    </div>
                  </article>
                  <article>
                    <Dog size={22} />
                    <div>
                      <strong>Fiche chien</strong>
                      <p>Nom, race, âge, vaccins et habitudes pour préparer l'accueil.</p>
                    </div>
                  </article>
                  <article>
                    <ShieldCheck size={22} />
                    <div>
                      <strong>Sociabilité et pré-visite</strong>
                      <p>Le chien doit être sociable avec ses congénères. Une pré-visite à la pension canine sera prévue avant le séjour.</p>
                    </div>
                  </article>
                  <article>
                    <Snowflake size={22} />
                    <div>
                      <strong>Pension climatisée</strong>
                      <p>L'espace pension est climatisé pour préserver le bien-être des chiens lors des périodes chaudes.</p>
                    </div>
                  </article>
                </div>

                <div className="client-calendar client-calendar--kennel">
                  <div className="client-calendar__header">
                    <div>
                      <span>Disponibilités pension</span>
                      <strong>{getMonthLabel(clientKennelCalendarMonth)}</strong>
                    </div>
                    <div>
                      <button type="button" onClick={() => setClientKennelCalendarMonth(shiftMonth(clientKennelCalendarMonth, -1))}>
                        Précédent
                      </button>
                      <button type="button" onClick={() => setClientKennelCalendarMonth(shiftMonth(clientKennelCalendarMonth, 1))}>
                        Suivant
                      </button>
                    </div>
                  </div>

                  <div className="client-calendar__legend" aria-label="Légende disponibilités pension">
                    <span><i className="is-available" /> Disponible</span>
                    <span><i className="is-nearly-full" /> Presque complet</span>
                    <span><i className="is-full" /> Complet</span>
                    <span><i className="is-blocked" /> Fermé</span>
                  </div>

                  <div className="client-calendar__grid">
                    {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => (
                      <span key={`kennel-${day}`} className="client-calendar__weekday">{day}</span>
                    ))}
                    {clientKennelCalendarDays.map((day) => (
                      <button
                        key={`kennel-calendar-${day.date}`}
                        type="button"
                        className={`client-calendar__day ${day.inMonth ? "" : "is-muted"} ${day.available ? "is-available" : ""} ${day.isNearlyFull && day.available ? "is-nearly-full" : ""} ${day.blockedDate ? "is-blocked" : ""} ${day.isFull ? "is-full" : ""} ${[kennelBookingForm.startDate, kennelBookingForm.endDate].includes(day.date) ? "is-selected" : ""}`}
                        onClick={() => selectKennelCalendarDay(day)}
                        disabled={!day.available}
                      >
                        <strong>{day.dayNumber}</strong>
                        <span>
                          {day.blockedDate
                            ? "Fermé"
                            : day.isFull
                            ? "Complet"
                            : day.isNearlyFull
                            ? "1 place"
                            : `${day.remainingSpots} libres`}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="client-calendar__note">Touchez une première date pour l'arrivée, puis une deuxième pour le départ.</p>
                </div>
              </div>

              <form className="service-form" onSubmit={requestKennelBooking}>
                <h2>Demande de pension</h2>
                {!isLogged && <p className="login-note">Connecte-toi ou crée un compte pour envoyer une demande.</p>}
                <p className="login-note">
                  Le chien doit être sociable avec ses congénères. Une pré-visite à la pension canine sera organisée avant le séjour.
                </p>

                <div className="service-form__grid">
                  <label>
                    <span>Arrivée</span>
                    <input
                      type="date"
                      min={getLocalIsoDate()}
                      value={kennelBookingForm.startDate}
                      onChange={(e) => setKennelBookingForm({ ...kennelBookingForm, startDate: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>Départ</span>
                    <input
                      type="date"
                      min={kennelBookingForm.startDate || getLocalIsoDate()}
                      value={kennelBookingForm.endDate}
                      onChange={(e) => setKennelBookingForm({ ...kennelBookingForm, endDate: e.target.value })}
                    />
                  </label>
                </div>

                <label>
                  <span>Téléphone</span>
                  <input
                    value={kennelBookingForm.phone}
                    onChange={(e) => setKennelBookingForm({ ...kennelBookingForm, phone: e.target.value })}
                    placeholder="Numéro de contact"
                  />
                </label>

                <div className="service-form__grid">
                  <label>
                    <span>Nom du chien</span>
                    <input
                      value={kennelBookingForm.dogName}
                      onChange={(e) => setKennelBookingForm({ ...kennelBookingForm, dogName: e.target.value })}
                      placeholder="Nom"
                    />
                  </label>
                  <label>
                    <span>Race</span>
                    <input
                      value={kennelBookingForm.dogBreed}
                      onChange={(e) => setKennelBookingForm({ ...kennelBookingForm, dogBreed: e.target.value })}
                      placeholder="Race ou croisé"
                    />
                  </label>
                  <label>
                    <span>Photo du chien</span>
                    <input
                      value={kennelBookingForm.dogPhotoUrl}
                      onChange={(e) => setKennelBookingForm({ ...kennelBookingForm, dogPhotoUrl: e.target.value })}
                      placeholder="Lien d'une photo, facultatif"
                    />
                  </label>
                </div>

                <div className="service-form__grid">
                  <label>
                    <span>Année de naissance</span>
                    <input
                      type="number"
                      min="1990"
                      max={new Date().getFullYear()}
                      value={kennelBookingForm.dogBirthYear}
                      onChange={(e) => setKennelBookingForm({ ...kennelBookingForm, dogBirthYear: e.target.value })}
                      placeholder="Ex. 2020"
                    />
                  </label>
                  <label>
                    <span>Sexe</span>
                    <select
                      value={kennelBookingForm.dogSex}
                      onChange={(e) => setKennelBookingForm({ ...kennelBookingForm, dogSex: e.target.value })}
                    >
                      <option value="">Non renseigné</option>
                      <option>Femelle</option>
                      <option>Mâle</option>
                    </select>
                  </label>
                </div>

                <div className="service-checkbox-grid">
                  <label className="service-checkbox">
                    <input
                      type="checkbox"
                      checked={kennelBookingForm.vaccinesUpToDate}
                      onChange={(e) => setKennelBookingForm({ ...kennelBookingForm, vaccinesUpToDate: e.target.checked })}
                    />
                    <span>Vaccins à jour</span>
                  </label>

                  <label className="service-checkbox">
                    <input
                      type="checkbox"
                      checked={kennelBookingForm.sterilized}
                      onChange={(e) => setKennelBookingForm({ ...kennelBookingForm, sterilized: e.target.checked })}
                    />
                    <span>Chien stérilisé</span>
                  </label>
                </div>

                <label>
                  <span>Habitudes et précisions</span>
                  <textarea
                    value={kennelBookingForm.notes}
                    onChange={(e) => setKennelBookingForm({ ...kennelBookingForm, notes: e.target.value })}
                    placeholder="Alimentation, traitement, comportement, vétérinaire..."
                    rows="4"
                  />
                </label>

                <button type="submit" className="primary-action">
                  Envoyer la demande
                </button>
              </form>
            </div>
          </section>
        )}

        {screen === "contact" && (
          <section className="service-page">
            <div className="service-hero service-hero--contact">
              <div>
                <p className="shop-eyebrow">Contact</p>
                <h1>Une question ou une demande ?</h1>
                <p>
                  Envoyez votre message à la ferme. Il sera conservé dans l'espace admin
                  pour pouvoir vous répondre facilement.
                </p>
              </div>
              <span className="service-hero__icon">
                <Mail size={42} />
              </span>
            </div>

            <div className="service-layout">
              <div className="service-panel">
                <h2>Nous écrire</h2>
                <div className="service-list">
                  <article>
                    <Mail size={22} />
                    <div>
                      <strong>Message centralisé</strong>
                      <p>Votre demande arrive directement dans l'espace admin de l'application.</p>
                    </div>
                  </article>
                  <article>
                    <ShoppingBasket size={22} />
                    <div>
                      <strong>Œufs, ferme ou pension</strong>
                      <p>Vous pouvez poser une question sur les commandes, les activités ou les séjours chiens.</p>
                    </div>
                  </article>
                  <article>
                    <ShieldCheck size={22} />
                    <div>
                      <strong>Données limitées</strong>
                      <p>Vos coordonnées servent uniquement à répondre à votre demande.</p>
                    </div>
                  </article>
                  <article>
                    <Mail size={22} />
                    <div>
                      <strong>Contact direct</strong>
                      <p>{publicContactEmail}</p>
                      <p>{publicContactPhone}</p>
                    </div>
                  </article>
                </div>
              </div>

              <form className="service-form" onSubmit={submitContactMessage}>
                <h2>Formulaire de contact</h2>
                <div className="service-form__grid">
                  <label>
                    <span>Nom complet</span>
                    <input
                      value={contactForm.fullName}
                      onChange={(e) => setContactForm({ ...contactForm, fullName: e.target.value })}
                      placeholder="Votre nom"
                      required
                    />
                  </label>
                  <label>
                    <span>Email</span>
                    <input
                      type="email"
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      placeholder="votre@email.fr"
                      required
                    />
                  </label>
                </div>
                <label>
                  <span>Téléphone</span>
                  <input
                    type="tel"
                    value={contactForm.phone}
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                    placeholder="06 00 00 00 00"
                  />
                </label>
                <label>
                  <span>Sujet</span>
                  <input
                    value={contactForm.subject}
                    onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                    placeholder="Commande, activité, pension canine..."
                  />
                </label>
                <label>
                  <span>Message</span>
                  <textarea
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    placeholder="Votre message"
                    rows="6"
                    required
                  />
                </label>

                <button type="submit" className="primary-action">
                  Envoyer le message
                </button>
                <p className="form-privacy-note">
                  Les informations transmises via ce formulaire sont utilisées uniquement pour traiter votre demande.
                  Elles ne sont pas revendues et peuvent être consultées, corrigées ou supprimées sur simple demande.
                </p>
              </form>
            </div>
          </section>
        )}

        {(screen === "register" || screen === "login" || screen === "forgot-password" || screen === "reset-password") && (
          <section className="auth-page">
            <div className="auth-visual">
              <img src="/logo-poulettes.png" alt={publicFarmName} />
              <div>
                <p className="shop-eyebrow">Espace client</p>
                <h1>
                  {screen === "register"
                    ? "Créer votre compte"
                    : screen === "forgot-password"
                    ? "Mot de passe oublié"
                    : screen === "reset-password"
                    ? "Nouveau mot de passe"
                    : "Bienvenue"}
                </h1>
                <p>
                  Retrouvez vos commandes, choisissez une date de livraison et suivez la
                  préparation de vos boîtes d'œufs.
                </p>
              </div>
            </div>

            <div className="auth-card">
              {screen !== "forgot-password" && screen !== "reset-password" && (
                <div className="auth-tabs" aria-label="Choix connexion ou inscription">
                  <button
                    type="button"
                    onClick={() => setScreen("login")}
                    className={screen === "login" ? "is-active" : ""}
                  >
                    Connexion
                  </button>
                  <button
                    type="button"
                    onClick={() => setScreen("register")}
                    className={screen === "register" ? "is-active" : ""}
                  >
                    Création
                  </button>
                </div>
              )}

              <form
                onSubmit={
                  screen === "register"
                    ? register
                    : screen === "forgot-password"
                    ? requestPasswordReset
                    : screen === "reset-password"
                    ? updateForgottenPassword
                    : loginAsClient
                }
                className="auth-form"
              >
                {screen === "register" && (
                  <>
                    <label className="auth-field">
                      <span>Nom complet</span>
                      <div>
                        <UserRound size={19} />
                        <input
                          value={form.fullName}
                          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                          placeholder="Votre nom"
                          required
                        />
                      </div>
                    </label>

                    <label className="auth-field">
                      <span>Adresse de livraison</span>
                      <div className="auth-textarea-wrap">
                        <MapPin size={19} />
                        <textarea
                          value={form.deliveryAddress}
                          onChange={(e) => setForm({ ...form, deliveryAddress: e.target.value })}
                          placeholder="Adresse complète, lieu de dépôt..."
                          rows="3"
                          required
                        />
                      </div>
                    </label>
                    <label className="auth-field">
                      <span>Téléphone</span>
                      <div>
                        <UserRound size={19} />
                        <input
                          type="tel"
                          value={form.phone}
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                          placeholder="06 00 00 00 00"
                          required
                        />
                      </div>
                    </label>
                  </>
                )}

                {screen !== "reset-password" && (
                  <label className="auth-field">
                    <span>Email</span>
                    <div>
                      <Mail size={19} />
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="vous@email.fr"
                        required
                      />
                    </div>
                  </label>
                )}

                {screen !== "forgot-password" && (
                  <label className="auth-field">
                    <span>{screen === "reset-password" ? "Nouveau mot de passe" : "Mot de passe"}</span>
                    <div className="auth-password-wrap">
                      <LockKeyhole size={19} />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        placeholder={screen === "register" || screen === "reset-password" ? "6 caractères minimum" : "Votre mot de passe"}
                      />
                      <button
                        type="button"
                        className="auth-password-toggle"
                        onClick={() => setShowPassword((visible) => !visible)}
                        aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                        title={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                      >
                        <Eye size={18} />
                      </button>
                    </div>
                  </label>
                )}

                {screen === "forgot-password" && passwordResetEmailSent && (
                  <p className="auth-help-message">
                    Si cette adresse correspond à un compte, un email de réinitialisation vient d'être envoyé.
                  </p>
                )}

                {screen === "login" && (
                  <button
                    type="button"
                    className="auth-forgot-link"
                    onClick={() => {
                      setPasswordResetEmailSent(false);
                      setScreen("forgot-password");
                    }}
                  >
                    Mot de passe oublié ?
                  </button>
                )}

                <button className="auth-submit">
                  {screen === "register"
                    ? "Créer mon compte"
                    : screen === "forgot-password"
                    ? "Recevoir le lien"
                    : screen === "reset-password"
                    ? "Enregistrer le mot de passe"
                    : "Me connecter"}
                </button>
                <p className="form-privacy-note">
                  Les informations renseignées sont utilisées uniquement pour gérer votre compte, vos commandes
                  et vos réservations auprès de {publicFarmName}. Elles ne sont pas revendues et peuvent être
                  consultées, corrigées ou supprimées sur simple demande.
                </p>
              </form>

              <p className="auth-switch">
                {screen === "register"
                  ? "Vous avez déjà un compte ?"
                  : screen === "forgot-password" || screen === "reset-password"
                  ? "Vous voulez revenir à la connexion ?"
                  : "Pas encore de compte ?"}
                <button
                  type="button"
                  onClick={() => {
                    setPasswordResetEmailSent(false);
                    setScreen(screen === "register" ? "login" : screen === "login" ? "register" : "login");
                  }}
                >
                  {screen === "register"
                    ? "Se connecter"
                    : screen === "forgot-password" || screen === "reset-password"
                    ? "Retour connexion"
                    : "Créer un compte"}
                </button>
              </p>
            </div>
          </section>
        )}

        {screen === "shop" && (
          <section className="shop-page">
            <div className="shop-hero">
              <div>
                <p className="shop-eyebrow">Boutique</p>
                <h1>{isLogged ? `Bonjour ${name}` : "Bonjour"}</h1>
                <p>
                  Choisissez vos boîtes, indiquez une date, et le stock se mettra à jour
                  automatiquement après validation.
                </p>
              </div>

              <div className={`stock-card ${stockEggs < 24 ? "stock-card--low" : ""}`}>
                <PackageCheck size={28} strokeWidth={2.1} />
                <div>
                  <span>Stock disponible</span>
                  <strong>{stockEggs} œufs</strong>
                  {stockEggs < 24 && <em>Stock faible</em>}
                </div>
              </div>
            </div>

            <div className="shop-layout">
              <div className="product-grid">
                {products.filter((p) => p.active).map((p) => (
                  <article key={p.id} className="product-card">
                    <div className="product-image-wrap">
                      <img src={p.image || "/images/marais.jpg"} alt={p.name} className="product-image" />
                      <span>{p.unit_label}</span>
                    </div>

                    <div className="product-body">
                      <div>
                        <h2>{p.name}</h2>
                        <p>{p.size_eggs > 0 ? "Œufs frais de l'élevage, préparés pour votre livraison." : "Produit frais disponible à la commande."}</p>
                      </div>

                      <div className="product-meta">
                        <strong>{p.price.toFixed(2)} EUR</strong>
                        <span>{getProductUnitPriceLabel(p)}</span>
                      </div>

                      <div className="qty-control" aria-label={`Quantite ${p.name}`}>
                        <button
                          type="button"
                          onClick={() => updateQty(p.id, -1)}
                          aria-label={`Retirer une ${p.name}`}
                          disabled={(cart[p.id] || 0) === 0}
                        >
                          <Minus size={18} />
                        </button>

                        <span>{cart[p.id] || 0}</span>

                        <button
                          type="button"
                          onClick={() => updateQty(p.id, 1)}
                          aria-label={`Ajouter une ${p.name}`}
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <aside className="order-panel">
                <div className="order-panel__title">
                  <span>
                    <ShoppingBasket size={24} />
                  </span>
                  <div>
                    <h2>Commande</h2>
                    <p>{selectedCartItems.length > 0 ? `${selectedCartItems.length} produit(s) selectionne(s)` : "Panier vide"}</p>
                  </div>
                </div>

                <div className="order-lines">
                  {selectedCartItems.map((item) => (
                    <div key={item.id}>
                      <span>{item.name}</span>
                      <strong>{item.quantity}</strong>
                    </div>
                  ))}
                  {hasSelectedEggProducts && (
                    <div>
                      <span>Œufs dans la commande</span>
                      <strong>{totalEggs}</strong>
                    </div>
                  )}
                </div>

                <label className="date-field">
                  <span>
                    <CalendarDays size={18} />
                    Date disponible
                  </span>
                  <select
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                  >
                    <option value="">Choisir un créneau</option>
                    {availableDeliverySlots.map((slot) => (
                      <option key={slot.id} value={slot.delivery_date}>
                        {formatDeliveryDate(slot.delivery_date)}
                        {slot.label ? ` - ${slot.label}` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                {availableDeliverySlots.length === 0 && (
                  <p className="login-note">
                    Aucun créneau de livraison n'est ouvert pour le moment.
                  </p>
                )}

                <label className="date-field">
                  <span>Adresse de livraison</span>
                  <textarea
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Adresse complète, lieu de dépôt..."
                    rows="3"
                  />
                </label>

                <label className="date-field">
                  <span>Commentaire</span>
                  <textarea
                    value={orderComment}
                    onChange={(e) => setOrderComment(e.target.value)}
                    placeholder="Précision utile pour la commande"
                    rows="3"
                  />
                </label>

                {!isLogged && (
                  <p className="login-note">
                    Créez un compte ou connectez-vous pour enregistrer la commande.
                  </p>
                )}

                {isLogged && !canOrderEggs && !isAdmin && (
                  <p className="login-note">
                    La commande d'œufs est réservée aux clients fidèles. Votre compte est créé,
                    mais l'accès doit être activé par la ferme.
                  </p>
                )}

                <div className="order-total">
                  <span>Total</span>
                  <strong>{total.toFixed(2)} EUR</strong>
                </div>

                <button
                  type="button"
                  onClick={isLogged ? placeOrder : () => setScreen("register")}
                  className="order-submit"
                  disabled={isLogged && !canOrderEggs && !isAdmin}
                >
                  {isLogged ? "Valider ma commande" : "Créer mon compte"}
                </button>
              </aside>
            </div>
          </section>
        )}

        {screen === "confirmation" && (
          <section className="confirmation-page">
            <div className="confirmation-card">
              <span className="confirmation-icon">
                <CheckCircle2 size={44} strokeWidth={2} />
              </span>

              <p className="shop-eyebrow">Commande confirmée</p>
              <h1>Votre commande est bien enregistrée</h1>
              <p>
                Elle apparaît maintenant dans votre espace client. Vous pourrez y suivre
                son statut jusqu’à la préparation.
              </p>

              <div className="confirmation-steps" aria-label="Étapes de commande">
                <div className="is-done">
                  <span>1</span>
                  <strong>Enregistree</strong>
                </div>
                <div>
                  <span>2</span>
                  <strong>À préparer</strong>
                </div>
                <div>
                  <span>3</span>
                  <strong>Prête</strong>
                </div>
              </div>

              <div className="confirmation-actions">
                <button onClick={() => setScreen("shop")} className="secondary-action">
                  Nouvelle commande
                </button>
                <button onClick={goToMyOrders} className="primary-action">
                  Voir mes commandes
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </section>
        )}

        {screen === "myOrders" && (
          <section className="orders-page">
            <div className="orders-header">
              <div>
                <p className="shop-eyebrow">Espace client</p>
                <h1>Mon compte</h1>
                <p>Retrouvez vos informations, commandes, réservations et chiens au même endroit.</p>
              </div>

              <div className="profile-actions">
                <button type="button" onClick={goToProfile} className="secondary-action">
                  Modifier mes infos
                </button>
                <button
                  type="button"
                  onClick={enableClientPushNotifications}
                  className="secondary-action"
                  disabled={clientPushStatus === "saving"}
                >
                  {clientPushStatus === "enabled" ? "Notifications actives" : "Activer notifications"}
                </button>
                <button onClick={() => setScreen("shop")} className="primary-action">
                  Nouvelle commande
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>

            <div className="client-account-actions" aria-label="Accès rapides du compte client">
              <button type="button" onClick={() => setScreen("shop")}>
                <span>
                  <ShoppingBasket size={24} />
                </span>
                <strong>Commander</strong>
                <em>{latestClientOrderStatus ? `Dernière commande : ${latestClientOrderStatus}` : "Passer une commande d'oeufs"}</em>
                <ChevronRight size={20} />
              </button>
              <button type="button" onClick={() => setScreen("education")}>
                <span>
                  <School size={24} />
                </span>
                <strong>Ferme pédagogique</strong>
                <em>{clientAccountEducationBookings.length} réservation{clientAccountEducationBookings.length > 1 ? "s" : ""}</em>
                <ChevronRight size={20} />
              </button>
              <button type="button" onClick={() => setScreen("kennel")}>
                <span>
                  <PawPrint size={24} />
                </span>
                <strong>Pension canine</strong>
                <em>{clientAccountKennelBookings.length} séjour{clientAccountKennelBookings.length > 1 ? "s" : ""}</em>
                <ChevronRight size={20} />
              </button>
              <button type="button" onClick={goToProfile}>
                <span>
                  <UserRound size={24} />
                </span>
                <strong>Mes infos</strong>
                <em>{clientNotificationLabel}</em>
                <ChevronRight size={20} />
              </button>
            </div>

            <div className="client-account-summary">
              <article>
                <span>Commandes</span>
                <strong>{myOrders.length}</strong>
              </article>
              <article>
                <span>Réservations ferme</span>
                <strong>{clientAccountEducationBookings.length}</strong>
              </article>
              <article>
                <span>Séjours pension</span>
                <strong>{clientAccountKennelBookings.length}</strong>
              </article>
              <article>
                <span>Chiens</span>
                <strong>{clientAccountDogs.length}</strong>
              </article>
            </div>

            <div className="client-account-grid">
              <section className="client-account-card client-account-card--info">
                <div className="client-account-title">
                  <span><UserRound size={22} /></span>
                  <div>
                    <h2>Mes infos</h2>
                    <p>{clientAccountProfile?.email || currentUser?.email || "Email non renseigné"}</p>
                  </div>
                </div>
                <div className="client-account-info">
                  <article>
                    <span>Nom</span>
                    <strong>{clientAccountProfile?.full_name || name || "Non renseigné"}</strong>
                  </article>
                  <article>
                    <span>Téléphone</span>
                    <strong>{clientAccountProfile?.phone || profileForm.phone || "Non renseigné"}</strong>
                  </article>
                  <article>
                    <span>Adresse</span>
                    <strong>{clientAccountProfile?.delivery_address || deliveryAddress || "Non renseignée"}</strong>
                  </article>
                </div>
              </section>

              <section className="client-account-card">
                <div className="client-account-title">
                  <span><ShoppingBasket size={22} /></span>
                  <div>
                    <h2>Mes commandes</h2>
                    <p>Suivi des commandes d'œufs et produits.</p>
                  </div>
                </div>
                <div className="client-account-list">
                  {myOrders.slice(0, 6).map((o) => (
                    <article key={o.id}>
                      <strong>Commande du {formatDeliveryDate(o.delivery_date)}</strong>
                      <span>{getOrderSummary(o)}</span>
                      <em>{getOrderEggs(o)} œufs - {o.status}</em>
                      <div className="client-order-progress" data-step={getOrderStatusStep(o.status)}>
                        {["Envoyée", "Préparation", "Prête", "Livrée"].map((step, index) => (
                          <span key={step} className={getOrderStatusStep(o.status) >= index ? "is-active" : ""}>
                            {step}
                          </span>
                        ))}
                      </div>
                    </article>
                  ))}
                  {myOrders.length === 0 && <p>Aucune commande pour le moment.</p>}
                </div>
              </section>

              <section className="client-account-card">
                <div className="client-account-title">
                  <span><School size={22} /></span>
                  <div>
                    <h2>Mes réservations ferme</h2>
                    <p>Visites et activités pédagogiques.</p>
                  </div>
                </div>
                <div className="client-account-list">
                  {clientAccountEducationBookings.slice(0, 6).map((booking) => (
                    <article key={booking.id}>
                      <strong>{formatDeliveryDate(booking.booking_date)} - {booking.activity_type}</strong>
                      <span>{booking.participants} participant{Number(booking.participants || 0) > 1 ? "s" : ""}</span>
                      <em>{booking.status || "Demandée"}</em>
                    </article>
                  ))}
                  {clientAccountEducationBookings.length === 0 && <p>Aucune réservation ferme.</p>}
                </div>
              </section>

              <section className="client-account-card">
                <div className="client-account-title">
                  <span><PawPrint size={22} /></span>
                  <div>
                    <h2>Ma pension canine</h2>
                    <p>Séjours et demandes pour vos chiens.</p>
                  </div>
                </div>
                <div className="client-account-list">
                  {clientAccountKennelBookings.slice(0, 6).map((booking) => (
                    <article key={booking.id}>
                      <strong>{booking.dog?.name || "Chien"} - {formatDeliveryDate(booking.start_date)} au {formatDeliveryDate(booking.end_date)}</strong>
                      <span>{booking.phone || "Téléphone non renseigné"}</span>
                      <em>{booking.status || "Demandée"}</em>
                    </article>
                  ))}
                  {clientAccountKennelBookings.length === 0 && <p>Aucun séjour pension.</p>}
                </div>
              </section>

              <section className="client-account-card client-account-card--dogs">
                <div className="client-account-title">
                  <span><Dog size={22} /></span>
                  <div>
                    <h2>Mes chiens</h2>
                    <p>Fiches liées aux séjours pension.</p>
                  </div>
                </div>
                <div className="client-account-dogs">
                  {clientAccountDogs.map((profile) => (
                    <article key={profile.dog?.id || profile.dog?.name}>
                      <DogAvatar dog={profile.dog} />
                      <div>
                        <strong>{profile.dog?.name || "Chien"}</strong>
                        <span>{[profile.dog?.breed, profile.dog?.sex, profile.dog?.birth_year].filter(Boolean).join(" - ") || "Infos à compléter"}</span>
                        <em>{profile.bookings.length} séjour{profile.bookings.length > 1 ? "s" : ""}</em>
                      </div>
                    </article>
                  ))}
                  {clientAccountDogs.length === 0 && <p>Aucune fiche chien pour le moment.</p>}
                </div>
              </section>
            </div>
          </section>
        )}

        {screen === "profile" && (
          <section className="profile-page">
            <div className="profile-header">
              <div>
                <p className="shop-eyebrow">Espace client</p>
                <h1>Mon profil</h1>
                <p>Modifiez vos informations de livraison pour les prochaines commandes.</p>
              </div>
              <button type="button" onClick={() => setScreen("shop")} className="secondary-action">
                Retour boutique
              </button>
            </div>

            <form className="profile-card" onSubmit={saveProfile}>
              <label className="auth-field">
                <span>Nom complet</span>
                <div>
                  <UserRound size={19} />
                  <input
                    value={profileForm.fullName}
                    onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                    placeholder="Votre nom"
                  />
                </div>
              </label>

              <label className="auth-field">
                <span>Téléphone</span>
                <div>
                  <UserRound size={19} />
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    placeholder="06 00 00 00 00"
                  />
                </div>
              </label>

              <label className="auth-field">
                <span>Adresse de livraison</span>
                <div className="auth-textarea-wrap">
                  <MapPin size={19} />
                  <textarea
                    value={profileForm.deliveryAddress}
                    onChange={(e) => setProfileForm({ ...profileForm, deliveryAddress: e.target.value })}
                    placeholder="Adresse complète, lieu de dépôt..."
                    rows="4"
                  />
                </div>
              </label>

              <div className="profile-actions">
                <button type="submit" className="primary-action">
                  Enregistrer
                </button>
                <button type="button" onClick={() => setScreen("shop")} className="secondary-action">
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={enableClientPushNotifications}
                  className="secondary-action"
                  disabled={clientPushStatus === "saving"}
                >
                  {clientPushStatus === "enabled" ? "Notifications actives" : "Activer notifications"}
                </button>
              </div>
            </form>
          </section>
        )}

        {screen === "admin" && (
          <section className="admin-page" data-admin-view={adminView}>
            <div className="admin-hero">
              <div>
                <p className="shop-eyebrow">Tableau de bord</p>
                <h1>Espace admin</h1>
                <p>Suivez le stock, préparez les commandes et mettez les statuts à jour.</p>
              </div>
              <div className="admin-hero__actions">
                <button
                  type="button"
                  onClick={enableAdminPushNotifications}
                  className="primary-action"
                >
                  {pushStatus === "enabled" ? "Notifications actives" : "Activer notifications"}
                </button>
                <button
                  type="button"
                  onClick={testAdminPushNotification}
                  className="secondary-action"
                >
                  Tester notification
                </button>
                <button
                  type="button"
                  onClick={() => setAdminView("announcements")}
                  className="primary-action"
                >
                  Annonce groupée
                </button>
                <button
                  type="button"
                  onClick={checkForAppUpdate}
                  className="secondary-action admin-update-button"
                  disabled={checkingAppUpdate}
                >
                  {checkingAppUpdate ? "Vérification..." : "Mettre à jour l'app"}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await loadOrders();
                    await loadCustomerProfiles();
                    await loadClientPushSubscriptions();
                    await loadAdminPushSubscriptions();
                    await loadStock();
                    await loadDeliverySlots();
                    await loadProducts();
                    await loadEducationActivities();
                    await loadEducationDateSlots();
                    await loadEducationBookings();
                    await loadKennelServices();
                    await loadKennelBookings();
                    await loadKennelBlockedDates();
                    await loadContactMessages();
                    await loadAdminReminders();
                    await loadAdminActionLogs();
                    await loadAnnouncementHistory();
                    await loadAboutContent();
                    await loadHomeFeaturedEvent();
                    await loadHomeNews();
                    await loadKennelContent();
                    await loadAppSettings();
                    await loadTrafficEvents();
                  }}
                  className="secondary-action"
                >
                  Actualiser
                </button>
                <button
                  type="button"
                  onClick={exportAllDataBackup}
                  className="secondary-action"
                >
                  Sauvegarde complète
                </button>
              </div>
            </div>

            <section className="admin-global-search" aria-label="Recherche globale admin">
              <label>
                <Search size={20} />
                <input
                  value={adminGlobalSearch}
                  onChange={(e) => setAdminGlobalSearch(e.target.value)}
                  placeholder="Recherche globale : client, téléphone, chien, email, commande, réservation..."
                />
              </label>
              {adminGlobalSearch.trim() && (
                <div className="admin-global-search__results">
                  {adminGlobalSearchResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => {
                        result.action();
                        setAdminGlobalSearch("");
                      }}
                    >
                      <span>{result.type}</span>
                      <strong>{result.title}</strong>
                      <em>{result.detail || "Ouvrir le résultat"}</em>
                    </button>
                  ))}
                  {adminGlobalSearchResults.length === 0 && (
                    <p>Aucun résultat trouvé.</p>
                  )}
                </div>
              )}
            </section>

            <nav className="admin-mobile-quickbar" aria-label="Actions admin rapides">
              <button type="button" onClick={() => setAdminView("assistant")}>
                <ClipboardList size={16} />
                Assistant
              </button>
              <button type="button" onClick={() => setAdminView("today")}>
                <CalendarDays size={16} />
                Aujourd'hui
              </button>
              <button type="button" onClick={() => applyAdminShortcut("toPrepare")}>
                <PackageCheck size={16} />
                À préparer
              </button>
              <button type="button" onClick={() => setAdminView("kennel")}>
                <Dog size={16} />
                Pension
              </button>
              <button type="button" onClick={() => setAdminView("clients")}>
                <UsersRound size={16} />
                Clients
              </button>
              <button type="button" onClick={() => setAdminView("contacts")}>
                <Mail size={16} />
                Messages
              </button>
            </nav>

            <nav className="admin-tabs admin-tabs--grouped" aria-label="Sections admin">
              {[
                {
                  title: "Tableau de bord",
                  tabs: [
                    { value: "overview", label: "Vue d'ensemble" },
                    { value: "assistant", label: "Assistant" },
                    { value: "today", label: "Planning du jour" },
                    { value: "health", label: "Santé appli" },
                  ],
                },
                {
                  title: "Œufs",
                  tabs: [
                    { value: "eggs", label: "Commandes" },
                    { value: "accounting", label: "Comptabilité" },
                  ],
                },
                {
                  title: "Ferme",
                  tabs: [{ value: "education", label: "Ferme pédagogique" }],
                },
                {
                  title: "Pension",
                  tabs: [
                    { value: "kennel", label: "Réservations" },
                    { value: "kennelDogs", label: "Fiches chiens" },
                    { value: "kennelPhotos", label: "Photos pension" },
                  ],
                },
                {
                  title: "Clients",
                  tabs: [
                    { value: "clients", label: "Clients" },
                    { value: "contacts", label: "Messages" },
                    { value: "templates", label: "Modèles" },
                  ],
                },
                {
                  title: "Communication",
                  tabs: [
                    { value: "announcements", label: "Annonces" },
                    { value: "news", label: "Actualités" },
                    { value: "media", label: "Médias" },
                    { value: "content", label: "Présentation" },
                  ],
                },
                {
                  title: "Suivi",
                  tabs: [
                    { value: "statistics", label: "Statistiques" },
                    { value: "traffic", label: "Trafic" },
                    { value: "audit", label: "Journal" },
                    { value: "settings", label: "Réglages" },
                  ],
                },
              ].map((group) => (
                <div key={group.title} className="admin-tab-group">
                  <span className="admin-tab-group__title">{group.title}</span>
                  <div className="admin-tab-group__buttons">
                    {group.tabs.map((tab) => (
                      <button
                        key={tab.value}
                        type="button"
                        className={adminView === tab.value ? "is-active" : ""}
                        onClick={() => setAdminView(tab.value)}
                      >
                        {tab.label}
                        {tab.value === "overview" && adminUrgentAlertCount > 0 && (
                          <span className={`admin-tab-badge admin-tab-badge--${adminAlertBadgeTone}`}>
                            {adminUrgentAlertCount}
                          </span>
                        )}
                        {tab.value === "health" && healthIssueCount > 0 && (
                          <span className={`admin-tab-badge admin-tab-badge--${healthCheckCounts.danger > 0 ? "danger" : "warning"}`}>
                            {healthIssueCount}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>

            <div className="admin-stats">
              <article>
                <span><ClipboardList size={24} /></span>
                <p>Commandes</p>
                <strong>{adminStats.totalOrders}</strong>
              </article>
              <article>
                <span><PackageCheck size={24} /></span>
                <p>À préparer</p>
                <strong>{adminStats.toPrepare}</strong>
              </article>
              <article>
                <span><CheckCircle2 size={24} /></span>
                <p>Prêtes</p>
                <strong>{adminStats.ready}</strong>
              </article>
              <article>
                <span><Boxes size={24} /></span>
                <p>Œufs vendus</p>
                <strong>{adminStats.eggsSold}</strong>
              </article>
              <article>
                <span><Euro size={24} /></span>
                <p>CA estimé</p>
                <strong>{adminStats.revenue.toFixed(2)} EUR</strong>
              </article>
              <article>
                <span><School size={24} /></span>
                <p>Résa activités</p>
                <strong>{educationBookings.length}</strong>
              </article>
              <article>
                <span><Dog size={24} /></span>
                <p>Résa chiens</p>
                <strong>{kennelBookings.length}</strong>
              </article>
              <article>
                <span><Mail size={24} /></span>
                <p>Messages</p>
                <strong>{activeContactMessages.filter((message) => message.status !== "Traité").length}</strong>
              </article>
            </div>

            <section className="admin-shortcuts" aria-label="Filtres rapides admin">
              <button type="button" onClick={() => applyAdminShortcut("todayOrders")}>
                <CalendarDays size={20} />
                <span>Commandes du jour</span>
                <strong>{todayOrdersCount}</strong>
              </button>
              <button type="button" onClick={() => applyAdminShortcut("toPrepare")}>
                <PackageCheck size={20} />
                <span>À préparer</span>
                <strong>{adminStats.toPrepare}</strong>
              </button>
              <button type="button" onClick={() => applyAdminShortcut("pendingReservations")}>
                <CalendarCheck size={20} />
                <span>Réservations en attente</span>
                <strong>{pendingReservationsCount}</strong>
              </button>
              <button type="button" onClick={() => applyAdminShortcut("recentClients")}>
                <UsersRound size={20} />
                <span>Clients récents</span>
                <strong>{recentClientsCount}</strong>
              </button>
            </section>

            <section className={`admin-alerts ${importantAdminAlerts.length === 0 ? "admin-alerts--clear" : ""}`} aria-label="Alertes importantes">
              <div className="admin-alerts__header">
                <span>{importantAdminAlerts.length > 0 ? <AlertTriangle size={24} /> : <ShieldCheck size={24} />}</span>
                <div>
                  <p className="shop-eyebrow">Alertes importantes</p>
                  <h2>{importantAdminAlerts.length > 0 ? "À vérifier rapidement" : "Tout est à jour"}</h2>
                  {importantAdminAlerts.length > 0 && (
                    <div className="admin-alerts__summary" aria-label="Résumé des priorités">
                      <span className="admin-alert-priority admin-alert-priority--danger">{adminAlertCounts.danger} rouge</span>
                      <span className="admin-alert-priority admin-alert-priority--warning">{adminAlertCounts.warning} orange</span>
                      <span className="admin-alert-priority admin-alert-priority--info">{adminAlertCounts.info} info</span>
                    </div>
                  )}
                </div>
              </div>

              {importantAdminAlerts.length > 0 ? (
                <div className="admin-alerts__list">
                  {importantAdminAlerts.map((alert) => (
                    <article key={alert.id} className={`admin-alert admin-alert--${alert.tone}`}>
                      <div>
                        <span className={`admin-alert-priority admin-alert-priority--${alert.tone}`}>
                          {alert.priorityLabel}
                        </span>
                        <strong>{alert.title}</strong>
                        <p>{alert.detail}</p>
                      </div>
                      <button type="button" onClick={alert.action}>
                        {alert.actionLabel}
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="admin-alerts__empty">
                  Aucune commande sans adresse, réservation sans téléphone, vaccin à vérifier ou message client en attente.
                </p>
              )}
            </section>

            <section className={`admin-todo ${adminTodoItems.length === 0 ? "admin-todo--clear" : ""}`} aria-label="Actions à faire maintenant">
              <div className="admin-todo__header">
                <span>{adminTodoItems.length > 0 ? <ClipboardList size={24} /> : <CheckCircle2 size={24} />}</span>
                <div>
                  <p className="shop-eyebrow">À faire maintenant</p>
                  <h2>{adminTodoItems.length > 0 ? "Les actions prioritaires" : "Rien d'urgent à traiter"}</h2>
                  <p>
                    {adminTodoItems.length > 0
                      ? "Une liste courte pour savoir quoi ouvrir en premier sur téléphone."
                      : "Les commandes, réservations, paiements, messages et rappels importants sont à jour."}
                  </p>
                </div>
              </div>

              {adminTodoItems.length > 0 ? (
                <div className="admin-todo__list">
                  {adminTodoItems.map((item) => (
                    <article key={item.id} className={`admin-todo-item admin-todo-item--${item.tone}`}>
                      <div className="admin-todo-item__meta">
                        <span className={`admin-alert-priority admin-alert-priority--${item.tone}`}>
                          {item.priorityLabel}
                        </span>
                        <em>{item.source}</em>
                      </div>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.detail}</p>
                      </div>
                      <button type="button" onClick={item.action}>
                        {item.actionLabel}
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="admin-todo__empty">Aucune action prioritaire pour le moment.</p>
              )}
            </section>

            <div className="admin-archive-toggle" aria-label="Affichage archivage">
              <button
                type="button"
                onClick={() => setAdminArchiveView("active")}
                className={adminArchiveView === "active" ? "is-active" : ""}
              >
                Actifs
              </button>
              <button
                type="button"
                onClick={() => setAdminArchiveView("archived")}
                className={adminArchiveView === "archived" ? "is-active" : ""}
              >
                Archives
              </button>
              <button type="button" onClick={archiveOldRecords}>
                Archiver les anciens
              </button>
            </div>

            <section className="today-planning" aria-label="Planning du jour">
              <div className="today-planning__header">
                <div>
                  <p className="shop-eyebrow">Aujourd'hui</p>
                  <h2>{formatDeliveryDate(todayIso)}</h2>
                </div>
                <button type="button" onClick={() => setAdminView("overview")}>
                  Vue d'ensemble
                </button>
              </div>

              <div className="today-planning__grid">
                <article className="today-card">
                  <div className="today-card__title">
                    <span><Egg size={22} /></span>
                    <div>
                      <h3>Commandes à préparer</h3>
                      <p>{todayOrders.length} commande{todayOrders.length > 1 ? "s" : ""} aujourd'hui</p>
                    </div>
                  </div>
                  <div className="today-card__list">
                    {todayOrders.map((order) => (
                      <div key={`today-order-${order.id}`} className="today-item">
                        <strong>{order.client}</strong>
                        <span>{getOrderSummary(order)}</span>
                        <em>{order.address || "Adresse non renseignée"}</em>
                      </div>
                    ))}
                    {todayOrders.length === 0 && <p className="today-empty">Aucune commande prévue aujourd'hui.</p>}
                  </div>
                  <button type="button" className="today-card__action" onClick={() => applyAdminShortcut("todayOrders")}>
                    Voir les commandes
                  </button>
                </article>

                <article className="today-card">
                  <div className="today-card__title">
                    <span><School size={22} /></span>
                    <div>
                      <h3>Ferme pédagogique</h3>
                      <p>{todayEducationBookings.length} réservation{todayEducationBookings.length > 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <div className="today-card__list">
                    {todayEducationBookings.map((booking) => (
                      <div key={`today-education-${booking.id}`} className="today-item">
                        <strong>{booking.activity_type}</strong>
                        <span>{booking.client_name} - {booking.participants} participant{Number(booking.participants || 0) > 1 ? "s" : ""}</span>
                        <em>{booking.phone || "Téléphone non renseigné"}</em>
                      </div>
                    ))}
                    {todayEducationBookings.length === 0 && <p className="today-empty">Aucune animation prévue aujourd'hui.</p>}
                  </div>
                  <button type="button" className="today-card__action" onClick={() => setAdminView("education")}>
                    Voir la ferme
                  </button>
                </article>

                <article className="today-card">
                  <div className="today-card__title">
                    <span><Dog size={22} /></span>
                    <div>
                      <h3>Chiens présents</h3>
                      <p>{currentKennelGuests.length} chien{currentKennelGuests.length > 1 ? "s" : ""} à la pension</p>
                    </div>
                  </div>
                  <div className="today-card__list">
                    {currentKennelGuests.map((booking) => (
                      <div key={`today-kennel-${booking.id}`} className="today-item">
                        <strong>{booking.dog?.name || "Chien non renseigné"}</strong>
                        <span>{booking.client_name} - départ {formatDeliveryDate(booking.end_date)}</span>
                        <em>{booking.phone || "Téléphone non renseigné"}</em>
                      </div>
                    ))}
                    {currentKennelGuests.length === 0 && <p className="today-empty">Aucun chien présent aujourd'hui.</p>}
                  </div>
                  <button type="button" className="today-card__action" onClick={() => setAdminView("kennel")}>
                    Voir la pension
                  </button>
                </article>

                <article className="today-card today-card--messages">
                  <div className="today-card__title">
                    <span><Mail size={22} /></span>
                    <div>
                      <h3>Messages urgents</h3>
                      <p>{urgentContactMessages.length} message{urgentContactMessages.length > 1 ? "s" : ""} à traiter</p>
                    </div>
                  </div>
                  <div className="today-card__list">
                    {urgentContactMessages.map((message) => (
                      <div key={`today-message-${message.id}`} className="today-item">
                        <strong>{message.full_name || "Client"}</strong>
                        <span>{message.subject || "Message"}</span>
                        <em>{message.phone || message.email || "Coordonnées non renseignées"}</em>
                      </div>
                    ))}
                    {urgentContactMessages.length === 0 && <p className="today-empty">Aucun message urgent.</p>}
                  </div>
                  <button type="button" className="today-card__action" onClick={() => setAdminView("contacts")}>
                    Voir les messages
                  </button>
                </article>
              </div>
            </section>

            <section className="admin-dashboard">
              <article className="admin-dashboard-card admin-dashboard-card--eggs">
                <div className="admin-dashboard-card__header">
                  <span><Egg size={24} /></span>
                  <div>
                    <h2>Œufs</h2>
                    <p>{adminStats.toPrepare} commande{adminStats.toPrepare > 1 ? "s" : ""} à préparer</p>
                  </div>
                </div>
                <div className="admin-dashboard-card__metric">
                  <strong>{upcomingDeliveryDay ? formatDeliveryDate(upcomingDeliveryDay.date) : "Aucune date"}</strong>
                  <span>
                    {upcomingDeliveryDay
                      ? `${upcomingDeliveryDay.orders.length} commande${upcomingDeliveryDay.orders.length > 1 ? "s" : ""} - ${upcomingDeliveryDay.eggs} œufs`
                      : "Pas de tournée à venir"}
                  </span>
                </div>
                <ul>
                  {filteredOrders.slice(0, 3).map((order) => (
                    <li key={`dash-order-${order.id}`}>
                      <span>{order.client}</span>
                      <strong>{formatDeliveryDate(order.date)} - {getOrderSummary(order)}</strong>
                    </li>
                  ))}
                  {filteredOrders.length === 0 && <li><em>Aucune commande active.</em></li>}
                </ul>
              </article>

              <article className="admin-dashboard-card admin-dashboard-card--education">
                <div className="admin-dashboard-card__header">
                  <span><School size={24} /></span>
                  <div>
                    <h2>Ferme pédagogique</h2>
                    <p>{pendingEducationBookings.length} demande{pendingEducationBookings.length > 1 ? "s" : ""} à suivre</p>
                  </div>
                </div>
                <div className="admin-dashboard-card__metric">
                  <strong>{upcomingEducationSlot ? formatDeliveryDate(upcomingEducationSlot.activity_date) : "Aucune date"}</strong>
                  <span>
                    {upcomingEducationSlot
                      ? `${getEducationSlotParticipants(upcomingEducationSlot)}/${upcomingEducationSlot.capacity} participants`
                      : "Aucune activité ouverte à venir"}
                  </span>
                </div>
                <ul>
                  {pendingEducationBookings.slice(0, 3).map((booking) => (
                    <li key={`dash-education-${booking.id}`}>
                      <span>{booking.client_name}</span>
                      <strong>{formatDeliveryDate(booking.booking_date)} - {booking.activity_type}</strong>
                    </li>
                  ))}
                  {pendingEducationBookings.length === 0 && <li><em>Aucune demande pédagogique active.</em></li>}
                </ul>
              </article>

              <article className="admin-dashboard-card admin-dashboard-card--kennel">
                <div className="admin-dashboard-card__header">
                  <span><Dog size={24} /></span>
                  <div>
                    <h2>Pension canine</h2>
                    <p>{currentKennelGuests.length} chien{currentKennelGuests.length > 1 ? "s" : ""} présent{currentKennelGuests.length > 1 ? "s" : ""} aujourd'hui</p>
                  </div>
                </div>
                <div className="admin-dashboard-card__metric">
                  <strong>{pendingKennelBookings[0] ? formatDeliveryDate(pendingKennelBookings[0].start_date) : "Aucun séjour"}</strong>
                  <span>
                    {pendingKennelBookings[0]
                      ? `${pendingKennelBookings[0].dog?.name || "Chien"} - ${pendingKennelBookings[0].client_name}`
                      : "Pas de demande pension active"}
                  </span>
                </div>
                <button type="button" className="admin-card-action" onClick={() => setAdminView("kennelPhotos")}>
                  Gérer les photos pension
                </button>
                <ul>
                  {fullKennelNights.map((day) => (
                    <li key={`dash-full-${day.date}`}>
                      <span>Complet</span>
                      <strong>{formatDeliveryDate(day.date)} - {day.bookings.length}/{KENNEL_MAX_BOOKINGS_PER_NIGHT}</strong>
                    </li>
                  ))}
                  {fullKennelNights.length === 0 && <li><em>Aucune nuit complète à venir.</em></li>}
                </ul>
              </article>

              <article className="admin-dashboard-card">
                <div className="admin-dashboard-card__header">
                  <span><Mail size={24} /></span>
                  <div>
                    <h2>Messages</h2>
                    <p>{activeContactMessages.filter((message) => message.status !== "Traité").length} message{activeContactMessages.filter((message) => message.status !== "Traité").length > 1 ? "s" : ""} à traiter</p>
                  </div>
                </div>
                <div className="admin-dashboard-card__metric">
                  <strong>{activeContactMessages[0] ? activeContactMessages[0].full_name : "Aucun message"}</strong>
                  <span>{activeContactMessages[0] ? activeContactMessages[0].subject || "Demande depuis le site" : "Pas de demande de contact"}</span>
                </div>
                <ul>
                  {activeContactMessages.slice(0, 3).map((message) => (
                    <li key={`dash-contact-${message.id}`}>
                      <span>{message.status || "Nouveau"}</span>
                      <strong>{message.full_name} - {message.subject || "Message"}</strong>
                    </li>
                  ))}
                  {activeContactMessages.length === 0 && <li><em>Aucun message actif.</em></li>}
                </ul>
              </article>

              <article className="admin-dashboard-card admin-dashboard-card--announcement">
                <div className="admin-dashboard-card__header">
                  <span><Mail size={24} /></span>
                  <div>
                    <h2>Annonces</h2>
                    <p>Envoyer une information groupée aux clients.</p>
                  </div>
                </div>
                <div className="admin-dashboard-card__metric">
                  <strong>Push + email</strong>
                  <span>Fermeture, nouveauté, rappel ou message important.</span>
                </div>
                <button type="button" className="primary-action" onClick={() => setAdminView("announcements")}>
                  Créer une annonce
                </button>
              </article>
            </section>

            <div className="admin-grid" data-admin-view={adminView}>
              <section className="admin-assistant-panel" data-section="assistant">
                <div className="admin-panel-title admin-panel-title--row">
                  <span><ClipboardList size={24} /></span>
                  <div>
                    <h2>Assistant admin</h2>
                    <p>La vue rapide pour savoir quoi faire maintenant et quoi relancer ensuite.</p>
                  </div>
                </div>

                <div className="admin-assistant-grid">
                  <article className="admin-assistant-block">
                    <div className="admin-assistant-block__title">
                      <CalendarDays size={22} />
                      <div>
                        <h3>Aujourd'hui</h3>
                        <p>{formatDeliveryDate(todayIso)}</p>
                      </div>
                    </div>
                    <div className="admin-assistant-list">
                      {adminAssistantTodayItems.map((item) => (
                        <button key={item.id} type="button" onClick={item.action} className={item.count > 0 ? "has-items" : ""}>
                          <strong>{item.count}</strong>
                          <span>
                            <b>{item.title}</b>
                            <em>{item.detail}</em>
                          </span>
                          <small>{item.actionLabel}</small>
                        </button>
                      ))}
                    </div>
                  </article>

                  <article className="admin-assistant-block admin-assistant-block--followups">
                    <div className="admin-assistant-block__title">
                      <AlertTriangle size={22} />
                      <div>
                        <h3>À relancer</h3>
                        <p>Paiements, vaccins, coordonnées et rappels internes.</p>
                      </div>
                    </div>
                    <div className="admin-assistant-followups">
                      {adminAssistantFollowups.map((item) => (
                        <article key={item.id} className={`admin-assistant-followup admin-assistant-followup--${item.tone}`}>
                          <div>
                            <strong>{item.title}</strong>
                            <p>{item.detail}</p>
                          </div>
                          <button type="button" onClick={item.action}>
                            {item.actionLabel}
                          </button>
                        </article>
                      ))}
                      {adminAssistantFollowups.length === 0 && (
                        <p className="admin-assistant-empty">Aucune relance prioritaire pour le moment.</p>
                      )}
                    </div>
                  </article>
                </div>

                <div className="admin-assistant-actions">
                  <button type="button" onClick={() => applyAdminShortcut("toPrepare")}>
                    <PackageCheck size={18} />
                    Commandes à préparer
                  </button>
                  <button type="button" onClick={() => applyAdminShortcut("pendingReservations")}>
                    <CalendarCheck size={18} />
                    Réservations en attente
                  </button>
                  <button type="button" onClick={() => setAdminView("contacts")}>
                    <Mail size={18} />
                    Messages clients
                  </button>
                  <button type="button" onClick={() => setAdminView("kennelDogs")}>
                    <Dog size={18} />
                    Fiches chiens
                  </button>
                  <button type="button" onClick={() => setAdminView("health")}>
                    <ShieldCheck size={18} />
                    Santé appli
                  </button>
                </div>
              </section>

              <div className="admin-domain-title" data-section="eggs">
                <span><ShoppingBasket size={22} /></span>
                <div>
                  <h2>Vente d'œufs</h2>
                  <p>Stock, tarifs, livraisons, commandes et feuille de préparation.</p>
                </div>
              </div>

              <section className="admin-stock-panel" data-section="eggs">
                <div className="admin-panel-title">
                  <span><Boxes size={24} /></span>
                  <div>
                    <h2>Gestion du stock</h2>
                    <p>Ajoutez ou retirez des œufs du stock disponible.</p>
                  </div>
                </div>

                <div className="admin-stock-value">
                  <span>Stock actuel</span>
                  <strong>{stockEggs} œufs</strong>
                </div>

                <div className="admin-stock-form">
                  <input
                    type="number"
                    value={stockInput}
                    onChange={(e) => setStockInput(e.target.value)}
                    placeholder="+50 ou -20"
                  />
                  <button type="button" onClick={updateStock} className="primary-action">
                    Modifier le stock
                  </button>
                </div>
              </section>

              <section className="admin-delivery-slots-panel" data-section="eggs">
                <div className="admin-panel-title">
                  <span><CalendarDays size={24} /></span>
                  <div>
                    <h2>Créneaux de livraison</h2>
                    <p>Les lundis, mardis, jeudis et vendredis sont ouverts automatiquement.</p>
                  </div>
                </div>

                <form className="admin-delivery-slot-form" onSubmit={saveDeliverySlot}>
                  <input
                    type="date"
                    value={deliverySlotForm.delivery_date}
                    min={getLocalIsoDate()}
                    onChange={(e) =>
                      setDeliverySlotForm({ ...deliverySlotForm, delivery_date: e.target.value })
                    }
                  />
                  <input
                    value={deliverySlotForm.label}
                    onChange={(e) =>
                      setDeliverySlotForm({ ...deliverySlotForm, label: e.target.value })
                    }
                    placeholder="Note : secteur, matin..."
                  />
                  <input
                    type="number"
                    min="0"
                    value={deliverySlotForm.max_orders}
                    onChange={(e) =>
                      setDeliverySlotForm({ ...deliverySlotForm, max_orders: e.target.value })
                    }
                    placeholder="Max commandes, optionnel"
                  />
                  <button type="submit" className="primary-action">
                    Ajouter le créneau
                  </button>
                </form>

                <div className="admin-delivery-slots-list">
                  {deliverySlots.map((slot) => (
                    <article key={slot.id}>
                      <div>
                        <strong>{formatDeliveryDate(slot.delivery_date)}</strong>
                        <span>
                          {slot.label || "Livraison ouverte"}
                          {slot.max_orders ? ` - max ${slot.max_orders} commandes` : ""}
                        </span>
                      </div>
                      <div>
                        <button type="button" onClick={() => toggleDeliverySlotActive(slot)}>
                          {slot.active ? "Fermer" : "Ouvrir"}
                        </button>
                        <button type="button" onClick={() => deleteDeliverySlot(slot)}>
                          Supprimer
                        </button>
                      </div>
                    </article>
                  ))}

                  {deliverySlots.length === 0 && (
                    <p className="delivery-empty">
                      Aucun créneau manuel. Les jours habituels restent ouverts automatiquement.
                    </p>
                  )}
                </div>
              </section>

              <section className="admin-products-panel" data-section="eggs">
                <div className="admin-panel-title">
                  <span><ShoppingBasket size={24} /></span>
                  <div>
                    <h2>Produits et prix</h2>
                    <p>Modifiez les tarifs ou ajoutez des produits comme des légumes.</p>
                  </div>
                </div>

                <form className="admin-product-form" onSubmit={saveProduct}>
                  <input
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    placeholder="Nom du produit"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    placeholder="Prix"
                  />
                  <input
                    value={productForm.unit_label}
                    onChange={(e) => setProductForm({ ...productForm, unit_label: e.target.value })}
                    placeholder="Unité : boite, kg, botte..."
                  />
                  <input
                    type="number"
                    min="0"
                    value={productForm.size_eggs}
                    onChange={(e) => setProductForm({ ...productForm, size_eggs: Number(e.target.value) })}
                    placeholder="Œufs par unité, laisser 0 pour légumes"
                  />
                  <input
                    value={productForm.image}
                    onChange={(e) => setProductForm({ ...productForm, image: e.target.value })}
                    placeholder="Image URL, optionnel"
                  />
                  <button type="submit" className="primary-action">
                    {productForm.id ? "Mettre à jour" : "Ajouter"}
                  </button>
                  {productForm.id && (
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => setProductForm(emptyProductForm)}
                    >
                      Annuler
                    </button>
                  )}
                </form>

                <div className="admin-products-list">
                  {products.map((product) => (
                    <article key={product.id}>
                      <div>
                        <strong>{product.name}</strong>
                        <span>{product.price.toFixed(2)} EUR / {product.unit_label}</span>
                      </div>
                      <div>
                        <button type="button" onClick={() => editProduct(product)}>
                          Modifier
                        </button>
                        <button type="button" onClick={() => toggleProductActive(product)}>
                          {product.active ? "Masquer" : "Afficher"}
                        </button>
                        <button type="button" onClick={() => deleteProduct(product)}>
                          Supprimer
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="admin-planning-panel" data-section="eggs">
                <div className="admin-panel-title admin-panel-title--row">
                  <span><CalendarDays size={24} /></span>
                  <div>
                    <h2>Planning de livraison</h2>
                    <p>Choisissez un jour pour voir les commandes et les produits à préparer.</p>
                  </div>
                </div>

                {deliveryPlanning.length > 0 ? (
                  <>
                    <div className="delivery-day-list">
                      {deliveryPlanning.map((day) => (
                        <button
                          key={day.date}
                          type="button"
                          onClick={() => setRouteDate(day.date)}
                          className={selectedPlanningDay?.date === day.date ? "is-active" : ""}
                        >
                          <span>{formatDeliveryDate(day.date)}</span>
                          <strong>{day.orders.length} commande{day.orders.length > 1 ? "s" : ""}</strong>
                          <em>{day.eggs} œufs</em>
                        </button>
                      ))}
                    </div>

                    {selectedPlanningDay && (
                      <div className="delivery-day-detail">
                        <div className="delivery-day-summary">
                          <article>
                            <span>Commandes</span>
                            <strong>{selectedPlanningDay.orders.length}</strong>
                          </article>
                          <article>
                            <span>Œufs</span>
                            <strong>{selectedPlanningDay.eggs}</strong>
                          </article>
                          <article>
                            <span>CA estimé</span>
                            <strong>{selectedPlanningDay.revenue.toFixed(2)} EUR</strong>
                          </article>
                        </div>

                        <div className="delivery-products">
                          <h3>Produits à préparer</h3>
                          <div>
                            {selectedPlanningDay.products.map((product) => (
                              <span key={`${product.name}-${product.unitLabel}`}>
                                {product.quantity} x {product.name}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="delivery-orders">
                          {selectedPlanningDay.orders.map((order) => (
                            <article key={order.id}>
                              <div>
                                <strong>{order.client}</strong>
                                <span>{order.address || "Adresse non renseignée"}</span>
                                {order.comment && <em>{order.comment}</em>}
                              </div>
                              <div>
                                <span>{getOrderSummary(order)}</span>
                                <strong>{order.status}</strong>
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="delivery-empty">
                    Aucune livraison à planifier pour le moment.
                  </div>
                )}
              </section>

              <section className="admin-orders-panel" data-section="eggs">
                <div className="admin-panel-title admin-panel-title--row">
                  <span><UsersRound size={24} /></span>
                  <div>
                    <h2>Commandes</h2>
                    <p>{filteredOrders.length} commande{filteredOrders.length > 1 ? "s" : ""} affichée{filteredOrders.length > 1 ? "s" : ""}</p>
                  </div>
                </div>

                <div className="admin-tools">
                  <label className="admin-search">
                    <Search size={18} />
                    <input
                      type="search"
                      value={adminSearch}
                      onChange={(e) => setAdminSearch(e.target.value)}
                      placeholder="Rechercher un client, email, date..."
                    />
                  </label>

                  <select
                    value={adminSort}
                    onChange={(e) => setAdminSort(e.target.value)}
                    className="admin-sort"
                    aria-label="Trier les commandes"
                  >
                    <option value="date-asc">Date proche</option>
                    <option value="date-desc">Date récente</option>
                    <option value="client">Client A-Z</option>
                    <option value="eggs-desc">Plus grosse commande</option>
                  </select>

                  <label className="admin-route-date">
                    <span>Date feuille de route</span>
                    <input
                      type="date"
                      value={routeDate}
                      onChange={(e) => setRouteDate(e.target.value)}
                    />
                  </label>

                  <button type="button" onClick={exportAdminCsv} className="admin-tool-button">
                    <Download size={17} />
                    CSV
                  </button>
                  <button type="button" onClick={printPreparationSheet} className="admin-tool-button">
                    <Printer size={17} />
                    Feuille de route
                  </button>
                </div>

                <div className="admin-filters">
                  {adminFilterOptions.map((status) => (
                    <button
                      key={status.value}
                      type="button"
                      onClick={() => {
                        setAdminFilter(status.value);
                        setAdminOrderShortcut("all");
                      }}
                      className={adminFilter === status.value && adminOrderShortcut === "all" ? "is-active" : ""}
                    >
                      {status.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setAdminFilter("Toutes");
                      setAdminOrderShortcut("today");
                    }}
                    className={adminOrderShortcut === "today" ? "is-active" : ""}
                  >
                    Aujourd'hui
                  </button>
                </div>

                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Client</th>
                        <th>Commande</th>
                        <th>Date</th>
                        <th>Livraison</th>
                        <th>Statut</th>
                        <th>Archive</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredOrders.map((o) => (
                        <tr key={o.id}>
                          <td data-label="Client">
                            <strong>{o.client}</strong>
                            {o.email && <span>{o.email}</span>}
                          </td>
                          <td data-label="Commande">
                            <strong>{getOrderEggs(o)} œufs</strong>
                            <span>{getOrderSummary(o)}</span>
                          </td>
                          <td data-label="Date">{o.date}</td>
                          <td data-label="Livraison">
                            {o.address ? <strong>{o.address}</strong> : <span>Adresse non renseignée</span>}
                            {o.comment && <span>Note : {o.comment}</span>}
                          </td>
                          <td data-label="Statut">
                            <select value={o.status} onChange={(e) => changeStatus(o.id, e.target.value)}>
                              {orderStatusOptions.map((status) => (
                                <option key={status.value} value={status.value}>
                                  {status.label}
                                </option>
                              ))}
                            </select>
                            <div className="admin-message-actions">
                              <button type="button" className="admin-message-actions__whatsapp" onClick={() => openPreparedMessage("order-ready", o, "whatsapp")}>
                                WhatsApp prête
                              </button>
                              <button type="button" onClick={() => openPreparedMessage("order-ready", o, "sms")}>
                                SMS prête
                              </button>
                              <button type="button" onClick={() => openPreparedMessage("order-ready", o, "email")}>
                                Email prête
                              </button>
                              <button type="button" onClick={() => copyPreparedMessage("order-ready", o)}>
                                Copier
                              </button>
                            </div>
                          </td>
                          <td data-label="Archive">
                            <button type="button" className="admin-inline-button" onClick={() => setOrderArchived(o, !o.archived_at)}>
                              {o.archived_at ? "Restaurer" : "Archiver"}
                            </button>
                          </td>
                        </tr>
                      ))}

                      {filteredOrders.length === 0 && (
                        <tr>
                          <td colSpan="6" className="admin-empty">Aucune commande pour ce filtre.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="admin-orders-panel" data-section="clients">
                <div className="admin-panel-title admin-panel-title--row">
                  <span><ShieldCheck size={24} /></span>
                  <div>
                    <h2>Clients fidèles</h2>
                    <p>
                      {filteredCustomerProfiles.length}/{customerProfiles.length} client{customerProfiles.length > 1 ? "s" : ""} affiché{filteredCustomerProfiles.length > 1 ? "s" : ""}.
                    </p>
                  </div>
                </div>

                <div className="client-admin-tools">
                  <label className="admin-search">
                    <Search size={18} />
                    <input
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      placeholder="Rechercher un client, email, téléphone..."
                    />
                  </label>
                  <select
                    className="admin-sort"
                    value={clientAccessFilter}
                    onChange={(e) => setClientAccessFilter(e.target.value)}
                    aria-label="Filtrer les clients"
                  >
                    <option value="all">Tous les comptes</option>
                    <option value="allowed">Autorisés œufs</option>
                    <option value="blocked">À autoriser</option>
                    <option value="admin">Admins</option>
                  </select>
                  <select
                    className="admin-sort"
                    value={clientSort}
                    onChange={(e) => setClientSort(e.target.value)}
                    aria-label="Trier les clients"
                  >
                    <option value="created-desc">Plus récents</option>
                    <option value="created-asc">Plus anciens</option>
                    <option value="name">Nom A-Z</option>
                    <option value="access">Accès œufs</option>
                  </select>
                </div>

                <div className="admin-filters">
                  <button
                    type="button"
                    onClick={() => setClientQuickFilter("all")}
                    className={clientQuickFilter === "all" ? "is-active" : ""}
                  >
                    Tous
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setClientQuickFilter("recent");
                      setClientSort("created-desc");
                    }}
                    className={clientQuickFilter === "recent" ? "is-active" : ""}
                  >
                    Clients récents
                  </button>
                </div>

                <section className="admin-reminders-panel" aria-label="Rappels internes admin">
                  <div className="admin-reminders-panel__header">
                    <div>
                      <span>Rappels internes</span>
                      <h3>Actions à ne pas oublier</h3>
                    </div>
                    <strong>{adminReminders.filter((reminder) => (reminder.status || "À faire") !== "Fait").length} actif{adminReminders.filter((reminder) => (reminder.status || "À faire") !== "Fait").length > 1 ? "s" : ""}</strong>
                  </div>

                  <form className="admin-reminder-form" onSubmit={saveAdminReminder}>
                    <input
                      value={adminReminderForm.title}
                      onChange={(e) => setAdminReminderForm({ ...adminReminderForm, title: e.target.value })}
                      placeholder="Ex : rappeler Mme Dupont, demander carnet de vaccin..."
                    />
                    <input
                      type="date"
                      value={adminReminderForm.dueDate}
                      onChange={(e) => setAdminReminderForm({ ...adminReminderForm, dueDate: e.target.value })}
                    />
                    <select
                      value={adminReminderForm.profileId}
                      onChange={(e) => setAdminReminderForm({ ...adminReminderForm, profileId: e.target.value })}
                      aria-label="Client lié au rappel"
                    >
                      <option value="">Sans client lié</option>
                      {customerProfiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.full_name || profile.email || "Client"}
                        </option>
                      ))}
                    </select>
                    <select
                      value={adminReminderForm.priority}
                      onChange={(e) => setAdminReminderForm({ ...adminReminderForm, priority: e.target.value })}
                      aria-label="Priorité du rappel"
                    >
                      <option value="Normal">Normal</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                    <textarea
                      value={adminReminderForm.notes}
                      onChange={(e) => setAdminReminderForm({ ...adminReminderForm, notes: e.target.value })}
                      placeholder="Détails facultatifs"
                      rows="2"
                    />
                    <button type="submit">Ajouter le rappel</button>
                  </form>

                  <div className="admin-reminder-list">
                    {adminReminders.slice(0, 8).map((reminder) => {
                      const reminderProfile = customerProfiles.find((profile) => profile.id === reminder.profile_id);
                      const isDone = (reminder.status || "À faire") === "Fait";
                      const isDue = !isDone && String(reminder.due_date || "") <= todayIso;

                      return (
                        <article key={reminder.id} className={`admin-reminder-item ${isDone ? "is-done" : ""} ${isDue ? "is-due" : ""}`}>
                          <div>
                            <span>{reminder.priority || "Normal"} - {formatDeliveryDate(reminder.due_date)}</span>
                            <strong>{reminder.title}</strong>
                            <p>{[reminderProfile?.full_name || reminderProfile?.email, reminder.notes].filter(Boolean).join(" - ") || "Rappel interne"}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              updateAdminReminder(reminder.id, {
                                status: isDone ? "À faire" : "Fait",
                                completed_at: isDone ? null : new Date().toISOString(),
                              })
                            }
                          >
                            {isDone ? "Réouvrir" : "Fait"}
                          </button>
                        </article>
                      );
                    })}

                    {adminReminders.length === 0 && (
                      <p className="delivery-empty">Aucun rappel interne pour le moment.</p>
                    )}
                  </div>
                </section>

                {selectedClientProfile && (
                  <section className="client-detail-panel" aria-label="Fiche client détaillée">
                    <div className="client-detail-panel__header">
                      <div>
                        <span>Fiche client</span>
                        <h3>{selectedClientProfile.full_name || "Client"}</h3>
                        <p>{selectedClientProfile.email || "Email non renseigné"}</p>
                      </div>
                      <div className="client-detail-panel__actions">
                        <button
                          type="button"
                          onClick={() =>
                            setAdminReminderForm({
                              ...emptyAdminReminderForm,
                              profileId: selectedClientProfile.id,
                              title: `Rappeler ${selectedClientProfile.full_name || selectedClientProfile.email || "ce client"}`,
                            })
                          }
                        >
                          Ajouter un rappel
                        </button>
                        <button type="button" onClick={() => setSelectedClientProfileId("")}>
                          Fermer
                        </button>
                      </div>
                    </div>

                    <div className="client-detail-grid">
                      <article>
                        <span>Téléphone</span>
                        <strong>{selectedClientProfile.phone || "Non renseigné"}</strong>
                      </article>
                      <article>
                        <span>Adresse</span>
                        <strong>{selectedClientProfile.delivery_address || "Non renseignée"}</strong>
                      </article>
                      <article>
                        <span>Inscription</span>
                        <strong>{formatCreatedAtDateTime(selectedClientProfile.created_at)}</strong>
                      </article>
                      <article>
                        <span>Accès œufs</span>
                        <strong>{selectedClientProfile.is_admin || selectedClientProfile.can_order_eggs ? "Autorisé" : "À autoriser"}</strong>
                      </article>
                    </div>

                    <div className="client-detail-stats">
                      <article>
                        <span>Commandes</span>
                        <strong>{selectedClientStats.orders}</strong>
                        <em>{selectedClientStats.eggs} œuf{selectedClientStats.eggs > 1 ? "s" : ""}</em>
                      </article>
                      <article>
                        <span>Total commandes</span>
                        <strong>{selectedClientStats.orderRevenue.toFixed(2)} EUR</strong>
                        <em>hors réservations</em>
                      </article>
                      <article>
                        <span>Ferme pédagogique</span>
                        <strong>{selectedClientStats.education}</strong>
                        <em>réservation{selectedClientStats.education > 1 ? "s" : ""}</em>
                      </article>
                      <article>
                        <span>Pension canine</span>
                        <strong>{selectedClientStats.kennel}</strong>
                        <em>séjour{selectedClientStats.kennel > 1 ? "s" : ""}</em>
                      </article>
                    </div>

                    <div className="client-internal-notes">
                      <label>
                        <span>Notes internes</span>
                        <textarea
                          value={selectedClientProfile.internal_notes || ""}
                          onChange={(e) => updateCustomerInternalNotesDraft(selectedClientProfile.id, e.target.value)}
                          placeholder="Préférences, consignes de livraison, habitudes, remarques privées..."
                          rows="5"
                        />
                      </label>
                      <div>
                        <p>Visible uniquement dans l'espace admin.</p>
                        <button type="button" onClick={() => saveCustomerInternalNotes(selectedClientProfile)}>
                          Enregistrer la note
                        </button>
                      </div>
                    </div>

                    <section className="client-timeline" aria-label="Historique complet du client">
                      <div className="client-timeline__header">
                        <div>
                          <span>Historique complet</span>
                          <h4>Frise chronologique</h4>
                        </div>
                        <strong>{selectedClientTimeline.length} événement{selectedClientTimeline.length > 1 ? "s" : ""}</strong>
                      </div>

                      <div className="client-timeline__list">
                        {selectedClientTimeline.map((event) => (
                          <article key={event.id} className={`client-timeline__item client-timeline__item--${event.tone}`}>
                            <div className="client-timeline__marker" />
                            <div>
                              <span>
                                {event.type} - {event.date ? (String(event.date).includes("T") ? formatCreatedAtDateTime(event.date) : formatDeliveryDate(event.date)) : "Date non renseignée"}
                              </span>
                              <strong>{event.title}</strong>
                              {event.detail && <p>{event.detail}</p>}
                            </div>
                          </article>
                        ))}

                        {selectedClientTimeline.length === 0 && (
                          <p className="client-timeline__empty">Aucun historique pour ce client.</p>
                        )}
                      </div>
                    </section>

                    <div className="client-history-grid">
                      <section>
                        <h4>Commandes œufs</h4>
                        {selectedClientOrders.slice(0, 6).map((order) => (
                          <article key={`client-order-${order.id}`}>
                            <strong>{formatDeliveryDate(order.date)} - {order.status}</strong>
                            <span>{getOrderSummary(order)}</span>
                            <em>{getOrderRevenue(order).toFixed(2)} EUR</em>
                          </article>
                        ))}
                        {selectedClientOrders.length === 0 && <p>Aucune commande œufs.</p>}
                      </section>

                      <section>
                        <h4>Ferme pédagogique</h4>
                        {selectedClientEducationBookings.slice(0, 6).map((booking) => (
                          <article key={`client-education-${booking.id}`}>
                            <strong>{formatDeliveryDate(booking.booking_date)} - {booking.status || "Demandée"}</strong>
                            <span>{booking.activity_type} - {booking.participants} participant{Number(booking.participants || 0) > 1 ? "s" : ""}</span>
                            <em>{getEducationBookingAmount(booking).toFixed(2)} EUR</em>
                          </article>
                        ))}
                        {selectedClientEducationBookings.length === 0 && <p>Aucune réservation ferme.</p>}
                      </section>

                      <section>
                        <h4>Pension canine</h4>
                        {selectedClientKennelBookings.slice(0, 6).map((booking) => (
                          <article key={`client-kennel-${booking.id}`}>
                            <strong>{formatDeliveryDate(booking.start_date)} au {formatDeliveryDate(booking.end_date)}</strong>
                            <span>{booking.dog?.name || "Chien"} - {booking.status || "Demandée"}</span>
                            <em>{getKennelBookingAmount(booking).toFixed(2)} EUR</em>
                          </article>
                        ))}
                        {selectedClientKennelBookings.length === 0 && <p>Aucune réservation pension.</p>}
                      </section>
                    </div>
                  </section>
                )}

                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Client</th>
                        <th>Email</th>
                        <th>Téléphone</th>
                        <th>Adresse</th>
                        <th>Notifications</th>
                        <th>Accès œufs</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredCustomerProfiles.map((profile) => {
                        const pushSummary = getClientPushSummary(profile.id);

                        return (
                          <tr key={profile.id}>
                            <td data-label="Client">
                              <strong>{profile.full_name || "Client"}</strong>
                              {profile.is_admin && <span>Administrateur</span>}
                              <span>Créé le {formatCreatedAtDateTime(profile.created_at)}</span>
                              {profile.internal_notes && <span>Note interne renseignée</span>}
                              <button
                                type="button"
                                className="client-detail-button"
                                onClick={() => setSelectedClientProfileId(profile.id)}
                              >
                                Fiche client
                              </button>
                            </td>
                            <td data-label="Email">{profile.email || "Email non renseigné"}</td>
                            <td data-label="Téléphone">{profile.phone || "Téléphone non renseigné"}</td>
                            <td data-label="Adresse">{profile.delivery_address || "Adresse non renseignée"}</td>
                            <td data-label="Notifications">
                              {pushSummary.active ? (
                                <span className="notification-status notification-status--active">
                                  Client actives
                                  <em>{pushSummary.clientCount} appareil{pushSummary.clientCount > 1 ? "s" : ""}</em>
                                  {pushSummary.clientUpdatedAt && <small>Depuis {formatCreatedAtDateTime(pushSummary.clientUpdatedAt)}</small>}
                                  {pushSummary.adminActive && <small>Admin aussi actif</small>}
                                </span>
                              ) : (
                                <span className="notification-status notification-status--inactive">
                                  Client à relancer
                                  <em>Notifications client non activées</em>
                                  {pushSummary.adminActive && <small>Admin actif uniquement</small>}
                                </span>
                              )}
                            </td>
                            <td data-label="Accès œufs">
                              {profile.is_admin ? (
                                <strong>Autorisé</strong>
                              ) : (
                                <button
                                  type="button"
                                  className={profile.can_order_eggs ? "admin-access-button is-allowed" : "admin-access-button"}
                                  onClick={() => updateCustomerEggAccess(profile, !profile.can_order_eggs)}
                                >
                                  {profile.can_order_eggs ? "Bloquer" : "Autoriser"}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {filteredCustomerProfiles.length === 0 && (
                        <tr>
                          <td colSpan="6" className="admin-empty">
                            {customerProfiles.length === 0 ? "Aucun compte client pour le moment." : "Aucun client ne correspond à cette recherche."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="admin-reservations-panel" data-section="contacts">
                <div className="admin-panel-title admin-panel-title--row">
                  <span><Mail size={24} /></span>
                  <div>
                    <h2>Messages clients</h2>
                    <p>Retrouvez ici les demandes envoyées depuis le formulaire de contact.</p>
                  </div>
                </div>

                <div className="contact-archive-toggle" aria-label="Affichage des messages clients">
                  <button
                    type="button"
                    onClick={() => setContactMessageArchiveView("active")}
                    className={contactMessageArchiveView === "active" ? "is-active" : ""}
                  >
                    Messages actifs
                    <strong>{activeContactMessages.length}</strong>
                  </button>
                  <button
                    type="button"
                    onClick={() => setContactMessageArchiveView("archived")}
                    className={contactMessageArchiveView === "archived" ? "is-active" : ""}
                  >
                    Archives
                    <strong>{archivedContactMessages.length}</strong>
                  </button>
                </div>

                <div className="admin-reservation-list">
                  {visibleContactMessages.map((message) => (
                    <article key={message.id} className="admin-reservation-card contact-message-card">
                      <div>
                        <strong>{message.full_name || "Client"}</strong>
                        <span>{message.email || "Email non renseigné"}{message.phone ? ` - ${message.phone}` : ""}</span>
                        <span>{message.subject || "Demande depuis le site"}</span>
                        <em>{message.message}</em>
                        <span>Reçu le {formatDeliveryDate(String(message.created_at || "").slice(0, 10))}</span>
                        {message.archived_at && (
                          <span>Archivé le {formatDeliveryDate(String(message.archived_at || "").slice(0, 10))}</span>
                        )}
                      </div>
                      <div className="admin-reservation-controls">
                        <select
                          value={message.status || "Nouveau"}
                          onChange={(e) => updateContactMessageStatus(message.id, e.target.value)}
                        >
                          <option>Nouveau</option>
                          <option>En cours</option>
                          <option>Traité</option>
                        </select>
                        <button type="button" className="admin-tool-link" onClick={() => openContactReplyInGmail(message)}>
                          Répondre
                        </button>
                        {message.archived_at && (
                          <button
                            type="button"
                            className="admin-tool-button"
                            onClick={() => updateContactMessageStatus(message.id, "Nouveau")}
                          >
                            Restaurer
                          </button>
                        )}
                      </div>
                    </article>
                  ))}

                  {visibleContactMessages.length === 0 && (
                    <p className="delivery-empty">
                      {contactMessageArchiveView === "archived"
                        ? "Aucun message archivé pour le moment."
                        : "Aucun message de contact actif pour le moment."}
                    </p>
                  )}
                </div>
              </section>

              <section className="admin-products-panel message-templates-panel" data-section="templates">
                <div className="admin-panel-title admin-panel-title--row">
                  <span><MessageSquareText size={24} /></span>
                  <div>
                    <h2>Modèles de messages</h2>
                    <p>Copiez rapidement une réponse ou préparez une annonce à partir d'un modèle.</p>
                  </div>
                </div>

                <div className="message-template-grid">
                  {MESSAGE_TEMPLATES.map((template) => (
                    <article key={`${template.category}-${template.title}`} className="message-template-card">
                      <div>
                        <span>{template.category}</span>
                        <h3>{template.title}</h3>
                      </div>
                      <p>{template.body}</p>
                      <div className="message-template-actions">
                        <button type="button" onClick={() => copyMessageTemplate(template)}>
                          <Copy size={16} />
                          Copier
                        </button>
                        <button type="button" onClick={() => prepareAnnouncementFromTemplate(template)}>
                          Préparer annonce
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="admin-products-panel broadcast-panel" data-section="announcements">
                <div className="admin-panel-title admin-panel-title--row">
                  <span><Mail size={24} /></span>
                  <div>
                    <h2>Annonce groupée</h2>
                    <p>Envoyez une information importante aux clients par notification push et/ou email.</p>
                  </div>
                </div>

                <form className="broadcast-form" onSubmit={sendBroadcastAnnouncement}>
                  <label>
                    <span>Titre</span>
                    <input
                      value={announcementForm.title}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                      placeholder="Ex. Fermeture exceptionnelle"
                    />
                  </label>
                  <label>
                    <span>Message</span>
                    <textarea
                      value={announcementForm.message}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, message: e.target.value })}
                      placeholder="Votre annonce..."
                      rows="5"
                    />
                  </label>
                  <div className="broadcast-options">
                    <label>
                      <input
                        type="checkbox"
                        checked={announcementForm.sendPush}
                        onChange={(e) => setAnnouncementForm({ ...announcementForm, sendPush: e.target.checked })}
                      />
                      <span>Notification push</span>
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={announcementForm.sendEmail}
                        onChange={(e) => setAnnouncementForm({ ...announcementForm, sendEmail: e.target.checked })}
                      />
                      <span>Email</span>
                    </label>
                  </div>
                  <button type="submit" className="primary-action" disabled={announcementSending}>
                    {announcementSending ? "Envoi en cours..." : "Envoyer l'annonce"}
                  </button>
                </form>

                <div className="broadcast-history">
                  <div className="broadcast-history__header">
                    <div>
                      <h3>Historique des annonces</h3>
                      <p>Les 50 derniers envois groupés, avec le détail push et email.</p>
                    </div>
                    <button type="button" className="secondary-action" onClick={loadAnnouncementHistory}>
                      Actualiser
                    </button>
                  </div>

                  {announcementHistory.length === 0 ? (
                    <p className="admin-empty">Aucune annonce enregistrée pour le moment.</p>
                  ) : (
                    <div className="broadcast-history__list">
                      {announcementHistory.map((announcement) => {
                        const failedCount = Number(announcement.push_failed || 0) + Number(announcement.email_failed || 0);

                        return (
                          <article
                            key={announcement.id}
                            className={`broadcast-history-card${announcement.status === "Erreur" ? " is-error" : ""}`}
                          >
                            <div className="broadcast-history-card__content">
                              <time>{formatCreatedAtDateTime(announcement.created_at)}</time>
                              <h4>{announcement.title}</h4>
                              <p>{announcement.message}</p>
                            </div>
                            <div className="broadcast-history-card__stats">
                              <span>{announcement.status || "Envoyée"}</span>
                              {announcement.send_push && (
                                <em>
                                  Push {announcement.push_sent || 0}/{announcement.push_total || 0}
                                </em>
                              )}
                              {announcement.send_email && (
                                <em>
                                  Email {announcement.email_sent || 0}/{announcement.email_total || 0}
                                </em>
                              )}
                              {Number(announcement.push_expired || 0) > 0 && (
                                <strong>{announcement.push_expired} expiré(s)</strong>
                              )}
                              {failedCount > 0 && <strong>{failedCount} échec(s)</strong>}
                              {announcement.error_message && <strong>{announcement.error_message}</strong>}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>

              <section className="admin-products-panel admin-audit-panel" data-section="audit">
                <div className="admin-panel-title admin-panel-title--row">
                  <span><History size={24} /></span>
                  <div>
                    <h2>Journal des actions admin</h2>
                    <p>Les dernières modifications importantes réalisées dans l'espace administrateur.</p>
                  </div>
                </div>

                <div className="admin-audit-actions">
                  <button type="button" className="secondary-action" onClick={loadAdminActionLogs}>
                    Actualiser
                  </button>
                </div>

                <div className="admin-audit-list">
                  {adminActionLogs.map((log) => (
                    <article key={log.id} className="admin-audit-card">
                      <time>{formatCreatedAtDateTime(log.created_at)}</time>
                      <div>
                        <strong>{log.title || log.action_type}</strong>
                        <span>
                          {[log.target_type, log.target_label].filter(Boolean).join(" - ") || "Action admin"}
                        </span>
                        <em>{log.created_by_email || "Admin"}</em>
                      </div>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <p>
                          {Object.entries(log.details)
                            .filter(([, value]) => value !== null && value !== undefined && value !== "")
                            .slice(0, 5)
                            .map(([key, value]) => `${key.replaceAll("_", " ")} : ${String(value)}`)
                            .join(" | ")}
                        </p>
                      )}
                    </article>
                  ))}

                  {adminActionLogs.length === 0 && (
                    <p className="admin-empty">Aucune action enregistrée pour le moment.</p>
                  )}
                </div>
              </section>

              <section className="admin-products-panel admin-health-panel" data-section="health">
                <div className="admin-panel-title admin-panel-title--row">
                  <span><ShieldCheck size={24} /></span>
                  <div>
                    <h2>Santé de l'application</h2>
                    <p>Un contrôle rapide des réglages, contenus, photos, annonces et fiches clients.</p>
                  </div>
                </div>

                <div className="admin-health-summary">
                  <article className={healthIssueCount === 0 ? "is-good" : "is-warning"}>
                    <span>État général</span>
                    <strong>{healthIssueCount === 0 ? "Tout va bien" : `${healthIssueCount} point${healthIssueCount > 1 ? "s" : ""} à vérifier`}</strong>
                  </article>
                  <article>
                    <span>OK</span>
                    <strong>{healthCheckCounts.success}</strong>
                  </article>
                  <article>
                    <span>Rouge</span>
                    <strong>{healthCheckCounts.danger}</strong>
                  </article>
                  <article>
                    <span>Orange</span>
                    <strong>{healthCheckCounts.warning}</strong>
                  </article>
                </div>

                <div className="admin-deploy-center">
                  <div className="admin-deploy-center__header">
                    <div>
                      <span>Déploiement</span>
                      <strong>Version installée</strong>
                      <p>À vérifier après chaque publication Netlify ou si l'icône installée semble bloquée.</p>
                    </div>
                    <button type="button" onClick={checkForAppUpdate} disabled={checkingAppUpdate}>
                      <RefreshCw size={18} />
                      {checkingAppUpdate ? "Vérification..." : "Vérifier mise à jour"}
                    </button>
                  </div>

                  <div className="admin-deploy-center__grid">
                    <article>
                      <span>Version</span>
                      <strong>{appBuildVersion}</strong>
                    </article>
                    <article>
                      <span>Build</span>
                      <strong>{appBuildTime ? formatCreatedAtDateTime(appBuildTime) : "Non renseigné"}</strong>
                    </article>
                    <article>
                      <span>Commit</span>
                      <strong>{appShortCommit}</strong>
                    </article>
                    <article>
                      <span>Site</span>
                      <strong>{publicSiteDisplayUrl}</strong>
                    </article>
                  </div>

                  <div className="admin-deploy-center__help">
                    <p>
                      Si Netlify indique un nouveau commit publié mais que l'icône installée ne change pas,
                      ouvrez le site dans le navigateur, utilisez ce bouton, puis réinstallez l'icône si besoin.
                    </p>
                    <button type="button" onClick={() => window.location.reload()}>
                      Recharger la page
                    </button>
                  </div>
                </div>

                <div className="admin-health-list">
                  {healthChecks.map((check) => (
                    <article key={check.id} className={`admin-health-card admin-health-card--${check.tone}`}>
                      <span className={`admin-health-card__status admin-health-card__status--${check.tone}`}>
                        {check.tone === "success" ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                      </span>
                      <div>
                        <strong>{check.title}</strong>
                        <p>{check.detail}</p>
                        {check.id === "images" && missingLibraryImages.length > 0 && (
                          <em>{missingLibraryImages.slice(0, 3).join(" | ")}</em>
                        )}
                        {check.id === "announcements" && lastAnnouncementWithIssue?.created_at && (
                          <em>Dernière annonce concernée : {formatCreatedAtDateTime(lastAnnouncementWithIssue.created_at)}</em>
                        )}
                      </div>
                      <button type="button" onClick={check.action}>
                        {check.actionLabel}
                      </button>
                    </article>
                  ))}
                </div>
              </section>

              <section className="admin-products-panel admin-media-panel" data-section="media">
                <div className="admin-panel-title admin-panel-title--row">
                  <span><ImageIcon size={24} /></span>
                  <div>
                    <h2>Gestionnaire de médias</h2>
                    <p>Retrouvez les photos disponibles, copiez leur chemin ou utilisez-les directement dans les contenus.</p>
                  </div>
                </div>

                <div className="admin-media-toolbar">
                  <label>
                    <Search size={18} />
                    <input
                      value={mediaSearch}
                      onChange={(e) => setMediaSearch(e.target.value)}
                      placeholder="Rechercher une photo..."
                    />
                  </label>
                  <div>
                    <span>{imageOptions.length} photo(s)</span>
                    <span>{unusedMediaImagesCount} non utilisée(s)</span>
                  </div>
                </div>

                {missingLibraryImages.length > 0 && (
                  <div className="admin-media-warning">
                    <AlertTriangle size={20} />
                    <div>
                      <strong>Photos utilisées mais absentes de la bibliothèque</strong>
                      <p>{missingLibraryImages.join(" | ")}</p>
                    </div>
                  </div>
                )}

                <div className="admin-media-grid">
                  {filteredMediaImages.map((imageUrl) => {
                    const isUsed = usedImageSet.has(imageUrl);

                    return (
                      <article key={imageUrl} className={`admin-media-card ${isUsed ? "is-used" : ""}`}>
                        <button
                          type="button"
                          className="admin-media-card__preview"
                          onClick={() => setPreviewImage({ src: imageUrl, alt: getImageOptionLabel(imageUrl) })}
                        >
                          <img src={imageUrl} alt={getImageOptionLabel(imageUrl)} loading="lazy" />
                        </button>
                        <div className="admin-media-card__body">
                          <div>
                            <strong>{getImageOptionLabel(imageUrl)}</strong>
                            <span>{imageUrl}</span>
                            <em>{isUsed ? "Déjà utilisée" : "Non utilisée"}</em>
                          </div>
                          <div className="admin-media-card__actions">
                            <button type="button" onClick={() => copyMediaPath(imageUrl)}>
                              Copier
                            </button>
                            <button type="button" onClick={() => applyMediaTo("about-main", imageUrl)}>
                              Présentation
                            </button>
                            <button type="button" onClick={() => applyMediaTo("kennel-main", imageUrl)}>
                              Pension
                            </button>
                            <button type="button" onClick={() => applyMediaTo("event-main", imageUrl)}>
                              Événement
                            </button>
                            <button type="button" onClick={() => applyMediaTo("news", imageUrl)}>
                              Actualité
                            </button>
                          </div>
                          <details className="admin-media-card__more">
                            <summary>Ajouter dans une galerie</summary>
                            <div>
                              <button type="button" onClick={() => applyMediaTo("about-gallery", imageUrl)}>
                                Galerie présentation
                              </button>
                              <button type="button" onClick={() => applyMediaTo("kennel-gallery", imageUrl)}>
                                Galerie pension
                              </button>
                              <button type="button" onClick={() => applyMediaTo("event-gallery", imageUrl)}>
                                Galerie événement
                              </button>
                            </div>
                          </details>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {filteredMediaImages.length === 0 && (
                  <p className="admin-empty">Aucune photo ne correspond à cette recherche.</p>
                )}
              </section>

              <section className="admin-products-panel home-news-admin-panel" data-section="news">
                <div className="admin-panel-title admin-panel-title--row">
                  <span><Star size={24} /></span>
                  <div>
                    <h2>Actualités de l'accueil</h2>
                    <p>Ajoutez les actualités du moment avec une photo, un titre, un texte et une date.</p>
                  </div>
                </div>

                <form className="home-news-admin-form" onSubmit={saveHomeNewsItem}>
                  <label>
                    <span>Date de l'actualité</span>
                    <input
                      type="date"
                      value={homeNewsForm.published_at}
                      onChange={(e) => setHomeNewsForm({ ...homeNewsForm, published_at: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>Titre</span>
                    <input
                      value={homeNewsForm.title}
                      onChange={(e) => setHomeNewsForm({ ...homeNewsForm, title: e.target.value })}
                      placeholder="Ex. Nouvelle édition canicross"
                    />
                  </label>
                  <label className="home-news-admin-form__wide">
                    <span>Photo</span>
                    <input
                      value={homeNewsForm.image_url}
                      onChange={(e) => setHomeNewsForm({ ...homeNewsForm, image_url: e.target.value })}
                      placeholder="/images/ma-photo.jpg ou lien complet"
                    />
                    <PhotoQuickPicker
                      imageOptions={imageOptions}
                      onPick={(imageUrl) => setHomeNewsForm({ ...homeNewsForm, image_url: imageUrl })}
                    />
                  </label>
                  {homeNewsForm.image_url && (
                    <img
                      src={normalizeImageUrl(homeNewsForm.image_url)}
                      alt="Aperçu actualité"
                      className="home-news-admin-preview"
                    />
                  )}
                  <label className="home-news-admin-form__wide">
                    <span>Texte</span>
                    <textarea
                      value={homeNewsForm.text}
                      onChange={(e) => setHomeNewsForm({ ...homeNewsForm, text: e.target.value })}
                      placeholder="Votre texte d'actualité..."
                      rows="5"
                    />
                  </label>
                  <label className="admin-payment-check">
                    <input
                      type="checkbox"
                      checked={homeNewsForm.active !== false}
                      onChange={(e) => setHomeNewsForm({ ...homeNewsForm, active: e.target.checked })}
                    />
                    <span>Afficher cette actualité sur l'accueil</span>
                  </label>
                  <div className="about-admin-actions">
                    <button type="submit" className="primary-action">
                      {homeNewsForm.id ? "Mettre à jour l'actualité" : "Ajouter l'actualité"}
                    </button>
                    <button type="button" className="secondary-action" onClick={() => setHomeNewsForm(emptyHomeNewsForm)}>
                      Réinitialiser
                    </button>
                  </div>
                </form>

                <div className="home-news-admin-list">
                  {(homeNewsContent.items || []).map((item) => (
                    <article key={item.id} className={item.active === false ? "is-muted" : ""}>
                      {item.image_url ? (
                        <img src={normalizeImageUrl(item.image_url)} alt={item.title} />
                      ) : (
                        <span><Star size={22} /></span>
                      )}
                      <div>
                        <time>{item.published_at ? formatDeliveryDate(item.published_at) : "Sans date"}</time>
                        <h3>{item.title || "Actualité sans titre"}</h3>
                        <p>{item.text}</p>
                      </div>
                      <div className="home-news-admin-list__actions">
                        <button type="button" onClick={() => editHomeNewsItem(item)}>Modifier</button>
                        <button type="button" onClick={() => toggleHomeNewsItem(item)}>
                          {item.active === false ? "Afficher" : "Masquer"}
                        </button>
                        <button type="button" onClick={() => deleteHomeNewsItem(item)}>Supprimer</button>
                      </div>
                    </article>
                  ))}
                  {(homeNewsContent.items || []).length === 0 && (
                    <p className="admin-empty">Aucune actualité pour le moment.</p>
                  )}
                </div>
              </section>

              <div className="admin-domain-title admin-domain-title--education" data-section="education">
                <span><School size={22} /></span>
                <div>
                  <h2>Ferme pédagogique</h2>
                  <p>Activités, tarifs, saisons et demandes de réservation.</p>
                </div>
              </div>

              <section className="admin-products-panel admin-service-panel" data-section="education">
                <div className="admin-panel-title">
                  <span><CalendarCheck size={24} /></span>
                  <div>
                    <h2>Activités pédagogiques</h2>
                    <p>Modifiez les tarifs, la saison et les activités visibles sur le site.</p>
                  </div>
                </div>

                <form className="admin-product-form" onSubmit={saveEducationActivity}>
                  <input
                    value={educationActivityForm.name}
                    onChange={(e) => setEducationActivityForm({ ...educationActivityForm, name: e.target.value })}
                    placeholder="Nom de l'activité"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={educationActivityForm.price}
                    onChange={(e) => setEducationActivityForm({ ...educationActivityForm, price: e.target.value })}
                    placeholder="Tarif, 0 si sur demande"
                  />
                  <input
                    value={educationActivityForm.season_label}
                    onChange={(e) => setEducationActivityForm({ ...educationActivityForm, season_label: e.target.value })}
                    placeholder="Saison : été, vacances, sur demande..."
                  />
                  <input
                    value={educationActivityForm.description}
                    onChange={(e) => setEducationActivityForm({ ...educationActivityForm, description: e.target.value })}
                    placeholder="Description courte"
                  />
                  <label className="admin-photo-field">
                    <span>Photo de l'atelier</span>
                    <input
                      value={educationActivityForm.image_url}
                      onChange={(e) => setEducationActivityForm({ ...educationActivityForm, image_url: e.target.value })}
                      placeholder="Lien de la photo principale"
                    />
                    <PhotoQuickPicker
                      imageOptions={imageOptions}
                      onPick={(imageUrl) =>
                        setEducationActivityForm({ ...educationActivityForm, image_url: imageUrl })
                      }
                    />
                    {educationActivityForm.image_url && (
                      <img src={educationActivityForm.image_url} alt="Aperçu atelier" />
                    )}
                  </label>
                  <label className="admin-photo-field">
                    <span>Galerie de photos</span>
                    <textarea
                      value={educationActivityForm.gallery_images}
                      onChange={(e) => setEducationActivityForm({ ...educationActivityForm, gallery_images: e.target.value })}
                      placeholder="Collez un lien de photo par ligne"
                      rows="4"
                    />
                    <PhotoQuickPicker
                      imageOptions={imageOptions}
                      label="Ajouter une photo existante à la galerie"
                      onPick={(imageUrl) =>
                        setEducationActivityForm({
                          ...educationActivityForm,
                          gallery_images: appendImageToGallery(educationActivityForm.gallery_images, imageUrl),
                        })
                      }
                    />
                    {parseGalleryImages(educationActivityForm.gallery_images).length > 0 && (
                      <div className="admin-photo-preview-grid">
                        {parseGalleryImages(educationActivityForm.gallery_images).map((imageUrl, index) => (
                          <img key={`${imageUrl}-${index}`} src={imageUrl} alt={`Aperçu galerie ${index + 1}`} />
                        ))}
                      </div>
                    )}
                  </label>
                  <button type="submit" className="primary-action">
                    {educationActivityForm.id ? "Mettre à jour" : "Ajouter"}
                  </button>
                  {educationActivityForm.id && (
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => setEducationActivityForm(emptyEducationActivityForm)}
                    >
                      Annuler
                    </button>
                  )}
                </form>

                <div className="admin-products-list">
                  {educationActivities.map((activity) => (
                    <article key={activity.id}>
                      <div>
                        <strong>{activity.name}</strong>
                        <span>
                          {activity.price > 0 ? `${activity.price.toFixed(2)} EUR` : "Tarif sur demande"}
                          {activity.season_label ? ` - ${activity.season_label}` : ""}
                          {activity.image_url ? " - photo ajoutée" : ""}
                          {parseGalleryImages(activity.gallery_images).length > 0 ? ` - ${parseGalleryImages(activity.gallery_images).length} photo(s) galerie` : ""}
                          {!activity.active ? " - masquée" : ""}
                        </span>
                      </div>
                      <div>
                        <button type="button" onClick={() => editEducationActivity(activity)}>
                          Modifier
                        </button>
                        <button type="button" onClick={() => toggleEducationActivityActive(activity)}>
                          {activity.active ? "Masquer" : "Afficher"}
                        </button>
                        <button type="button" onClick={() => deleteEducationActivity(activity)}>
                          Supprimer
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="admin-products-panel admin-service-panel" data-section="education">
                <div className="admin-panel-title">
                  <span><CalendarDays size={24} /></span>
                  <div>
                    <h2>Dates et places</h2>
                    <p>Ouvrez les dates visibles côté client et fixez le nombre de places.</p>
                  </div>
                </div>

                <form className="admin-product-form" onSubmit={saveEducationDateSlot}>
                  <select
                    value={educationDateForm.activity_id}
                    onChange={(e) => setEducationDateForm({ ...educationDateForm, activity_id: e.target.value })}
                  >
                    <option value="">Choisir l'activité</option>
                    {educationActivities.map((activity) => (
                      <option key={activity.id} value={activity.id}>{activity.name}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={educationDateForm.activity_date}
                    onChange={(e) => setEducationDateForm({ ...educationDateForm, activity_date: e.target.value })}
                  />
                  <input
                    value={educationDateForm.label}
                    onChange={(e) => setEducationDateForm({ ...educationDateForm, label: e.target.value })}
                    placeholder="Horaire ou note : 10h, matin..."
                  />
                  <input
                    type="number"
                    min="1"
                    value={educationDateForm.capacity}
                    onChange={(e) => setEducationDateForm({ ...educationDateForm, capacity: e.target.value })}
                    placeholder="Nombre de places"
                  />
                  <button type="submit" className="primary-action">
                    {educationDateForm.id ? "Mettre à jour la date" : "Ajouter la date"}
                  </button>
                  {educationDateForm.id && (
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => setEducationDateForm(emptyEducationDateForm)}
                    >
                      Annuler
                    </button>
                  )}
                </form>

                <div className="admin-products-list">
                  {educationDateSlots.map((slot) => {
                    const activity = educationActivities.find((item) => item.id === slot.activity_id);
                    const participants = getEducationSlotParticipants(slot);
                    const remaining = getEducationSlotRemaining(slot);

                    return (
                      <article key={slot.id}>
                        <div>
                          <strong>{activity?.name || "Activité supprimée"} - {formatDeliveryDate(slot.activity_date)}</strong>
                          <span>
                            {slot.label ? `${slot.label} - ` : ""}
                            {participants}/{slot.capacity} place{Number(slot.capacity) > 1 ? "s" : ""}
                            {remaining <= 0 ? " - complet" : ` - ${remaining} restante${remaining > 1 ? "s" : ""}`}
                            {!slot.active ? " - masquée" : ""}
                          </span>
                        </div>
                        <div>
                          <button type="button" onClick={() => editEducationDateSlot(slot)}>
                            Modifier
                          </button>
                          <button type="button" onClick={() => toggleEducationDateSlotActive(slot)}>
                            {slot.active ? "Masquer" : "Afficher"}
                          </button>
                          <button type="button" onClick={() => deleteEducationDateSlot(slot)}>
                            Supprimer
                          </button>
                        </div>
                      </article>
                    );
                  })}

                  {educationDateSlots.length === 0 && (
                    <p className="delivery-empty">Aucune date pédagogique ouverte pour le moment.</p>
                  )}
                </div>
              </section>

              <section className="admin-reservations-panel" data-section="education">
                <div className="admin-panel-title">
                  <span><UsersRound size={24} /></span>
                  <div>
                    <h2>Réservations pédagogiques</h2>
                    <p>{filteredEducationBookings.length} demande{filteredEducationBookings.length > 1 ? "s" : ""} affichée{filteredEducationBookings.length > 1 ? "s" : ""}.</p>
                  </div>
                </div>

                <div className="admin-filters">
                  {[
                    { value: "pending", label: "En attente" },
                    { value: "active", label: "Actives" },
                    { value: "confirmed", label: "Confirmées" },
                    { value: "today", label: "Aujourd'hui" },
                    { value: "all", label: "Toutes" },
                  ].map((filter) => (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => setEducationReservationFilter(filter.value)}
                      className={educationReservationFilter === filter.value ? "is-active" : ""}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                <div className="admin-reservation-list">
                  {filteredEducationBookings.map((booking) => (
                    <article key={booking.id} className="admin-reservation-card">
                      <div>
                        <strong>{booking.activity_type}</strong>
                        <span>{booking.client_name} - {booking.client_email}</span>
                        <span>
                          {formatDeliveryDate(booking.booking_date)}
                          {booking.accompanist_name ? ` - accompagnateur : ${booking.accompanist_name}` : ""}
                        </span>
                        <span>{booking.participants} enfant{booking.participants > 1 ? "s" : ""}{booking.phone ? ` - ${booking.phone}` : ""}</span>
                        {Array.isArray(booking.children) && booking.children.length > 0 && (
                          <span>
                            {booking.children.map((child) => `${child.firstName || child.first_name} (${child.age} ans)`).join(", ")}
                          </span>
                        )}
                        {booking.notes && <em>{booking.notes}</em>}
                      </div>
                      <div className="admin-reservation-controls">
                        <span className="admin-status-pill">{booking.status || "Demandée"}</span>
                        <label className="admin-amount-field">
                          <span>Montant confirmé</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue={booking.amount_confirmed ?? ""}
                            placeholder={`${getEducationBookingAmount({ ...booking, amount_confirmed: null }).toFixed(2)} EUR`}
                            onBlur={(e) =>
                              updateEducationBooking(booking.id, {
                                amount_confirmed: e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <div className={`payment-status payment-status--${getBookingPaymentSummary(booking, getEducationBookingAmount(booking)).tone}`}>
                          <strong>{getBookingPaymentSummary(booking, getEducationBookingAmount(booking)).label}</strong>
                          <span>
                            Acompte {getBookingPaymentSummary(booking, getEducationBookingAmount(booking)).deposit.toFixed(2)} EUR - reste {getBookingPaymentSummary(booking, getEducationBookingAmount(booking)).remaining.toFixed(2)} EUR
                          </span>
                          <em>{getBookingPaymentSummary(booking, getEducationBookingAmount(booking)).method}</em>
                        </div>
                        <label className="admin-amount-field">
                          <span>Acompte payé</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue={booking.deposit_amount ?? ""}
                            placeholder="0.00"
                            onBlur={(e) =>
                              updateEducationBooking(booking.id, {
                                deposit_amount: e.target.value === "" ? 0 : Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <label className="admin-payment-check">
                          <input
                            type="checkbox"
                            checked={booking.payment_received === true}
                            onChange={(e) =>
                              updateEducationBooking(booking.id, {
                                payment_received: e.target.checked,
                                payment_received_at: e.target.checked ? new Date().toISOString() : null,
                              })
                            }
                          />
                          <span>Paiement reçu</span>
                        </label>
                        <select
                          value={booking.payment_method || "Non renseigné"}
                          onChange={(e) => updateEducationBooking(booking.id, { payment_method: e.target.value })}
                          aria-label="Moyen de paiement"
                        >
                          {paymentMethodOptions.map((method) => (
                            <option key={method} value={method}>{method}</option>
                          ))}
                        </select>
                        <select
                          value={booking.status || "Demandée"}
                          onChange={(e) => updateEducationBooking(booking.id, { status: e.target.value })}
                        >
                          {reservationStatusOptions.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                        <button type="button" onClick={() => setEducationBookingArchived(booking, !booking.archived_at)}>
                          {booking.archived_at ? "Restaurer" : "Archiver"}
                        </button>
                        <div className="admin-message-actions">
                          <button type="button" className="admin-message-actions__whatsapp" onClick={() => openPreparedMessage("education-confirmed", booking, "whatsapp")}>
                            WhatsApp confirmer
                          </button>
                          <button type="button" onClick={() => openPreparedMessage("education-confirmed", booking, "sms")}>
                            SMS confirmer
                          </button>
                          <button type="button" onClick={() => openPreparedMessage("education-confirmed", booking, "email")}>
                            Email confirmer
                          </button>
                          <button type="button" onClick={() => copyPreparedMessage("education-confirmed", booking)}>
                            Copier
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}

                  {filteredEducationBookings.length === 0 && (
                    <p className="delivery-empty">Aucune réservation pédagogique pour ce filtre.</p>
                  )}
                </div>
              </section>

              <div className="admin-domain-title admin-domain-title--kennel" data-section="kennel">
                <span><Dog size={22} /></span>
                <div>
                  <h2>Pension canine</h2>
                  <p>Tarifs, fiches chiens, dates de séjour et suivi des réservations.</p>
                </div>
              </div>

              <section className="admin-products-panel kennel-admin-photos-panel" data-section="kennelPhotos">
                <div className="admin-panel-title">
                  <span><Dog size={24} /></span>
                  <div>
                    <h2>Photos de la pension canine</h2>
                    <p>Collez ici les liens des photos qui apparaissent sur la page client Pension canine.</p>
                  </div>
                </div>

                <form className="admin-product-form" onSubmit={saveKennelContent}>
                  <label className="admin-photo-field">
                    <span>Photo principale</span>
                    <input
                      value={kennelContentForm.image_url}
                      onChange={(e) => setKennelContentForm({ ...kennelContentForm, image_url: e.target.value })}
                      placeholder="/images/pension-canine-1.jpg ou lien d'une photo"
                    />
                    <PhotoQuickPicker
                      imageOptions={imageOptions}
                      onPick={(imageUrl) =>
                        setKennelContentForm({ ...kennelContentForm, image_url: imageUrl })
                      }
                    />
                    {kennelContentForm.image_url && (
                      <img src={normalizeImageUrl(kennelContentForm.image_url)} alt="Aperçu pension canine" />
                    )}
                  </label>
                  <label className="admin-photo-field">
                    <span>Galerie photos</span>
                    <textarea
                      value={kennelContentForm.gallery_images}
                      onChange={(e) => setKennelContentForm({ ...kennelContentForm, gallery_images: e.target.value })}
                      placeholder="Collez un lien de photo par ligne"
                      rows="5"
                    />
                    <PhotoQuickPicker
                      imageOptions={imageOptions}
                      label="Ajouter une photo existante à la galerie"
                      onPick={(imageUrl) =>
                        setKennelContentForm({
                          ...kennelContentForm,
                          gallery_images: appendImageToGallery(kennelContentForm.gallery_images, imageUrl),
                        })
                      }
                    />
                    {parseGalleryImages(kennelContentForm.gallery_images).length > 0 && (
                      <div className="admin-photo-preview-grid">
                        {parseGalleryImages(kennelContentForm.gallery_images).map((imageUrl, index) => (
                          <img key={`${imageUrl}-${index}`} src={imageUrl} alt={`Aperçu pension ${index + 1}`} />
                        ))}
                      </div>
                    )}
                  </label>
                  <button type="submit" className="primary-action">
                    Enregistrer les photos
                  </button>
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => setKennelContentForm(kennelContent)}
                  >
                    Annuler
                  </button>
                </form>
              </section>

              <section className="admin-reservations-panel" data-section="kennel">
                <div className="admin-panel-title admin-panel-title--row">
                  <span><CalendarDays size={24} /></span>
                  <div>
                    <h2>Calendrier pension</h2>
                    <p>Vue mensuelle des nuitées réservées, limitée à {KENNEL_MAX_BOOKINGS_PER_NIGHT} chiens par nuit.</p>
                  </div>
                </div>

                <div className="kennel-ops">
                  <article className="kennel-ops-card kennel-ops-card--arrivals">
                    <div className="kennel-ops-card__title">
                      <span><ArrowRight size={22} /></span>
                      <div>
                        <h3>Arrivées du jour</h3>
                        <p>{todayKennelArrivals.length} chien{todayKennelArrivals.length > 1 ? "s" : ""} attendu{todayKennelArrivals.length > 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    <div className="kennel-ops-list">
                      {todayKennelArrivals.map((booking) => (
                        <div key={`arrival-${booking.id}`} className="kennel-ops-item">
                          <div className="kennel-ops-item__head">
                            <DogAvatar dog={booking.dog} size="small" />
                            <div>
                              <strong>{booking.dog?.name || "Chien non renseigné"}</strong>
                              <span>{booking.client_name}</span>
                            </div>
                          </div>
                          <div className="kennel-ops-meta">
                            <span>{booking.phone || "Téléphone non renseigné"}</span>
                            <span>Départ {formatDeliveryDate(booking.end_date)}</span>
                            <span>{booking.status || "Demandée"}</span>
                          </div>
                          <div className="kennel-ops-dog">
                            {[booking.dog?.breed, booking.dog?.sex, booking.dog?.birth_year].filter(Boolean).join(" - ") || "Fiche chien à compléter"}
                            {" - "}
                            vaccins {booking.dog?.vaccines_up_to_date ? "à jour" : "à vérifier"}
                          </div>
                          {getKennelOperationalNotes(booking).length > 0 && (
                            <div className="kennel-ops-notes">
                              {getKennelOperationalNotes(booking).map((note, index) => (
                                <p key={`${booking.id}-arrival-note-${index}`}>{note}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {todayKennelArrivals.length === 0 && <p className="kennel-ops-empty">Aucune arrivée prévue aujourd'hui.</p>}
                    </div>
                  </article>

                  <article className="kennel-ops-card kennel-ops-card--present">
                    <div className="kennel-ops-card__title">
                      <span><Dog size={22} /></span>
                      <div>
                        <h3>Chiens présents</h3>
                        <p>{currentKennelGuests.length} chien{currentKennelGuests.length > 1 ? "s" : ""} actuellement à la pension</p>
                      </div>
                    </div>
                    <div className="kennel-ops-list">
                      {currentKennelGuests.map((booking) => (
                        <div key={`present-${booking.id}`} className="kennel-ops-item">
                          <div className="kennel-ops-item__head">
                            <DogAvatar dog={booking.dog} size="small" />
                            <div>
                              <strong>{booking.dog?.name || "Chien non renseigné"}</strong>
                              <span>{booking.client_name}</span>
                            </div>
                          </div>
                          <div className="kennel-ops-meta">
                            <span>{booking.phone || "Téléphone non renseigné"}</span>
                            <span>Départ {formatDeliveryDate(booking.end_date)}</span>
                            <span>{getKennelNights(booking.start_date, booking.end_date).length} nuitée{getKennelNights(booking.start_date, booking.end_date).length > 1 ? "s" : ""}</span>
                          </div>
                          <div className="kennel-ops-dog">
                            {[booking.dog?.breed, booking.dog?.sex, booking.dog?.birth_year].filter(Boolean).join(" - ") || "Fiche chien à compléter"}
                            {" - "}
                            {booking.dog?.sterilized ? "stérilisé" : "non stérilisé / à vérifier"}
                          </div>
                          {getKennelOperationalNotes(booking).length > 0 && (
                            <div className="kennel-ops-notes">
                              {getKennelOperationalNotes(booking).map((note, index) => (
                                <p key={`${booking.id}-present-note-${index}`}>{note}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {currentKennelGuests.length === 0 && <p className="kennel-ops-empty">Aucun chien présent aujourd'hui.</p>}
                    </div>
                  </article>

                  <article className="kennel-ops-card kennel-ops-card--departures">
                    <div className="kennel-ops-card__title">
                      <span><LogOut size={22} /></span>
                      <div>
                        <h3>Départs du jour</h3>
                        <p>{todayKennelDepartures.length} chien{todayKennelDepartures.length > 1 ? "s" : ""} à préparer</p>
                      </div>
                    </div>
                    <div className="kennel-ops-list">
                      {todayKennelDepartures.map((booking) => (
                        <div key={`departure-${booking.id}`} className="kennel-ops-item">
                          <div className="kennel-ops-item__head">
                            <DogAvatar dog={booking.dog} size="small" />
                            <div>
                              <strong>{booking.dog?.name || "Chien non renseigné"}</strong>
                              <span>{booking.client_name}</span>
                            </div>
                          </div>
                          <div className="kennel-ops-meta">
                            <span>{booking.phone || "Téléphone non renseigné"}</span>
                            <span>Arrivé le {formatDeliveryDate(booking.start_date)}</span>
                            <span>{booking.status || "Demandée"}</span>
                          </div>
                          <div className="kennel-ops-dog">
                            {[booking.dog?.breed, booking.dog?.sex, booking.dog?.birth_year].filter(Boolean).join(" - ") || "Fiche chien à compléter"}
                          </div>
                          {getKennelOperationalNotes(booking).length > 0 && (
                            <div className="kennel-ops-notes">
                              {getKennelOperationalNotes(booking).map((note, index) => (
                                <p key={`${booking.id}-departure-note-${index}`}>{note}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {todayKennelDepartures.length === 0 && <p className="kennel-ops-empty">Aucun départ prévu aujourd'hui.</p>}
                    </div>
                  </article>
                </div>

                <div className="kennel-calendar-toolbar">
                  <button type="button" onClick={() => setKennelCalendarMonth(shiftMonth(kennelCalendarMonth, -1))}>
                    Mois précédent
                  </button>
                  <strong>{getMonthLabel(kennelCalendarMonth)}</strong>
                  <button type="button" onClick={() => setKennelCalendarMonth(shiftMonth(kennelCalendarMonth, 1))}>
                    Mois suivant
                  </button>
                </div>

                <div className="kennel-calendar">
                  {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => (
                    <span key={day} className="kennel-calendar__weekday">{day}</span>
                  ))}

                  {kennelCalendarDays.map((day) => (
                    <article
                      key={day.date}
                      className={`kennel-calendar__day ${day.inMonth ? "" : "is-muted"} ${day.bookings.length >= KENNEL_MAX_BOOKINGS_PER_NIGHT ? "is-full" : ""} ${day.blockedDate ? "is-blocked" : ""}`}
                    >
                      <div>
                        <strong>{day.dayNumber}</strong>
                        <span>{day.blockedDate ? "Fermé" : `${day.bookings.length}/${KENNEL_MAX_BOOKINGS_PER_NIGHT}`}</span>
                      </div>
                      {day.blockedDate ? (
                        <em>{day.blockedDate.reason || "Réservations fermées"}</em>
                      ) : day.bookings.length > 0 ? (
                        <ul>
                          {day.bookings.slice(0, 4).map((booking) => (
                            <li key={`${day.date}-${booking.id}`}>{booking.dog?.name || booking.client_name}</li>
                          ))}
                        </ul>
                      ) : (
                        <em>Libre</em>
                      )}
                    </article>
                  ))}
                </div>
              </section>

              <section className="admin-products-panel admin-manual-kennel-panel" data-section="kennel">
                <div className="admin-panel-title">
                  <span><Plus size={24} /></span>
                  <div>
                    <h2>Ajouter une réservation hors appli</h2>
                    <p>Saisissez vous-même un client, son chien et les dates réservées par téléphone, message ou sur place.</p>
                  </div>
                </div>

                <form className="admin-manual-kennel-form" onSubmit={createAdminKennelBooking}>
                  <fieldset>
                    <legend>Client</legend>
                    <label>
                      <span>Nom du client *</span>
                      <input
                        value={adminKennelBookingForm.clientName}
                        onChange={(e) => setAdminKennelBookingForm({ ...adminKennelBookingForm, clientName: e.target.value })}
                        placeholder="Nom et prénom"
                      />
                    </label>
                    <label>
                      <span>Téléphone *</span>
                      <input
                        type="tel"
                        value={adminKennelBookingForm.clientPhone}
                        onChange={(e) => setAdminKennelBookingForm({ ...adminKennelBookingForm, clientPhone: e.target.value })}
                        placeholder="06 00 00 00 00"
                      />
                    </label>
                    <label>
                      <span>Email facultatif</span>
                      <input
                        type="email"
                        value={adminKennelBookingForm.clientEmail}
                        onChange={(e) => setAdminKennelBookingForm({ ...adminKennelBookingForm, clientEmail: e.target.value })}
                        placeholder="client@email.fr"
                      />
                    </label>
                    <label>
                      <span>Adresse / consignes</span>
                      <textarea
                        value={adminKennelBookingForm.clientAddress}
                        onChange={(e) => setAdminKennelBookingForm({ ...adminKennelBookingForm, clientAddress: e.target.value })}
                        placeholder="Adresse, habitudes de contact, consignes de dépôt..."
                        rows="3"
                      />
                    </label>
                  </fieldset>

                  <fieldset>
                    <legend>Séjour</legend>
                    <label>
                      <span>Arrivée *</span>
                      <input
                        type="date"
                        value={adminKennelBookingForm.startDate}
                        onChange={(e) => setAdminKennelBookingForm({ ...adminKennelBookingForm, startDate: e.target.value })}
                      />
                    </label>
                    <label>
                      <span>Départ *</span>
                      <input
                        type="date"
                        min={adminKennelBookingForm.startDate || undefined}
                        value={adminKennelBookingForm.endDate}
                        onChange={(e) => setAdminKennelBookingForm({ ...adminKennelBookingForm, endDate: e.target.value })}
                      />
                    </label>
                    <label>
                      <span>Statut</span>
                      <select
                        value={adminKennelBookingForm.status}
                        onChange={(e) => setAdminKennelBookingForm({ ...adminKennelBookingForm, status: e.target.value })}
                      >
                        {reservationStatusOptions.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Montant confirmé</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={adminKennelBookingForm.amountConfirmed}
                        onChange={(e) => setAdminKennelBookingForm({ ...adminKennelBookingForm, amountConfirmed: e.target.value })}
                        placeholder="Ex : 120"
                      />
                    </label>
                    <label>
                      <span>Acompte payé</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={adminKennelBookingForm.depositAmount}
                        onChange={(e) => setAdminKennelBookingForm({ ...adminKennelBookingForm, depositAmount: e.target.value })}
                        placeholder="Ex : 40"
                      />
                    </label>
                    <label>
                      <span>Moyen de paiement</span>
                      <select
                        value={adminKennelBookingForm.paymentMethod}
                        onChange={(e) => setAdminKennelBookingForm({ ...adminKennelBookingForm, paymentMethod: e.target.value })}
                      >
                        {paymentMethodOptions.map((method) => (
                          <option key={method} value={method}>{method}</option>
                        ))}
                      </select>
                    </label>
                    <label className="admin-manual-check">
                      <input
                        type="checkbox"
                        checked={adminKennelBookingForm.paymentReceived}
                        onChange={(e) => setAdminKennelBookingForm({ ...adminKennelBookingForm, paymentReceived: e.target.checked })}
                      />
                      <span>Paiement reçu</span>
                    </label>
                  </fieldset>

                  <fieldset>
                    <legend>Chien</legend>
                    <label>
                      <span>Nom du chien *</span>
                      <input
                        value={adminKennelBookingForm.dogName}
                        onChange={(e) => setAdminKennelBookingForm({ ...adminKennelBookingForm, dogName: e.target.value })}
                        placeholder="Nom"
                      />
                    </label>
                    <label>
                      <span>Photo du chien</span>
                      <input
                        value={adminKennelBookingForm.dogPhotoUrl}
                        onChange={(e) => setAdminKennelBookingForm({ ...adminKennelBookingForm, dogPhotoUrl: e.target.value })}
                        placeholder="/images/photo-chien.jpg ou lien"
                      />
                    </label>
                    <label>
                      <span>Race</span>
                      <input
                        value={adminKennelBookingForm.dogBreed}
                        onChange={(e) => setAdminKennelBookingForm({ ...adminKennelBookingForm, dogBreed: e.target.value })}
                        placeholder="Race ou croisé"
                      />
                    </label>
                    <label>
                      <span>Année de naissance</span>
                      <input
                        type="number"
                        min="1990"
                        max={new Date().getFullYear()}
                        value={adminKennelBookingForm.dogBirthYear}
                        onChange={(e) => setAdminKennelBookingForm({ ...adminKennelBookingForm, dogBirthYear: e.target.value })}
                        placeholder="2020"
                      />
                    </label>
                    <label>
                      <span>Sexe</span>
                      <select
                        value={adminKennelBookingForm.dogSex}
                        onChange={(e) => setAdminKennelBookingForm({ ...adminKennelBookingForm, dogSex: e.target.value })}
                      >
                        <option value="">Non renseigné</option>
                        <option value="Femelle">Femelle</option>
                        <option value="Mâle">Mâle</option>
                      </select>
                    </label>
                    <label className="admin-manual-check">
                      <input
                        type="checkbox"
                        checked={adminKennelBookingForm.vaccinesUpToDate}
                        onChange={(e) => setAdminKennelBookingForm({ ...adminKennelBookingForm, vaccinesUpToDate: e.target.checked })}
                      />
                      <span>Vaccins à jour</span>
                    </label>
                    <label className="admin-manual-check">
                      <input
                        type="checkbox"
                        checked={adminKennelBookingForm.sterilized}
                        onChange={(e) => setAdminKennelBookingForm({ ...adminKennelBookingForm, sterilized: e.target.checked })}
                      />
                      <span>Stérilisé</span>
                    </label>
                    <label className="admin-manual-wide">
                      <span>Notes privées</span>
                      <textarea
                        value={adminKennelBookingForm.notes}
                        onChange={(e) => setAdminKennelBookingForm({ ...adminKennelBookingForm, notes: e.target.value })}
                        placeholder="Alimentation, comportement, traitement, remarques..."
                        rows="4"
                      />
                    </label>
                  </fieldset>

                  <div className="admin-manual-actions">
                    <button type="submit" className="primary-action">
                      Ajouter la réservation
                    </button>
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => setAdminKennelBookingForm(emptyAdminKennelBookingForm)}
                    >
                      Vider le formulaire
                    </button>
                  </div>
                </form>
              </section>

              <section className="admin-delivery-slots-panel" data-section="kennel">
                <div className="admin-panel-title">
                  <span><CalendarCheck size={24} /></span>
                  <div>
                    <h2>Dates fermées</h2>
                    <p>Bloquez simplement les nuitées où la pension canine n'est pas ouverte.</p>
                  </div>
                </div>

                <form className="admin-delivery-slot-form" onSubmit={saveKennelBlockedDate}>
                  <input
                    type="date"
                    value={kennelBlockedDateForm.blocked_date}
                    onChange={(e) => setKennelBlockedDateForm({ ...kennelBlockedDateForm, blocked_date: e.target.value })}
                  />
                  <input
                    value={kennelBlockedDateForm.reason}
                    onChange={(e) => setKennelBlockedDateForm({ ...kennelBlockedDateForm, reason: e.target.value })}
                    placeholder="Raison facultative : week-end, congés..."
                  />
                  <button type="submit" className="primary-action">
                    Fermer cette date
                  </button>
                </form>

                <div className="admin-delivery-slots-list">
                  {upcomingKennelBlockedDates.map((blockedDate) => (
                    <article key={blockedDate.id}>
                      <div>
                        <strong>{formatDeliveryDate(blockedDate.blocked_date)}</strong>
                        <span>{blockedDate.reason || "Réservations fermées"}</span>
                      </div>
                      <div>
                        <button type="button" onClick={() => deleteKennelBlockedDate(blockedDate)}>
                          Rouvrir
                        </button>
                      </div>
                    </article>
                  ))}

                  {upcomingKennelBlockedDates.length === 0 && (
                    <p className="delivery-empty">Aucune date fermée à venir.</p>
                  )}
                </div>
              </section>

              <section className="admin-products-panel admin-service-panel" data-section="kennel">
                <div className="admin-panel-title">
                  <span><Euro size={24} /></span>
                  <div>
                    <h2>Tarifs pension</h2>
                    <p>Ajoutez, masquez ou modifiez les offres visibles côté client.</p>
                  </div>
                </div>

                <form className="admin-product-form" onSubmit={saveKennelService}>
                  <input
                    value={kennelServiceForm.name}
                    onChange={(e) => setKennelServiceForm({ ...kennelServiceForm, name: e.target.value })}
                    placeholder="Nom du tarif"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={kennelServiceForm.price}
                    onChange={(e) => setKennelServiceForm({ ...kennelServiceForm, price: e.target.value })}
                    placeholder="Tarif, 0 si sur demande"
                  />
                  <input
                    value={kennelServiceForm.unit_label}
                    onChange={(e) => setKennelServiceForm({ ...kennelServiceForm, unit_label: e.target.value })}
                    placeholder="Unité : jour, nuit, séjour..."
                  />
                  <input
                    value={kennelServiceForm.description}
                    onChange={(e) => setKennelServiceForm({ ...kennelServiceForm, description: e.target.value })}
                    placeholder="Description courte"
                  />
                  <button type="submit" className="primary-action">
                    {kennelServiceForm.id ? "Mettre à jour" : "Ajouter"}
                  </button>
                  {kennelServiceForm.id && (
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => setKennelServiceForm(emptyKennelServiceForm)}
                    >
                      Annuler
                    </button>
                  )}
                </form>

                <div className="admin-products-list">
                  {kennelServices.map((service) => (
                    <article key={service.id}>
                      <div>
                        <strong>{service.name}</strong>
                        <span>
                          {service.price > 0 ? `${service.price.toFixed(2)} EUR / ${service.unit_label}` : "Tarif sur demande"}
                          {!service.active ? " - masqué" : ""}
                        </span>
                      </div>
                      <div>
                        <button type="button" onClick={() => editKennelService(service)}>
                          Modifier
                        </button>
                        <button type="button" onClick={() => toggleKennelServiceActive(service)}>
                          {service.active ? "Masquer" : "Afficher"}
                        </button>
                        <button type="button" onClick={() => deleteKennelService(service)}>
                          Supprimer
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="admin-products-panel kennel-dog-profiles-panel" data-section="kennelDogs">
                <div className="admin-panel-title">
                  <span><Dog size={24} /></span>
                  <div>
                    <h2>Fiches chiens</h2>
                    <p>Historique des séjours, alimentation, comportement, santé et contacts d'urgence.</p>
                  </div>
                </div>

                <div className="kennel-dog-profile-list">
                  {kennelDogProfiles.map((profile) => {
                    const dog = profile.dog;
                    const latestBooking = profile.bookings[0];

                    return (
                      <article key={profile.id} className="kennel-dog-profile-card">
                        <div className="kennel-dog-profile-card__header">
                          <div className="kennel-dog-profile-card__identity">
                            <DogAvatar dog={dog} size="large" />
                            <div>
                              <h3>{dog?.name || "Chien non renseigné"}</h3>
                              <p>
                                {[dog?.breed, dog?.sex, dog?.birth_year].filter(Boolean).join(" - ") || "Fiche chien à compléter"}
                              </p>
                            </div>
                          </div>
                          <div className="kennel-dog-profile-badges">
                            <span>{profile.bookings.length} séjour{profile.bookings.length > 1 ? "s" : ""}</span>
                            <span>{dog?.vaccines_up_to_date ? "Vaccins à jour" : "Vaccins à vérifier"}</span>
                            <span>{dog?.sterilized ? "Stérilisé" : "Non stérilisé / à vérifier"}</span>
                          </div>
                        </div>

                        <div className="kennel-dog-profile-grid">
                          <label>
                            <span>Photo du chien</span>
                            <input
                              defaultValue={dog?.photo_url || ""}
                              disabled={!dog?.id}
                              onBlur={(e) => updateDogProfile(dog.id, { photo_url: normalizeImageUrl(e.target.value) })}
                              placeholder="/images/photo-chien.jpg ou lien"
                            />
                          </label>
                          <label>
                            <span>Alimentation</span>
                            <textarea
                              defaultValue={dog?.food_notes || ""}
                              disabled={!dog?.id}
                              onBlur={(e) => updateDogProfile(dog.id, { food_notes: e.target.value.trim() })}
                              placeholder="Croquettes, quantité, horaires, allergies..."
                              rows="3"
                            />
                          </label>
                          <label>
                            <span>Comportement</span>
                            <textarea
                              defaultValue={dog?.behavior_notes || ""}
                              disabled={!dog?.id}
                              onBlur={(e) => updateDogProfile(dog.id, { behavior_notes: e.target.value.trim() })}
                              placeholder="Entente chiens, peurs, habitudes, sorties..."
                              rows="3"
                            />
                          </label>
                          <label>
                            <span>Santé / traitement</span>
                            <textarea
                              defaultValue={dog?.medical_notes || ""}
                              disabled={!dog?.id}
                              onBlur={(e) => updateDogProfile(dog.id, { medical_notes: e.target.value.trim() })}
                              placeholder="Traitement, vétérinaire, surveillance..."
                              rows="3"
                            />
                          </label>
                          <label>
                            <span>Notes générales</span>
                            <textarea
                              defaultValue={dog?.notes || ""}
                              disabled={!dog?.id}
                              onBlur={(e) => updateDogProfile(dog.id, { notes: e.target.value.trim() })}
                              placeholder="Remarques privées visibles admin"
                              rows="3"
                            />
                          </label>
                        </div>

                        <div className="kennel-dog-profile-contact">
                          <label>
                            <span>Contact d'urgence</span>
                            <input
                              defaultValue={dog?.emergency_contact_name || ""}
                              disabled={!dog?.id}
                              onBlur={(e) => updateDogProfile(dog.id, { emergency_contact_name: e.target.value.trim() })}
                              placeholder="Nom du contact"
                            />
                          </label>
                          <label>
                            <span>Téléphone urgence</span>
                            <input
                              type="tel"
                              defaultValue={dog?.emergency_contact_phone || ""}
                              disabled={!dog?.id}
                              onBlur={(e) => updateDogProfile(dog.id, { emergency_contact_phone: e.target.value.trim() })}
                              placeholder="06 00 00 00 00"
                            />
                          </label>
                          <label className="kennel-dog-check">
                            <input
                              type="checkbox"
                              checked={dog?.vaccines_up_to_date === true}
                              disabled={!dog?.id}
                              onChange={(e) => updateDogProfile(dog.id, { vaccines_up_to_date: e.target.checked })}
                            />
                            <span>Vaccins à jour</span>
                          </label>
                          <label className="kennel-dog-check">
                            <input
                              type="checkbox"
                              checked={dog?.sterilized === true}
                              disabled={!dog?.id}
                              onChange={(e) => updateDogProfile(dog.id, { sterilized: e.target.checked })}
                            />
                            <span>Stérilisé</span>
                          </label>
                        </div>

                        <div className="kennel-dog-history">
                          <h4>Historique des séjours</h4>
                          <div>
                            {profile.bookings.slice(0, 5).map((booking) => (
                              <article key={`dog-history-${booking.id}`}>
                                <strong>
                                  {formatDeliveryDate(booking.start_date)} au {formatDeliveryDate(booking.end_date)}
                                </strong>
                                <span>{booking.client_name} - {booking.phone || profile.phonesList[0] || "Téléphone non renseigné"}</span>
                                <em>{booking.status || "Demandée"}{booking.amount_confirmed ? ` - ${Number(booking.amount_confirmed).toFixed(2)} EUR` : ""}</em>
                              </article>
                            ))}
                            {profile.bookings.length === 0 && <p>Aucun séjour enregistré.</p>}
                          </div>
                        </div>

                        {latestBooking && (
                          <div className="kennel-dog-latest">
                            Dernier séjour : {formatDeliveryDate(latestBooking.start_date)} - {latestBooking.client_name}
                          </div>
                        )}
                      </article>
                    );
                  })}

                  {kennelDogProfiles.length === 0 && (
                    <p className="delivery-empty">Aucune fiche chien pour le moment.</p>
                  )}
                </div>
              </section>

              <section className="admin-reservations-panel" data-section="kennel">
                <div className="admin-panel-title">
                  <span><Dog size={24} /></span>
                  <div>
                    <h2>Réservations chiens</h2>
                    <p>{filteredKennelBookings.length} séjour{filteredKennelBookings.length > 1 ? "s" : ""} affiché{filteredKennelBookings.length > 1 ? "s" : ""}.</p>
                  </div>
                </div>

                <div className="admin-filters">
                  {[
                    { value: "pending", label: "En attente" },
                    { value: "active", label: "Actives" },
                    { value: "confirmed", label: "Confirmées" },
                    { value: "today", label: "Départs/arrivées du jour" },
                    { value: "all", label: "Toutes" },
                  ].map((filter) => (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => setKennelReservationFilter(filter.value)}
                      className={kennelReservationFilter === filter.value ? "is-active" : ""}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                <div className="admin-reservation-list">
                  {filteredKennelBookings.map((booking) => (
                    <article key={booking.id} className="admin-reservation-card">
                      <div className="admin-reservation-dog">
                        <DogAvatar dog={booking.dog} size="medium" />
                        <div>
                          <strong>{booking.dog?.name || "Chien non renseigné"}</strong>
                          <span>
                            {booking.client_name} - {String(booking.client_email || "").includes("@les-poulettes.local") ? "hors appli" : booking.client_email}
                          </span>
                          {booking.client_address && <span>{booking.client_address}</span>}
                          <span>
                            {[booking.dog?.breed, booking.dog?.sex, booking.dog?.birth_year].filter(Boolean).join(" - ") || "Fiche chien à compléter"}
                          </span>
                          <span>
                            {booking.phone || "Téléphone non renseigné"} - vaccins {booking.dog?.vaccines_up_to_date ? "à jour" : "à vérifier"}
                            {" - "}
                            {booking.dog?.sterilized ? "stérilisé" : "non stérilisé / à vérifier"}
                          </span>
                          {(booking.notes || booking.dog?.notes) && <em>{booking.notes || booking.dog?.notes}</em>}
                        </div>
                      </div>
                      <div className="admin-reservation-controls admin-reservation-controls--dates">
                        <input
                          type="date"
                          value={booking.start_date || ""}
                          onChange={(e) => updateKennelBooking(booking.id, { start_date: e.target.value })}
                        />
                        <input
                          type="date"
                          value={booking.end_date || ""}
                          onChange={(e) => updateKennelBooking(booking.id, { end_date: e.target.value })}
                        />
                        <label className="admin-amount-field">
                          <span>Montant confirmé</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue={booking.amount_confirmed ?? ""}
                            placeholder={`${getKennelBookingAmount({ ...booking, amount_confirmed: null }).toFixed(2)} EUR`}
                            onBlur={(e) =>
                              updateKennelBooking(booking.id, {
                                amount_confirmed: e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <div className={`payment-status payment-status--${getBookingPaymentSummary(booking, getKennelBookingAmount(booking)).tone}`}>
                          <strong>{getBookingPaymentSummary(booking, getKennelBookingAmount(booking)).label}</strong>
                          <span>
                            Acompte {getBookingPaymentSummary(booking, getKennelBookingAmount(booking)).deposit.toFixed(2)} EUR - reste {getBookingPaymentSummary(booking, getKennelBookingAmount(booking)).remaining.toFixed(2)} EUR
                          </span>
                          <em>{getBookingPaymentSummary(booking, getKennelBookingAmount(booking)).method}</em>
                        </div>
                        <label className="admin-amount-field">
                          <span>Acompte payé</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue={booking.deposit_amount ?? ""}
                            placeholder="0.00"
                            onBlur={(e) =>
                              updateKennelBooking(booking.id, {
                                deposit_amount: e.target.value === "" ? 0 : Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <label className="admin-payment-check">
                          <input
                            type="checkbox"
                            checked={booking.payment_received === true}
                            onChange={(e) =>
                              updateKennelBooking(booking.id, {
                                payment_received: e.target.checked,
                                payment_received_at: e.target.checked ? new Date().toISOString() : null,
                              })
                            }
                          />
                          <span>Paiement reçu</span>
                        </label>
                        <select
                          value={booking.payment_method || "Non renseigné"}
                          onChange={(e) => updateKennelBooking(booking.id, { payment_method: e.target.value })}
                          aria-label="Moyen de paiement"
                        >
                          {paymentMethodOptions.map((method) => (
                            <option key={method} value={method}>{method}</option>
                          ))}
                        </select>
                        <select
                          value={booking.status || "Demandée"}
                          onChange={(e) => updateKennelBooking(booking.id, { status: e.target.value })}
                        >
                          {reservationStatusOptions.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                        <button type="button" onClick={() => setKennelBookingArchived(booking, !booking.archived_at)}>
                          {booking.archived_at ? "Restaurer" : "Archiver"}
                        </button>
                        <div className="admin-message-actions admin-message-actions--wide">
                          <button type="button" className="admin-message-actions__whatsapp" onClick={() => openPreparedMessage("kennel-confirmed", booking, "whatsapp")}>
                            WhatsApp confirmer
                          </button>
                          <button type="button" className="admin-message-actions__whatsapp" onClick={() => openPreparedMessage("kennel-reminder", booking, "whatsapp")}>
                            WhatsApp rappel
                          </button>
                          <button type="button" className="admin-message-actions__whatsapp" onClick={() => openPreparedMessage("kennel-full", booking, "whatsapp")}>
                            WhatsApp complète
                          </button>
                          <button type="button" onClick={() => openPreparedMessage("kennel-confirmed", booking, "sms")}>
                            SMS confirmer
                          </button>
                          <button type="button" onClick={() => openPreparedMessage("kennel-reminder", booking, "sms")}>
                            SMS rappel
                          </button>
                          <button type="button" onClick={() => openPreparedMessage("kennel-full", booking, "sms")}>
                            SMS complète
                          </button>
                          <button type="button" onClick={() => openPreparedMessage("kennel-confirmed", booking, "email")}>
                            Email confirmer
                          </button>
                          <button type="button" onClick={() => copyPreparedMessage("kennel-confirmed", booking)}>
                            Copier
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}

                  {filteredKennelBookings.length === 0 && (
                    <p className="delivery-empty">Aucune réservation pension canine pour ce filtre.</p>
                  )}
                </div>
              </section>

              <section className="admin-orders-panel accounting-panel" data-section="accounting">
                <div className="admin-panel-title admin-panel-title--row">
                  <span><Euro size={24} /></span>
                  <div>
                    <h2>Comptabilité</h2>
                    <p>Suivez le chiffre d'affaires estimé par activité et exportez une période.</p>
                  </div>
                </div>

                <div className="accounting-tools">
                  <label>
                    <span>Du</span>
                    <input
                      type="date"
                      value={accountingStartDate}
                      onChange={(e) => setAccountingStartDate(e.target.value)}
                    />
                  </label>
                  <label>
                    <span>Au</span>
                    <input
                      type="date"
                      value={accountingEndDate}
                      onChange={(e) => setAccountingEndDate(e.target.value)}
                    />
                  </label>
                  <label>
                    <span>Activité</span>
                    <select
                      value={accountingActivity}
                      onChange={(e) => setAccountingActivity(e.target.value)}
                    >
                      <option value="all">Toutes</option>
                      <option value="eggs">Œufs</option>
                      <option value="education">Ferme pédagogique</option>
                      <option value="kennel">Pension canine</option>
                    </select>
                  </label>
                  <button type="button" onClick={exportAccountingCsv} className="admin-tool-button">
                    <Download size={17} />
                    Export CSV
                  </button>
                </div>

                <div className="accounting-summary">
                  <article>
                    <span>Total période</span>
                    <strong>{accountingTotals.global.toFixed(2)} EUR</strong>
                  </article>
                  <article>
                    <span>Œufs</span>
                    <strong>{accountingTotals.eggs.toFixed(2)} EUR</strong>
                  </article>
                  <article>
                    <span>Ferme pédagogique</span>
                    <strong>{accountingTotals.education.toFixed(2)} EUR</strong>
                  </article>
                  <article>
                    <span>Pension canine</span>
                    <strong>{accountingTotals.kennel.toFixed(2)} EUR</strong>
                  </article>
                </div>

                <div className="export-panel">
                  <div>
                    <h3>Exports CSV</h3>
                    <p>Les boutons utilisent la période choisie ci-dessus.</p>
                  </div>
                  <div className="export-panel__actions">
                    <button type="button" onClick={exportOrdersPeriodCsv}>
                      Commandes
                    </button>
                    <button type="button" onClick={exportEducationPeriodCsv}>
                      Réservations ferme
                    </button>
                    <button type="button" onClick={exportKennelPeriodCsv}>
                      Pension canine
                    </button>
                    <button type="button" onClick={exportClientsPeriodCsv}>
                      Clients
                    </button>
                    <button type="button" onClick={exportAccountingCsv}>
                      Comptabilité
                    </button>
                    <button type="button" onClick={exportAllDataBackup} className="export-panel__primary">
                      Export complet
                    </button>
                  </div>
                </div>

                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Activité</th>
                        <th>Client</th>
                        <th>Détail</th>
                        <th>Montant</th>
                        <th>Type</th>
                        <th>Paiement</th>
                        <th>Reste</th>
                        <th>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountingRows.map((row) => (
                        <tr key={row.id}>
                          <td data-label="Date">{formatDeliveryDate(row.date)}</td>
                          <td data-label="Activité">{row.activityLabel}</td>
                          <td data-label="Client">{row.client || "Client"}</td>
                          <td data-label="Détail">{row.detail}</td>
                          <td data-label="Montant"><strong>{row.amount.toFixed(2)} EUR</strong></td>
                          <td data-label="Type">{row.amountSource}</td>
                          <td data-label="Paiement">{row.paymentLabel}{row.paymentMethod ? ` - ${row.paymentMethod}` : ""}</td>
                          <td data-label="Reste">{row.paymentRemaining.toFixed(2)} EUR</td>
                          <td data-label="Statut">{row.status}</td>
                        </tr>
                      ))}

                      {accountingRows.length === 0 && (
                        <tr>
                          <td colSpan="9" className="admin-empty">Aucune ligne comptable pour cette période.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="admin-products-panel statistics-panel" data-section="statistics">
                <div className="admin-panel-title admin-panel-title--row">
                  <span><Euro size={24} /></span>
                  <div>
                    <h2>Statistiques</h2>
                    <p>Vue synthétique des ventes, réservations, pension et clients actifs.</p>
                  </div>
                </div>

                <div className="statistics-cards">
                  <article className="statistics-card statistics-card--primary">
                    <span>CA total</span>
                    <strong>{adminStats.revenue.toFixed(2)} EUR</strong>
                    <em>{adminStats.eggsSold} œuf{adminStats.eggsSold > 1 ? "s" : ""} vendu{adminStats.eggsSold > 1 ? "s" : ""}</em>
                  </article>
                  <article className="statistics-card">
                    <span>Activité la plus demandée</span>
                    <strong>{topEducationActivities[0]?.name || "Aucune"}</strong>
                    <em>{topEducationActivities[0]?.bookings || 0} réservation{(topEducationActivities[0]?.bookings || 0) > 1 ? "s" : ""}</em>
                  </article>
                  <article className="statistics-card">
                    <span>Pension occupée</span>
                    <strong>{kennelOccupancyStats.occupancyRate}%</strong>
                    <em>{kennelOccupancyStats.occupiedNights}/{kennelOccupancyStats.capacityNights} nuitées ce mois</em>
                  </article>
                  <article className="statistics-card">
                    <span>Clients actifs</span>
                    <strong>{activeClientStats.active90Days}</strong>
                    <em>sur les 90 derniers jours</em>
                  </article>
                </div>

                <div className="statistics-grid">
                  <article className="statistics-block">
                    <h3>Ventes par mois</h3>
                    <div className="statistics-list statistics-list--bars">
                      {monthlySalesStats.map((month) => (
                        <div key={month.month} className="statistics-row">
                          <span>{getMonthLabel(month.month)}</span>
                          <strong>{month.revenue.toFixed(2)} EUR</strong>
                          <em>{month.orders} commande{month.orders > 1 ? "s" : ""} - {month.eggs} œufs</em>
                        </div>
                      ))}
                      {monthlySalesStats.length === 0 && <p>Aucune vente à afficher.</p>}
                    </div>
                  </article>

                  <article className="statistics-block">
                    <h3>Activités les plus demandées</h3>
                    <div className="statistics-list statistics-list--ranked">
                      {topEducationActivities.map((activity) => (
                        <div key={activity.name} className="statistics-row">
                          <span>{activity.name}</span>
                          <strong>{activity.bookings}</strong>
                          <em>{activity.participants} participant{activity.participants > 1 ? "s" : ""}</em>
                        </div>
                      ))}
                      {topEducationActivities.length === 0 && <p>Aucune réservation ferme à afficher.</p>}
                    </div>
                  </article>

                  <article className="statistics-block">
                    <h3>Pension canine</h3>
                    <div className="statistics-list">
                      <div className="statistics-row">
                        <span>Mois suivi</span>
                        <strong>{getMonthLabel(kennelOccupancyStats.month)}</strong>
                        <em>capacité {KENNEL_MAX_BOOKINGS_PER_NIGHT} chiens/nuit</em>
                      </div>
                      <div className="statistics-row">
                        <span>Demandes actives</span>
                        <strong>{pendingKennelBookings.length}</strong>
                        <em>hors archives et annulations</em>
                      </div>
                      <div className="statistics-row">
                        <span>Chiens présents aujourd'hui</span>
                        <strong>{currentKennelGuests.length}</strong>
                        <em>{formatDeliveryDate(todayIso)}</em>
                      </div>
                    </div>
                  </article>

                  <article className="statistics-block">
                    <h3>Clients</h3>
                    <div className="statistics-list">
                      <div className="statistics-row">
                        <span>Total clients</span>
                        <strong>{activeClientStats.total}</strong>
                        <em>comptes enregistrés</em>
                      </div>
                      <div className="statistics-row">
                        <span>Accès œufs</span>
                        <strong>{activeClientStats.eggAccess}</strong>
                        <em>clients autorisés</em>
                      </div>
                      <div className="statistics-row">
                        <span>Nouveaux clients</span>
                        <strong>{activeClientStats.recent}</strong>
                        <em>sur les 7 derniers jours</em>
                      </div>
                    </div>
                  </article>
                </div>
              </section>

              <section className="admin-products-panel traffic-panel" data-section="traffic">
                <div className="admin-panel-title admin-panel-title--row">
                  <span><Eye size={24} /></span>
                  <div>
                    <h2>Trafic du site</h2>
                    <p>Suivi anonyme des pages consultées et des clics importants, même sans connexion client.</p>
                  </div>
                  <button type="button" className="admin-tool-button" onClick={loadTrafficEvents}>
                    <RefreshCw size={17} />
                    Actualiser
                  </button>
                </div>

                <div className="statistics-cards traffic-cards">
                  <article>
                    <span>Visites aujourd'hui</span>
                    <strong>{trafficTodayEvents.length}</strong>
                    <em>{trafficUniqueVisitorsToday} session{trafficUniqueVisitorsToday > 1 ? "s" : ""} anonyme{trafficUniqueVisitorsToday > 1 ? "s" : ""}</em>
                  </article>
                  <article>
                    <span>Pages vues 7 jours</span>
                    <strong>{traffic7DayEvents.filter((event) => event.event_type === "page_view").length}</strong>
                    <em>activité récente du site</em>
                  </article>
                  <article>
                    <span>Pages vues 30 jours</span>
                    <strong>{trafficPageViews.length}</strong>
                    <em>{trafficUniqueVisitors30Days} session{trafficUniqueVisitors30Days > 1 ? "s" : ""}</em>
                  </article>
                  <article>
                    <span>Clics suivis</span>
                    <strong>{trafficClicks.length}</strong>
                    <em>boutons Google et actions clés</em>
                  </article>
                </div>

                <div className="traffic-grid">
                  <article className="statistics-block traffic-daily-block">
                    <h3>Vue par jour</h3>
                    <div className="traffic-daily-list">
                      {trafficDailyRows.map((day) => (
                        <div key={day.date} className="traffic-day-row">
                          <div>
                            <span>{day.label}</span>
                            <em>{formatDeliveryDate(day.date)}</em>
                          </div>
                          <strong>{day.pageViews}</strong>
                          <small>pages vues</small>
                          <strong>{day.visitorsCount}</strong>
                          <small>sessions</small>
                          <strong>{day.clicks}</strong>
                          <small>clics</small>
                          <p>
                            Page la plus vue : {day.topPage ? `${day.topPage.label} (${day.topPage.views})` : "aucune"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="statistics-block">
                    <h3>Pages les plus vues</h3>
                    <div className="traffic-table">
                      {trafficPageRows.map((page) => (
                        <div key={page.key} className="traffic-row">
                          <span>{page.label}</span>
                          <strong>{page.views}</strong>
                          <em>{page.visitorsCount} session{page.visitorsCount > 1 ? "s" : ""}</em>
                        </div>
                      ))}
                      {trafficPageRows.length === 0 && (
                        <p>Aucune visite enregistrée pour le moment. La migration Supabase doit être appliquée avant de voir les données.</p>
                      )}
                    </div>
                  </article>

                  <article className="statistics-block">
                    <h3>Clics importants</h3>
                    <div className="traffic-table">
                      {trafficClickRows.map((click) => (
                        <div key={click.key} className="traffic-row">
                          <span>{click.label}</span>
                          <strong>{click.clicks}</strong>
                          <em>{click.pageLabel}</em>
                        </div>
                      ))}
                      {trafficClickRows.length === 0 && <p>Aucun clic important enregistré.</p>}
                    </div>
                  </article>
                </div>

                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Page</th>
                        <th>Session</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trafficEvents.slice(0, 80).map((event) => (
                        <tr key={event.id}>
                          <td data-label="Date">{formatCreatedAtDateTime(event.created_at)}</td>
                          <td data-label="Type">
                            {event.event_type === "click" ? (
                              <span className="traffic-event-label"><MousePointerClick size={15} /> Clic</span>
                            ) : (
                              <span className="traffic-event-label"><Eye size={15} /> Page vue</span>
                            )}
                          </td>
                          <td data-label="Page">{event.page_label || event.page_key || "Page"}</td>
                          <td data-label="Session">{String(event.visitor_id || "").slice(0, 8) || "Anonyme"}</td>
                        </tr>
                      ))}

                      {trafficEvents.length === 0 && (
                        <tr>
                          <td colSpan="4" className="admin-empty">Aucune donnée de trafic à afficher.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="admin-products-panel admin-settings-panel" data-section="settings">
                <div className="admin-panel-title admin-panel-title--row">
                  <span><ShieldCheck size={24} /></span>
                  <div>
                    <h2>Réglages admin</h2>
                    <p>Centralisez les informations importantes de l'application et les liens utiles.</p>
                  </div>
                </div>

                <form className="admin-settings-form" onSubmit={saveAppSettings}>
                  <div className="admin-settings-grid">
                    <label>
                      <span>Nom affiché</span>
                      <input
                        value={appSettingsForm.farm_name}
                        onChange={(e) => setAppSettingsForm({ ...appSettingsForm, farm_name: e.target.value })}
                        placeholder="Les Poulettes du Marais"
                      />
                    </label>
                    <label>
                      <span>Email de contact</span>
                      <input
                        type="email"
                        value={appSettingsForm.contact_email}
                        onChange={(e) => setAppSettingsForm({ ...appSettingsForm, contact_email: e.target.value })}
                        placeholder="contact@exemple.fr"
                      />
                    </label>
                    <label>
                      <span>Téléphone de contact</span>
                      <input
                        value={appSettingsForm.contact_phone}
                        onChange={(e) => setAppSettingsForm({ ...appSettingsForm, contact_phone: e.target.value })}
                        placeholder="06 00 00 00 00"
                      />
                    </label>
                    <label>
                      <span>Adresse du site</span>
                      <input
                        value={appSettingsForm.site_url}
                        onChange={(e) => setAppSettingsForm({ ...appSettingsForm, site_url: e.target.value })}
                        placeholder="https://votre-site.netlify.app"
                      />
                    </label>
                    <label>
                      <span>Lien pour déposer un avis Google</span>
                      <input
                        value={appSettingsForm.google_review_url}
                        onChange={(e) => setAppSettingsForm({ ...appSettingsForm, google_review_url: e.target.value })}
                        placeholder="https://g.page/r/.../review"
                      />
                    </label>
                    <label>
                      <span>Lien fiche Google / Maps</span>
                      <input
                        value={appSettingsForm.google_maps_url}
                        onChange={(e) => setAppSettingsForm({ ...appSettingsForm, google_maps_url: e.target.value })}
                        placeholder="Lien Google Maps"
                      />
                    </label>
                    <label>
                      <span>Repère capacité pension</span>
                      <input
                        value={appSettingsForm.kennel_capacity_note}
                        onChange={(e) => setAppSettingsForm({ ...appSettingsForm, kennel_capacity_note: e.target.value })}
                        placeholder="4 chiens par nuit"
                      />
                    </label>
                  </div>

                  <label className="admin-settings-form__wide">
                    <span>Mémo interne</span>
                    <textarea
                      value={appSettingsForm.admin_note}
                      onChange={(e) => setAppSettingsForm({ ...appSettingsForm, admin_note: e.target.value })}
                      placeholder="Infos utiles pour l'admin : consignes, rappels, liens..."
                      rows="4"
                    />
                  </label>

                  <div className="admin-settings-summary">
                    <article>
                      <span>Site</span>
                      <strong>{appSettings.site_url || "Non renseigné"}</strong>
                    </article>
                    <article>
                      <span>Contact</span>
                      <strong>{[appSettings.contact_phone, appSettings.contact_email].filter(Boolean).join(" - ") || "Non renseigné"}</strong>
                    </article>
                    <article>
                      <span>Pension</span>
                      <strong>{appSettings.kennel_capacity_note || DEFAULT_APP_SETTINGS.kennel_capacity_note}</strong>
                    </article>
                  </div>

                  <div className="about-admin-actions">
                    <button type="submit" className="primary-action">
                      Enregistrer les réglages
                    </button>
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => setAppSettingsForm(appSettings)}
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              </section>

              <section className="admin-products-panel about-admin-panel" data-section="content">
                <div className="admin-panel-title">
                  <span><Leaf size={24} /></span>
                  <div>
                    <h2>Présentation et accueil</h2>
                    <p>Modifiez l'événement à l'honneur sur l'accueil, puis les textes de la page La ferme.</p>
                  </div>
                </div>

                <form className="about-admin-form photo-library-admin" onSubmit={saveCustomPhotoLibrary}>
                  <div className="about-admin-block">
                    <div className="home-featured-admin-help">
                      <div>
                        <strong>Bibliothèque photos</strong>
                        <span>Les photos du dossier /public/images sont ajoutées automatiquement après redéploiement. Utilisez ce bloc surtout pour ajouter un lien externe ou une photo spéciale.</span>
                      </div>
                      <span className="photo-library-admin__count">{imageOptions.length} photo(s)</span>
                    </div>
                    <label>
                      <span>Ajouter une photo</span>
                      <div className="photo-library-admin__add">
                        <input
                          value={customPhotoInput}
                          onChange={(e) => setCustomPhotoInput(e.target.value)}
                          placeholder="/images/ma-photo.jpg ou lien complet"
                        />
                        <button type="button" className="secondary-action" onClick={addCustomPhotoToLibrary}>
                          Ajouter
                        </button>
                      </div>
                    </label>
                    <label>
                      <span>Photos ajoutées depuis l'admin</span>
                      <textarea
                        value={customPhotoLibraryForm.images}
                        onChange={(e) => setCustomPhotoLibraryForm({ ...customPhotoLibraryForm, images: e.target.value })}
                        placeholder="Un chemin ou lien par ligne"
                        rows="5"
                      />
                    </label>
                    {parseGalleryImages(customPhotoLibraryForm.images).length > 0 && (
                      <div className="about-admin-gallery-preview">
                        {parseGalleryImages(customPhotoLibraryForm.images).map((imageUrl, index) => (
                          <img key={`${imageUrl}-${index}`} src={imageUrl} alt={`Photo ajoutée ${index + 1}`} />
                        ))}
                      </div>
                    )}
                    <div className="about-admin-actions">
                      <button type="submit" className="primary-action">
                        Enregistrer la bibliothèque photos
                      </button>
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={() => setCustomPhotoLibraryForm(customPhotoLibrary)}
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                </form>

                <form className="about-admin-form home-featured-admin-form" onSubmit={saveHomeFeaturedEvent}>
                  <div className="about-admin-block">
                    <div className="home-featured-admin-help">
                      <div>
                        <strong>Page dédiée côté client</strong>
                        <span>Le bouton “Voir la page événement” apparaît maintenant automatiquement dans l'encadré de l'accueil.</span>
                      </div>
                      <button type="button" className="secondary-action" onClick={() => setScreen("event")}>
                        Prévisualiser la page
                      </button>
                    </div>
                    <label className="admin-payment-check">
                      <input
                        type="checkbox"
                        checked={homeFeaturedEventForm.enabled === true}
                        onChange={(e) =>
                          setHomeFeaturedEventForm({ ...homeFeaturedEventForm, enabled: e.target.checked })
                        }
                      />
                      <span>Afficher l'événement à l'honneur sur l'accueil</span>
                    </label>
                    <label>
                      <span>Petit titre</span>
                      <input
                        value={homeFeaturedEventForm.eyebrow}
                        onChange={(e) =>
                          setHomeFeaturedEventForm({ ...homeFeaturedEventForm, eyebrow: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span>Titre de l'événement</span>
                      <input
                        value={homeFeaturedEventForm.title}
                        onChange={(e) =>
                          setHomeFeaturedEventForm({ ...homeFeaturedEventForm, title: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span>Date de l'événement</span>
                      <input
                        type="date"
                        value={homeFeaturedEventForm.event_date || ""}
                        onChange={(e) =>
                          setHomeFeaturedEventForm({ ...homeFeaturedEventForm, event_date: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span>Texte affiché</span>
                      <textarea
                        value={homeFeaturedEventForm.text}
                        onChange={(e) =>
                          setHomeFeaturedEventForm({ ...homeFeaturedEventForm, text: e.target.value })
                        }
                        rows="4"
                      />
                    </label>
                    <label>
                      <span>Photo de l'événement</span>
                      <input
                        value={homeFeaturedEventForm.image_url}
                        onChange={(e) =>
                          setHomeFeaturedEventForm({
                            ...homeFeaturedEventForm,
                            image_url: e.target.value,
                          })
                        }
                        placeholder="/images/canicross.jpg ou lien d'une photo"
                      />
                    </label>
                    <PhotoQuickPicker
                      imageOptions={imageOptions}
                      onPick={(imageUrl) =>
                        setHomeFeaturedEventForm({
                          ...homeFeaturedEventForm,
                          image_url: imageUrl,
                        })
                      }
                    />
                    {homeFeaturedEventForm.image_url && (
                      <img
                        src={normalizeImageUrl(homeFeaturedEventForm.image_url)}
                        alt="Aperçu événement"
                        className="about-admin-preview"
                      />
                    )}
                    <label>
                      <span>Texte détaillé de la page événement</span>
                      <textarea
                        value={homeFeaturedEventForm.event_details || ""}
                        onChange={(e) =>
                          setHomeFeaturedEventForm({
                            ...homeFeaturedEventForm,
                            event_details: e.target.value,
                          })
                        }
                        rows="6"
                      />
                    </label>
                    <label>
                      <span>Galerie photos événement</span>
                      <textarea
                        value={homeFeaturedEventForm.gallery_images || ""}
                        onChange={(e) =>
                          setHomeFeaturedEventForm({
                            ...homeFeaturedEventForm,
                            gallery_images: e.target.value,
                          })
                        }
                        placeholder="Collez un lien de photo par ligne"
                        rows="5"
                      />
                    </label>
                    <PhotoQuickPicker
                      imageOptions={imageOptions}
                      label="Ajouter une photo à la galerie"
                      onPick={(imageUrl) =>
                        setHomeFeaturedEventForm({
                          ...homeFeaturedEventForm,
                          gallery_images: appendImageToGallery(homeFeaturedEventForm.gallery_images, imageUrl),
                        })
                      }
                    />
                    {parseGalleryImages(homeFeaturedEventForm.gallery_images).length > 0 && (
                      <div className="about-admin-gallery-preview">
                        {parseGalleryImages(homeFeaturedEventForm.gallery_images).map((imageUrl, index) => (
                          <img key={`${imageUrl}-${index}`} src={imageUrl} alt={`Aperçu événement ${index + 1}`} />
                        ))}
                      </div>
                    )}
                    <div className="home-featured-admin-form__button-row">
                      <label>
                        <span>Texte du bouton</span>
                        <input
                          value={homeFeaturedEventForm.cta_label}
                          onChange={(e) =>
                            setHomeFeaturedEventForm({
                              ...homeFeaturedEventForm,
                              cta_label: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        <span>Destination du bouton</span>
                        <select
                          value={homeFeaturedEventForm.cta_screen}
                          onChange={(e) =>
                            setHomeFeaturedEventForm({
                              ...homeFeaturedEventForm,
                              cta_screen: e.target.value,
                            })
                          }
                        >
                          <option value="event">Page événement</option>
                          <option value="contact">Contact</option>
                          <option value="about">La ferme</option>
                          <option value="education">Ferme pédagogique</option>
                          <option value="kennel">Pension canine</option>
                          <option value="shop">Boutique</option>
                        </select>
                      </label>
                    </div>
                    <div className="about-admin-actions">
                      <button type="submit" className="primary-action">
                        Enregistrer l'événement
                      </button>
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={() => setHomeFeaturedEventForm(homeFeaturedEvent)}
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                </form>

                <form className="about-admin-form" onSubmit={saveAboutContent}>
                  <label>
                    <span>Photo principale</span>
                    <input
                      value={aboutForm.image_url}
                      onChange={(e) => setAboutForm({ ...aboutForm, image_url: e.target.value })}
                      placeholder="/images/marais.jpg ou lien d'une photo"
                    />
                    <PhotoQuickPicker
                      imageOptions={imageOptions}
                      onPick={(imageUrl) => setAboutForm({ ...aboutForm, image_url: imageUrl })}
                    />
                  </label>
                  {aboutForm.image_url && (
                    <img src={aboutForm.image_url} alt="Aperçu présentation" className="about-admin-preview" />
                  )}
                  <label>
                    <span>Galerie photos</span>
                    <textarea
                      value={aboutForm.gallery_images}
                      onChange={(e) => setAboutForm({ ...aboutForm, gallery_images: e.target.value })}
                      placeholder="Collez un lien de photo par ligne"
                      rows="5"
                    />
                    <PhotoQuickPicker
                      imageOptions={imageOptions}
                      label="Ajouter une photo existante à la galerie"
                      onPick={(imageUrl) =>
                        setAboutForm({
                          ...aboutForm,
                          gallery_images: appendImageToGallery(aboutForm.gallery_images, imageUrl),
                        })
                      }
                    />
                  </label>
                  {parseGalleryImages(aboutForm.gallery_images).length > 0 && (
                    <div className="about-admin-gallery-preview">
                      {parseGalleryImages(aboutForm.gallery_images).map((imageUrl, index) => (
                        <img key={`${imageUrl}-${index}`} src={imageUrl} alt={`Aperçu galerie ${index + 1}`} />
                      ))}
                    </div>
                  )}
                  <label>
                    <span>Petit titre</span>
                    <input
                      value={aboutForm.eyebrow}
                      onChange={(e) => setAboutForm({ ...aboutForm, eyebrow: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>Grand titre</span>
                    <input
                      value={aboutForm.title}
                      onChange={(e) => setAboutForm({ ...aboutForm, title: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>Texte d'introduction</span>
                    <textarea
                      value={aboutForm.intro}
                      onChange={(e) => setAboutForm({ ...aboutForm, intro: e.target.value })}
                      rows="4"
                    />
                  </label>
                  {[1, 2, 3].map((index) => (
                    <div key={index} className="about-admin-block">
                      <label>
                        <span>Titre bloc {index}</span>
                        <input
                          value={aboutForm[`block${index}_title`]}
                          onChange={(e) =>
                            setAboutForm({ ...aboutForm, [`block${index}_title`]: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        <span>Texte bloc {index}</span>
                        <textarea
                          value={aboutForm[`block${index}_text`]}
                          onChange={(e) =>
                            setAboutForm({ ...aboutForm, [`block${index}_text`]: e.target.value })
                          }
                          rows={index === 2 ? "5" : "4"}
                        />
                      </label>
                    </div>
                  ))}
                  <div className="about-admin-actions">
                    <button type="submit" className="primary-action">
                      Enregistrer la présentation
                    </button>
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => setAboutForm(aboutContent)}
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              </section>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}


