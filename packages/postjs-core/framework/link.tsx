import React, { Children, cloneElement, CSSProperties, isValidElement, PropsWithChildren, useCallback, useEffect, useMemo } from 'react'
import { prefetchPage, redirect, Transition, useRouter } from './router'
import utils from './utils'

interface LinkProps {
    to: string
    as?: string
    className?: string
    style?: CSSProperties
    replace?: boolean
    prefetch?: boolean
    transition?: Transition | ((currentPage: string, nextPage: string) => Transition)
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
            if (typeof transition === 'function') {
                transition = transition(router.pagePath, pagePath)
            }
            if (transition && transition['name'] === 'fade') {

            }
            redirect(pagePath, asPath, replace, transition).catch(err => {
                alert(`can not load page '${pagePath}': ${err.message || err}`)
            })
        }
    }, [pagePath, asPath, replace, router])
    const onMouseEnter = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
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
                href: asPath || pagePath,
                'aria-current': props['aria-current'] || 'page',
                onClick: (e: React.MouseEvent<HTMLAnchorElement>) => {
                    onClick(e)
                    if (utils.isFunction(props.onClick)) {
                        props.onClick(e)
                    }
                },
                onMouseEnter: (e: React.MouseEvent<HTMLAnchorElement>) => {
                    onMouseEnter(e)
                    if (utils.isFunction(props.onMouseEnter)) {
                        props.onMouseEnter(e)
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
    return (
        <Link {...rest} />
    )
}
