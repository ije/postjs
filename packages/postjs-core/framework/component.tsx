import React, { PropsWithChildren, useEffect, useState } from 'react'
import { fetchPage } from './router'

interface ComponentProps {
    is: string
}

export const Component = ({ is }: PropsWithChildren<ComponentProps>) => (
    <p>{is}</p>
)

export function LazyPageComponent({ pagePath, ...rest }: any) {
    const { __POST_PAGES: pages = {} } = window as any
    const [isFetching, setIsFetching] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    useEffect(() => {
        if (pagePath in pages) {
            setIsFetching(false)
        } else {
            fetchPage(pagePath).catch(err => setError(err)).finally(() => setIsFetching(false))
        }
    }, [])

    if (isFetching) {
        return <p>loading...</p>
    }

    if (error) {
        return <p>can't load page: {error}</p>
    }

    const Component = pages[pagePath].reqComponent()
    return <Component {...rest} />
}
