'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useJeltixStore } from '@/lib/store/jeltix-store';
import { uploadEventImage } from '@/lib/services/storage.service';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Calendar,
  MapPin,
  Sparkles,
  CheckCircle2,
  Upload,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import type { EventCategory } from '@/types';

export default function NewEventPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const { currentUser, createEvent } = useJeltixStore();

  // Seuls Super Admin et Organisateurs peuvent créer un événement
  if (currentUser && currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'ORGANIZER') {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-black text-on-surface mb-1">Accès Restreint</h2>
        <p className="text-xs text-on-surface-variant max-w-sm mb-4 leading-relaxed">
          La création d'événements est réservée aux Organisateurs et Super Administrateurs.
        </p>
        <Link
          href={currentUser.role === 'SELLER' ? '/sales/pos' : '/scan'}
          className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold inline-flex items-center gap-2"
        >
          <span>Aller à mon espace ({currentUser.role === 'SELLER' ? 'Guichet POS' : 'Scanner'})</span>
        </Link>
      </div>
    );
  }

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<EventCategory>('Football');
  const [customCategory, setCustomCategory] = useState('');
  const [venue, setVenue] = useState('');
  const [locationDetails, setLocationDetails] = useState('');
  const [startDate, setStartDate] = useState('2026-11-20');
  const [endDate, setEndDate] = useState('');
  const [timeString, setTimeString] = useState('18:00 UTC');
  const [bannerImage, setBannerImage] = useState(
    'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80'
  );
  const [description, setDescription] = useState('');
  const [totalCapacity, setTotalCapacity] = useState(25000);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ticket Categories
  const [ticketTypes, setTicketTypes] = useState([
    {
      id: 'tt-custom-1',
      eventId: '',
      name: 'Billet Standard (Gradins)',
      price: 300,
      badge: 'Populaire',
      description: 'Accès aux gradins généraux. Placement libre.',
      totalQuantity: 20000,
      soldQuantity: 0,
      isActive: true,
    },
    {
      id: 'tt-custom-2',
      eventId: '',
      name: 'Billet Tribune Couverte',
      price: 500,
      badge: 'VIP',
      description: 'Accès tribune couverte avec assise numérotée.',
      totalQuantity: 5000,
      soldQuantity: 0,
      isActive: true,
    },
  ]);

  const handleAddTicketType = () => {
    setTicketTypes((prev) => [
      ...prev,
      {
        id: `tt-custom-${Date.now()}`,
        eventId: '',
        name: 'Nouvelle Catégorie',
        price: 1000,
        badge: 'Accès Spécial',
        description: 'Description du billet.',
        totalQuantity: 1000,
        soldQuantity: 0,
        isActive: true,
      },
    ]);
  };

  const handleRemoveTicketType = (index: number) => {
    if (ticketTypes.length <= 1) return;
    setTicketTypes((prev) => prev.filter((_, i) => i !== index));
  };

  // Image Upload Handler (Mobile camera or File selection)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMessage(null);

    try {
      const publicUrl = await uploadEventImage(file);
      setBannerImage(publicUrl);
    } catch (err: any) {
      setErrorMessage(err.message || "Erreur lors du téléversement de l'image.");
    } finally {
      setIsUploading(false);
    }
  };

  const submitWithStatus = async (chosenStatus: 'PUBLISHED' | 'DRAFT') => {
    if (!title || !venue || !startDate) {
      setErrorMessage('Veuillez renseigner tous les champs obligatoires (*).');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const organizerId = currentUser?.id || `usr-org-${Date.now()}`;
    const organizerName = currentUser?.fullName || 'Mon Organisation';

    let parsedDateStr = new Date().toISOString();
    try {
      const d = new Date(startDate);
      if (!isNaN(d.getTime())) {
        parsedDateStr = d.toISOString();
      }
    } catch {}

    let parsedEndDateStr: string | undefined = undefined;
    if (endDate) {
      try {
        const ed = new Date(endDate);
        if (!isNaN(ed.getTime())) {
          parsedEndDateStr = ed.toISOString();
        }
      } catch {}
    }

    const finalCategory = category === 'Autre' ? (customCategory.trim() || 'Autre') : category;

    const eventPayload = {
      slug,
      title,
      category: finalCategory,
      venue,
      locationDetails: locationDetails || 'Dakar, Sénégal',
      startDate: parsedDateStr,
      endDate: parsedEndDateStr,
      timeString: timeString || '18:00 UTC',
      bannerImage,
      description: description || `Événement majeur organisé au ${venue}.`,
      status: chosenStatus,
      totalCapacity: Number(totalCapacity),
      organizerId,
      organizerName,
      ticketTypes: ticketTypes.map((tt) => ({
        name: tt.name,
        price: Number(tt.price),
        badge: tt.badge || '',
        description: tt.description || '',
        totalQuantity: Number(tt.totalQuantity),
      })),
    };

    // Persist in 100% local store on Mac & notify all views
    try {
      await createEvent({
        ...eventPayload,
        ticketTypes: ticketTypes.map((tt, idx) => ({
          ...tt,
          id: `tt-${Date.now()}-${idx}`,
          price: Number(tt.price),
          totalQuantity: Number(tt.totalQuantity),
        })),
      });

      addToast({
        type: 'success',
        title: chosenStatus === 'PUBLISHED' ? 'Événement publié !' : 'Brouillon enregistré',
        message: `"${title}" est maintenant disponible sur Jël Tix.`,
      });

      setIsSubmitting(false);
      router.push('/events');
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err.message || "Erreur lors de la création de l'événement.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitWithStatus('PUBLISHED');
  };

  return (
    <div className="max-w-4xl mx-auto py-4">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/events"
          className="p-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface">
            Créer un Nouvel Événement
          </h1>
          <p className="text-xs text-on-surface-variant">
            Publiez votre événement avec billetterie en temps réel et image de valorisation.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-center gap-3 text-red-700 dark:text-red-300 text-xs font-semibold animate-in fade-in">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* SECTION 1: Informations Générales */}
        <div className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/30 space-y-4">
          <h2 className="text-base font-bold text-on-surface border-b border-outline-variant/20 pb-2">
            1. Informations Générales
          </h2>

          <div>
            <label className="block text-xs font-bold text-on-surface mb-1">
              Titre Officiel de l'Événement *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Derby ASC Jaraaf vs ASC Jeanne d'Arc 2026"
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant/40 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface mb-1">Catégorie *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as EventCategory)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant/40 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="Football">⚽ Football</option>
                <option value="Basketball">🏀 Basketball</option>
                <option value="Lutte Sénégalaise">🤼 Lutte Sénégalaise</option>
                <option value="Concert">🎤 Concert</option>
                <option value="Festival">🎪 Festival</option>
                <option value="Oscar des vacances">🏆 Oscar des vacances</option>
                <option value="Soirée">🌙 Soirée (Gala, Dansante...)</option>
                <option value="Théâtre & Humour">🎭 Théâtre & Humour</option>
                <option value="Salon & Expo">💼 Salon & Expo</option>
                <option value="Autre">✨ Autre (Préciser...)</option>
              </select>

              {category === 'Autre' && (
                <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <input
                    type="text"
                    required
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="Précisez la catégorie (ex: Gala, Religeux, Tournoi...)"
                    className="w-full px-3.5 py-2 rounded-xl bg-surface border-2 border-primary text-xs focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                    autoFocus
                  />
                  <p className="text-[10px] text-on-surface-variant mt-1">
                    Précisez le type d'événement pour l'affichage dans le catalogue.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface mb-1">Lieu / Stade *</label>
              <input
                type="text"
                required
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="Ex: Stade Abdoulaye Wade"
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant/40 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface mb-1">
                Ville / Quartier *
              </label>
              <input
                type="text"
                value={locationDetails}
                onChange={(e) => setLocationDetails(e.target.value)}
                placeholder="Ex: Diamniadio, Dakar"
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant/40 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface mb-1">
                Date de l'Événement *
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant/40 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface mb-1">
                Date Fin / Clôture Ventes (Optionnelle)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant/40 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface mb-1">
                Heure Affichée (Coup d'envoi)
              </label>
              <input
                type="text"
                value={timeString}
                onChange={(e) => setTimeString(e.target.value)}
                placeholder="Ex: 18:00 UTC"
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant/40 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface mb-1">
                Capacité Totale Estimée
              </label>
              <input
                type="number"
                value={totalCapacity}
                onChange={(e) => setTotalCapacity(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant/40 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Image Upload Component */}
          <div>
            <label className="block text-xs font-bold text-on-surface mb-1">
              Image / Affiche de Valorisation de l'Événement
            </label>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Image Preview & Upload Dropzone */}
            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-surface border border-outline-variant/30">
              <div className="relative w-full sm:w-48 h-32 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border shrink-0 flex items-center justify-center">
                {bannerImage ? (
                  <img
                    src={bannerImage}
                    alt="Aperçu bannière"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-8 h-8 text-slate-400" />
                )}
                {isUploading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white">
                    <Loader2 className="w-6 h-6 animate-spin text-[#4EED15]" />
                  </div>
                )}
              </div>

              <div className="flex-1 w-full space-y-2 text-center sm:text-left">
                <p className="text-xs font-bold text-on-surface">
                  Ajoutez une photo réelle pour valoriser votre événement
                </p>
                <p className="text-[11px] text-on-surface-variant">
                  Format recommandé : 1200x600 px (JPG, PNG, WebP). Max 5 Mo.
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploading ? 'Téléversement...' : 'Choisir une photo'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const promptUrl = prompt('Entrez l’URL de l’image :', bannerImage);
                      if (promptUrl) setBannerImage(promptUrl);
                    }}
                    className="px-3 py-2 rounded-xl bg-surface-container text-on-surface-variant text-xs font-semibold hover:bg-surface-container-high transition-colors cursor-pointer"
                  >
                    Ou coller un lien
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface mb-1">
              Description de l'Événement
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Détails du match, artistes, consignes pour les spectateurs..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-outline-variant/40 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* SECTION 2: Catégories & Tarifs de Billets */}
        <div className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/30 space-y-4">
          <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
            <div>
              <h2 className="text-base font-bold text-on-surface">2. Catégories & Tarifs de Billets</h2>
              <p className="text-[11px] text-on-surface-variant">
                Configurez les catégories disponibles à la vente en ligne et au guichet.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddTicketType}
              className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-bold flex items-center gap-1.5 hover:bg-primary/20 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter une Catégorie</span>
            </button>
          </div>

          <div className="space-y-4">
            {ticketTypes.map((tt, idx) => (
              <div
                key={tt.id}
                className="p-4 rounded-2xl bg-surface border border-outline-variant/30 space-y-3 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-black uppercase text-primary">
                    Catégorie #{idx + 1}
                  </span>
                  {ticketTypes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTicketType(idx)}
                      className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                      title="Supprimer cette catégorie"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-on-surface mb-1">
                      Nom du Billet *
                    </label>
                    <input
                      type="text"
                      required
                      value={tt.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTicketTypes((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, name: val } : item))
                        );
                      }}
                      placeholder="Ex: Gradins Virage"
                      className="w-full px-3 py-2 rounded-xl bg-surface-container border border-outline-variant/40 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-on-surface mb-1">
                      Prix Unitaire (FCFA) *
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      step={50}
                      value={tt.price}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setTicketTypes((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, price: val } : item))
                        );
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-surface-container border border-outline-variant/40 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-on-surface mb-1">
                      Quantité Disponible *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={tt.totalQuantity}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setTicketTypes((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, totalQuantity: val } : item
                          )
                        );
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-surface-container border border-outline-variant/40 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Button Bar */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-4">
          <Link
            href="/events"
            className="px-5 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold transition-colors"
          >
            Annuler
          </Link>
          <button
            type="button"
            disabled={isSubmitting || isUploading}
            onClick={() => submitWithStatus('DRAFT')}
            className="px-5 py-2.5 rounded-xl bg-surface-container-highest hover:bg-surface-container-high border border-outline-variant/40 text-on-surface text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span>Enregistrer en Brouillon</span>
          </button>
          <button
            type="button"
            disabled={isSubmitting || isUploading}
            onClick={() => submitWithStatus('PUBLISHED')}
            className="px-6 py-2.5 rounded-xl bg-[#0038A8] text-white hover:bg-[#002D8C] text-xs font-black shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#4EED15]" />
                <span>Publication en cours...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#4EED15]" />
                <span>Publier Immédiatement</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
