import React, { PropsWithChildren, useEffect, useState } from 'react'
import { Default404Page } from './404'
import { fetchPage } from './router'

interface Props {
    is: string
}

export const Component = ({ is }: PropsWithChildren<Props>) => (
    <p>{is}</p>
)

export function LazyPageComponent({ pagePath, fallback, ...rest }: any) {
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
        return fallback || Default404Page
    }

    if (isFetching) {
        return <p>loading...</p>
    }

    if (error) {
        return <p>can't load page: {error}</p>
    }

    const Component = pages[pagePath].reqComponent()
    return <Component {...rest} />
}
