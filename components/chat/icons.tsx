import type { Platform } from "@/lib/types";

export function PlatformIcon({ platform }: { platform: Platform }) {
  return (
    <svg
      className="platformSvg"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="currentColor"
    >
      {platform === "twitch" ? (
        <path d="M4 2 1 6v16h6v2l4-2h5l7-7V2H4zm17 12-4 4h-6l-4 3v-3H4V4h17v10zM17 7h-2v6h2V7zm-5 0h-2v6h2V7z" />
      ) : platform === "kick" ? (
        <path d="M3 2h6v7h3V5h3V2h6v7h-3v3h-3v3h3v3h3v4h-6v-4h-3v-3H9v7H3V2z" />
      ) : (
        <path d="M23 7s-.2-1.7-.9-2.4C21.3 3.7 20.4 3.7 20 3.6 17 3.4 12 3.4 12 3.4s-5 0-8 .2c-.4.1-1.3.1-2.1 1C1.2 5.3 1 7 1 7S.8 9 .8 11v2c0 2 .2 4 .2 4s.2 1.7.9 2.4c.8.9 1.9.9 2.4 1 1.8.2 7.7.2 7.7.2s5 0 8-.2c.4-.1 1.3-.1 2.1-1 .7-.7.9-2.4.9-2.4s.2-2 .2-4v-2C23.2 9 23 7 23 7zM9.7 16V8l6.5 4-6.5 4z" />
      )}
    </svg>
  );
}

export type IconName =
  | "settings"
  | "bell"
  | "hub"
  | "accounts"
  | "external"
  | "pause"
  | "play"
  | "trash"
  | "shield"
  | "smile"
  | "terminal"
  | "send"
  | "close"
  | "reply"
  | "search"
  | "star"
  | "history"
  | "check"
  | "at"
  | "pin";
const paths: Record<IconName, string> = {
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 3l1-1h4l1 3 3 1 3 1v4l-2 2-1 3 1 3-3 2-3-1-3 1-3-2 1-3-1-3-2-2V7l3-1 1-3",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  hub: "M9 12h6M12 9V5M9 14l-4 4M15 14l4 4M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6M12 1a2 2 0 1 0 0 4 2 2 0 0 0 0-4M3 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4M21 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4",
  accounts:
    "M9 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6M3 18v-3c0-4 12-4 12 0v3M19 10v8M15 14h8",
  external: "M14 3h7v7M21 3l-10 10M10 3H3v18h18v-7",
  pause: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M9 8v8M15 8v8",
  play: "M8 4l13 8-13 8V4",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7",
  shield: "M12 2 3 6v6c0 6 9 10 9 10s9-4 9-10V6l-9-4M12 3v18",
  smile:
    "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M7 14s1 4 5 4 5-4 5-4M8 8v1M16 8v1",
  terminal: "M3 4h18v16H3V4M6 8l3 3-3 3M12 15h5",
  send: "m3 3 19 9-19 9 4-9-4-9M7 12h15",
  close: "m6 6 12 12M6 18 18 6",
  reply: "m9 5-7 7 7 7M2 12h12c5 0 7 2 7 7",
  search: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14M15 15l6 6",
  star: "m12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1 3-6",
  history: "M3 4v6h6M3 10a9 9 0 1 1 0 6M12 7v5l3 2",
  check: "m4 12 5 5L21 5",
  at: "M16 8v7c0 4 6 1 6-3A10 10 0 1 0 12 22M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10",
  pin: "m9 3 12 12-5 1-3 5-5-5-5-5 5-3 1-5M8 16l-6 6",
};
export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className="uiIcon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
