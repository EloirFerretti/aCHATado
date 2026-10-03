import { Icon, PlatformIcon } from "./icons";
import {
  platforms,
  labels,
  type AuthInfo,
  type ChannelInputs,
  type ChannelMap,
  type ChannelErrors,
  type Platform,
} from "./model";

type Props = {
  auth: AuthInfo;
  channels: ChannelMap;
  inputs: ChannelInputs;
  errors: ChannelErrors;
  resolving: Platform | null;
  popup: boolean;
  onInput: (platform: Platform, value: string) => void;
  onResolve: (platform: Platform) => void;
  onLogout: (platform: Platform) => void;
};
export function ChannelSidebar({
  auth,
  channels,
  inputs,
  errors,
  resolving,
  popup,
  onInput,
  onResolve,
  onLogout,
}: Props) {
  return (
    <>
      <section className="sidebarSection" aria-label="Plataformas e canais">
        <h2 className="sidebarTitle">
          Plataformas <Icon name="hub" />
        </h2>
        <div className="channelGrid">
          {platforms.map((platform) => {
            const channel = channels[platform];
            const status =
              resolving === platform
                ? "Identificando…"
                : errors[platform]
                  ? "Erro ao conectar"
                  : channel
                    ? channel.live === true
                      ? "Ao vivo"
                      : channel.live === false
                        ? "Offline"
                        : "Canal selecionado"
                    : "Off";
            return (
              <div className={`channelCard ${platform}`} key={platform}>
                <div className="channelCardTitle">
                  <span className={`platformIcon ${platform}`}>
                    <PlatformIcon platform={platform} />
                  </span>
                  <div className="channelIdentity">
                    <strong>
                      {labels[platform]}{" "}
                      <i
                        className={`statusDot ${channel ? "connected" : ""}`}
                      />
                    </strong>
                    <small title={channel?.note}>{status}</small>
                  </div>
                  <button
                    className="tinyButton"
                    type="button"
                    onClick={() => onResolve(platform)}
                    disabled={!inputs[platform].trim() || resolving !== null}
                    aria-label={`${channel ? "Atualizar" : "Conectar"} canal da ${labels[platform]}`}
                  >
                    {resolving === platform
                      ? "…"
                      : channel
                        ? "Atualizar"
                        : "Conectar"}
                  </button>
                </div>
                <input
                  value={inputs[platform]}
                  onChange={(e) => onInput(platform, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onResolve(platform);
                    }
                  }}
                  placeholder="@usuário ou URL"
                  aria-label={`Canal da ${labels[platform]}`}
                  spellCheck={false}
                  autoComplete="off"
                  aria-invalid={Boolean(errors[platform])}
                />
                {errors[platform] && (
                  <p className="channelError" role="alert">
                    {errors[platform]}
                  </p>
                )}
                {channel?.note && (
                  <details className="channelDetails">
                    <summary>{channel.channelName}</summary>
                    <p>{channel.note}</p>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <section className="sidebarSection" aria-label="Suas contas">
        <h2 className="sidebarTitle">
          Suas contas <Icon name="accounts" />
        </h2>
        <div className="accountList">
          {platforms.map((platform) => (
            <div className={`accountRow ${platform}`} key={platform}>
              <span className={`platformIcon ${platform}`}>
                <PlatformIcon platform={platform} />
              </span>
              <div className="accountText">
                <strong>{labels[platform]}</strong>
                <small title={auth[platform].userName}>
                  {auth[platform].connected
                    ? auth[platform].userName || "Conectado"
                    : "Não conectado"}
                </small>
              </div>
              {!auth[platform].configured ? (
                <button
                  className="tinyButton"
                  disabled
                  title="Autenticação indisponível neste ambiente"
                >
                  Conectar
                </button>
              ) : auth[platform].connected ? (
                <button
                  type="button"
                  className="tinyButton"
                  onClick={() => onLogout(platform)}
                >
                  Sair
                </button>
              ) : (
                <a
                  className="tinyButton"
                  href={`/api/auth/${platform}/start${popup ? "?popup=1" : ""}`}
                >
                  Conectar
                </a>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
