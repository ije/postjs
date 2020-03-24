import { PropsWithChildren } from 'react';
export declare function Head({ children }: PropsWithChildren<{}>): null;
export declare function renderHeadToString(spaces?: number): string;
interface SEOProps {
    title: string;
    description: string;
    keywords: string;
    image?: string;
    url?: string;
}
export declare const SEO: ({ title, description, keywords, url, image }: SEOProps) => JSX.Element;
export {};
