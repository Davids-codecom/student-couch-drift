import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/hooks/useSession";
import { fetchThreadsForUser, fetchDirectMessages, sendDirectMessage, type DirectMessageRecord, type DirectMessageThread } from "@/lib/directMessages";
import { fetchUserProfilesByIds } from "@/lib/users";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

interface ConversationProfile {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
}

const normalizeProfileName = (profile?: ConversationProfile) => {
  if (!profile) return "Member";
  if (profile.name) return profile.name;
  if (profile.email) {
    const [localPart] = profile.email.split("@");
    return localPart || "Member";
  }
  return "Member";
};

const MessageCenter = () => {
  const { user, loading } = useSession();
  const [threads, setThreads] = useState<DirectMessageThread[]>([]);
  const [threadProfiles, setThreadProfiles] = useState<Record<string, ConversationProfile>>({});
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [selectedThread, setSelectedThread] = useState<DirectMessageThread | null>(null);
  const [messages, setMessages] = useState<DirectMessageRecord[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");

  const userId = user?.id ?? null;
  const selectedThreadOtherUserId = selectedThread?.otherUserId ?? null;

  useEffect(() => {
    if (!userId) {
      setThreads([]);
      setThreadProfiles({});
      return;
    }

    let active = true;

    const loadThreads = async () => {
      try {
        setThreadsLoading(true);
        const data = await fetchThreadsForUser(userId);
        if (!active) return;
        setThreads(data);

        const ids = data.map((thread) => thread.otherUserId);
        if (ids.length) {
          const profiles = await fetchUserProfilesByIds(ids);
          if (!active) return;
          setThreadProfiles(
            profiles.reduce((acc, profile) => {
              acc[profile.id] = {
                id: profile.id,
                name: profile.full_name ?? "",
                role: profile.user_role ?? null,
                email: profile.email ?? null,
              };
              return acc;
            }, {} as Record<string, ConversationProfile>),
          );
        }

        setSelectedThread((current) => current ?? data[0] ?? null);
        setThreadsError(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load conversations.";
        setThreadsError(message);
      } finally {
        if (active) {
          setThreadsLoading(false);
        }
      }
    };

    loadThreads();

    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !selectedThreadOtherUserId) {
      setMessages([]);
      return;
    }

    let active = true;

    const loadMessages = async () => {
      try {
        setMessagesLoading(true);
        const data = await fetchDirectMessages(userId, selectedThreadOtherUserId);
        if (!active) return;
        setMessages(data);
        setMessagesError(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load messages.";
        if (active) {
          setMessagesError(message);
          setMessages([]);
        }
      } finally {
        if (active) {
          setMessagesLoading(false);
        }
      }
    };

    loadMessages();

    const channel = supabase
      .channel(`dm-center-${userId}-${selectedThreadOtherUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        (payload) => {
          const record = payload.new as DirectMessageRecord;
          if (
            (record.sender_id === userId && record.receiver_id === selectedThreadOtherUserId)
            || (record.sender_id === selectedThreadOtherUserId && record.receiver_id === userId)
          ) {
            setMessages((prev) => {
              if (prev.some((message) => message.id === record.id)) {
                return prev;
              }
              return [...prev, record];
            });
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [selectedThreadOtherUserId, userId]);

  const filteredThreads = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return threads;
    return threads.filter((thread) => {
      const profile = threadProfiles[thread.otherUserId];
      if (!profile) return false;
      const name = normalizeProfileName(profile).toLowerCase();
      const role = profile.role?.toLowerCase() ?? "";
      return name.includes(term) || role.includes(term);
    });
  }, [threads, threadProfiles, search]);

  const handleSelectThread = (thread: DirectMessageThread) => {
    setSelectedThread(thread);
    setMessagesError(null);
    setMessageDraft("");
  };

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !selectedThread) return;

    const content = messageDraft.trim();
    if (!content) {
      setMessagesError("Please enter a message.");
      return;
    }

    setSending(true);
    setMessagesError(null);

    try {
      const created = await sendDirectMessage(user.id, selectedThread.otherUserId, content);
      if (created) {
        setMessages((prev) => [...prev, created]);
      }
      setMessageDraft("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send message.";
      setMessagesError(message);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading session…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-semibold">Sign in required</h1>
          <p className="text-muted-foreground text-sm">
            Visit the sign-in page to view your conversations.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="dreamy-bg min-h-screen px-4 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section className="rounded-[2.5rem] border border-white/60 bg-white/85 p-6 backdrop-blur-lg shadow-2xl shadow-blue-100/50">
          <p className="text-xs uppercase tracking-[0.5em] text-slate-500">Conversations</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Message center</h1>
          <p className="text-sm text-slate-500">
            Keep calm chats organized. Search your hosts, continue planning, and never lose a thread.
          </p>
        </section>

        <div className="flex flex-col gap-6 lg:flex-row">
          <aside className="w-full rounded-[2rem] border border-white/70 bg-white/95 p-5 shadow-xl shadow-blue-100/40 lg:max-w-xs">
            <div className="space-y-3">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name"
                className="rounded-full bg-slate-50 text-sm"
              />
              {threadsError && <p className="text-sm text-destructive">{threadsError}</p>}
            </div>
            <ul className="mt-4 space-y-2 overflow-y-auto pr-1" style={{ maxHeight: "70vh" }}>
              {threadsLoading && <li className="text-sm text-muted-foreground">Loading conversations…</li>}
              {!threadsLoading && filteredThreads.length === 0 && (
                <li className="text-sm text-muted-foreground">No conversations yet.</li>
              )}
              {filteredThreads.map((thread) => {
                const profile = threadProfiles[thread.otherUserId];
                const lastMessage = thread.lastMessage;
                const preview = lastMessage.content.length > 60
                  ? `${lastMessage.content.slice(0, 57)}…`
                  : lastMessage.content;
                const lastTime = format(new Date(lastMessage.created_at), "MMM d, h:mm a");
                const isActive = selectedThread?.otherUserId === thread.otherUserId;

                return (
                  <li key={thread.otherUserId}>
                    <button
                      type="button"
                      onClick={() => handleSelectThread(thread)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50 ${
                        isActive ? "border-blue-400 bg-blue-50" : "border-white/80 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{normalizeProfileName(profile)}</p>
                          {profile?.role && (
                            <p className="text-[11px] uppercase tracking-wide text-slate-400">{profile.role}</p>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400">{lastTime}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{preview}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <section className="flex-1">
            {selectedThread ? (
              <div className="flex h-full flex-col rounded-[2rem] border border-white/70 bg-white/95 p-6 shadow-2xl shadow-blue-100/40">
                <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Chatting with</p>
                    <h2 className="text-2xl font-semibold text-slate-900">
                      {normalizeProfileName(threadProfiles[selectedThread.otherUserId])}
                    </h2>
                    <p className="text-sm text-slate-500">
                      {threadProfiles[selectedThread.otherUserId]?.role ?? "Community member"}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                    Direct messages
                  </span>
                </header>

                <div className="flex-1 space-y-3 overflow-y-auto pr-2">
                  {messagesLoading && <p className="text-sm text-muted-foreground">Loading messages…</p>}
                  {!messagesLoading && messages.length === 0 && (
                    <p className="text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
                  )}
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                        message.sender_id === user.id
                          ? "ml-auto bg-blue-600 text-white"
                          : "mr-auto bg-slate-100 text-slate-800"
                      }`}
                    >
                      <p className="whitespace-pre-line break-words">{message.content}</p>
                      <p className="mt-1 text-[11px] opacity-70">
                        {format(new Date(message.created_at), "MMM d, yyyy · h:mm a")}
                      </p>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleSendMessage} className="mt-4 space-y-2">
                  <Textarea
                    value={messageDraft}
                    onChange={(event) => {
                      setMessageDraft(event.target.value);
                      if (messagesError) setMessagesError(null);
                    }}
                    placeholder="Write your message"
                    rows={3}
                    className="rounded-2xl"
                  />
                  {messagesError && <p className="text-sm text-destructive">{messagesError}</p>}
                  <Button type="submit" disabled={sending || !messageDraft.trim()} className="rounded-full px-6">
                    {sending ? "Sending…" : "Send message"}
                  </Button>
                </form>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center rounded-[2rem] border border-dashed border-white/70 bg-white/80 p-10 text-center shadow-2xl shadow-blue-100/30">
                <p className="text-sm text-slate-500">Select a conversation on the left to view messages.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
};

export default MessageCenter;
