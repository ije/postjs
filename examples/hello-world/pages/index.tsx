import { Head } from '@postjs/core'
import React from 'react'

export default function Home() {
    return (
        <div style={{ margin: 50 }}>
            <Head>
                <title>Welcome to use postjs!</title>
            </Head>
            <p>Welcome to use <strong>postjs</strong>!</p>
        </div>
    )
}
