import React, { Fragment, PropsWithChildren } from 'https://cdn.pika.dev/react'

export default function App({ children }: PropsWithChildren<{}>) {
    return (
        <Fragment>
            {children}
        </Fragment>
    )
}
