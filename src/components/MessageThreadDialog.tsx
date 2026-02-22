import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { MessageRecord } from "@/lib/messages";
import { format } from "date-fns";

export interface MessageThread {
  threadKey: string;
  couchId: string | null;
  hostId: string | null;
  hostName: string | null;
  hostEmail: string | null;
  renterId: string | null;
  renterName: string | null;
  renterEmail: string | null;
  messages: MessageRecord[];
}

interface MessageThreadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  thread: MessageThread | null;
  currentUserRole: "host" | "renter";
  onSendMessage: (text: string) => Promise<void>;
  sending?: boolean;
}

export const MessageThreadDialog = ({
  open,
  onOpenChange,
  thread,
  currentUserRole,
  onSendMessage,
  sending = false,
}: MessageThreadDialogProps) => {
  const [draft, setDraft] = useState("");

  const orderedMessages = useMemo(() => {
    if (!thread) return [] as MessageRecord[];
    return [...thread.messages].sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
  }, [thread]);

  const handleSend = async () => {
    if (!draft.trim()) return;
    await onSendMessage(draft.trim());
    setDraft("");
  };

  const title = useMemo(() => {
    if (!thread) return "Conversation";
    const otherParticipant = currentUserRole === "host"
      ? thread.renterName ?? "Guest"
      : thread.hostName ?? "Host";
    return `Chat with ${otherParticipant}`;
  }, [thread, currentUserRole]);

  return (
    <Dialog open={open} onOpenChange={(next) => {
      setDraft("");
      onOpenChange(next);
    }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {thread?.couchId && (
            <DialogDescription className="text-xs text-muted-foreground">
              Couch reference: {thread.couchId}
            </DialogDescription>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-80 rounded-md border border-sketch p-3 bg-background/50">
          <div className="space-y-3">
            {orderedMessages.map((message) => {
              const isSelf = message.senderRole === currentUserRole;
              return (
                <div
                  key={message.id}
                  className={`flex flex-col ${isSelf ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                      isSelf ? "bg-sketch-blue text-white" : "bg-muted"
                    }`}
                  >
                    <p className="whitespace-pre-line leading-relaxed">{message.text}</p>
                  </div>
                  <span className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {isSelf ? "You" : message.senderName ?? (isSelf ? "You" : "Partner")} ·
                    {" "}
                    {format(new Date(message.sentAt), "MMM d, yyyy HH:mm")}
                  </span>
                </div>
              );
            })}

            {!orderedMessages.length && (
              <p className="text-xs text-muted-foreground text-center">
                Start the conversation by sending a message.
              </p>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex flex-col gap-3 sm:flex-col">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type your message..."
            rows={3}
          />
          <Button onClick={handleSend} disabled={sending || !draft.trim()}>
            {sending ? "Sending..." : "Send message"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MessageThreadDialog;
