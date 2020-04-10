import { Head, Viewport } from '@postjs/core'
import React from 'react'

export default function Home({ name }: { name: string }) {
    return (
        <div className="home">
            <Head>
                <title>Welcome to use {name}!</title>
                <Viewport width="device-width" initialScale={1} userScalable={false} />
            </Head>
            <p>Welcome to use <strong>{name}</strong>!</p>
        </div>
    )
}
