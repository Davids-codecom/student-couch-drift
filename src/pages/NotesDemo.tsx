import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { callTransformNote } from "@/lib/callTransformNote";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Note {
  id: string;
  content: string;
  user_id: string | null;
  created_at: string;
}

const NotesDemo = () => {
  const { user, loading } = useSession();
  const [notes, setNotes] = useState<Note[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadNotes = useCallback(async () => {
    if (!user) {
      setNotes([]);
      return;
    }
    setIsFetching(true);
    setFetchError(null);

    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      setFetchError(error.message);
      setNotes([]);
    } else {
      setNotes(data ?? []);
    }

    setIsFetching(false);
  }, [user]);

  useEffect(() => {
    if (!loading) {
      loadNotes();
    }
  }, [loading, loadNotes]);

  const handleAddNote = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user) {
      setSubmitError("You must be signed in to add a note.");
      return;
    }

    const content = inputValue.trim();
    if (!content) {
      setSubmitError("Please enter some text before adding a note.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setStatusMessage(null);

    try {
      const response = await callTransformNote(content);
      setStatusMessage(response.message ?? "Note added successfully.");
      setInputValue("");
      if (response.note) {
        setNotes((prev) => [response.note as Note, ...prev].slice(0, 20));
      } else {
        await loadNotes();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add note";
      setSubmitError(message);
    }

    setIsSubmitting(false);
  };

  const formattedNotes = useMemo(
    () =>
      notes.map((note) => ({
        ...note,
        formattedDate: new Date(note.created_at).toLocaleString(),
      })),
    [notes],
  );

  if (loading) {
    return (
      <main className="dreamy-bg min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Checking session…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="dreamy-bg min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-semibold">Sign in required</h1>
          <p className="text-muted-foreground text-sm">
            Visit the sign-in page to receive a magic link, then return to test notes.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="dreamy-bg min-h-screen px-4 py-8">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-sketch-dark">Notes demo</h1>
          <p className="text-muted-foreground text-sm">
            Add personal notes stored in Supabase. Only you can see your entries.
          </p>
        </header>

        <form onSubmit={handleAddNote} className="space-y-3">
          <div className="flex gap-3">
            <Input
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="Write a note…"
              className="flex-1"
            />
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding…" : "Add note"}
            </Button>
          </div>
          {submitError && <p className="text-sm text-destructive">{submitError}</p>}
          {statusMessage && <p className="text-sm text-emerald-600">{statusMessage}</p>}
        </form>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Latest notes</h2>
            <Button variant="outline" size="sm" onClick={loadNotes} disabled={isFetching}>
              {isFetching ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
          {fetchError && <p className="text-sm text-destructive">{fetchError}</p>}
          {!fetchError && formattedNotes.length === 0 && (
            <p className="text-sm text-muted-foreground">No notes yet. Add your first one above!</p>
          )}

          <ul className="space-y-3">
            {formattedNotes.map((note) => (
              <li key={note.id} className="sketch-card p-4">
                <p className="text-sm text-muted-foreground mb-1">{note.formattedDate}</p>
                <p className="text-base text-sketch-dark whitespace-pre-line break-words">{note.content}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
};

export default NotesDemo;
