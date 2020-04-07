import React, { Children, cloneElement, CSSProperties, isValidElement, PropsWithChildren, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from './router/context'
import { fetchPage } from './router/fetch'
import { redirect } from './router/redirect'
import { PageTransition } from './router/transition'
import utils from './utils'

interface LinkProps {
    to: string
    as?: string
    className?: string
    style?: CSSProperties
    replace?: boolean
    prefetch?: boolean
    transition?: string | PageTransition
}

export function Link({
    to: toProp,
    as: asProp,
    className,
    style,
    replace,
    prefetch,
    transition,
    children
}: PropsWithChildren<LinkProps>) {
    const router = useRouter()
    const pagePath = useMemo(() => utils.cleanPath(toProp), [toProp])
    const asPath = useMemo(() => utils.isNEString(asProp) ? utils.cleanPath(asProp) : undefined, [asProp])
    const onClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault()
        if (router.pagePath !== pagePath) {
            redirect(pagePath, asPath, replace, transition).catch(err => {
                alert(`can't load page '${pagePath}': ${err.message || err}`)
            })
        }
    }, [pagePath, asPath, replace, router])
    const onMouseEnter = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
        fetchPage(pagePath)
    }, [pagePath])

    useEffect(() => {
        if (prefetch) {
            fetchPage(pagePath)
        }
    }, [prefetch, pagePath])

    if (Children.count(children) === 1) {
        const child = Children.toArray(children)[0]
        if (isValidElement(child) && child.type === 'a') {
            const { props } = child
            return cloneElement(child, {
                ...props,
                className: [className, props.className].filter(utils.isNEString).join(' ') || undefined,
                style: Object.assign({}, style, props.style),
                href: asPath || pagePath,
                'aria-current': props['aria-current'] || 'page',
                onClick: (e: React.MouseEvent<HTMLAnchorElement>) => {
                    if (utils.isFunction(props.onClick)) {
                        props.onClick(e)
                    }
                    if (!e.defaultPrevented) {
                        onClick(e)
                    }
                },
                onMouseEnter: (e: React.MouseEvent<HTMLAnchorElement>) => {
                    if (utils.isFunction(props.onMouseEnter)) {
                        props.onMouseEnter(e)
                    }
                    if (!e.defaultPrevented) {
                        onMouseEnter(e)
                    }
                }
            })
        }
    }

    return (
        <a
            className={className}
            style={style}
            href={asPath || pagePath}
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            aria-current="page"
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
    const router = useRouter()
    if (router.pagePath === rest.to) {
        return (
            <Link
                {...rest}
                className={[rest.className, activeClassName].filter(Boolean).join(' ')}
                style={Object.assign({}, rest.style, activeStyle)}
            />
        )
    }

    return (
        <Link  {...rest} />
    )
}
