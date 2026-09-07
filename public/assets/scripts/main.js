let modal_inst = document.getElementById('modal_instruction')
let modal_styles = document.getElementById('m-styles')
let progressBar = document.getElementById('progress-bar')
let progressContainer = document.querySelector('.progress-container')

function modal_instruction() {
    modal_inst.style.display = modal_inst.style.display === 'block' ? 'none' : 'block'

    window.onclick = function(event) {
        if(event.target == modal_inst) {
            modal_inst.style.display = 'none'
        }
    }
}

function modal_style() {
    modal_styles.style.display = modal_styles.style.display === 'block' ? 'none' : 'block'

    window.onclick = function(event) {
        if(event.target == modal_styles) {
            modal_styles.style.display = 'none'
        }
    }
}

function closeModal_ints() {
    modal_inst.style.display = 'none'
}

function closeModal_styles() {
    modal_styles.style.display = 'none'
}

document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById("button")
    const input = document.getElementById("enter_url")

    button.addEventListener("click", async () => {
        let url = input.value.trim()
        if(!url) {
            return alert("Введите ссылку")
        }

        if (!/^https?:\/\//i.test(url)) url = `https://${url}`

        try {
            new URL(url)
        } catch {
            return alert('Введите корректную ссылку')
        }
        
        progressContainer.style.display = 'block'
        progressBar.style.width = '30%'
        button.disabled = true
        
        try {
            const res = await fetch('/bold-url', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({url})
            })

            progressBar.style.width = '60%'
            
            if(!res.ok) throw new Error('Ошибка запроса!')

            const data = await res.json()
            
            progressBar.style.width = '90%'
            showMainInfo(data)
            showTree(data.children)
            
            progressBar.style.width = '100%'
            setTimeout(() => {
                progressContainer.style.display = 'none'
                progressBar.style.width = '0%'
            }, 1000)

        } catch(e) {
            alert('Не удалось загрузить данные: ' + e.message)
            progressContainer.style.display = 'none'
            progressBar.style.width = '0%'
        } finally {
            button.disabled = false
        }
    })

    const saveTheme = localStorage.getItem('theme')
    if(saveTheme) document.body.className = saveTheme
})

function showMainInfo(data) {
    const resultSection = document.getElementById('result')

    const old = document.getElementById('results')
    if(old) old.remove()

    const container = document.createElement('div')
    container.id = 'results'

    const titleElem = document.createElement('h2')
    titleElem.textContent = `Заголовок сайта: ${data.title || 'нет данных'}`
    container.appendChild(titleElem)

        const metaDiv = document.createElement('div')
        appendField(metaDiv, 'Описание (description):', data.metaDescription)
        appendField(metaDiv, 'Ключевые слова (keywords):', data.metaKeywords)
        appendField(metaDiv, 'OpenGraph Title:', data.ogTitle)
        appendField(metaDiv, 'OpenGraph Description:', data.ogDescription)
    container.appendChild(metaDiv)

    const cssLinks = Array.isArray(data.cssLinks) ? data.cssLinks : []
    const cssDiv = document.createElement('div')
        const cssTitle = document.createElement('p')
        const cssLabel = document.createElement('strong')
        cssLabel.textContent = `CSS-файлы (${cssLinks.length}):`
        cssTitle.appendChild(cssLabel)
        cssDiv.appendChild(cssTitle)
    if(cssLinks.length) {
        const ulCss = document.createElement('ul')
        cssLinks.forEach(link => {
            const li = document.createElement('li')
            li.textContent = link
            ulCss.appendChild(li)
        })
        cssDiv.appendChild(ulCss)
    } else {
            const emptyCss = document.createElement('p')
            emptyCss.textContent = 'Отсутствуют'
            cssDiv.appendChild(emptyCss)
    }
    container.appendChild(cssDiv)

    const inlineStylesDiv = document.createElement('p')
        const inlineStylesLabel = document.createElement('strong')
        inlineStylesLabel.textContent = 'Количество inline-стилей: '
        inlineStylesDiv.append(inlineStylesLabel, document.createTextNode(data.inlineStylesCount || 0))
    container.appendChild(inlineStylesDiv)

    resultSection.appendChild(container)
}

function appendField(container, label, value) {
    const paragraph = document.createElement('p')
    const strong = document.createElement('strong')
    strong.textContent = `${label} `
    paragraph.append(strong, document.createTextNode(value || 'нет данных'))
    container.appendChild(paragraph)
}

function showTree(treeData) {
    const resultSection = document.getElementById('result')

    const oldTree = document.getElementById('link-tree')
    if(oldTree) oldTree.remove()

    if(!treeData || !treeData.length) return

    const treeContainer = document.createElement('div')
    treeContainer.id = 'link-tree'
    treeContainer.style.marginTop = '20px'

    const title = document.createElement('h3')
    title.textContent = 'Сетевая структура ссылок (детали дочерних страниц):'
    treeContainer.appendChild(title)

    const ul = document.createElement('ul')

    treeData.forEach(element => {
        const li = document.createElement('li')
            appendField(li, 'URL:', element.url)
            appendField(li, 'Заголовок:', element.title)
            appendField(li, 'Описание:', element.metaDescription)
            appendField(li, 'Ключевые слова:', element.metaKeywords)
            appendField(li, 'OpenGraph Title:', element.ogTitle)
            appendField(li, 'OpenGraph Description:', element.ogDescription)
            appendField(li, 'CSS-файлы:', `${Array.isArray(element.cssLinks) ? element.cssLinks.length : 0} шт.`)
            appendField(li, 'Количество inline-стилей:', element.inlineStylesCount || 0)

        if(element.children && element.children.length) {
            const subUl = document.createElement('ul')
            element.children.forEach(child => {
                const subLi = document.createElement('li')
                subLi.textContent = child
                subUl.appendChild(subLi)
            })
            li.appendChild(subUl)
        }

        ul.appendChild(li)
    })

    treeContainer.appendChild(ul)
    resultSection.appendChild(treeContainer)
}

function applyTheme(theme) {
    document.body.className = theme
    localStorage.setItem("theme", theme)
}
function toggleDark() {
    applyTheme('dark-style')
}
function toggleLite() {
    applyTheme('lite-style')
}
function toggleRetro() {
    applyTheme('retro')
}