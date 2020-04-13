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
    const asPath = useMemo(() => utils.cleanPath(to), [to])
    const pagePath = useMemo(() => {
        const { baseUrl = '/' } = window['__POST_APP']?.config || {}
        const { pages = {} } = window['__POST_BUILD_MANIFEST'] || {}
        const { pagePath } = route(baseUrl, Object.keys(pages), { fallback: '/_404', location: { pathname: asPath } })
        return pagePath
    }, [asPath])
    const onClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault()
        if (router.asPath !== asPath) {
            redirect(asPath, replace, transition).catch(err => {
                alert(`Error: ${err.message}`)
            })
        }
    }, [asPath, replace, router, transition])
    const onMouseEnter = useCallback(() => {
        prefetchPage(pagePath, asPath)
    }, [pagePath])

    useEffect(() => {
        if (prefetch) {
            prefetchPage(pagePath, asPath)
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
                href: asPath,
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
            href={asPath}
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
    to,
    ...rest
}: PropsWithChildren<NavLinkProps>) {
    const router = useRouter()
    const asPath = useMemo(() => utils.cleanPath(to), [to])
    if (router.asPath === asPath) {
        return (
            <Link
                {...rest}
                to={asPath}
                className={[rest.className, activeClassName].filter(Boolean).join(' ')}
                style={Object.assign({}, rest.style, activeStyle)}
            />
        )
    }

    return (
        <Link {...rest} to={asPath} />
    )
}

function prefetchPage(pagePath: string, asPath: string) {
    // not a file
    if (location.protocol === 'file:') {
        return
    }

    const {
        __POST_PAGES: pages = {},
        __POST_SSR_DATA: ssrData = {},
        __POST_BUILD_MANIFEST: buildManifest = {}
    } = window as any

    if (pagePath in (buildManifest.pages || {}) && (!(pagePath in pages) || !(asPath in ssrData))) {
        fetchPage(pagePath, asPath)
    }
}
