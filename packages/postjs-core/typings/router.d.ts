/// <reference types="node" />
import { ParsedUrlQuery } from 'querystring';
import { ComponentType } from 'react';
export interface URL {
    pagePath: string;
    pathname: string;
    params: Record<string, string>;
    query: ParsedUrlQuery;
}
export interface Route {
    path: string;
    component: ComponentType<any>;
}
export declare class RouterStore {
    private _url;
    constructor(url?: URL);
    get url(): URL;
    push(url: string, as?: string): void;
    replace(url: string, as?: string): void;
}
export declare const RouterContext: import("react").Context<RouterStore>;
export declare function useRouter(): RouterStore;
export declare function route(base: string, routes: Route[], options?: {
    location?: {
        pathname: string;
        search?: string;
    };
    fallback?: Route;
}): [URL, ComponentType<any> | null];
