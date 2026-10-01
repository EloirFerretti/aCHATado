import emojiData from "unicode-emoji-json/data-by-emoji.json";

export type UnicodeEmojiItem = {
  emoji: string;
  name: string;
  group: string;
};

type EmojiMeta = {
  name?: string;
  group?: string;
};

const data = emojiData as Record<string, EmojiMeta>;

export const unicodeEmojiCatalog: UnicodeEmojiItem[] = Object.entries(data).map(
  ([emoji, meta]) => ({
    emoji,
    name: meta.name || emoji,
    group: meta.group || "Emoji",
  }),
);
