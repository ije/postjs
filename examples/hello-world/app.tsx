import React, { Fragment, PropsWithChildren } from 'react'

export default function App({ children }: PropsWithChildren<{}>) {
    return (
        <Fragment>
            {children}
        </Fragment>
    )
}
