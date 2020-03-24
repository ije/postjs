import React from 'react'
import { Head, SEO } from '@postjs/core'

export default function Home(props: any) {
    return (
        <div>
            <Head>
                <meta charSet="utf-8" />
                <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1" />
            </Head>
            <SEO
                title={`Hello ${props.name}!`}
                description={props.description || 'The Post-Front-End Framework'}
                keywords={`react, ${props.name}`}
            />
            <h1>Hello {props.name}!</h1>
        </div>
    )
}

Home.getStaticProps = async () => {
    const res = await fetch('https://api.github.com/repos/postui/postjs')
    return await res.json()
}
