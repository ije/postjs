import { Head, useAppStaticProps } from '@postjs/core'
import React from 'react'

export default function About() {
    const { description } = useAppStaticProps()
    return (
        <div className="about">
            <Head>
                <title>{description}</title>
            </Head>
            <p>{description}</p>
        </div>
    )
}
