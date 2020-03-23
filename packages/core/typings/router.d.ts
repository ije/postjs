/// <reference types="node" />
import React, { PropsWithChildren } from 'react';
import { ParsedUrlQuery } from 'querystring';
export interface URL {
    routePath: string;
    pathname: string;
    params: Record<string, string>;
    query: ParsedUrlQuery;
}
export interface Route {
    path: string;
    component: React.ComponentType;
    isExact?: boolean;
}
export declare class Router {
    routePath: string;
    pathname: string;
    params: Record<string, string>;
    query: ParsedUrlQuery;
    constructor(url?: URL);
    get url(): URL;
    push(url: string, as?: string): void;
    replace(url: string, as?: string): void;
}
export declare const RouterContext: React.Context<Router>;
export declare function useRouter(): Router;
interface RouterComponentProps {
    base: string;
    routes: Route[];
}
export declare function RouterComponent({ base: propBase, routes, children }: PropsWithChildren<RouterComponentProps>): JSX.Element;
export {};
