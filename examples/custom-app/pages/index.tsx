import { Head } from '@postjs/core'
import React from 'react'

export default function Home({ name }) {
    return (
        <div className="home">
            <Head>
                <title>Welcome to use {name}!</title>
            </Head>
            <p>Welcome to use <strong>{name}</strong>!</p>
        </div>
    )
}
