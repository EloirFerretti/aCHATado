import type { ReactNode } from "react";
import type { ChatSettings, FeedFontSize } from "./model";
import { Dialog } from "./dialog";
import { Icon } from "./icons";

type ToggleKey = Exclude<keyof ChatSettings, "feedFontSize">;
const appearance: [ToggleKey, string, string][] = [
  [
    "compactMode",
    "Modo Compacto",
    "Reduz espaçamentos e exibe mais mensagens por tela",
  ],
  [
    "showPlatformBadges",
    "Exibir Badges de Plataforma",
    "Exibir badges reais e a identificação da plataforma",
  ],
  [
    "showTimestamps",
    "Timestamps / Horário",
    "Exibir horário de envio nas mensagens",
  ],
];
const filters: [ToggleKey, string, string][] = [
  [
    "hideBots",
    "Ocultar Mensagens de Bots",
    "Ocultar alertas automáticos e mensagens de bots",
  ],
  [
    "blockLinks",
    "Bloqueio de Links / Anti-Spam",
    "Ocultar URLs de espectadores comuns",
  ],
];
const sounds: [ToggleKey, string, string][] = [
  [
    "newMessageSound",
    "Som em Novas Mensagens",
    "Tocar bipe sutil a cada mensagem recebida",
  ],
  [
    "mentionSound",
    "Alerta Sonoro em Menções (@você)",
    "Notificar com som de destaque quando for citado",
  ],
];
export function SettingsDialog({
  draft,
  onChange,
  onClose,
  onSave,
  onRestore,
  accounts,
}: {
  draft: ChatSettings;
  onChange: (settings: ChatSettings) => void;
  onClose: () => void;
  onSave: () => void;
  onRestore: () => void;
  accounts: ReactNode;
}) {
  const toggle = ([key, title, description]: [ToggleKey, string, string]) => (
    <div className="settingsCard" key={key}>
      <div className="settingsCardCopy">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <button
        type="button"
        className={`settingsSwitch ${draft[key] ? "active" : ""}`}
        role="switch"
        aria-checked={draft[key]}
        aria-label={title}
        onClick={() => onChange({ ...draft, [key]: !draft[key] })}
      >
        <span />
      </button>
    </div>
  );
  return (
    <Dialog
      titleId="popup-settings-title"
      className="chatPreferencesDialog"
      onClose={onClose}
    >
      <div className="popupSettingsHeader">
        <span className="settingsHeaderIcon">
          <Icon name="settings" />
        </span>
        <div className="settingsHeaderCopy">
          <strong id="popup-settings-title">Configurações do Chat</strong>
          <span>Ajuste o comportamento do feed, visualização e alertas</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar configurações"
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="popupSettingsBody preferencesBody">
        <details className="settingsAccounts">
          <summary>
            <Icon name="accounts" /> Canais &amp; contas
          </summary>
          <div>{accounts}</div>
        </details>
        <section className="settingsSection">
          <h3 className="settingsSectionTitle">Visualização &amp; aparência</h3>
          {appearance.slice(0, 2).map(toggle)}
          <div className="settingsCard settingsFontCard">
            <div className="settingsFontHeading">
              <strong>Tamanho da Fonte do Feed</strong>
              <span>
                {draft.feedFontSize === "small"
                  ? "12px (Pequena)"
                  : draft.feedFontSize === "large"
                    ? "16px (Grande)"
                    : "14px (Média)"}
              </span>
            </div>
            <div
              className="settingsSegmented"
              role="group"
              aria-label="Tamanho da fonte"
            >
              {(
                [
                  ["small", "Pequena"],
                  ["medium", "Média"],
                  ["large", "Grande"],
                ] as [FeedFontSize, string][]
              ).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={draft.feedFontSize === value}
                  className={draft.feedFontSize === value ? "active" : ""}
                  onClick={() => onChange({ ...draft, feedFontSize: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {appearance.slice(2).map(toggle)}
        </section>
        <section className="settingsSection">
          <h3 className="settingsSectionTitle">Filtros &amp; moderação</h3>
          {filters.map(toggle)}
        </section>
        <section className="settingsSection">
          <h3 className="settingsSectionTitle">Notificações sonoras</h3>
          {sounds.map(toggle)}
        </section>
      </div>
      <div className="settingsFooter">
        <button
          type="button"
          className="restoreSettingsButton"
          onClick={onRestore}
        >
          Restaurar Padrões
        </button>
        <div>
          <button
            type="button"
            className="cancelSettingsButton"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button type="button" className="saveSettingsButton" onClick={onSave}>
            <Icon name="check" /> Salvar Alterações
          </button>
        </div>
      </div>
    </Dialog>
  );
}
