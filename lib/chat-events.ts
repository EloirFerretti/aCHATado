import type { ChatMessage } from "@/lib/types";

type Listener = (message: ChatMessage) => void;
type DeleteListener = (message: {
  platform: ChatMessage["platform"];
  platform_message_id: string;
}) => void;

type EventBus = {
  listeners: Set<Listener>;
  deleteListeners: Set<DeleteListener>;
};

const globalKey = "__achatado_chat_event_bus__";

function bus(): EventBus {
  const root = globalThis as typeof globalThis & { [globalKey]?: EventBus };
  if (!root[globalKey]) {
    root[globalKey] = { listeners: new Set(), deleteListeners: new Set() };
  }
  if (!root[globalKey]!.deleteListeners) {
    root[globalKey]!.deleteListeners = new Set();
  }
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


export function publishChatDeletion(message: {
  platform: ChatMessage["platform"];
  platform_message_id: string;
}) {
  for (const listener of bus().deleteListeners) {
    try { listener(message); } catch { /* listener isolado */ }
  }
}

export function subscribeChatDeletions(listener: DeleteListener) {
  bus().deleteListeners.add(listener);
  return () => bus().deleteListeners.delete(listener);
}
