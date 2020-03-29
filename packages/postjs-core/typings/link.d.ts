import { CSSProperties, PropsWithChildren } from 'react';
interface LinkProps {
    to: string;
    as?: string;
    className?: string;
    style?: CSSProperties;
    replace?: boolean;
    prefetch?: boolean;
}
export declare function Link({ to, as, className, style, replace, children }: PropsWithChildren<LinkProps>): JSX.Element;
interface NavLinkProps extends LinkProps {
    activeClassName?: string;
    activeStyle?: CSSProperties;
}
export declare function NavLink({ activeClassName, activeStyle, ...rest }: PropsWithChildren<NavLinkProps>): JSX.Element;
export {};
