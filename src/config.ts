// Site-wide constants. Edit here; components read from this file.

export const SITE = {
  name: 'Joseph Bejjani',
  url: 'https://josephbejjani.com',
  description:
    'Joseph Bejjani is a PhD student in computer science at the University of Toronto, working on AI alignment.',
  // Written in [at] form on purpose. The real address must never appear in the build.
  email: 'jbejjani[at]cs.toronto.edu',
};

export type NavItem = { label: string; href: string; external?: boolean };

export const NAV: NavItem[] = [
  { label: 'About', href: '/about/' },
  { label: 'Research', href: '/research/' },
  { label: 'Projects', href: '/projects/' },
  { label: 'Blog', href: '/blog/' },
  { label: 'Music', href: '/music/' },
  { label: 'Into the Fog', href: '/intothefog/', external: true },
];

export type Social = {
  icon: 'mail' | 'linkedin' | 'x' | 'github';
  label: string;
  text: string;
  href?: string;
};

export const SOCIALS: Social[] = [
  { icon: 'mail', label: 'Email', text: SITE.email },
  { icon: 'linkedin', label: 'LinkedIn', text: 'jbejjani4', href: 'https://www.linkedin.com/in/jbejjani4/' },
  { icon: 'x', label: 'X', text: 'jbejjani2022', href: 'https://x.com/jbejjani2022' },
  { icon: 'github', label: 'GitHub', text: 'jbejjani2022', href: 'https://github.com/jbejjani2022' },
];
