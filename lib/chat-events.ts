import type { ChatMessage } from "@/lib/types";

type Listener = (message: ChatMessage) => void;

type EventBus = {
  listeners: Set<Listener>;
};

const globalKey = "__achatado_chat_event_bus__";

function bus(): EventBus {
  const root = globalThis as typeof globalThis & { [globalKey]?: EventBus };
  if (!root[globalKey]) root[globalKey] = { listeners: new Set() };
  return root[globalKey]!;
}

export function publishChatMessage(message: ChatMessage) {
  for (const listener of bus().listeners) {
    try { listener(message); } catch { /* listener isolado */ }
  }
}

export function subscribeChatMessages(listener: Listener) {
  bus().listeners.add(listener);
  return () => bus().listeners.delete(listener);
}
