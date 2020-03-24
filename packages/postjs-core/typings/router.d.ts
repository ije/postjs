/// <reference types="node" />
import React, { PropsWithChildren } from 'react';
import { ParsedUrlQuery } from 'querystring';
export interface URL {
    routePath: string;
    pathname: string;
    params: Record<string, string>;
    query: ParsedUrlQuery;
}
export declare class RouterStore {
    private _url;
    constructor(url?: URL);
    get url(): URL;
    push(url: string, as?: string): void;
    replace(url: string, as?: string): void;
}
export declare const RouterContext: React.Context<RouterStore>;
export declare function useRouter(): RouterStore;
export interface Route {
    path: string;
    component: React.ComponentType;
}
interface RouterProps {
    base: string;
    routes: Route[];
}
export declare function Router({ base, routes, children }: PropsWithChildren<RouterProps>): JSX.Element;
export declare function matchPath(routePath: string, locPath: string): Record<string, string> | null;
export {};
