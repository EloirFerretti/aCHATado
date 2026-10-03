const roles: Record<string, { label: string; title: string }> = {
  owner: { label: "DONO", title: "Dono do canal do YouTube" },
  moderator: { label: "MOD", title: "Moderador do YouTube" },
  member: { label: "MEMBRO", title: "Membro do canal do YouTube" },
  verified: { label: "✓", title: "Canal verificado no YouTube" },
};

// The YouTube API supplies role flags, not membership badge artwork.
// Render those real roles without inventing an official badge image.
export function YouTubeBadges({ badges }: { badges: unknown[] }) {
  const names = Array.from(
    new Set(
      badges.flatMap((badge) => {
        if (typeof badge === "string") return [badge];
        if (
          badge &&
          typeof badge === "object" &&
          "type" in badge &&
          typeof badge.type === "string"
        )
          return [badge.type];
        return [];
      }),
    ),
  ).filter((name) => roles[name]);
  if (!names.length) return null;
  return (
    <span className="userBadges youtubeBadges" aria-label="Badges do YouTube">
      {names.map((name) => (
        <span
          className={`youtubeRoleBadge ${name}`}
          key={name}
          title={roles[name].title}
          aria-label={roles[name].title}
        >
          {roles[name].label}
        </span>
      ))}
    </span>
  );
}
