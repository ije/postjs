import React, { Children, cloneElement, isValidElement, useCallback, useEffect, useMemo } from 'https://cdn.pika.dev/react'
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
    prefetch: isPrefetch = false,
    className,
    style,
    children
}: React.PropsWithChildren<LinkProps>) {
    const { asPath: currentPath } = useRouter()
    const href = useMemo(() => {
        if (util.isHttpUrl(to)) {
            return to
        }
        if (to.startsWith('/')) {
            return util.cleanPath(to)
        }
        return util.cleanPath(currentPath + '/' + to)
    }, [currentPath, to])
    const onClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        if (href !== currentPath) {
            redirect(href, replace)
        }
    }, [href, currentPath, replace])
    const prefetch = useCallback(() => {
        if (href.startsWith('/') && href !== currentPath) {
            prefetchPage(href)
        }
    }, [href, currentPath])

    useEffect(() => {
        if (isPrefetch) {
            prefetch()
        }
    }, [isPrefetch, prefetch])

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
