const express = require('express')
const puppeteer = require('puppeteer')
const cheerio = require('cheerio')
const dns = require('dns').promises
const fs = require('fs')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const net = require('net')
const path = require('path')

const app = express()
app.disable('x-powered-by')
app.use(helmet())
app.use(express.json({ limit: '10kb' }))
app.use(express.static(path.join(__dirname, 'public')))

const analyzeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Слишком много запросов. Повторите попытку позже.' }
})

const dnsCache = new Map()
const browserLaunchArgs = ['--no-sandbox', '--disable-setuid-sandbox']
let browserInstance = null
let browserPromise = null
let serverInstance = null

function isBlockedIp(address) {
  const normalizedAddress = address.toLowerCase()

  if (net.isIP(normalizedAddress) === 4) {
    const octets = normalizedAddress.split('.').map(Number)
    const [first, second] = octets
    return first === 0 || first === 10 || first === 127 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && (second === 0 || second === 168)) ||
      (first === 198 && second >= 18 && second <= 19) ||
      (first === 203 && second === 0) ||
      first >= 224
  }

  if (net.isIP(normalizedAddress) === 6) {
    const mappedIpv4 = normalizedAddress.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)
    if (mappedIpv4) return isBlockedIp(mappedIpv4[1])

    return normalizedAddress === '::' || normalizedAddress === '::1' ||
      normalizedAddress.startsWith('fc') || normalizedAddress.startsWith('fd') ||
      normalizedAddress.startsWith('fe8') || normalizedAddress.startsWith('fe9') ||
      normalizedAddress.startsWith('fea') || normalizedAddress.startsWith('feb')
  }

  return true
}

async function resolvePublicHostname(hostname) {
  const normalizedHostname = hostname.toLowerCase()
  const cached = dnsCache.get(normalizedHostname)
  if (cached && cached.expiresAt > Date.now()) return cached.addresses

  const lookupPromise = dns.lookup(normalizedHostname, { all: true })
    .then(addresses => {
      if (!addresses.length || addresses.some(({ address }) => isBlockedIp(address))) {
        throw new Error('Адрес относится к закрытой или локальной сети')
      }
      return addresses
    })
    .catch(error => {
      dnsCache.delete(normalizedHostname)
      throw error
    })

  dnsCache.set(normalizedHostname, {
    expiresAt: Date.now() + 60 * 1000,
    addresses: lookupPromise
  })
  return lookupPromise
}

async function assertPublicUrl(value) {
  const parsedUrl = new URL(value)
  if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
    throw new Error('Разрешены только публичные HTTP и HTTPS URL')
  }

  const hostname = parsedUrl.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new Error('Локальные адреса запрещены')
  }

  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) throw new Error('Адрес относится к закрытой или локальной сети')
    return
  }

  await resolvePublicHostname(hostname)
}

function getExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH

  const candidates = process.platform === 'win32'
    ? [
        path.join(process.env.PROGRAMFILES || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
      ]
    : []

  return candidates.find(candidate => fs.existsSync(candidate))
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

async function getBrowser() {
  if (browserInstance) return browserInstance
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      executablePath: getExecutablePath(),
      args: browserLaunchArgs
    })
      .then(browser => {
        browserInstance = browser
        return browser
      })
      .catch(error => {
        browserPromise = null
        throw error
      })
  }
  return browserPromise
}

async function parsePage(url) {
  await assertPublicUrl(url)
  const browser = await getBrowser()
  const page = await browser.newPage()

  await page.setRequestInterception(true)
  page.on('request', async request => {
    try {
      const requestUrl = request.url()
      if (/^https?:/i.test(requestUrl)) await assertPublicUrl(requestUrl)
      await request.continue()
    } catch {
      await request.abort('blockedbyclient')
    }
  })

  try {
    page.setDefaultNavigationTimeout(20000)
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    
    const html = await page.content()
    const $ = cheerio.load(html)

    const title = $('title').text().trim()
    const metaDescription = $('meta[name="description"]').attr('content') || ''
    const metaKeywords = $('meta[name="keywords"]').attr('content') || ''
    const ogTitle = $('meta[property="og:title"]').attr('content') || ''
    const ogDescription = $('meta[property="og:description"]').attr('content') || ''

    const cssLinks = $('link[rel="stylesheet"]')
      .map((i, el) => $(el).attr('href'))
      .get()
      .filter(href => href)

    const inlineStyles = $('style')
      .map((i, el) => $(el).html())
      .get()

    const rawLinks = $('a[href]')
      .map((i, el) => {
        const href = $(el).attr('href')
        if (!href) return null
        return href.split('#')[0].trim()
      })
      .get()
      .filter(href => href && !href.match(/^(mailto:|tel:|javascript:|data:)/i))

    const baseUrl = new URL(url)
    const links = rawLinks
      .map(href => {
        try {
          const absoluteUrl = new URL(href, baseUrl).href
          return absoluteUrl.startsWith(baseUrl.origin) ? absoluteUrl : null
        } catch {
          return null
        }
      })
      .filter(link => link && link.startsWith('http'))
      .map(link => {
        const urlObj = new URL(link)
        urlObj.hash = ''
        return urlObj.href
      })

    const uniqueLinks = [...new Set(links)]

    return {
      url,
      title,
      metaDescription,
      metaKeywords,
      ogTitle,
      ogDescription,
      cssLinks,
      inlineStyles,
      links: uniqueLinks,
    }
  } finally {
    await page.close().catch(() => {})
  }
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++
      results[index] = await mapper(items[index], index)
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  )
  await Promise.all(workers)
  return results
}

app.post('/bold-url', analyzeLimiter, async (req, res) => {
  const { url } = req.body
  if (!url) {
    return res.status(400).send('URL не указан')
  }

  let parsedUrl
  try {
    parsedUrl = new URL(url)
    await assertPublicUrl(parsedUrl.href)
  } catch {
    return res.status(400).send('Некорректный или запрещенный URL')
  }

  try {
    const rootData = await parsePage(parsedUrl.href)

    const children = await mapWithConcurrency(rootData.links.slice(0, 5), 2, async link => {
        try {
          const childData = await parsePage(link)
          return {
            url: link,
            title: childData.title,
            metaDescription: childData.metaDescription,
            metaKeywords: childData.metaKeywords,
            ogTitle: childData.ogTitle,
            ogDescription: childData.ogDescription,
            cssLinks: childData.cssLinks,
            inlineStylesCount: childData.inlineStyles.length,
            children: childData.links.slice(0, 3)
          }
        } catch (e) {
          return {
            url: link,
            error: true,
            cssLinks: [],
            inlineStylesCount: 0,
            children: []
          }
        }
      })

    res.json({
      url: rootData.url,
      title: rootData.title,
      metaDescription: rootData.metaDescription,
      metaKeywords: rootData.metaKeywords,
      ogTitle: rootData.ogTitle,
      ogDescription: rootData.ogDescription,
      cssLinks: rootData.cssLinks,
      inlineStylesCount: rootData.inlineStyles.length,
      sum_links: rootData.links.length,
      children,
    })
  } catch (e) {
    console.error('Ошибка при обработке URL:', e.message)
    res.status(500).send('Ошибка при получении страницы')
  }
})

const PORT = process.env.PORT || 3000
serverInstance = app.listen(PORT, () => console.log(`Server running on port ${PORT}`))

async function shutdown() {
  if (browserInstance) {
    await browserInstance.close().catch(() => {})
  }
  if (serverInstance) serverInstance.close()
  process.exit()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)