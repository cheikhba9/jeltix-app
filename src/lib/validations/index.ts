import { z } from 'zod';

/**
 * Zod Schemas for Jël Tix Security & Data Validation
 */

// Phone number validation: matches Senegal numbers (77, 78, 70, 76, 75) and international E.164 formats
export const SenegaleseOrInternationalPhoneSchema = z
  .string()
  .trim()
  .min(8, 'Le numéro de téléphone doit comporter au moins 8 chiffres')
  .max(18, 'Le numéro de téléphone est trop long')
  .regex(
    /^(?:\+221\s?)?(?:7[05678]\d{7}|3[03]\d{7})$|^\+?[0-9\s\-()]{8,18}$/,
    'Format de numéro de téléphone invalide (ex: 77 123 45 67 ou +221771234567)'
  );

// Ticket Code validation
export const TicketCodeSchema = z
  .string()
  .trim()
  .min(3, 'Code billet trop court')
  .max(64, 'Code billet invalide')
  .regex(/^[A-Za-z0-9_-]+$/, 'Le code billet contient des caractères non autorisés');

// Checkout Form validation
export const CheckoutSchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(2, 'Le nom complet doit contenir au moins 2 caractères')
    .max(100, 'Le nom complet est trop long (100 caractères max)'),
  customerPhone: SenegaleseOrInternationalPhoneSchema,
  customerEmail: z
    .string()
    .trim()
    .email('Adresse email invalide')
    .optional()
    .or(z.literal('')),
  paymentMethod: z.enum(['WAVE', 'ORANGE_MONEY', 'FREE_MONEY', 'CASH', 'CREDIT_CARD', 'CARD', 'PAYTECH']),
  items: z
    .array(
      z.object({
        ticketTypeId: z.string().min(1),
        quantity: z.number().int().positive().max(50, 'Limite de 50 billets par commande dépassée'),
      })
    )
    .min(1, 'Votre panier est vide'),
});

// Login / Register Form validation
export const AuthCredentialsSchema = z.object({
  email: z.string().trim().email('Adresse email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  fullName: z.string().trim().min(2, 'Le nom doit contenir au moins 2 caractères').optional(),
  role: z.enum(['SUPER_ADMIN', 'ORGANIZER', 'CONTROLLER', 'SELLER', 'FINANCE']).optional(),
});

// User Creation / Management Schema
export const UserManagementSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email(),
  phone: SenegaleseOrInternationalPhoneSchema.optional().or(z.literal('')),
  role: z.enum(['SUPER_ADMIN', 'ORGANIZER', 'CONTROLLER', 'SELLER', 'FINANCE']),
  isActive: z.boolean().default(true),
});

// Invitation Schema (used in users management)
export const InviteUserSchema = z.object({
  fullName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères').max(100),
  email: z.string().email('Adresse email invalide'),
  phone: z.string().optional().or(z.literal('')),
  role: z.enum(['CONTROLLER', 'SELLER', 'ORGANIZER', 'FINANCE', 'SUPER_ADMIN']),
  organization: z.string().optional().or(z.literal('')),
});

