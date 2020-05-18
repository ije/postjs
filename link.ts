import React from 'https://cdn.pika.dev/react'

interface LinkProps {
    to: string
    replace?: boolean
    prefetch?: boolean
    className?: string
    style?: React.CSSProperties
}

export default function Link({ to, children }: React.PropsWithChildren<LinkProps>) {
    return React.createElement(
        'a',
        {
            href: to
        },
        children
    )
}
