import React, { PropsWithChildren } from 'react'

interface Props {
    href: string
}

export default ({ href, children }: PropsWithChildren<Props>) => {
    return <a href={href}>{children}</a>
}
