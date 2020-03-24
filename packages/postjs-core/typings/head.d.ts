import { PropsWithChildren } from 'react';
export declare function renderHeadToString(spaces?: number): string;
export declare function Head({ children }: PropsWithChildren<{}>): JSX.Element;
interface SEOProps {
    title: string;
    description: string;
    keywords: string;
    image?: string;
    url?: string;
}
export declare function SEO({ title, description, keywords, url, image }: SEOProps): JSX.Element;
export {};
