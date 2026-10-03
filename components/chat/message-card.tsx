import type { ReactNode } from "react";
import {
  type Message,
  type ChatSettings,
  type ReplyTarget,
  labels,
  initials,
  avatarFallback,
  isBotMessage,
  messageDomId,
  messageModerationRole,
  timeLabel,
} from "./model";
import { Icon } from "./icons";

type Props = {
  message: Message;
  settings: ChatSettings;
  avatar: string | null;
  mentioned: boolean;
  reply: ReplyTarget | null;
  parent?: Message;
  canDelete: boolean;
  busy: boolean;
  badges: ReactNode;
  children: ReactNode;
  onProfile: () => void;
  onReply: () => void;
  onPin: () => void;
  onDelete: () => void;
  onJump: (reply: ReplyTarget) => void;
  onAvatarError: (url: string) => void;
};
export function MessageCard({
  message: m,
  settings,
  avatar,
  mentioned,
  reply,
  parent,
  canDelete,
  busy,
  badges,
  children,
  onProfile,
  onReply,
  onPin,
  onDelete,
  onJump,
  onAvatarError,
}: Props) {
  const moderationRole = messageModerationRole(m);
  const highlightedAuthor =
    moderationRole === "owner" ||
    moderationRole === "moderator" ||
    isBotMessage(m);

  return (
    <article
      className={`message ${m.platform} ${mentioned ? "messageMentioned" : ""} ${highlightedAuthor ? "messagePrivileged" : ""}`}
      id={messageDomId(m.platform, m.platform_message_id)}
    >
      {reply && (
        <button
          type="button"
          className={`messageReplyContext ${m.platform}`}
          disabled={!parent}
          onClick={() => onJump(reply)}
          title={
            parent
              ? "Ir para a mensagem original"
              : "Mensagem original não está carregada"
          }
        >
          <Icon name="reply" />
          <b>@{parent?.author_name || reply.authorName}</b>
          <small>
            {reply.message || parent?.message || "Mensagem original"}
          </small>
        </button>
      )}
      <div className="messageMain">
        <div className={`avatarRing ${m.platform}`}>
          <button
            type="button"
            className="avatarProfileLink"
            onClick={onProfile}
            title={`Ver perfil de ${m.author_name}`}
            aria-label={`Ver perfil de ${m.author_name}`}
          >
            <span className="avatarFallback" aria-hidden="true">
              {avatarFallback(m.author_name)}
            </span>
            {avatar && (
              <img
                src={avatar}
                alt=""
                onError={(e) => {
                  e.currentTarget.hidden = true;
                  onAvatarError(e.currentTarget.src);
                }}
              />
            )}
          </button>
          {settings.showPlatformBadges && (
            <span className={`miniPlatform ${m.platform}`}>
              {initials[m.platform]}
            </span>
          )}
        </div>
        <div className="messageBody">
          <div className="meta">
            {settings.showPlatformBadges && badges}
            <button
              type="button"
              className="authorProfileButton"
              onClick={onProfile}
              title={`Ver perfil de ${m.author_name}`}
            >
              <strong
                style={m.author_color ? { color: m.author_color } : undefined}
              >
                {m.author_name}
              </strong>
            </button>
            {settings.showPlatformBadges && (
              <span className={`platformLabel ${m.platform}`}>
                {labels[m.platform]}
              </span>
            )}
            {mentioned && (
              <span className="mentionLabel">
                <Icon name="at" /> Citou você
              </span>
            )}
            {settings.showTimestamps && (
              <time dateTime={m.created_at}>{timeLabel(m.created_at)}</time>
            )}
          </div>
          <p className="chatText">{children}</p>
        </div>
      </div>
      <div className="messageActions">
        <button
          type="button"
          onClick={onPin}
          title="Fixar mensagem no chat"
          aria-label={`Fixar mensagem de ${m.author_name}`}
        >
          <Icon name="pin" />
        </button>
        {m.platform !== "youtube" && (
          <button
            type="button"
            onClick={onReply}
            title={`Responder a ${m.author_name}`}
            aria-label={`Responder a ${m.author_name}`}
          >
            <Icon name="reply" />
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            title={`Apagar mensagem de ${m.author_name}`}
            aria-label={`Apagar mensagem de ${m.author_name}`}
          >
            <Icon name="trash" />
          </button>
        )}
      </div>
    </article>
  );
}
