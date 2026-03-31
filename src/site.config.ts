export const SITE_URL = "https://gramajo.xyz";
export const SITE_TITLE = "gramajo";
export const SITE_TAGLINE =
  "Internet Archaeologist. Michelada Connoisseur. Founder of 0773H.";
export const SITE_DESCRIPTION =
  "Personal website for Gramajo — internet archaeologist, crypto/web3 researcher, and founder of 0773H.";

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
];
