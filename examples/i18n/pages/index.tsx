import { Head, Link, useLocale, useTranslate } from '@postjs/core'
import React from 'react'

export default function Home() {
    const locale = useLocale()
    const text = useTranslate('Welcome to use')

    return (
        <div style={{ margin: 50 }}>
            <Head>
                <title>{text} postjs!</title>
            </Head>
            <p>{text} <strong>postjs</strong>! <Link style={{ paddingLeft: 15 }} to={locale === 'en' ? '/zh-CN' : '/'}>&rarr;&nbsp; {locale === 'en' ? '中文' : 'English'}</Link></p>
        </div>
    )
}
