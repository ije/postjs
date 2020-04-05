import { Head } from '@postjs/core'
import React from 'react'

export default function About({ description }) {
    return (
        <div className="about">
            <Head>
                <title>{description}</title>
            </Head>
            <p>{description}</p>
        </div>
    )
}
