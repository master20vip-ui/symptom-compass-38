import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { supabase } from "@/integrations/supabase/client";
import { AssistantMarkdown } from "./ProbabilityAssessment";
import { Conversation, ConversationContent, ConversationScrollButton } from "./ai-elements/conversation";
import { Message, MessageContent } from "./ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "./ai-elements/prompt-input";
import { Shimmer } from "./ai-elements/shimmer";
import { ShieldAlert, Sparkle } from "lucide-react";
import { toast } from "sonner";
import { getActiveProfileId } from "@/lib/active-profile";

type Props = {
  threadId: string;
  onAfterFirstMessage?: (title: string) => void;
};

export function ChatWindow({ threadId, onAfterFirstMessage }: Props) {
  const [initial, setInitial] = useState<UIMessage[] | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? null);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, role, parts, created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) {
        toast.error("Could not load messages");
        setInitial([]);
        return;
      }
      const mapped: UIMessage[] = (data ?? []).map((m) => ({
        id: m.id,
        role: m.role as UIMessage["role"],
        parts: m.parts as UIMessage["parts"],
      }));
      setInitial(mapped);
    })();
    return () => {
      cancelled = true;
    };
  }, [threadId]);

  if (initial === null || token === null) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading session…
      </div>
    );
  }

  return (
    <ChatInner
      threadId={threadId}
      initial={initial}
      token={token}
      onAfterFirstMessage={onAfterFirstMessage}
      textareaRef={textareaRef}
    />
  );
}

function ChatInner({
  threadId,
  initial,
  token,
  onAfterFirstMessage,
  textareaRef,
}: Props & {
  initial: UIMessage[];
  token: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const transport = new DefaultChatTransport({
    api: "/api/chat",
    headers: { Authorization: `Bearer ${token}` },
    prepareSendMessagesRequest: ({ messages }) => ({
      body: { messages, threadId },
    }),
  });

  const { messages, sendMessage, status, error } = useChat({
    id: threadId,
    messages: initial,
    transport,
    onError: (err) => toast.error(err.message ?? "Chat error"),
  });

  // Focus textarea on mount + after stream
  useEffect(() => {
    textareaRef.current?.focus();
  }, [textareaRef, threadId, status]);

  const isEmpty = messages.length === 0;
  const isLoading = status === "submitted" || status === "streaming";

  const handleSubmit = async ({ text }: { text: string }) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    const isFirst = messages.length === 0;
    await sendMessage({ text: trimmed });
    if (isFirst) onAfterFirstMessage?.(trimmed.slice(0, 60));
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="font-display text-base font-semibold">Symptom check</h1>
          <p className="text-xs text-muted-foreground">
            One question at a time. Information, not diagnosis.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs text-destructive">
          <ShieldAlert className="size-3.5" />
          Emergency? Call 911
        </div>
      </header>

      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl px-4 py-6">
          {isEmpty && <EmptyState />}

          {messages.map((m) => (
            <Message key={m.id} from={m.role}>
              {m.role === "assistant" ? (
                <div className="prose-chat max-w-full">
                  {m.parts.map((part, i) =>
                    part.type === "text" ? (
                      <AssistantMarkdown key={i} text={part.text} />
                    ) : null,
                  )}
                </div>
              ) : (
                <MessageContent>
                  {m.parts.map((part, i) =>
                    part.type === "text" ? <span key={i}>{part.text}</span> : null,
                  )}
                </MessageContent>
              )}
            </Message>
          ))}

          {status === "submitted" && (
            <Message from="assistant">
              <Shimmer>Thinking…</Shimmer>
            </Message>
          )}

          {error && (
            <p className="mt-2 text-sm text-destructive">
              {error.message ?? "Something went wrong."}
            </p>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border bg-background/40 px-4 py-4 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl">
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputTextarea
              ref={textareaRef}
              placeholder="Describe your main symptom…"
              autoFocus
            />
            <PromptInputFooter className="justify-between">
              <p className="text-[11px] text-muted-foreground">
                Triage may be inaccurate. Consult a clinician for diagnosis.
              </p>
              <PromptInputSubmit status={status} disabled={isLoading} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <div className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-2xl border border-neon/40 bg-neon/10 text-neon">
        <Sparkle className="size-5" />
      </div>
      <h2 className="font-display text-2xl font-semibold">
        What's bothering you today?
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Describe your main symptom in your own words. Triage will ask a few
        focused questions, then return likely conditions and next steps.
      </p>
      <div className="mt-6 grid gap-2 text-left text-xs text-muted-foreground sm:grid-cols-2">
        {[
          "I have a throbbing headache for 2 days",
          "Sore throat and mild fever since yesterday",
          "Sharp lower back pain after lifting",
          "Persistent dry cough for a week",
        ].map((s) => (
          <div
            key={s}
            className="rounded-xl border border-border bg-card/40 px-3 py-2"
          >
            “{s}”
          </div>
        ))}
      </div>
    </div>
  );
}
