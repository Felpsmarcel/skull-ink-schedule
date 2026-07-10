import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import {
  getMyArtistProfile,
  updateArtistProfile,
  uploadArtistAvatar,
} from "@/lib/onboarding.functions";

const SPECIALTIES = [
  "Fine line",
  "Blackwork",
  "Realismo",
  "Colorido",
  "Oriental",
  "Lettering",
  "Cover-up",
  "Geométrico",
  "Old school",
];

export const Route = createFileRoute("/_authenticated/onboarding/perfil")({
  head: () => ({ meta: [{ title: "Seu perfil — GF Tattoo Studio" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: ProfileStep,
});

function ProfileStep() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getMyArtistProfile);
  const saveProfile = useServerFn(updateArtistProfile);
  const uploadFn = useServerFn(uploadArtistAvatar);

  const { data: profile } = useQuery({ queryKey: ["my-artist-profile"], queryFn: () => fetchProfile() });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name ?? "");
    setPhone(profile.phone ?? "");
    setBio(profile.bio ?? "");
    setAvatarUrl(profile.avatar_url);
    setSelected(profile.specialties ?? []);
  }, [profile]);

  const mutation = useMutation({
    mutationFn: () =>
      saveProfile({
        data: {
          name: name.trim(),
          phone: phone.trim(),
          bio: bio.trim() || null,
          avatar_url: avatarUrl,
          specialties: selected,
        },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["my-artist-profile"] });
      navigate({ to: "/onboarding/disponibilidade" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4_000_000) {
      toast.error("Arquivo maior que 4MB.");
      return;
    }
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const bin = String.fromCharCode(...new Uint8Array(buf));
      const base64 = btoa(bin);
      const ext = file.name.split(".").pop() || "jpg";
      const res = await uploadFn({
        data: { file_base64: base64, content_type: file.type || "image/jpeg", extension: ext },
      });
      if (res.url) setAvatarUrl(res.url);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const canSubmit = name.trim().length >= 2 && phone.trim().length >= 6 && !mutation.isPending;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) mutation.mutate();
      }}
      className="space-y-5"
    >
      <Toaster position="top-center" />
      <div>
        <h1 className="text-xl font-bold">Seu perfil</h1>
        <p className="text-sm text-muted-foreground">Como você aparece para clientes e equipe.</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-muted text-lg font-bold">
          {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : (name || "?").slice(0, 2).toUpperCase()}
        </div>
        <label className="cursor-pointer">
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
          <span className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs uppercase tracking-wider hover:bg-muted">
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Foto
          </span>
        </label>
      </div>

      <div className="space-y-1">
        <Label htmlFor="name">Nome público</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="phone">Telefone / WhatsApp</Label>
        <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} required minLength={6} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="bio">Bio curta</Label>
        <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={500} />
      </div>

      <div className="space-y-2">
        <Label>Especialidades</Label>
        <div className="flex flex-wrap gap-2">
          {SPECIALTIES.map((s) => {
            const active = selected.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() =>
                  setSelected((prev) => (active ? prev.filter((x) => x !== s) : [...prev, s]))
                }
                className={`rounded-full border px-3 py-1 text-xs ${active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:bg-muted"}`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={!canSubmit}>
        {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Continuar
      </Button>
    </form>
  );
}