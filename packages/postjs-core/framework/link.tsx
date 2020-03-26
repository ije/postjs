import React, { CSSProperties, PropsWithChildren, useCallback } from 'react'

interface LinkProps {
    to: string
    as?: string
    className?: string
    style?: CSSProperties
    replace?: boolean
}

export function Link({
    to,
    as,
    className,
    style,
    replace,
    children
}: PropsWithChildren<LinkProps>) {
    const onClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault()
        if (replace) {
            history.replaceState(null, '', to)
        } else {
            history.pushState(null, '', to)
        }
    }, [to, replace])

    return (
        <a
            className={className}
            style={style}
            href={as || to}
            onClick={onClick}
        >{children}</a>
    )
}

interface NavLinkProps extends LinkProps {
    activeClassName?: string
    activeStyle?: CSSProperties
}

export function NavLink({
    activeClassName,
    activeStyle,
    ...rest
}: PropsWithChildren<NavLinkProps>) {
    return (
        <Link {...rest} />
    )
}
