import { Helmet } from "react-helmet-async";

const SITE_NAME = "CtrlTrade®";
const BASE_URL = "https://ctrltrade.co.uk";
const DEFAULT_IMAGE = `${BASE_URL}/opengraph.jpg`;

interface PageHeadProps {
  title: string;
  description: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  noIndex?: boolean;
}

export function PageHead({
  title,
  description,
  canonical,
  ogTitle,
  ogDescription,
  ogImage = DEFAULT_IMAGE,
  noIndex = false,
}: PageHeadProps) {
  const fullTitle = `${title} | ${SITE_NAME}`;
  const resolvedOgTitle = ogTitle ?? title;
  const resolvedOgDescription = ogDescription ?? description;
  const resolvedCanonical = canonical ? `${BASE_URL}${canonical}` : undefined;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noIndex ? <meta name="robots" content="noindex, nofollow" /> : null}
      {resolvedCanonical ? <link rel="canonical" href={resolvedCanonical} /> : null}
      {resolvedCanonical ? <meta property="og:url" content={resolvedCanonical} /> : null}
      <meta property="og:title" content={resolvedOgTitle} />
      <meta property="og:description" content={resolvedOgDescription} />
      <meta property="og:image" content={ogImage} />
      <meta name="twitter:title" content={resolvedOgTitle} />
      <meta name="twitter:description" content={resolvedOgDescription} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  );
}
