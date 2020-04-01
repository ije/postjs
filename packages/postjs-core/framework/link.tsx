import React, { CSSProperties, PropsWithChildren, useCallback, useEffect, useMemo } from 'react'
import { prefetchPage, redirect } from './router'
import utils from './utils'

interface LinkProps {
    to: string
    as?: string
    className?: string
    style?: CSSProperties
    replace?: boolean
    prefetch?: boolean
}

export function Link({
    to: toProp,
    as: asProp,
    className,
    style,
    replace,
    prefetch,
    children
}: PropsWithChildren<LinkProps>) {
    const pagePath = useMemo(() => utils.cleanPath(toProp), [toProp])
    const asPath = useMemo(() => utils.isNEString(asProp) ? utils.cleanPath(asProp) : undefined, [asProp])
    const onClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault()
        redirect(pagePath, asPath, replace)
    }, [pagePath, asPath, replace])
    const onMouseEnter = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
        prefetchPage(pagePath)
    }, [pagePath])

    useEffect(() => {
        if (prefetch) {
            prefetchPage(pagePath)
        }
    }, [prefetch, pagePath])

    return (
        <a
            className={className}
            style={style}
            href={asPath || pagePath}
            onClick={onClick}
            onMouseEnter={onMouseEnter}
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
