"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Role = "user" | "assistant";
type ConversationMode = "general" | "qualification";

type ChatMessage = {
  id: string;
  role: Role;
  content: string;
};

type LeadProfile = {
  business_segment: "industrial" | "commercial" | null;
  annual_usage_mwh: number | null;
  usage_estimated: boolean;
  square_footage: number | null;
  contract_status:
    | "unknown"
    | "expiring"
    | "month_to_month"
    | "fixed_term"
    | "no_current_provider";
  contract_expiry_months: number | null;
  building_age_years: number | null;
  has_current_provider: boolean | null;
  notes: string[];
};

type Qualification = {
  tier: "tier_1" | "tier_2" | "tier_3" | "unqualified";
  bucket: "gold" | "warm" | "lemon";
  reasoning: string;
};

type ConversationState = {
  session_id: string;
  mode: ConversationMode;
  detected_language: string;
  profile: LeadProfile;
  qualification: Qualification;
  missing_fields: string[];
  next_question: string;
  completed: boolean;
  last_intent:
    | "general_chat"
    | "product_question"
    | "business_qualification"
    | "business_clarification"
    | "off_topic"
    | null;
};

type PersistedSession = {
  sessionId: string;
  messages: ChatMessage[];
  state: ConversationState;
};

const SESSION_STORAGE_KEY = "owe-ui-session";

const initialAssistantMessage: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Welcome. Share a few details about your business, contract situation, or energy usage whenever you're ready.",
};

const initialState: ConversationState = {
  session_id: "",
  mode: "general",
  detected_language: "en",
  profile: {
    business_segment: null,
    annual_usage_mwh: null,
    usage_estimated: false,
    square_footage: null,
    contract_status: "unknown",
    contract_expiry_months: null,
    building_age_years: null,
    has_current_provider: null,
    notes: [],
  },
  qualification: {
    tier: "unqualified",
    bucket: "lemon",
    reasoning: "No assessment has been completed yet.",
  },
  missing_fields: [],
  next_question: "Start by telling me a little about the business or opportunity.",
  completed: false,
  last_intent: null,
};

function labelize(value: string | null | undefined) {
  if (!value) return "Not captured";
  return value.replaceAll("_", " ");
}

function formatLanguage(language: string) {
  if (!language) return "Unknown";
  if (language === "zh") return "Chinese";
  if (language === "en") return "English";
  return language.toUpperCase();
}

function formatMissingField(field: string) {
  if (field === "annual_usage_or_square_footage") {
    return "annual usage or square footage";
  }
  return labelize(field);
}

function badgeTone(mode: ConversationMode) {
  return mode === "qualification"
    ? "bg-amber-300/20 text-amber-200 border-amber-200/30"
    : "bg-sky-300/20 text-sky-200 border-sky-200/30";
}

function bucketTone(bucket: Qualification["bucket"]) {
  if (bucket === "gold") return "text-amber-200";
  if (bucket === "warm") return "text-orange-200";
  return "text-lime-200";
}

export default function Page() {
  const [apiBaseUrl, setApiBaseUrl] = useState("http://localhost:8000");
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([initialAssistantMessage]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<ConversationState>(initialState);
  const [isComposing, setIsComposing] = useState(false);
  const assistantMessageIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function loadRuntimeConfig() {
      try {
        const response = await fetch("/api/runtime-config", {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { apiBaseUrl?: string } | undefined;
        if (payload?.apiBaseUrl) {
          setApiBaseUrl(payload.apiBaseUrl);
        }
      } catch {
        // Fall back to the local default when runtime config is unavailable.
      }
    }

    void loadRuntimeConfig();
  }, []);

  useEffect(() => {
    async function bootstrapSession() {
      const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as PersistedSession;
          setSessionId(parsed.sessionId);

          const response = await fetch(`${apiBaseUrl}/api/v1/chat/${parsed.sessionId}`);

          if (response.ok) {
            const payload = (await response.json()) as
              | {
                  status?: string;
                  state?: ConversationState;
                  messages?: Array<{ role: Role; content: string }>;
                }
              | undefined;

            if (payload?.status !== "not_found" && payload?.state && payload?.messages) {
              setState(payload.state);
              setMessages(
                payload.messages.map((message, index) => ({
                  id: `${parsed.sessionId}-${index}`,
                  role: message.role,
                  content: message.content,
                })),
              );
              return;
            }
          }

          setMessages(parsed.messages);
          setState(parsed.state);
          return;
        } catch {
          window.localStorage.removeItem(SESSION_STORAGE_KEY);
        }
      }

      const freshSessionId = crypto.randomUUID();
      setSessionId(freshSessionId);
      setState({
        ...initialState,
        session_id: freshSessionId,
      });
    }

    void bootstrapSession();
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!sessionId) return;

    const payload: PersistedSession = {
      sessionId,
      messages,
      state,
    };
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
  }, [messages, sessionId, state]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, isStreaming]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = input.trim();
    if (!trimmed || isStreaming || !sessionId) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };

    const assistantMessageId = crypto.randomUUID();
    assistantMessageIdRef.current = assistantMessageId;

    setMessages((current) => [
      ...current,
      userMessage,
      { id: assistantMessageId, role: "assistant", content: "" },
    ]);
    setInput("");
    setError(null);
    setIsStreaming(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: sessionId,
          message: trimmed,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const rawEvent of events) {
          const parsed = parseSseEvent(rawEvent);
          if (!parsed) continue;

          if (parsed.event === "token") {
            const delta = parsed.data.delta as string;
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessageId
                  ? { ...message, content: `${message.content}${delta}` }
                  : message,
              ),
            );
          }

          if (parsed.event === "state") {
            setState(parsed.data as ConversationState);
          }

          if (parsed.event === "error" && parsed.data.message) {
            setError(parsed.data.message as string);
          }

          if (parsed.event === "done" && parsed.data.message) {
            const finalMessage = parsed.data.message as string;
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessageId
                  ? { ...message, content: finalMessage }
                  : message,
              ),
            );
          }
        }
      }
    } catch (streamError) {
      setError(
        streamError instanceof Error
          ? streamError.message
          : "Something went wrong while streaming the response.",
      );
    } finally {
      setIsStreaming(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing || isComposing) {
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const form = event.currentTarget.form;
      if (form) {
        form.requestSubmit();
      }
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#20385a_0%,_#0d1726_46%,_#050913_100%)] px-4 py-8 text-slate-50">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.7fr_1fr]">
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/70 shadow-2xl shadow-black/30 backdrop-blur">
          <div className="border-b border-white/10 px-6 py-5">
            <p className="text-sm uppercase tracking-[0.28em] text-emerald-300">
              Strategic Lead Matrix
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                Energy lead qualification assistant
              </h1>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] ${badgeTone(
                  state.mode,
                )}`}
              >
                {state.mode}
              </span>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Share a few details about the business, contract situation, and energy usage,
              and this assistant will help assess the opportunity and its priority.
            </p>
          </div>

          <div className="flex h-[72vh] flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-lg ${
                      message.role === "user"
                        ? "bg-emerald-300 text-slate-950"
                        : "bg-white/10 text-slate-100 markdown-message"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content ||
                          (isStreaming && message.id === assistantMessageIdRef.current
                            ? "..."
                            : "")}
                      </ReactMarkdown>
                    ) : (
                      message.content
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-white/10 p-4">
              <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
                <textarea
                  className="min-h-28 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-300"
                  onChange={(event) => setInput(event.target.value)}
                  onCompositionEnd={() => setIsComposing(false)}
                  onCompositionStart={() => setIsComposing(true)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder="Example: We are a commercial site on a month-to-month contract using 80 MWh. Or ask a general question first."
                  value={input}
                />

                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-400">
                    Press Enter to send. Use Shift + Enter for a new line.
                  </p>

                  <button
                    className="rounded-full bg-white/20 px-5 py-2 text-sm font-medium text-white transition hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={isStreaming || !input.trim()}
                    type="submit"
                  >
                    {isStreaming ? "Streaming..." : "Send"}
                  </button>
                </div>

                {error ? (
                  <p className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                    {error}
                  </p>
                ) : null}
              </form>
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-[24px] border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-black/20">
            <p className="text-xs uppercase tracking-[0.26em] text-slate-400">
              Opportunity Overview
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <MetricCard
                label="Conversation"
                value={state.mode === "qualification" ? "Assessment in progress" : "General guidance"}
              />
              <MetricCard label="Preferred language" value={formatLanguage(state.detected_language)} />
              <MetricCard
                label="Status"
                value={state.completed ? "Assessment complete" : "Gathering details"}
              />
            </div>
          </section>

          <section className="rounded-[24px] border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-black/20">
            <p className="text-xs uppercase tracking-[0.26em] text-slate-400">
              Qualification
            </p>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-400">Current tier</p>
                  <p className="mt-1 text-2xl font-semibold text-white">
                    {labelize(state.qualification.tier)}
                  </p>
                </div>
                <div className={`text-sm font-medium uppercase ${bucketTone(state.qualification.bucket)}`}>
                  {state.qualification.bucket}
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-300">
                {state.qualification.reasoning}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                  {state.completed ? "completed" : "in progress"}
                </span>
                {state.profile.usage_estimated ? (
                  <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-emerald-200">
                    usage estimated
                  </span>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-[24px] border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-black/20">
            <p className="text-xs uppercase tracking-[0.26em] text-slate-400">
              Missing Fields
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {state.missing_fields.length > 0 ? (
                state.missing_fields.map((field) => (
                  <span
                    key={field}
                    className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-100"
                  >
                    {formatMissingField(field)}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-400">
                  Nothing missing right now.
                </span>
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Next question
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                {state.next_question}
              </p>
            </div>
          </section>

          <section className="rounded-[24px] border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-black/20">
            <p className="text-xs uppercase tracking-[0.26em] text-slate-400">
              Lead Profile
            </p>
            <dl className="mt-4 grid gap-3 text-sm text-slate-300">
              <ProfileRow label="Business segment" value={labelize(state.profile.business_segment)} />
              <ProfileRow
                label="Annual usage"
                value={
                  state.profile.annual_usage_mwh !== null
                    ? `${state.profile.annual_usage_mwh} MWh`
                    : "Not captured"
                }
              />
              <ProfileRow
                label="Square footage"
                value={
                  state.profile.square_footage !== null
                    ? `${state.profile.square_footage.toLocaleString()} sq ft`
                    : "Not captured"
                }
              />
              <ProfileRow label="Contract status" value={labelize(state.profile.contract_status)} />
              <ProfileRow
                label="Contract expiry"
                value={
                  state.profile.contract_expiry_months !== null
                    ? `${state.profile.contract_expiry_months} months`
                    : "Not captured"
                }
              />
              <ProfileRow
                label="Building age"
                value={
                  state.profile.building_age_years !== null
                    ? `${state.profile.building_age_years} years`
                    : "Not captured"
                }
              />
              <ProfileRow
                label="Current provider"
                value={
                  state.profile.has_current_provider === null
                    ? "Not captured"
                    : state.profile.has_current_provider
                      ? "Yes"
                      : "No"
                }
              />
            </dl>
          </section>
        </aside>
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right text-slate-100">{value}</dd>
    </div>
  );
}

function parseSseEvent(
  rawEvent: string,
): { event: string; data: Record<string, unknown> } | null {
  const lines = rawEvent.split("\n");
  let event = "";
  let data = "";

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.replace("event:", "").trim();
    }

    if (line.startsWith("data:")) {
      data += line.replace("data:", "").trim();
    }
  }

  if (!event || !data) return null;

  try {
    return {
      event,
      data: JSON.parse(data) as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}
