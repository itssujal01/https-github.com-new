// Constants shared by the server and the browser client.

export const AVATARS = ['🦁', '🐯', '🦊', '🐼', '🐸', '🐙', '🦄', '🐲', '🦉', '🐧', '🐺', '🦖'];
export const AVATAR_COUNT = AVATARS.length;

// Preset reactions only: no free-text chat means nothing to moderate or inject.
export const REACTIONS = ['👍', '😂', '😮', '😡', '🔥', '😢', '👏', '🙏'];
export const REACTION_COUNT = REACTIONS.length;

export const BOT_NAMES = ['Nova Bot', 'Pixel Bot', 'Turbo Bot'];

export const TIMING = {
  turnMs: 15_000, // time a human gets for each roll or move
  botThinkMs: 700,
  diceMs: 1_500, // dice throw animation
  stepMs: 170, // one cell hop
  captureMs: 700,
  reactionCooldownMs: 1_200,
};
