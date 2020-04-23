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
    const href = useMemo(() => {
        if (/^https?:\/\//i.test(to)) {
            return to
        }
        return utils.cleanPath(to)
    }, [to])
    const onClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault()
        if (router.asPath !== href) {
            redirect(href, replace, transition).catch(err => {
                alert(`Error: ${err.message}`)
            })
        }
    }, [href, replace, router, transition])
    const onMouseEnter = useCallback(() => {
        prefetchPage(href)
    }, [href])

    useEffect(() => {
        if (prefetch) {
            prefetchPage(href)
        }
    }, [prefetch, href])

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
    to,
    ...rest
}: PropsWithChildren<NavLinkProps>) {
    const router = useRouter()
    const href = useMemo(() => {
        if (/^https?:\/\//i.test(to)) {
            return to
        }
        return utils.cleanPath(to)
    }, [to])

    if (router.asPath === href) {
        return (
            <Link
                {...rest}
                to={href}
                className={[rest.className, activeClassName].filter(Boolean).join(' ')}
                style={Object.assign({}, rest.style, activeStyle)}
            />
        )
    }
    return (
        <Link {...rest} to={href} />
    )
}

function prefetchPage(href: string) {
    if (/^https?:\/\//i.test(href) || location.protocol === 'file:') {
        return
    }

    const {
        __POST_APP: app = {},
        __POST_PAGES: pages = {},
        __POST_SSR_DATA: ssrData = {},
        __POST_BUILD_MANIFEST: buildManifest = {}
    } = window as any
    const { pagePath } = route(app.config?.baseUrl || '/', Object.keys(buildManifest.pages), { fallback: '/_404', location: { pathname: href } })

    if (pagePath in (buildManifest.pages || {}) && (!(pagePath in pages) || !(href in ssrData))) {
        fetchPage(pagePath, href)
    }
}
