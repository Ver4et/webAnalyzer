
let modal_inst = document.getElementById('modal_instruction')
let modal_styles = document.getElementById('m-styles')
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
        try {
            const res = await fetch('http://localhost:3000/bold-url', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({url})
            })

            if(!res.ok) throw new Error('Ошибка запроса!')

            const data = await res.json()
            if(data.title) {
                document.getElementById('titleOut').textContent = `Заголовок сайта: ${data.title}`
            }
            showTree(data.children)
        } catch(e) {
            alert('Не удалось загрузить данные: ' + e.message)
        }
    })
})

function showTree(treeData) {
    const main = document.querySelector('main')

    const old = document.getElementById('results')
    if(old) old.remove()

    const container = document.createElement('div')
    container.id = 'results'

    const ul = document.createElement('ul')
    treeData.forEach(element => {
        const li = document.createElement('li')
        li.innerHTML = `<strong>${element.url}</strong>`
        if(element.children && element.children.length) {
            const subUl = document.createElement('ul')
            element.children.forEach(child => {
                const subLi = document.createElement('li');
                subLi.textContent = child;
                subUl.appendChild(subLi);
            });
            li.appendChild(subUl)
        }
        ul.appendChild(li)
    });
    container.appendChild(ul)
    main.appendChild(container)
}


// functions of styles
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

document.addEventListener('DOMContentLoaded', () => {
    const saveTheme = localStorage.getItem('theme')
    if(saveTheme) document.body.className = saveTheme
})