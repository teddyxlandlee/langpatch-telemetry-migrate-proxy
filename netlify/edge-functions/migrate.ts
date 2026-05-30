import { Context } from '@netlify/edge-functions'
import jwt from 'jsonwebtoken'

//noinspection JSUnusedGlobalSymbols
export const config = {
    path: '/migrate'
}

function signJwt(content: object): string {
    const key: string | undefined = Netlify.env.get('REVERSE_PROXY_JWT')
    if (!key) throw new Error(`${key} is not set`)
    return jwt.sign(content, Buffer.from(key, 'base64'), {
        expiresIn: '5min'
    })
}

const endpoint = Netlify.env.get('REVERSE_PROXY_ENDPOINT')

async function handle(req: Request, context: Context): Promise<Response> {
    if (req.method !== 'POST') {
        return new Response('Method not allowed', {
            status: 405
        })
    }

    if (!endpoint) {
        return new Response('Upstream endpoint not found', {
            status: 502,    // Bad Gateway
        })
    }

    const requestText = await req.text()
    const disableGeoContextInjection: boolean = false

    const geoContext: object = disableGeoContextInjection ? {} : {
        country: context.geo.country,
        timezone: context.geo.timezone,
    }
    const delegateText = signJwt({
        'geo_context': geoContext,
        'content': requestText
    })
    const promise = fetch(endpoint, {
        method: 'POST',
        referrer: context.url.href,
        body: delegateText,
        headers: {
            'Via': 'LangPatch-Migrate-Proxy',
            'Content-Type': 'text/plain; charset=utf-8',
        },
    })
    context.waitUntil(promise)
    return new Response(null, {
        status: 202,
    })
}

//noinspection JSUnusedGlobalSymbols
export default handle