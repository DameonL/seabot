export function capitalize(string: string) {
  return `${string[0].toUpperCase()}${string.substring(1)}`;
}

export function toTitleCase(string: string) {
  const splitString = string.split(" ");
  const doNotTitle = [
    "a",
    "an",
    "the",
    "and",
    "as",
    "but",
    "for",
    "if",
    "nor",
    "or",
    "so",
    "yet",
    "at",
    "by",
    "in",
    "of",
    "off",
    "on",
    "per",
    "to",
    "up",
    "via",
  ];
  for (let i = 0; i < splitString.length; i++) {
    if (i > 0 && doNotTitle.includes(splitString[i])) continue;

    splitString[i] = capitalize(splitString[i]);
  }
  return splitString.join(" ");
}