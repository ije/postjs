import React, { Children, ComponentType, Fragment, PropsWithChildren, useEffect, useState } from 'react'
import { Loading } from '../component'
import { Head } from '../head'
import { fetchPage } from './fetch'

interface PageProps {
    pagePath: string
    props?: Record<string, any>
    fallback?: ComponentType
}

export function Page({ pagePath, fallback, props, children }: PropsWithChildren<PageProps>) {
    const {
        __POST_PAGES: pages = {},
        __POST_BUILD_MANIFEST: buildManifest = {}
    } = window as any
    const ok = pagePath in buildManifest.pages
    const [isFetching, setIsFetching] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    useEffect(() => {
        if (ok) {
            if (pagePath in pages) {
                setIsFetching(false)
            } else {
                fetchPage(pagePath).catch(err => setError(err)).finally(() => setIsFetching(false))
            }
        }
    }, [])

    if (!ok) {
        const Fallback = fallback || Default404Page
        return <Fallback />
    }

    if (isFetching) {
        if (Children.count(children) > 0) {
            return <Fragment>children</Fragment>
        }
        return <Loading />
    }

    if (error) {
        return <Loading error={error} />
    }

    const Component = pages[pagePath].reqComponent()
    return <Component {...props} />
}

function Default404Page() {
    return (
        <p>
            <Head><title>404 - Page not found</title></Head>
            <strong><code>404</code></strong>
            <small>&nbsp;-&nbsp;</small>
            <span>Page not found</span>
        </p>
    )
}
