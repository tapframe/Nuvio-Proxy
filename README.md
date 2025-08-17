# SimpleProxy for Nuvio Streams

Reverse proxy for [Nuvio Streams Addon](https://github.com/tapframe/NuvioStreamsAddon) to bypass regional restrictions and access streaming providers.

## Deploy

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/tapframe/Nuvio-Proxy)

After deployment:
1. Copy your deployed URL
2. Add `?destination=` to the end
3. Use in your Nuvio Streams `.env` file

## Features
 - Multi-platform deployment
 - CORS bypass
 - Header management
 - M3U8 stream support
 - TLS segment caching

> [!WARNING]
> Turnstile integration only works with Cloudflare Workers

## Supported Platforms
- Netlify
- Cloudflare Workers
- AWS Lambda
- Node.js

## Configuration

Add to your Nuvio Streams `.env` file:

```env
SHOWBOX_PROXY_URL_VALUE=https://your-proxy.netlify.app/?destination=
VIDSRC_PROXY_URL=https://your-proxy.netlify.app/?destination=
VIDZEE_PROXY_URL=https://your-proxy.netlify.app/?destination=
SOAPERTV_PROXY_URL=https://your-proxy.netlify.app/?destination=
HOLLYMOVIEHD_PROXY_URL=https://your-proxy.netlify.app/?destination=
XPRIME_PROXY_URL=https://your-proxy.netlify.app/?destination=
ANIMEPAHE_PROXY_GLOBAL=https://your-proxy.netlify.app/?destination=
```

## Usage

Direct URL proxying:
```
https://your-proxy.netlify.app/?destination=https://example.com/api/data
```
