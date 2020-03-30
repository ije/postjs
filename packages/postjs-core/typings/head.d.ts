import { PropsWithChildren } from 'react';
export declare function Head({ children }: PropsWithChildren<{}>): null;
export declare function renderHeadToString(): string[];
interface SEOProps {
    title: string;
    description: string;
    keywords: string;
    image?: string;
    url?: string;
}
export declare function SEO({ title, description, keywords, url, image }: SEOProps): JSX.Element;
export {};
