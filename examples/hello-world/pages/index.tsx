import React from 'react'
import { Head, SEO } from '@postjs/core'
import Nav from '../components/nav'

export async function getStaticProps() {
    const res = await fetch('https://api.github.com/repos/postui/postjs')
    return await res.json()
}

export default ({ name, description }: any) => {
    return (
        <div>
            <Head>
                <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1" />
            </Head>
            <SEO
                title={`Hello ${name}!`}
                description={description}
                keywords={`react, ${name}`}
            />
            <Nav />
            <h1>Welcome to use {name}!</h1>
        </div>
    )
}
