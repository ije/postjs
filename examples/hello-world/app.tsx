import React, { Fragment, PropsWithChildren } from 'react'
import Head from 'https://postjs.io/head.ts'

export default function App({ children }: PropsWithChildren<{}>) {
    return (
        <Fragment>
            <Head>
                <title>Welcome - postjs</title>
            </Head>
            {children}
        </Fragment>
    )
}
