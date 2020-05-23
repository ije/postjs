import React, { Children, cloneElement, isValidElement, useCallback, useEffect, useMemo, useRef } from 'https://cdn.pika.dev/react'
import { prefetchPage, redirect } from './app.ts'
import { useRouter } from './router.ts'
import util from './util.ts'

interface LinkProps {
    to: string
    replace?: boolean
    prefetch?: boolean
    className?: string
    style?: React.CSSProperties
}

export default function Link({
    to,
    replace = false,
    prefetch: shouldPrefetch = false,
    className,
    style,
    children
}: React.PropsWithChildren<LinkProps>) {
    const { asPath: currentPath, query: currentQuery } = useRouter()
    const currentHref = useMemo(() => {
        return [currentPath, Object.entries(currentQuery).map(([key, value]) => {
            if (util.isArray(value)) {
                return value.map(v => `${key}=${v}`).join('&')
            }
            return `${key}=${value}`
        }).join('&')].filter(Boolean).join('?')
    }, [currentPath, currentQuery])
    const href = useMemo(() => {
        if (util.isHttpUrl(to)) {
            return to
        }
        let [pathname, search] = util.splitBy(to, '?')
        if (to.startsWith('/')) {
            pathname = util.cleanPath(pathname)
        } else {
            pathname = util.cleanPath(currentPath + '/' + pathname)
        }
        return [pathname, search].filter(Boolean).join('?')
    }, [currentPath, to])
    const prefetchStatus = useRef(0)
    const prefetch = useCallback(() => {
        if (prefetchStatus.current == 0 && !util.isHttpUrl(href) && href !== currentHref) {
            prefetchStatus.current = 1
            prefetchPage(href)
        }
    }, [href, currentHref])
    const onClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        if (href !== currentHref) {
            redirect(href, replace)
        }
    }, [href, currentHref, replace])

    useEffect(() => {
        if (shouldPrefetch) {
            prefetch()
        }
    }, [shouldPrefetch, prefetch])

    if (Children.count(children) === 1) {
        const child = Children.toArray(children)[0]
        if (isValidElement(child) && child.type === 'a') {
            const { props } = child
            return cloneElement(child, {
                ...props,
                className: [className, props.className].filter(util.isNEString).join(' ') || undefined,
                style: Object.assign({}, style, props.style),
                href,
                'aria-current': props['aria-current'] || 'page',
                onClick: (e: React.MouseEvent) => {
                    if (util.isFunction(props.onClick)) {
                        props.onClick(e)
                    }
                    if (!e.defaultPrevented) {
                        onClick(e)
                    }
                },
                onMouseEnter: (e: React.MouseEvent) => {
                    if (util.isFunction(props.onMouseEnter)) {
                        props.onMouseEnter(e)
                    }
                    if (!e.defaultPrevented) {
                        prefetch()
                    }
                }
            })
        }
    }

    return React.createElement(
        'a',
        {
            className,
            style,
            href,
            onClick,
            onMouseEnter: prefetch,
            'aria-current': 'page'
        },
        children
    )
}
