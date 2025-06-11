const express = require('express')
const axios = require('axios')
const cheerio = require('cheerio')
const app = express()
const path = require('path')

app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

app.get('/', (req, res) => {
    res.status(200) //OK
    res.sendFile(path.join(__dirname, 'public', 'index.html'))
})


app.post('/bold-url', async (req, res) => {
    const {url} = req.body
    try {
        const rootURl = new URL(url)
        const response = await axios.get(url)
        const $ = cheerio.load(response.data)
        const title = $('title').text()
        const links = $('a')
            .map((i, el) => $(el).attr('href'))
            .get()
            .filter(href => href && href.startsWith("/"))
            .map(href => new URL(href, rootURl).href)
        const rewarkLinks = [...new Set(links)]
        let sum_links = rewarkLinks.length
        const childrenPromises = rewarkLinks.map(async (link) => {
            try {
                const childResponse = await axios.get(link)
                const $$ = cheerio.load(childResponse.data)

                const sublinks = $$('a')
                    .map((i, el) => $$(el).attr('href'))
                    .get()
                    .filter(href => href && href.startsWith("/"))
                    .map(href => new URL(href, rootURl).href)

                const parentUrl = link.endsWith("/") ? link : link + '/'
                const childrenOnly = [... new Set(sublinks)].filter(
                    sublink => sublink.startsWith(parentUrl) && sublink !== link
                )
                

                return {
                    url: link,
                    children: childrenOnly
                }
            } catch(e) {return {url: link, error: true, children: []};}
            })
        const children = await Promise.all(childrenPromises)
        res.json({title, sum_links, rewarkLinks, url, children})
        } catch(e) {res.status(500).send('Ошибка при получении страницы')}
})
app.listen(3000, () => console.log("Server has been started"))