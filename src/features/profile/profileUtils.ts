const IDENTITY_KEYS = ["email", "phone", "linkedin_url", "github_url", "website_url", "city"] as const;

export type ProfileTextType = "education" | "certification" | "achievement";

type ProfileRecord = Record<string, unknown>;

const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const asRecord = (value: unknown): ProfileRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? value as ProfileRecord : {};

const textOrEmpty = (value: unknown): string => {
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "";
};

const joinedLabel = (values: unknown[], separator: string): string =>
  values.map(textOrEmpty).filter(Boolean).join(separator);

export const entryTitle = (item: unknown): string =>
  typeof item === "string"
    ? item
    : textOrEmpty(
        asRecord(item).title
        || asRecord(item).name
        || asRecord(item).n
        || joinedLabel([asRecord(item).role, asRecord(item).co], " at ")
        || asRecord(item).id
        || "",
      );

export const profileDeleteKey = (item: unknown): string => {
  if (typeof item === "string") return item;
  const source = asRecord(item);
  return String(source.id || entryTitle(source));
};

export function normalizeProfileResponse(data: unknown) {
  const source = asRecord(data);
  const identitySource = asRecord(source.identity);
  const identity = Object.fromEntries(
    IDENTITY_KEYS.map(key => [key, String(identitySource[key] || source[key] || "")]),
  );

  return {
    ...source,
    n: String(source.n || ""),
    s: String(source.s || ""),
    skills: asArray(source.skills),
    projects: asArray(source.projects),
    exp: asArray(source.exp),
    education: asArray(source.education),
    certifications: asArray(source.certifications || source.certs),
    achievements: asArray(source.achievements || source.awards),
    identity,
  };
}

export function profileDeletePath(type: string, idOrTitle: string) {
  return `/api/v1/profile/${type}/${encodeURIComponent(idOrTitle)}`;
}

const cleanDeleteToken = (value: unknown): string => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    return decodeURIComponent(raw).trim().toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
};

const deleteTokenMatches = (target: string, values: unknown[]) =>
  values.some(value => cleanDeleteToken(value) === target);

export function removeProfileItem(profile: unknown, type: string, idOrTitle: string) {
  const next = normalizeProfileResponse(profile);
  const target = cleanDeleteToken(idOrTitle);
  if (!target) return next;

  const keepStructured = (item: unknown, values: unknown[]) => {
    const source = asRecord(item);
    return !deleteTokenMatches(target, [
      profileDeleteKey(item),
      entryTitle(item),
      source.id,
      ...values,
    ]);
  };
  const keepTextEntry = (item: unknown) => !deleteTokenMatches(target, [profileDeleteKey(item), entryTitle(item), item]);

  if (type === "skill") {
    next.skills = next.skills.filter((item) => {
      const source = asRecord(item);
      return keepStructured(item, [source.n, source.name, source.title]);
    });
  } else if (type === "experience") {
    next.exp = next.exp.filter((item) => {
      const source = asRecord(item);
      return keepStructured(item, [
        source.role,
        source.co,
        joinedLabel([source.role, source.co], " at "),
        joinedLabel([source.role, source.co], " - "),
      ]);
    });
  } else if (type === "project") {
    next.projects = next.projects.filter((item) => {
      const source = asRecord(item);
      return keepStructured(item, [source.title, source.name]);
    });
  } else if (type === "education") {
    next.education = next.education.filter(keepTextEntry);
  } else if (type === "certification") {
    next.certifications = next.certifications.filter(keepTextEntry);
  } else if (type === "achievement") {
    next.achievements = next.achievements.filter(keepTextEntry);
  }

  return next;
}
