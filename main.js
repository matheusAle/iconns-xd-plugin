const { parser } = require("./svg");
const { createDialog } = require("./lib/dialogs.js");
const { group } = require("commands");

async function renderInterface(selection) {
    await createDialog({
        title: 'Iconns',
        render: template(selection),
    })
}

function template(selection) {
    let template = document.createElement('div');
    template.innerHTML = `
        <style>
            
            form {
                display: flex;
                justify-content: flex-start;
                flex-direction: row;
                flex-wrap: wrap;
            }

            #results {
                display: flex;
                justify-content: flex-start;
                flex-direction: row;
                flex-wrap: wrap;
            }

            .iconn-view {
                display: flex;
                justify-content: flex-center;
                padding: 2px;
                margin: 8px;
                position: relative;
                background-color: white;

            }

            .iconn-view.selected {
                padding: 1px;
                border: 1px solid blue;
            }

            .input-wapper {
                position: relative;
            }

            .input-wapper .load {
                top: 25%;
                transform: translateY(-50%);
                right: 10px;    
                position: absolute;
                object-fit: contain;
                height: 25px;
                width: 25px;
                display: none;
            }

            .load.show {
                display: block;
            }

            .iconn-view .load-wapper.show {
                display: flex;
                justify-content: flex-start;
                flex-direction: row;
                flex-wrap: wrap;   
            }

            .iconn-view .load-wapper {
                position: absolute;
                height: calc(100% -1px);
                width: calc(100% -1px);
                display: none;
                background-color: rgb(255, 255, 255, 0.6);
                z-index: 99999;
            }
            .iconn-view .load-wapper img {
                object-fit: contain;
                height: 25px;
                width: 25px;
                display: block;
            }

        </style>
        <div>
            <form id="iconns-search-form">
                <div class="input-wapper">
                    <input typ="text" placeholder="icon name"/>
                    <img class="load" src="images/load.gif"/>
                <div>
            </form>
            <div id="results">
                
            </div>
        </div>
    `;
    const inputQueryEl = template.querySelector('form input');
    const searchLoadEl = template.querySelector('form .load');
    const resultsContainerEl = template.querySelector('#results');
    
    template.addEventListener('keydown', (e) => { 
        if (e.key == 'Enter') { onSearch() }
     })

    function onSearch() {
        searchLoadEl.classList.toggle('show');
        inputQueryEl.disabled = true;
        let query = inputQueryEl.value;

        fetch('http://127.0.0.1:3000/search?q=' + query)
            .then(async response => {
                searchLoadEl.classList.toggle('show');
                inputQueryEl.disabled = false;
                resultsContainerEl.innerHTML = '';
                (await parseResults(response)).map(iconView)
                    .forEach((el) => resultsContainerEl.appendChild(el))
                
            })
            .catch(err => console.log(err));
    }

    function iconView(url) {
        let el = document.createElement('div')
        el.addEventListener('dblclick', () => placeIcon(url, el))
        el.addEventListener('click', () => onclick())
        el.classList.add('iconn-view')
        el.innerHTML = `
            <img src="${url.preview_url}"/>
            <div class="load-wapper">
                <img src="images/load.gif"/>
            </div>
        `
        return el;

        function onclick() {
            let selected = template.querySelector('.selected')
            if (selected) selected.classList.remove('selected')
            el.classList.add('selected')
        }
    }

    function placeIcon({ download_url: url }, el) {

        el.querySelector('.load-wapper').classList.toggle('show');

        fetch(`http://127.0.0.1:3000${url}`)
            .then(async (result) => {
                let content = await result.text();
                let paths = await parser(content);
                paths.forEach(p => selection.insertionParent.addChild(p));
                selection.items = paths;
                group();
                el.querySelector('.load-wapper').classList.toggle('show');
            })
            .catch(err => console.log(err));
    }

    /**
     * map response in array of urls
     * @param {httpResponse} response of fetch
     * @returns {array} array of urls 
     */
    function parseResults(response) {
        return new Promise(async (resolve, reject) => {
            try {
                resolve(await response.json())
            } catch (e) {
                resolve([])
            }
        });
    }
    return () => template
}

module.exports = {
    commands: {
        renderInterface
    }
};
