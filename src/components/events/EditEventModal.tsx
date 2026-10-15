'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  X,
  Upload,
  Plus,
  Trash2,
  Calendar,
  Clock,
  MapPin,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { uploadEventImage } from '@/lib/services/storage.service';
import type { EventItem, EventCategory, EventStatus, TicketType } from '@/types';

interface EditEventModalProps {
  event: EventItem | null;
  onClose: () => void;
  onSave: (updatedEvent: Partial<EventItem>) => Promise<void>;
}

const CATEGORIES: EventCategory[] = [
  'Football',
  'Lutte Sénégalaise',
  'Concert / Festival',
  'Oscars & Soirées Gala',
  'Théâtre & Humour',
  'Basketball',
  'Autre Événement',
];

export function EditEventModal({ event, onClose, onSave }: EditEventModalProps) {
  if (!event) return null;

  const [title, setTitle] = useState(event.title || '');
  const [category, setCategory] = useState<EventCategory>((event.category as EventCategory) || 'Football');
  const [venue, setVenue] = useState(event.venue || '');
  const [locationDetails, setLocationDetails] = useState(event.locationDetails || '');
  const [startDate, setStartDate] = useState(
    event.startDate ? event.startDate.substring(0, 10) : new Date().toISOString().substring(0, 10)
  );
  const [timeString, setTimeString] = useState(event.timeString || '18:00 UTC');
  const [bannerImage, setBannerImage] = useState(
    event.bannerImage || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80'
  );
  const [description, setDescription] = useState(event.description || '');
  const [status, setStatus] = useState<EventStatus>(event.status || 'PUBLISHED');

  const [ticketTypes, setTicketTypes] = useState<TicketType[]>(
    (event.ticketTypes || []).map((tt) => ({ ...tt }))
  );

  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      const url = await uploadEventImage(file);
      setBannerImage(url);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors du chargement de l’image.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddTicketType = () => {
    setTicketTypes((prev) => [
      ...prev,
      {
        id: `tt-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        eventId: event.id,
        name: 'Tarif Standard',
        price: 3000,
        badge: 'Accès Général',
        description: 'Placement libre dans les tribunes',
        totalQuantity: 200,
        soldQuantity: 0,
        isActive: true,
      },
    ]);
  };

  const handleUpdateTicketType = (index: number, field: keyof TicketType, val: any) => {
    setTicketTypes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const handleRemoveTicketType = (index: number) => {
    if (ticketTypes.length <= 1) {
      setErrorMessage('Un événement doit comporter au moins un type de billet.');
      return;
    }
    setTicketTypes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage('Le titre de l’événement est obligatoire.');
      return;
    }
    if (!venue.trim()) {
      setErrorMessage('Le lieu de l’événement est obligatoire.');
      return;
    }
    if (ticketTypes.length === 0) {
      setErrorMessage('Veuillez définir au moins un type de billet.');
      return;
    }

    const totalCap = ticketTypes.reduce((sum, tt) => sum + (Number(tt.totalQuantity) || 0), 0);

    try {
      setIsSaving(true);
      await onSave({
        id: event.id,
        slug: event.slug,
        title: title.trim(),
        category,
        venue: venue.trim(),
        locationDetails: locationDetails.trim(),
        startDate: new Date(startDate).toISOString(),
        timeString: timeString.trim(),
        bannerImage: bannerImage.trim(),
        description: description.trim(),
        status,
        totalCapacity: totalCap,
        ticketTypes,
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de l’enregistrement des modifications.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl my-8 bg-white dark:bg-[#0B1936] rounded-3xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black">
              ✏️
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Modifier l'événement
              </h3>
              <p className="text-xs text-slate-500 dark:text-white/60">
                Corrigez les informations, modifiez les tarifs ou republiez
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body Scrollable */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6 flex-1">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Statut de publication */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-white">
                Statut de publication
              </label>
              <p className="text-[11px] text-slate-500 dark:text-white/60">
                Définissez si l'événement est visible au public ou gardé en brouillon
              </p>
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as EventStatus)}
              className="px-4 py-2 rounded-xl font-bold text-xs bg-white dark:bg-[#050D1E] border border-slate-200 dark:border-white/15 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="PUBLISHED">🟢 PUBLIÉ (En ligne / Billetterie ouverte)</option>
              <option value="DRAFT">🟡 BROUILLON (Non visible au public)</option>
              <option value="CLOSED">🔴 CLÔTURÉ (Ventes terminées)</option>
            </select>
          </div>

          {/* Informations générales */}
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-primary">
              Informations Principales
            </h4>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-white/80 mb-1">
                Titre de l'événement *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex : Soirée Gala des Lauréats 2026"
                className="w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-white/80 mb-1">
                  Catégorie
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as EventCategory)}
                  className="w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-white/80 mb-1">
                  Lieu principal *
                </label>
                <input
                  type="text"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="Ex : Esplanade Grand Théâtre National"
                  className="w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-white/80 mb-1">
                Complément de lieu / Zone
              </label>
              <input
                type="text"
                value={locationDetails}
                onChange={(e) => setLocationDetails(e.target.value)}
                placeholder="Ex : Dakar Plateau, Sénégal"
                className="w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-white/80 mb-1">
                  Date de l'événement
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-white/80 mb-1">
                  Heure
                </label>
                <input
                  type="text"
                  value={timeString}
                  onChange={(e) => setTimeString(e.target.value)}
                  placeholder="Ex : 20:30 UTC"
                  className="w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Image / Bannière */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-primary">
              Affiche / Bannière
            </h4>
            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10">
              <div className="relative w-28 h-20 rounded-xl overflow-hidden bg-slate-200 dark:bg-white/10 shrink-0 border border-slate-300 dark:border-white/10">
                <Image src={bannerImage} alt="Preview" fill className="object-cover" />
              </div>
              <div className="flex-1 w-full space-y-2">
                <input
                  type="text"
                  value={bannerImage}
                  onChange={(e) => setBannerImage(e.target.value)}
                  placeholder="URL de l'image"
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#050D1E] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none"
                />
                <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isUploading ? 'Chargement...' : 'Téléverser une image'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={isUploading}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-white/80">
              Description &amp; Programme
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Détails du programme, invités d'honneur, accès..."
              className="w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Types de Billets & Tarifs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-primary">
                  Tarifs &amp; Types de Billets
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-white/60">
                  Modifiez les prix ou les capacités de chaque catégorie de billet
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddTicketType}
                className="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ajouter un tarif</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {ticketTypes.map((tt, idx) => (
                <div
                  key={tt.id || idx}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row items-center gap-3"
                >
                  <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-white/50 block mb-0.5">
                        Catégorie
                      </label>
                      <input
                        type="text"
                        value={tt.name}
                        onChange={(e) => handleUpdateTicketType(idx, 'name', e.target.value)}
                        placeholder="Ex : VIP, Standard"
                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#050D1E] border border-slate-200 dark:border-white/10 font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-white/50 block mb-0.5">
                        Prix (FCFA)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="500"
                        value={tt.price}
                        onChange={(e) => handleUpdateTicketType(idx, 'price', Number(e.target.value))}
                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#050D1E] border border-slate-200 dark:border-white/10 font-mono font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-white/50 block mb-0.5">
                        Jauge / Quantité Max
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={tt.totalQuantity}
                        onChange={(e) => handleUpdateTicketType(idx, 'totalQuantity', Number(e.target.value))}
                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#050D1E] border border-slate-200 dark:border-white/10 font-mono font-bold"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveTicketType(idx)}
                    className="p-2 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors shrink-0 cursor-pointer"
                    title="Supprimer ce tarif"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 dark:border-white/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-[#0038A8] to-[#0D52D6] hover:from-[#002D8C] hover:to-[#0B4FD8] text-white shadow-md flex items-center gap-2 cursor-pointer transition-transform active:scale-95"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Enregistrer et republier</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
