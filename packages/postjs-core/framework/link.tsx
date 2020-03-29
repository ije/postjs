import React, { CSSProperties, PropsWithChildren, useCallback } from 'react'
import { useRouter } from './router'

interface LinkProps {
    to: string
    as?: string
    className?: string
    style?: CSSProperties
    replace?: boolean
    prefetch?: boolean
}

export function Link({
    to,
    as,
    className,
    style,
    replace,
    children
}: PropsWithChildren<LinkProps>) {
    const router = useRouter()
    const onClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault()
        // todo: load page component/static data
        if (replace) {
            router.replace(to, as)
        } else {
            router.push(to, as)
        }
    }, [to, as, replace])
    const onMouseEnter = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {

    }, [to])

    return (
        <a
            className={className}
            style={style}
            href={as || to}
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
