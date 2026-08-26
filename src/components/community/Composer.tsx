import { useRef, useState, type FormEvent } from "react";
import { Plus, Send, Smile, Video as VideoIcon, X } from "lucide-react";
import { EMOJI_LIBRARY, readFileAsDataUrl, STICKERS, type Member, type PostInput } from "@/lib/community";

export function Composer({
  authors,
  authorId,
  setAuthorId,
  replyTo,
  clearReply,
  onSend,
  channel = "general",
}: {
  authors: Member[];
  authorId: string;
  setAuthorId: (id: string) => void;
  replyTo: { id: string; name: string } | null;
  clearReply: () => void;
  onSend: (post: PostInput) => Promise<void>;
  channel?: string;
}) {
  const [text, setText] = useState("");
  const [image, setImage] = useState("");
  const [video, setVideo] = useState("");
  const [stickers, setStickers] = useState(false);
  const [stickerSearch, setStickerSearch] = useState("");
  const [sendError, setSendError] = useState("");
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  async function send(extra?: Partial<PostInput>) {
    if (!authorId) return;
    const payload: PostInput = {
      authorId,
      text: text.trim(),
      image,
      video,
      replyToId: replyTo?.id,
      channel,
      ...extra,
    };
    if (!payload.text && !payload.image && !payload.video && !payload.sticker) return;
    try {
      await onSend(payload);
      setText("");
      setImage("");
      setVideo("");
      setStickers(false);
      setSendError("");
      clearReply();
    } catch {
      setSendError("Message was not saved. Please try again.");
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void send();
  }

  return (
    <div className="shrink-0 border-t border-rail bg-background px-3 pb-3 pt-2">
      {replyTo && (
        <div className="mb-2 flex items-center justify-between gap-3 rounded-t-md bg-accent/50 px-3 py-1.5 text-xs">
          <span className="min-w-0 truncate text-muted-foreground">
            Replying to <strong className="text-foreground">{replyTo.name}</strong>
          </span>
          <button onClick={clearReply} className="shrink-0 text-muted-foreground">
            ×
          </button>
        </div>
      )}

      {(image || video) && (
        <div className="mb-2 flex flex-wrap gap-2">
          {image && (
            <div className="relative">
              <img src={image} alt="Attachment preview" className="h-20 rounded-md" />
              <button
                onClick={() => setImage("")}
                className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-destructive text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          {video && (
            <div className="relative">
              <video src={video} className="h-20 rounded-md" />
              <button
                onClick={() => setVideo("")}
                className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-destructive text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {stickers && (
        <div className="mb-2 rounded-md bg-popover p-2">
          <input value={stickerSearch} onChange={(e) => setStickerSearch(e.target.value)} placeholder="Search emoji (e.g. fire, party, gaming)" className="mb-2 w-full rounded-md bg-input px-3 py-2 text-sm outline-none" />
          <div className="grid grid-cols-6 gap-1">{[...STICKERS, ...EMOJI_LIBRARY.filter(([, name]) => name.includes(stickerSearch.toLowerCase())).map(([emoji]) => emoji)].filter((emoji, index, list) => list.indexOf(emoji) === index).map((s) => (
            <button
              key={s}
              onClick={() => void send({ sticker: s })}
              className="rounded-md py-1.5 text-2xl hover:bg-accent/60"
            >
              {s}
            </button>
          ))}</div>
          <p className="mt-2 text-[11px] text-muted-foreground">Use standard emoji here. Upload a sticker image with the + button; third-party packs remain on their source sites unless you have permission to add them.</p>
        </div>
      )}

      {authors.length > 1 && (
        <select
          value={authorId}
          onChange={(e) => setAuthorId(e.target.value)}
          className="mb-2 w-full rounded-md bg-input px-2 py-1.5 text-xs text-muted-foreground outline-none"
        >
          {authors.map((m) => (
            <option key={m.id} value={m.id}>
              Post as {m.name} · {m.handle}
            </option>
          ))}
        </select>
      )}

      <form
        onSubmit={submit}
        className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2 rounded-full bg-input px-2 py-1.5"
      >
        <button
          type="button"
          aria-label="Upload image"
          onClick={() => imageRef.current?.click()}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Upload video"
          onClick={() => videoRef.current?.click()}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent"
        >
          <VideoIcon className="h-4 w-4" />
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Message #${channel}`}
          className="min-w-0 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
        />
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label="Stickers"
            onClick={() => setStickers((v) => !v)}
            className="grid h-8 w-8 place-items-center rounded-full bg-accent"
          >
            <Smile className="h-4 w-4" />
          </button>
          <button
            type="submit"
            aria-label="Send message"
            className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
      {sendError && <p className="mt-1 px-2 text-xs font-semibold text-destructive">{sendError}</p>}

      <input
        ref={imageRef}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => setImage(await readFileAsDataUrl(e.target.files?.[0]))}
      />
      <input
        ref={videoRef}
        type="file"
        accept="video/*"
        hidden
        onChange={async (e) => setVideo(await readFileAsDataUrl(e.target.files?.[0]))}
      />
    </div>
  );
}
