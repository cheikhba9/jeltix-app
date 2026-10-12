# Jël Tix • Saisissez • Réservez • Profitez

Plateforme de billetterie électronique haute performance et système de contrôle d'accès anti-fraude au Sénégal et en Afrique de l'Ouest.

![Jël Tix Logo](/public/logo.svg)

---

## ✨ Points Forts du Système

- 🚀 **Marketplace Événements & Billetterie en Ligne** : Découverte et réservation en 30 secondes pour le Football (Navétanes, Coupe du Sénégal), Lutte Sénégalaise, Concerts, Festivals et Basketball.
- 💳 **Paiement Mobile Money Instantané** : Intégration fluide de **Wave**, **Orange Money** et **Free Money**.
- 🎟️ **Billet Digital avec QR Code Unique** : Signatures cryptographiques uniques empêchant toute tentative de duplication ou capture d'écran frauduleuse.
- ⚡ **Scanner PWA Ultra-Rapide** : Validation des spectateurs aux tourniquets et portes en moins d'une seconde avec détection automatique des billets déjà scannés et faux billets.
- 🏪 **Caisse Guichet Express (POS)** : Encaissement physique sur site pour les spectateurs achetant directement au stade.
- 📊 **Tableau de Bord Backoffice Organisateur** : Pilotage des jauges en temps réel, alertes de fraude en direct, statistiques de ventes et export des rapports financiers.

---

## 🛠️ Stack Technique

- **Framework** : Next.js 16 (App Router) + React 19 + TypeScript
- **Styling** : Tailwind CSS v4 + Design System Jël Tix (Cobalt Blue `#0038A8` & Neon Lime `#4EED15`)
- **QR Engine** : `qrcode.react` (High-Correction Level)
- **Audio & FX** : Web Audio API (Beeps & Buzzers) + `canvas-confetti`
- **Iconographie** : Lucide React + Google Material Symbols

---

## 🚀 Démarrage Rapide

```bash
npm install
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000) dans votre navigateur.

---

## 📱 Parcours Clés de Démonstration

1. **Accueil & Marketplace Spectateurs** : `http://localhost:3000/`
2. **Tunnel d'Achat & Réservation** : `http://localhost:3000/discover/match-pilote-finale-coupe`
3. **Paiement Mobile Wave / OM** : `http://localhost:3000/discover/match-pilote-finale-coupe/checkout`
4. **Billet Électronique Interactif** : `http://localhost:3000/tickets/JT-7777-DEMO`
5. **Scanner Contrôleur PWA** : `http://localhost:3000/scan`
6. **Caisse Guichet POS** : `http://localhost:3000/sales/pos`
7. **Backoffice Administration** : `http://localhost:3000/dashboard`
