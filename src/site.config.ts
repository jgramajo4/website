export const SITE_URL = "https://gramajo.xyz";
export const SITE_TITLE = "gramajo";
export const SITE_TAGLINE =
	"Legal ops at Asana · Nouns DAO builder · Founder of 0773H";
export const SITE_DESCRIPTION =
	"Juan Gramajo — legal ops at Asana, Nouns DAO builder, founder of 0773H. Bay Area, California.";

export type NavLink = {
  label: string;
  href: string;
};

export const NAV_LINKS: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Blog", href: "/blog" },
  { label: "Photos", href: "/photos" },
  { label: "Projects", href: "/projects" },
  { label: "Now", href: "/now" },
  { label: "Feeds", href: "/feeds" },
  { label: "About", href: "/about" },
  { label: "Donate", href: "/donate" },
];
