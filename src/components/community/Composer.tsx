import { useRef, useState, type FormEvent } from "react";
import { Plus, Send, Smile, Video as VideoIcon, X, Sparkles, Upload, Star, Gamepad2, Heart, Search } from "lucide-react";
import { EMOJI_LIBRARY, readFileAsDataUrl, STICKERS, type Member, type PostInput, uploadCommunityMedia } from "@/lib/community";
import { COMMUNITY_STICKERS, getCustomStickers, saveCustomSticker, removeCustomSticker, type CommunitySticker } from "@/lib/stickers";

export function Composer({
  authors,
  authorId,
  setAuthorId,
  replyTo,
  clearReply,
  onSend,
  onTyping,
  channel = "general",
}: {
  authors: Member[];
  authorId: string;
  setAuthorId: (id: string) => void;
  replyTo: { id: string; name: string } | null;
  clearReply: () => void;
  onSend: (post: PostInput) => Promise<void>;
  onTyping?: (typing: boolean) => void;
  channel?: string;
}) {
  const [text, setText] = useState("");
  const [image, setImage] = useState("");
  const [video, setVideo] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [stickers, setStickers] = useState(false);
  const [stickerCategory, setStickerCategory] = useState<"streamer" | "anime" | "gaming" | "custom" | "emojis">("streamer");
  const [stickerSearch, setStickerSearch] = useState("");
  const [sendError, setSendError] = useState("");
  const [customStickers, setCustomStickers] = useState<CommunitySticker[]>(() => getCustomStickers());

  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const customStickerRef = useRef<HTMLInputElement>(null);

  const refreshCustom = () => setCustomStickers(getCustomStickers());

  async function send(extra?: Partial<PostInput>) {
    if (!authorId) return;
    if (!text.trim() && !image && !video && !extra?.sticker) return;
    try {
      setSending(true);
      const payload: PostInput = {
        authorId,
        text: text.trim(),
        image: imageFile ? await uploadCommunityMedia(imageFile) : image,
        video: videoFile ? await uploadCommunityMedia(videoFile) : video,
        replyToId: replyTo?.id,
        channel,
        ...extra,
      };
      await onSend(payload);
      setText("");
      setImage("");
      setVideo("");
      setImageFile(null);
      setVideoFile(null);
      setStickers(false);
      setSendError("");
      clearReply();
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Message was not saved. Please try again.");
    } finally {
      setSending(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void send();
  }

  const handleCustomStickerUpload = async (file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const uploadedUrl = await uploadCommunityMedia(file).catch(() => dataUrl);
      saveCustomSticker(file.name.replace(/\.[^/.]+$/, ""), uploadedUrl || dataUrl);
      refreshCustom();
      setStickerCategory("custom");
    } catch {
      // ignore
    }
  };

  const filteredCommunityStickers = COMMUNITY_STICKERS.filter((s) => {
    if (stickerSearch.trim()) {
      return s.name.toLowerCase().includes(stickerSearch.toLowerCase());
    }
    return s.category === stickerCategory;
  });

  const filteredCustomStickers = customStickers.filter((s) =>
    s.name.toLowerCase().includes(stickerSearch.toLowerCase())
  );

  return (
    <div className="shrink-0 border-t border-rail bg-background px-3 pb-3 pt-2">
      {replyTo && (
        <div className="mb-2 flex items-center justify-between gap-3 rounded-t-md bg-accent/50 px-3 py-1.5 text-xs">
          <span className="min-w-0 truncate text-muted-foreground">
            Replying to <strong className="text-foreground">{replyTo.name}</strong>
          </span>
          <button onClick={clearReply} className="shrink-0 text-muted-foreground hover:text-foreground">
            ×
          </button>
        </div>
      )}

      {(image || video) && (
        <div className="mb-2 flex flex-wrap gap-2">
          {image && (
            <div className="relative">
              <img src={image} alt="Attachment preview" className="h-20 rounded-md object-cover" />
              <button
                onClick={() => { setImage(""); setImageFile(null); }}
                className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-xs"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          {video && (
            <div className="relative">
              <video src={video} className="h-20 rounded-md" />
              <button
                onClick={() => { setVideo(""); setVideoFile(null); }}
                className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-xs"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {stickers && (
        <div className="mb-2.5 rounded-2xl border border-border/80 bg-popover p-3 shadow-xl">
          {/* Header & Search */}
          <div className="mb-2.5 flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-xl bg-input px-3 py-1.5 text-xs">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={stickerSearch}
                onChange={(e) => setStickerSearch(e.target.value)}
                placeholder="Search stickers, emotes, or emojis..."
                className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
              />
              {stickerSearch && (
                <button onClick={() => setStickerSearch("")} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <button
              onClick={() => customStickerRef.current?.click()}
              className="flex shrink-0 items-center gap-1 rounded-xl bg-primary/15 px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/25"
              title="Upload a new custom sticker"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Add Sticker</span>
            </button>
          </div>

          {/* Category Tabs */}
          {!stickerSearch && (
            <div className="mb-3 flex gap-1 overflow-x-auto border-b border-border/50 pb-2 text-xs font-semibold">
              <button
                onClick={() => setStickerCategory("streamer")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-colors ${
                  stickerCategory === "streamer" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                <Sparkles className="h-3 w-3" />
                <span>Streamer Hype</span>
              </button>
              <button
                onClick={() => setStickerCategory("anime")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-colors ${
                  stickerCategory === "anime" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                <Heart className="h-3 w-3" />
                <span>Anime & Chibi</span>
              </button>
              <button
                onClick={() => setStickerCategory("gaming")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-colors ${
                  stickerCategory === "gaming" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                <Gamepad2 className="h-3 w-3" />
                <span>Gaming Memes</span>
              </button>
              <button
                onClick={() => { setStickerCategory("custom"); refreshCustom(); }}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-colors ${
                  stickerCategory === "custom" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                <Star className="h-3 w-3" />
                <span>My Stickers ({customStickers.length})</span>
              </button>
              <button
                onClick={() => setStickerCategory("emojis")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-colors ${
                  stickerCategory === "emojis" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                <span>😀 Emojis</span>
              </button>
            </div>
          )}

          {/* Stickers Grid */}
          <div className="max-h-60 overflow-y-auto">
            {stickerCategory === "custom" && !stickerSearch && (
              <div>
                {!customStickers.length && (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    <p className="font-semibold">No custom stickers added yet.</p>
                    <p className="mt-1">Tap &quot;⭐ Add to stickers&quot; on any sticker in chat, or click &quot;Add Sticker&quot; above to upload your own!</p>
                  </div>
                )}
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {filteredCustomStickers.map((s) => (
                    <div key={s.id} className="group relative flex flex-col items-center rounded-xl p-1.5 hover:bg-accent/70">
                      <button
                        onClick={() => void send({ sticker: s.url })}
                        className="flex flex-col items-center"
                        title={s.name}
                      >
                        <img src={s.url} alt={s.name} className="h-16 w-16 object-contain" />
                        <span className="mt-1 w-16 truncate text-center text-[10px] text-muted-foreground">{s.name}</span>
                      </button>
                      <button
                        onClick={() => { removeCustomSticker(s.id); refreshCustom(); }}
                        className="absolute right-0 top-0 hidden rounded-full bg-destructive p-0.5 text-destructive-foreground shadow group-hover:block"
                        title="Delete from My Stickers"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stickerCategory === "emojis" && !stickerSearch && (
              <div className="grid grid-cols-6 gap-1">
                {[...STICKERS, ...EMOJI_LIBRARY.map(([emoji]) => emoji)].filter((emoji, index, list) => list.indexOf(emoji) === index).map((s) => (
                  <button
                    key={s}
                    onClick={() => void send({ sticker: s })}
                    className="rounded-xl py-2 text-2xl hover:bg-accent/70"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {stickerCategory !== "custom" && stickerCategory !== "emojis" && (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {filteredCommunityStickers.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => void send({ sticker: s.url })}
                    className="flex flex-col items-center rounded-xl p-2 transition-transform hover:scale-105 hover:bg-accent/70"
                    title={s.name}
                  >
                    <img src={s.url} alt={s.name} className="h-16 w-16 object-contain" />
                    <span className="mt-1 w-16 truncate text-center text-[10px] text-muted-foreground">{s.name}</span>
                  </button>
                ))}
              </div>
            )}

            {stickerSearch && (
              <div>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {filteredCommunityStickers.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => void send({ sticker: s.url })}
                      className="flex flex-col items-center rounded-xl p-2 transition-transform hover:scale-105 hover:bg-accent/70"
                      title={s.name}
                    >
                      <img src={s.url} alt={s.name} className="h-16 w-16 object-contain" />
                      <span className="mt-1 w-16 truncate text-center text-[10px] text-muted-foreground">{s.name}</span>
                    </button>
                  ))}
                  {filteredCustomStickers.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => void send({ sticker: s.url })}
                      className="flex flex-col items-center rounded-xl p-2 transition-transform hover:scale-105 hover:bg-accent/70"
                      title={s.name}
                    >
                      <img src={s.url} alt={s.name} className="h-16 w-16 object-contain" />
                      <span className="mt-1 w-16 truncate text-center text-[10px] text-muted-foreground">{s.name}</span>
                    </button>
                  ))}
                </div>
                {/* Search in Emojis */}
                <div className="mt-3 border-t border-border/50 pt-2">
                  <p className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">Emojis</p>
                  <div className="grid grid-cols-6 gap-1">
                    {EMOJI_LIBRARY.filter(([, name]) => name.includes(stickerSearch.toLowerCase())).map(([emoji]) => (
                      <button
                        key={emoji}
                        onClick={() => void send({ sticker: emoji })}
                        className="rounded-xl py-2 text-2xl hover:bg-accent/70"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {authors.length > 1 && (
        <select
          value={authorId}
          onChange={(e) => setAuthorId(e.target.value)}
          className="mb-2 w-full rounded-xl bg-input px-3 py-1.5 text-xs font-semibold text-foreground/90 outline-none"
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
        className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2 rounded-full bg-input px-2.5 py-1.5 shadow-inner"
      >
        <button
          type="button"
          aria-label="Upload image"
          onClick={() => imageRef.current?.click()}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-muted-foreground transition-colors hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Upload video"
          onClick={() => videoRef.current?.click()}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-muted-foreground transition-colors hover:text-foreground"
        >
          <VideoIcon className="h-4 w-4" />
        </button>
        <input
          value={text}
          onChange={(e) => { const value = e.target.value; setText(value); onTyping?.(value.trim().length > 0); }}
          placeholder={`Message #${channel}`}
          className="min-w-0 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
        />
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            aria-label="Stickers & Emotes"
            onClick={() => setStickers((v) => !v)}
            className={`grid h-8 w-8 place-items-center rounded-full transition-colors ${
              stickers ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Smile className="h-4 w-4" />
          </button>
          <button
            type="submit"
            aria-label="Send message"
            disabled={sending}
            className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground shadow-xs transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
      {sending && <p className="mt-1 px-2 text-xs text-muted-foreground">Uploading media…</p>}
      {sendError && <p className="mt-1 px-2 text-xs font-semibold text-destructive">{sendError}</p>}

      <input
        ref={imageRef}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => { const file = e.target.files?.[0] ?? null; setImageFile(file); setImage(await readFileAsDataUrl(file)); }}
      />
      <input
        ref={videoRef}
        type="file"
        accept="video/*"
        hidden
        onChange={async (e) => { const file = e.target.files?.[0] ?? null; setVideoFile(file); setVideo(await readFileAsDataUrl(file)); }}
      />
      <input
        ref={customStickerRef}
        type="file"
        accept="image/*,.gif"
        hidden
        onChange={(e) => void handleCustomStickerUpload(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
