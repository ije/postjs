import React from 'react'
import { Link, Head, SEO } from '@postjs/core'

export default () => (
    <div>
        <Head>
            <meta charSet="utf8" />
        </Head>
        <SEO
            title="Hello World!"
            description="The Post-Front-End Framework"
            keywords="react, postio"
        />
        <h1>Hello World!</h1>
        <Link to="/about">About</Link>
        <Link to="/contact">Contact</Link>
    </div>
)
