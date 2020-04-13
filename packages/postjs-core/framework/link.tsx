import React, { Children, cloneElement, CSSProperties, isValidElement, PropsWithChildren, useCallback, useEffect, useMemo } from 'react'
import { fetchPage } from './page'
import { redirect } from './redirect'
import { route, useRouter } from './router'
import { PageTransition } from './transition'
import { utils } from './utils'

interface LinkProps {
    to: string
    replace?: boolean
    prefetch?: boolean
    className?: string
    style?: CSSProperties
    transition?: string | PageTransition
}

export function Link({
    to,
    replace,
    prefetch,
    className,
    style,
    transition,
    children
}: PropsWithChildren<LinkProps>) {
    const router = useRouter()
    const href = useMemo(() => utils.cleanPath(to), [to])
    const pagePath = useMemo(() => {
        const { baseUrl = '/' } = window['__POST_APP']?.config || {}
        const { pages = {} } = window['__POST_BUILD_MANIFEST'] || {}
        const { pagePath } = route(baseUrl, Object.keys(pages), { fallback: '/_404', location: { pathname: href } })
        return pagePath
    }, [href])
    const onClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault()
        if (router.pathname !== href) {
            redirect(href, replace, transition).catch(err => {
                alert(`Error: ${err.message}`)
            })
        }
    }, [href, replace, router, transition])
    const onMouseEnter = useCallback(() => {
        prefetchPage(pagePath)
    }, [pagePath])

    useEffect(() => {
        if (prefetch) {
            prefetchPage(pagePath)
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
                href,
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
                        onMouseEnter()
                    }
                }
            })
        }
    }

    return (
        <a
            className={className}
            style={style}
            href={href}
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
    if (router.pathname === rest.to) {
        return (
            <Link
                {...rest}
                className={[rest.className, activeClassName].filter(Boolean).join(' ')}
                style={Object.assign({}, rest.style, activeStyle)}
            />
        )
    }

    return (
        <Link {...rest} />
    )
}

function prefetchPage(pagePath: string) {
    // not a file
    if (location.protocol === 'file:') {
        return
    }

    const {
        __POST_PAGES: pages = {},
        __POST_BUILD_MANIFEST: buildManifest = {}
    } = window as any

    if (pagePath in (buildManifest.pages || {}) && !(pagePath in pages)) {
        fetchPage(pagePath)
    }
}
