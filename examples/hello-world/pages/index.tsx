import React from 'react'
import { Link, Head, SEO } from '@postjs/core'

export default () => (
    <div>
        <Head>
            <meta charSet="utf8" />
            <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1" />
            <title>postjs</title>
        </Head>
        <SEO
            title="Hello World!"
            description="The Post-Front-End Framework"
            keywords="react, postio"
            image="https://postui.com/postjs/card.png"
            url="https://postui.com/postjs"
        />
        <h1>Hello World!</h1>
        <Link to="/about">About</Link>
        <Link to="/contact">Contact</Link>
    </div>
)
