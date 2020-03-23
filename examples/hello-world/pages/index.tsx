import React from 'react'
import Link from 'postui/link'
import Head, { SEO } from 'postui/head'

export default () => (
    <div>
        <Head>
            <meta charSet="utf8" />
        </Head>
        <SEO
            title="Hello World!"
            description="The Post-Front-End Framework"
            keywords="react, postui"
        />
        <h1>Hello World!</h1>
        <Link to="/about">About</Link>
        <Link to="/contact">Contact</Link>
    </div>
)
