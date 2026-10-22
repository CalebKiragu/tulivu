import { useEffect, useMemo, useState } from "react";
import type { ArtifactType } from "@tulivu/shared";
import { ARTIFACT_LABELS } from "@tulivu/shared";
import { Braces, TriangleAlert } from "lucide-react";
import { apiErrorMessage } from "@/lib/api";
import { usePatchArtifact } from "@/lib/queries";
import { Button, Callout, Field, Modal, Textarea } from "./ui";
import { useToast } from "./toast";

export function ArtifactEditorModal({
  campaignId,
  type,
  content,
  open,
  onClose,
}: {
  campaignId: string;
  type: ArtifactType;
  content: unknown;
  open: boolean;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = usePatchArtifact(campaignId);
  const { push } = useToast();

  const formatted = useMemo(() => JSON.stringify(content, null, 2), [content]);

  useEffect(() => {
    if (open) {
      setText(formatted);
      setNote("");
      setError(null);
    }
  }, [open, formatted]);

  async function submit() {
    setError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setError("This is not valid JSON. Check for a missing comma or quotation mark.");
      return;
    }
    try {
      await mutation.mutateAsync({ type, content: parsed, ...(note.trim() ? { note: note.trim() } : {}) });
      push({
        title: `${ARTIFACT_LABELS[type]} updated`,
        description: "A new campaign version was created. Quality review and approval are now stale.",
        tone: "success",
      });
      onClose();
    } catch (caught) {
      setError(apiErrorMessage(caught));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit ${ARTIFACT_LABELS[type].toLowerCase()}`}
      description="Advanced structured editing. Save creates a new artifact version and a new campaign version."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={mutation.isPending}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Callout tone="warning" icon={<TriangleAlert className="h-4 w-4" aria-hidden />} title="This invalidates the current review">
          Editing is a real change to the campaign package. The quality review and any active approval will no longer
          cover this version.
        </Callout>

        <div className="flex items-center gap-2 rounded-lg border border-line bg-paper px-3 py-2 text-[11px] text-muted">
          <Braces className="h-3.5 w-3.5 text-forest" aria-hidden />
          JSON is validated against the artifact schema on the server before it is saved.
        </div>

        <Field label="Artifact content" htmlFor="artifact-json">
          <Textarea
            id="artifact-json"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={22}
            spellCheck={false}
            className="font-mono text-[11px] leading-5"
          />
        </Field>

        <Field label="Change note" htmlFor="artifact-note" optional hint="Stored in the audit trail so a reviewer can see why this changed.">
          <Textarea
            id="artifact-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            placeholder="For example: shortened the first Meta primary text after review."
          />
        </Field>

        {error ? (
          <p className="rounded-lg border border-clay/25 bg-[#fbf1ec] px-3 py-2 text-xs text-[#743d2b]" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
