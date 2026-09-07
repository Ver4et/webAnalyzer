const express = require('express')
const puppeteer = require('puppeteer')
const cheerio = require('cheerio')
const fs = require('fs')
const path = require('path')

const app = express()
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

let browserInstance = null

async function getBrowser() {
  if (!browserInstance) {
    const systemChromePath = process.platform === 'win32'
      ? path.join(process.env.PROGRAMFILES || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
      : ''
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || (
      fs.existsSync(systemChromePath) ? systemChromePath : undefined
    )

    browserInstance = await puppeteer.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
  }
  return browserInstance
}

async function parsePage(url) {
  const browser = await getBrowser()
  const page = await browser.newPage()
  
  try {
    await page.goto(url, { 
      waitUntil: 'domcontentloaded', 
      timeout: 20000 
    })
    
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
    await page.close()
  }
}

app.post('/bold-url', async (req, res) => {
  const { url } = req.body
  if (!url) {
    return res.status(400).send('URL не указан')
  }

  let parsedUrl
  try {
    parsedUrl = new URL(url)
  } catch {
    return res.status(400).send('Некорректный URL')
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return res.status(400).send('Поддерживаются только HTTP и HTTPS URL')
  }

  try {
    const rootData = await parsePage(parsedUrl.href)

    const children = await Promise.all(
      rootData.links.slice(0, 5).map(async (link) => {
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
          return { url: link, error: true, children: [] }
        }
      })
    )

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
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))

process.on('SIGINT', async () => {
  if (browserInstance) {
    await browserInstance.close()
  }
  process.exit()
})