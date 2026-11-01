/** Labels, vendor questions and keywords per budget category. Plain data, no logic. */
import type { Audience, CategoryId, Diet, Style } from '../../shared/schemas.js';

/**
 * Display data for a budget category: label, vendor, Maps search term, the words that name it, and
 * questions to ask before booking.
 */
export interface CategoryInfo {
  readonly label: string;
  readonly vendor: string;
  /** Google Maps search term, or null when there is no vendor to search for. */
  readonly search: string | null;
  /** Words that name the category in free text ("food and photos matter most"). */
  readonly keywords: readonly string[];
  readonly questions: readonly string[];
}

/** Display data for every budget category. */
export const CATEGORIES: Readonly<Record<CategoryId, CategoryInfo>> = {
  venue: {
    label: 'Venue',
    vendor: 'Venue',
    search: 'banquet halls',
    keywords: ['venue', 'hall', 'lawn', 'location'],
    questions: [
      'Is the rent for the full day or a time slot, and what does each extra hour cost?',
      'Is power backup included, and is diesel charged separately?',
      'Can we bring our own caterer and decorator, or is there an outside-vendor fee?',
      'How many cars can park on site?',
      'How much is the advance, and how much is refunded if we cancel?',
    ],
  },
  catering: {
    label: 'Food & catering',
    vendor: 'Caterer',
    search: 'caterers',
    keywords: ['food', 'catering', 'caterer', 'menu', 'khana'],
    questions: [
      'Is GST included in the per-plate price, and at what rate?',
      'What is the minimum guarantee, and what does each plate above it cost?',
      'Are serving staff, crockery, counters and transport included?',
      'Can we do a tasting before booking?',
      'How are leftovers handled, and can extra food be donated?',
    ],
  },
  decor: {
    label: 'Décor & flowers',
    vendor: 'Decorator',
    search: 'event decorators',
    keywords: ['decor', 'décor', 'decoration', 'flowers'],
    questions: [
      'Which flowers are in season on our date, and are any artificial?',
      'Are setup and teardown included, and when do you need venue access?',
      'What exactly does the package include (stage, entrance, table centres)?',
      'Are lights and power cabling included?',
    ],
  },
  photography: {
    label: 'Photo & video',
    vendor: 'Photographer',
    search: 'event photographers',
    keywords: ['photo', 'photos', 'photography', 'video', 'pictures'],
    questions: [
      'How many photographers and videographers, and for how many hours?',
      'When do we get the edited photos and film, and in what format?',
      'Is an album included, and how many pages?',
      'Are travel and stay for your team charged extra?',
    ],
  },
  entertainment: {
    label: 'Music & entertainment',
    vendor: 'Entertainer or DJ',
    search: 'DJ and live music',
    keywords: ['music', 'dj', 'band', 'entertainment', 'dance', 'sangeet'],
    questions: [
      'How long is the set, and what does overtime cost?',
      'Is the sound system included, or does the venue provide it?',
      'When must music stop under local noise rules?',
    ],
  },
  attire: {
    label: 'Outfits & makeup',
    vendor: 'Designer and makeup artist',
    search: 'makeup artists',
    keywords: ['outfits', 'clothes', 'makeup', 'lehenga', 'attire'],
    questions: [
      'How many fittings are included, and when is the final fitting?',
      'Are alterations after delivery free?',
      'Is a makeup trial included, and are early-morning or travel charges extra?',
    ],
  },
  invitations: {
    label: 'Invitations',
    vendor: 'Printer',
    search: 'invitation card printers',
    keywords: ['invitations', 'invites', 'cards'],
    questions: [
      'What is the price per card at our quantity, including envelopes?',
      'How long do printing and delivery take?',
      'Can you also make a matching digital invite?',
    ],
  },
  rituals: {
    label: 'Priest & rituals',
    vendor: 'Priest',
    search: 'pandit for puja',
    keywords: ['rituals', 'puja', 'pooja', 'priest', 'pandit', 'ceremony'],
    questions: [
      'Which samagri do you bring, and what must the family arrange?',
      'How long does the ceremony take, and is there a fixed muhurat time?',
      'Is the dakshina fixed, and is travel extra?',
    ],
  },
  cake: {
    label: 'Cake & desserts',
    vendor: 'Bakery',
    search: 'cake shops',
    keywords: ['cake', 'dessert', 'desserts', 'sweets'],
    questions: [
      'Is the cake eggless, and can it suit our dietary needs?',
      'What size feeds our guest count?',
      'Is delivery included?',
    ],
  },
  logistics: {
    label: 'Guest travel & stay',
    vendor: 'Transport and hotel',
    search: 'tempo traveller rental',
    keywords: ['travel', 'stay', 'transport', 'hotel'],
    questions: [
      'Is the price per vehicle per day, and are driver allowance and tolls extra?',
      'How many rooms are blocked, and until when can we release unused ones?',
      'Are station and airport pickups included?',
    ],
  },
  gifts: {
    label: 'Return gifts & favours',
    vendor: 'Gift supplier',
    search: 'return gift shops',
    keywords: ['gifts', 'favours', 'favors', 'return gifts'],
    questions: [
      'What is the price per piece at our quantity, and is packing included?',
      'How long does delivery take, and can we see a sample first?',
    ],
  },
  permits: {
    label: 'Permissions & safety',
    vendor: 'Society office and authorities',
    search: null,
    keywords: ['permissions', 'permission', 'safety'],
    questions: [
      'Which permissions do we need (society, police, fire, loudspeaker)?',
      'How long does each permission take, and which documents are needed?',
      'Is a security deposit or event insurance needed?',
    ],
  },
  sound: {
    label: 'Sound, stage & lights',
    vendor: 'Sound and light vendor',
    search: 'sound and light rental',
    keywords: ['sound', 'stage', 'lights', 'mic'],
    questions: [
      'Does the quote include the stage, lights, mics and an operator?',
      'Is a generator included in case of a power cut?',
      'When will setup be ready, and is a sound check included?',
    ],
  },
};

/** Extra questions that matter for particular guests. */
export const TAILORED_QUESTIONS: readonly {
  readonly need: Audience | Diet;
  readonly category: CategoryId;
  readonly text: string;
}[] = [
  {
    need: 'elders',
    category: 'venue',
    text: 'Is there a lift or step-free access, and seating near the stage for elders?',
  },
  { need: 'accessibility', category: 'venue', text: 'Are there ramps and an accessible washroom?' },
  { need: 'outstation', category: 'venue', text: 'Are there rooms nearby for outstation guests?' },
  {
    need: 'elders',
    category: 'catering',
    text: 'Can you serve a less spicy, soft-food option for elders?',
  },
  { need: 'kids', category: 'catering', text: "Can you set up a kids' counter?" },
  {
    need: 'jain',
    category: 'catering',
    text: 'Can you run a separate Jain counter (no onion, garlic or root vegetables)?',
  },
  { need: 'veg', category: 'catering', text: 'Is the kitchen pure vegetarian?' },
  { need: 'kids', category: 'entertainment', text: 'Can you run an hour of games for kids?' },
  {
    need: 'elders',
    category: 'entertainment',
    text: 'Can the volume stay comfortable for elders, with a set of old songs?',
  },
  {
    need: 'outstation',
    category: 'logistics',
    text: 'Can you coordinate pickups for guests arriving by train or flight?',
  },
];

/** Words shown for each diet. */
export const DIET_LABELS: Readonly<Record<Diet, string>> = {
  veg: 'vegetarian',
  jain: 'Jain vegetarian',
  mixed: 'veg and non-veg',
};

/** Words shown for each audience need. */
export const AUDIENCE_LABELS: Readonly<Record<Audience, string>> = {
  elders: 'Many elders',
  kids: 'Many kids',
  accessibility: 'Wheelchair users',
  outstation: 'Outstation guests',
};

/** Words shown for each style. */
export const STYLE_LABELS: Readonly<Record<Style, string>> = {
  traditional: 'Traditional',
  modern: 'Modern',
  minimal: 'Simple and minimal',
  eco: 'Eco-friendly',
};
