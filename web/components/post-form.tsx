"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { useController, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { apiFetch } from "@/lib/api";
import { isCountryCode } from "@/lib/countries";
import { findCoordinates, type Coordinates } from "@/lib/geocode";
import { readMediaMeta } from "@/lib/media-meta";
import { formatCoordinates, MAX_MEDIA, MEDIA_RULES, uploadFiles, type Post } from "@/lib/posts";
import { CountryPicker } from "./country-picker";
import { Button, buttonStyles, Field, FormError, Input, Textarea } from "./ui";

const schema = z
  .object({
    title: z.string().trim().min(1, "Give your trip a title").max(120, "At most 120 characters"),
    caption: z.string().trim().max(2200, "At most 2200 characters"),
    country: z.string().regex(/^[A-Z]{2}$/, "Choose a country"),
    city: z.string().trim().min(1, "Enter the city").max(80),
    tripStart: z.string().min(1, "When did the trip start?"),
    tripEnd: z.string().min(1, "When did it end?"),
  })
  .refine((values) => values.tripEnd >= values.tripStart, {
    path: ["tripEnd"],
    message: "The end can’t be before the start",
  });

type Values = z.infer<typeof schema>;

/** The post's files in display order, the first being the cover: files already on the post, and new local ones. */
type Item = { id: string; kind: "kept"; media: Post["media"][number] } | { id: string; kind: "new"; file: File };

/** Coordinates found for one place; they don't carry over once the city or country changes. */
type Found = Coordinates & { place: string };

const MB = 1024 * 1024;
let nextItemId = 0;
const placeOf = (country: string, city: string) => `${country}|${city.trim().toLowerCase()}`;

/**
 * Creates or edits a post. New files go straight to MinIO on submit (P2),
 * with a progress bar; files already on the post are kept by key.
 */
export function PostForm({
  post,
  cancelHref,
  onSaved,
}: {
  post?: Post;
  cancelHref: string;
  onSaved: (post: Post) => void;
}) {
  const [items, setItems] = useState<Item[]>(
    () => post?.media.map((media): Item => ({ id: media.key, kind: "kept", media })) ?? [],
  );
  const [mediaError, setMediaError] = useState<string>();
  // Keys of files already uploaded, so retrying a failed save doesn't upload them again.
  const [uploadedKeys, setUploadedKeys] = useState(() => new Map<File, string>());
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null);
  const [found, setFound] = useState<Found | null>(() =>
    post?.location.lat !== undefined && post.location.lng !== undefined
      ? { lat: post.location.lat, lng: post.location.lng, place: placeOf(post.location.country, post.location.city) }
      : null,
  );
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: post?.title ?? "",
      caption: post?.caption ?? "",
      // Posts from before country codes kept free text (P1); those pick a country again.
      country: post && isCountryCode(post.location.country) ? post.location.country : "",
      city: post?.location.city ?? "",
      tripStart: post?.tripStart ?? "",
      tripEnd: post?.tripEnd ?? "",
    },
  });
  const [country, city, tripStart] = useWatch({ control, name: ["country", "city", "tripStart"] });
  const { field: countryField } = useController({ control, name: "country" });
  const coordinates = found && found.place === placeOf(country, city) ? found : null;

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: Object.fromEntries(
      Object.entries(MEDIA_RULES).map(([type, rule]) => [type, rule.extensions]),
    ),
    onDrop: (accepted: File[], rejected: FileRejection[]) => {
      // Dropzone also accepts by extension, so a file's reported type may still be one we don't take.
      const known = accepted.filter((file) => file.type in MEDIA_RULES);
      const tooBig = known.filter((file) => file.size > MEDIA_RULES[file.type].maxBytes);
      const fitting = known.filter((file) => !tooBig.includes(file));
      const room = MAX_MEDIA - items.length;
      const problems = [
        (rejected.length > 0 || known.length < accepted.length) &&
          "Only JPEG, PNG and WebP photos or MP4, WebM and MOV videos",
        tooBig.length > 0 && "Photos can be at most 10 MB, videos 100 MB",
        fitting.length > room && `A post can have at most ${MAX_MEDIA} files`,
      ].filter(Boolean);
      setMediaError(problems.length > 0 ? `${problems.join(". ")}.` : undefined);
      const added = fitting.slice(0, Math.max(room, 0));
      // Colour and size are read while the user fills in the rest.
      added.forEach((file) => void readMediaMeta(file));
      setItems((current) => [...current, ...added.map((file): Item => ({ id: `new-${nextItemId++}`, kind: "new", file }))]);
    },
  });

  function move(from: number, to: number) {
    setItems((current) => {
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  const onSubmit = handleSubmit(async (values: Values) => {
    if (items.length === 0) {
      setMediaError("Add at least one photo or video.");
      return;
    }
    try {
      const pending = items.flatMap((item) => (item.kind === "new" && !uploadedKeys.has(item.file) ? [item.file] : []));
      const total = pending.reduce((sum, file) => sum + file.size, 0);
      setProgress(total > 0 ? { sent: 0, total } : null);
      const keys = new Map(uploadedKeys);
      (await uploadFiles(pending, (sent) => setProgress({ sent, total }))).forEach((key, index) =>
        keys.set(pending[index], key),
      );
      setUploadedKeys(keys);
      const media = await Promise.all(
        items.map(async (item) =>
          item.kind === "kept"
            ? { key: item.media.key }
            : { key: keys.get(item.file)!, ...(await readMediaMeta(item.file)) },
        ),
      );
      const body = {
        title: values.title,
        caption: values.caption,
        location: {
          country: values.country,
          city: values.city,
          ...(coordinates && { lat: coordinates.lat, lng: coordinates.lng }),
        },
        tripStart: values.tripStart,
        tripEnd: values.tripEnd,
        media,
      };
      const saved = await apiFetch<Post>(post ? `/api/posts/${post.id}` : "/api/posts", {
        method: post ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      onSaved(saved);
    } catch (error) {
      setError("root", {
        message: error instanceof Error ? error.message : "Something went wrong",
      });
    } finally {
      setProgress(null);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <p className="text-xs opacity-60">
        <span className="text-trail">*</span> Required
      </p>
      <FormError message={errors.root?.message} />
      <Field label="Title" required error={errors.title?.message}>
        <Input {...register("title")} placeholder="Three days in Lisbon" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Country" required error={errors.country?.message}>
          <CountryPicker
            value={countryField.value}
            onChange={countryField.onChange}
            onBlur={countryField.onBlur}
            invalid={errors.country !== undefined}
          />
        </Field>
        <Field label="City" required error={errors.city?.message}>
          <Input {...register("city")} placeholder="Lisbon" />
        </Field>
      </div>
      <MapLocation country={country} city={city} coordinates={coordinates} onFound={setFound} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Trip start" required error={errors.tripStart?.message}>
          <Input type="date" {...register("tripStart")} />
        </Field>
        <Field label="Trip end" required error={errors.tripEnd?.message}>
          <Input type="date" min={tripStart || undefined} {...register("tripEnd")} />
        </Field>
      </div>
      <Field label="Story" optional error={errors.caption?.message}>
        <Textarea {...register("caption")} rows={5} />
      </Field>

      <div className="flex flex-col gap-2 text-sm">
        <span className="font-medium">
          Photos and videos <span className="text-trail" aria-hidden>*</span>{" "}
          <span className="font-normal opacity-60">
            ({items.length}/{MAX_MEDIA}) · the first one is the cover
          </span>
        </span>
        <MediaItems
          items={items}
          onMove={move}
          onRemove={(index) => setItems((current) => current.filter((_, i) => i !== index))}
        />
        {items.length < MAX_MEDIA && (
          <div
            {...getRootProps()}
            className={`cursor-pointer rounded-md border-2 border-dashed p-6 text-center ${isDragActive ? "border-neutral-900 dark:border-neutral-100" : "border-neutral-300 dark:border-neutral-700"}`}
          >
            <input {...getInputProps()} />
            Drop photos or videos here, or click to choose
            <span className="block opacity-60">Photos up to 10 MB, videos up to 100 MB</span>
          </div>
        )}
        {mediaError && <span className="text-red-600 dark:text-red-400">{mediaError}</span>}
      </div>

      {progress && <UploadProgress {...progress} />}
      <div className="flex items-center justify-end gap-2">
        <Link href={cancelHref} className={buttonStyles("ghost")}>
          Cancel
        </Link>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (progress ? "Uploading…" : "Saving…") : post ? "Save changes" : "Publish"}
        </Button>
      </div>
    </form>
  );
}

/** Optional coordinates, looked up from the city instead of typed in (P1). */
function MapLocation({
  country,
  city,
  coordinates,
  onFound,
}: {
  country: string;
  city: string;
  coordinates: Coordinates | null;
  onFound: (found: Found | null) => void;
}) {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string>();
  const ready = country !== "" && city.trim() !== "";

  async function locate() {
    setLocating(true);
    setError(undefined);
    try {
      const result = await findCoordinates(city.trim(), country);
      if (result) {
        onFound({ ...result, place: placeOf(country, city) });
      } else {
        setError(`Couldn’t find ${city.trim()} on the map.`);
      }
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : "The location lookup failed");
    } finally {
      setLocating(false);
    }
  }

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="font-medium">
        Map location <span className="font-normal opacity-60">(optional)</span>
      </span>
      {coordinates ? (
        <p className="flex flex-wrap items-center gap-3">
          <span>
            📍 <span className="font-mono">{formatCoordinates(coordinates.lat, coordinates.lng)}</span>
          </span>
          <a
            href={`https://www.openstreetmap.org/?mlat=${coordinates.lat}&mlon=${coordinates.lng}#map=11/${coordinates.lat}/${coordinates.lng}`}
            target="_blank"
            rel="noreferrer"
            className="underline opacity-70 hover:opacity-100"
          >
            View on map
          </a>
          <Button type="button" variant="ghost" className="px-2 py-1" onClick={() => onFound(null)}>
            Remove
          </Button>
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" onClick={() => void locate()} disabled={!ready || locating}>
            {locating ? "Finding…" : "Find on map"}
          </Button>
          <span className="opacity-60">
            {ready ? "Pins the post to the city’s centre." : "Choose the country and city first."}
          </span>
        </div>
      )}
      {error && <span className="text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}

function MediaItems({
  items,
  onMove,
  onRemove,
}: {
  items: Item[];
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
}) {
  if (items.length === 0) {
    return null;
  }
  return (
    <ul className="grid grid-cols-3 gap-2">
      {items.map((item, index) => (
        <li key={item.id} className="relative overflow-hidden rounded-md">
          {item.kind === "kept" ? (
            <Preview url={item.media.url} video={item.media.type === "video"} color={item.media.color} />
          ) : (
            <FilePreview file={item.file} />
          )}
          {index === 0 && (
            <span className="absolute top-1 left-1 rounded bg-trail px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
              Cover
            </span>
          )}
          <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/60 text-white">
            <TileButton label="Move earlier" disabled={index === 0} onClick={() => onMove(index, index - 1)}>
              ←
            </TileButton>
            <TileButton label="Make cover" disabled={index === 0} onClick={() => onMove(index, 0)}>
              ★
            </TileButton>
            <TileButton
              label="Move later"
              disabled={index === items.length - 1}
              onClick={() => onMove(index, index + 1)}
            >
              →
            </TileButton>
            <TileButton label="Remove" onClick={() => onRemove(index)}>
              ×
            </TileButton>
          </div>
        </li>
      ))}
    </ul>
  );
}

function TileButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex-1 py-1 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

// A local preview for a file that hasn't been uploaded yet.
function FilePreview({ file }: { file: File }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <Preview url={url} video={file.type.startsWith("video/")} />;
}

function Preview({ url, video, color }: { url: string; video: boolean; color?: string }) {
  return video ? (
    <video src={url} muted preload="metadata" className="aspect-square w-full bg-black object-cover" />
  ) : (
    <img src={url} alt="" className="aspect-square w-full object-cover" style={{ backgroundColor: color }} />
  );
}

function UploadProgress({ sent, total }: { sent: number; total: number }) {
  const megabytes = (bytes: number) => (bytes / MB).toFixed(1);
  return (
    <div className="flex flex-col gap-1 text-sm">
      <div
        role="progressbar"
        aria-label="Upload progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={sent}
        className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
      >
        <div className="h-full bg-trail transition-[width]" style={{ width: `${(sent / total) * 100}%` }} />
      </div>
      <span className="opacity-70">
        Uploading {megabytes(sent)} of {megabytes(total)} MB
      </span>
    </div>
  );
}
