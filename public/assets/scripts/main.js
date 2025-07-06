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
        const url = input.value.trim()
        if(!url) {
            return alert("Введите ссылку")
        }
        
        progressContainer.style.display = 'block'
        progressBar.style.width = '30%'
        
        try {
            const res = await fetch('http://localhost:3000/bold-url', {
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
    metaDiv.innerHTML = `
        <p><strong>Описание (description):</strong> ${data.metaDescription || 'нет данных'}</p>
        <p><strong>Ключевые слова (keywords):</strong> ${data.metaKeywords || 'нет данных'}</p>
        <p><strong>OpenGraph Title:</strong> ${data.ogTitle || 'нет данных'}</p>
        <p><strong>OpenGraph Description:</strong> ${data.ogDescription || 'нет данных'}</p>
    `
    container.appendChild(metaDiv)

    const cssDiv = document.createElement('div')
    cssDiv.innerHTML = `<p><strong>CSS-файлы (${data.cssLinks.length}):</strong></p>`
    if(data.cssLinks.length) {
        const ulCss = document.createElement('ul')
        data.cssLinks.forEach(link => {
            const li = document.createElement('li')
            li.textContent = link
            ulCss.appendChild(li)
        })
        cssDiv.appendChild(ulCss)
    } else {
        cssDiv.innerHTML += '<p>Отсутствуют</p>'
    }
    container.appendChild(cssDiv)

    const inlineStylesDiv = document.createElement('p')
    inlineStylesDiv.innerHTML = `<strong>Количество inline-стилей:</strong> ${data.inlineStylesCount || 0}`
    container.appendChild(inlineStylesDiv)

    resultSection.appendChild(container)
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
        li.innerHTML = `<strong>URL:</strong> ${element.url}<br>
                        <strong>Заголовок:</strong> ${element.title || 'нет данных'}<br>
                        <strong>Описание:</strong> ${element.metaDescription || 'нет данных'}<br>
                        <strong>Ключевые слова:</strong> ${element.metaKeywords || 'нет данных'}<br>
                        <strong>OpenGraph Title:</strong> ${element.ogTitle || 'нет данных'}<br>
                        <strong>OpenGraph Description:</strong> ${element.ogDescription || 'нет данных'}<br>
                        <strong>CSS-файлы:</strong> ${element.cssLinks.length} шт.<br>
                        <strong>Количество inline-стилей:</strong> ${element.inlineStylesCount || 0}
                        `

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