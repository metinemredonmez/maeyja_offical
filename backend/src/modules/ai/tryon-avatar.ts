/**
 * "See it on me" without a photo: the visitor picks a height, a build, a skin tone and a hair colour/length, and an
 * avatar of those choices carries the bag. Choices are grouped, so each avatar is made once and serves everyone who
 * picks the same — nothing about the visitor is stored.
 */
export const AVATAR_OPTIONS = {
  body: ['slim', 'regular', 'curvy'],
  skin: ['fair', 'light', 'medium', 'tan', 'deep'],
  hair: ['blonde', 'brown', 'black', 'red'],
  length: ['short', 'long'],
} as const;

export type AvatarChoice = {
  /** Centimetres, 140–200; grouped into three heights. */
  height: number;
  body: (typeof AVATAR_OPTIONS.body)[number];
  skin: (typeof AVATAR_OPTIONS.skin)[number];
  hair: (typeof AVATAR_OPTIONS.hair)[number];
  length: (typeof AVATAR_OPTIONS.length)[number];
};

/** Height groups and the height each avatar is drawn at. */
const HEIGHTS = { petite: 157, average: 167, tall: 177 } as const;
export type HeightGroup = keyof typeof HEIGHTS;

export const heightGroup = (cm: number): HeightGroup => (cm <= 160 ? 'petite' : cm <= 172 ? 'average' : 'tall');
export const avatarHeight = (cm: number) => HEIGHTS[heightGroup(cm)];

/** e.g. "average-slim-medium-brown-long": the avatar's identity, also its file name (only known words reach it). */
export const avatarKey = (c: AvatarChoice) => [heightGroup(c.height), c.body, c.skin, c.hair, c.length].join('-');

const BUILD: Record<AvatarChoice['body'], string> = { slim: 'a slim build', regular: 'an average, medium build', curvy: 'a curvy, fuller figure' };
const SKIN: Record<AvatarChoice['skin'], string> = {
  fair: 'very fair skin',
  light: 'light skin',
  medium: 'medium, olive skin',
  tan: 'tan, light brown skin',
  deep: 'deep brown skin',
};
const HAIR: Record<AvatarChoice['hair'], string> = { blonde: 'blonde', brown: 'brown', black: 'black', red: 'auburn red' };
const LENGTH: Record<AvatarChoice['length'], string> = { short: 'short, chin-length', long: 'long, past the shoulders' };

/** The picture of the avatar alone: plain studio, simple clothes, no bag yet (the bag comes in the next step). */
export const avatarPrompt = (c: AvatarChoice) =>
  `A full-length studio photograph of a woman in her early thirties standing naturally, facing the camera, arms relaxed at her sides, her whole body visible from head to toe with a little space above and below. She is about ${avatarHeight(c.height)} cm tall, with ${BUILD[c.body]}, ${SKIN[c.skin]} and ${LENGTH[c.length]} ${HAIR[c.hair]} hair.

Simple, elegant, neutral clothes: a fitted cream knit top, straight dark-grey trousers and plain flat shoes. No jewellery, no bag, nothing in her hands. Plain warm light-grey seamless studio backdrop, soft even daylight, no scenery.

A real, natural and respectful portrayal: no exaggeration, no caricature, no beautification filter. Photorealistic. No text, no logo.`;
