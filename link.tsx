// @deno-types="./@types/react/index.d.ts"
import React from 'https://dev.jspm.io/react'

interface LinkProps {
    to: string
    replace?: boolean
    prefetch?: boolean
    className?: string
    style?: React.CSSProperties
}

export default function Link({ to, children }: React.PropsWithChildren<LinkProps>) {
    return <a href={to}>{children}</a>
}
