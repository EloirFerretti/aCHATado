import { useEffect, useRef, useState } from "react";
import {
  type PickerEmote,
  type PickerProvider,
  type Platform,
  labels,
  pickerProviderLabels,
} from "./model";
import { Icon } from "./icons";

const emoteKey = (e: PickerEmote) => `${e.provider}:${e.id || e.code}`;
function savedKeys(key: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}
type Props = {
  platform: Platform;
  emotes: PickerEmote[];
  loading: boolean;
  scopeUpgrade: boolean;
  popup: boolean;
  onInsert: (emote: PickerEmote) => void;
  onClose: () => void;
};
export function EmotePicker({
  platform,
  emotes,
  loading,
  scopeUpgrade,
  popup,
  onInsert,
  onClose,
}: Props) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<PickerProvider | "recent" | "favorites">(
    "all",
  );
  const [favorites, setFavorites] = useState(() =>
    savedKeys("achatado_emote_favorites"),
  );
  const [recent, setRecent] = useState(() =>
    savedKeys("achatado_emote_recent"),
  );
  const [preview, setPreview] = useState<PickerEmote | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    root.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => previous?.focus();
  }, []);
  const insert = (emote: PickerEmote) => {
    if (emote.locked) return;
    onInsert(emote);
    const next = [
      emoteKey(emote),
      ...recent.filter((key) => key !== emoteKey(emote)),
    ].slice(0, 40);
    setRecent(next);
    try {
      localStorage.setItem("achatado_emote_recent", JSON.stringify(next));
    } catch {
      /* Armazenamento indisponível. */
    }
  };
  const favorite = () => {
    if (!preview) return;
    const key = emoteKey(preview);
    const next = favorites.includes(key)
      ? favorites.filter((item) => item !== key)
      : [...favorites, key];
    setFavorites(next);
    try {
      localStorage.setItem("achatado_emote_favorites", JSON.stringify(next));
    } catch {
      /* Armazenamento indisponível. */
    }
  };
  const filtered = emotes.filter(
    (e) =>
      (tab === "all" ||
        (tab === "recent" && recent.includes(emoteKey(e))) ||
        (tab === "favorites" && favorites.includes(emoteKey(e))) ||
        e.provider === tab) &&
      `${e.code} ${e.name || ""}`.toLowerCase().includes(search.toLowerCase()),
  );
  const providers = ["all", platform, "bttv", "ffz", "7tv"] as PickerProvider[];
  const groups = Array.from(
    new Set(
      filtered.map((e) =>
        e.category === "thirdparty" ? e.provider : e.category,
      ),
    ),
  );
  const groupLabel: Record<string, string> = {
    user: "Seus emotes",
    channel: "Canal",
    official: `Oficiais da ${labels[platform]}`,
    "kick-emotes": "Emotes da Kick",
    "kick-global": "Globais da Kick",
    bttv: "BetterTTV",
    ffz: "FrankerFaceZ",
    "7tv": "7TV",
  };
  return (
    <div
      ref={root}
      className={`emotePickerPanel ${platform}`}
      role="dialog"
      aria-label="Seletor de emotes"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="emotePickerHeader">
        <div className="emotePickerTitle">
          <Icon name="smile" />
          <strong>Emotes da {labels[platform]}</strong>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar emotes">
          <Icon name="close" />
        </button>
      </div>
      <div className="emoteSearchWrap">
        <Icon name="search" />
        <input
          className="emotePickerSearch"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar emote…"
          aria-label="Buscar emote"
        />
        <kbd>ESC</kbd>
      </div>
      <div className="emoteProviderTabs" aria-label="Origem dos emotes">
        {(["recent", "favorites", ...providers] as const).map((provider) => (
          <button
            type="button"
            key={provider}
            className={tab === provider ? "active" : ""}
            aria-pressed={tab === provider}
            onClick={() => setTab(provider)}
          >
            {provider === "recent" ? (
              <>
                <Icon name="history" />
                Recentes
              </>
            ) : provider === "favorites" ? (
              <>
                <Icon name="star" />
                Favoritos
              </>
            ) : (
              pickerProviderLabels[provider]
            )}
          </button>
        ))}
      </div>
      {scopeUpgrade && (
        <a
          className="emoteScopeNotice"
          href={`/api/auth/twitch/start${popup ? "?popup=1" : ""}`}
        >
          Reconecte a Twitch para incluir emotes da sua conta e assinaturas.
        </a>
      )}
      <div className="emotePickerContent">
        {loading ? (
          <div className="emotePickerEmpty" role="status">
            Carregando emotes…
          </div>
        ) : !filtered.length ? (
          <div className="emotePickerEmpty">Nenhum emote encontrado.</div>
        ) : (
          groups.map((group) => (
            <section className="emotePickerGroup" key={group}>
              <h3 className="emotePickerGroupTitle">
                {groupLabel[group] || group}
                <span>
                  {
                    filtered.filter(
                      (e) =>
                        (e.category === "thirdparty"
                          ? e.provider
                          : e.category) === group,
                    ).length
                  }
                </span>
              </h3>
              <div className="emotePickerGrid">
                {filtered
                  .filter(
                    (e) =>
                      (e.category === "thirdparty"
                        ? e.provider
                        : e.category) === group,
                  )
                  .map((e) => (
                    <button
                      type="button"
                      className={`emotePickerItem ${e.locked ? "locked" : ""}`}
                      key={emoteKey(e)}
                      onMouseEnter={() => setPreview(e)}
                      onFocus={() => setPreview(e)}
                      onClick={() => insert(e)}
                      aria-disabled={Boolean(e.locked)}
                      aria-label={`${e.code}${e.locked ? ", bloqueado" : ""}`}
                      title={
                        e.locked
                          ? e.lockReason || "Requer assinatura deste canal"
                          : `${e.code} · ${pickerProviderLabels[e.provider]}`
                      }
                    >
                      <span className="emoteImageWrap">
                        {e.url && <img src={e.url} alt="" loading="lazy" />}
                        {e.locked && <span className="emoteLockBadge">🔒</span>}
                      </span>
                      <span>{e.code}</span>
                    </button>
                  ))}
              </div>
            </section>
          ))
        )}
      </div>
      <div className="emotePickerFooter">
        {preview ? (
          <>
            <div className="emotePreviewIdentity">
              {preview.url && <img src={preview.url} alt="" />}
              <div>
                <strong>{preview.code}</strong>
                <small>
                  {pickerProviderLabels[preview.provider]}
                  {preview.locked
                    ? " · Requer assinatura"
                    : preview.native
                      ? " · Emote oficial"
                      : ""}
                </small>
              </div>
            </div>
            <button
              type="button"
              className={
                favorites.includes(emoteKey(preview))
                  ? "favorite active"
                  : "favorite"
              }
              onClick={favorite}
              aria-label="Favoritar emote"
              aria-pressed={favorites.includes(emoteKey(preview))}
            >
              <Icon name="star" />
            </button>
            <button
              type="button"
              className="insertEmoteButton"
              disabled={preview.locked}
              onClick={() => insert(preview)}
            >
              Inserir ↵
            </button>
          </>
        ) : (
          <span>
            {emotes.filter((e) => !e.locked).length} emotes disponíveis · Clique
            para inserir
          </span>
        )}
      </div>
    </div>
  );
}
