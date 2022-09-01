
const Reactoid = {
    createElement,
    render,
}

// typeとpropsとchildrenを受け取ってReactoid要素を作成する関数
// typeは h1, h2, aなどのHTML属性
// propsは <h1 id="foo">　の要素についているid="foo"みたいなもの
// childrenはjavascriptの残余引数(可変長引数)を使う。
function createElement(type, props, ...children) {
    return {
        type,
        props: {
            ...props,
            children: children.map(child => 
                typeof child === "object"
                  ? child
                  : createTextElement(child)
            ),
        },
    }
}

// objectではないものをElementとしてラップする関数
function createTextElement(text) {
    return {
        type : "TEXT_ELEMENT",
        props: {
            nodeValue: text,
            children: [],
        },
    }
}

function createDom(fiber) {
    const dom =
        fiber.type === "TEXT_ELEMENT" 
        ? document.createTextNode("")
        : document.createElement(fiber.type)

    const isProperty = key => key !== "children"
    Object.keys(fiber.props)
        .filter(isProperty)
        .forEach(name => {
            dom[name] = fiber.props[name]
        })   
    
    return dom
}

// element(Reactoid要素)をcontainerの要素の下にレンダリングする。
function render(element, container) {
    wipRoot = {
        dom: container,
        props: {
            children: [element],
        },
    }
    nextUnitOfWork = wipRoot
}

// 今のroot
let wipRoot = null

// 次の作業単位
let nextUnitOfWork = null

// commitフェーズを実行する関数
function commmitRoot() {
    commitWork(wipRoot.child)
    wipRoot = null
}

// 再帰的にDomについか
function commitWork(fiber) {
    if (!fiber) {
        return
    }
    const domParent = fiber.parent.dom
    domParent.appendChild(fiber.dom)
    commitWork(fiber.child)
    commitWork(fiber.sibling)
}

function workLoop(deadline) {
    let shouldYield = false
    while (nextUnitOfWork && !shouldYield) {
        nextUnitOfWork = performUnitOfWork(
            nextUnitOfWork
        )
        shouldYield = deadline.timeRemaining() < 1
        // deadline.timeRemaining() でアイドル時間の残り時間を返す。(ms)
    }

    if (!nextUnitOfWork && wipRoot) {
        commmitRoot()
    }

    requestIdleCallback(workLoop)
}
requestIdleCallback(workLoop)

function performUnitOfWork(fiber) {
    // DOMのノードを新しく作る
    if (!fiber.dom) {
        fiber.dom = createDom(fiber)
    }

    // 次のファイバーを作る
    const elements = fiber.props.children
    let index = 0
    let prevSibling = null

    while (index < elements.length) {
        const element = elements[index]

        const newFiber = {
            type: element.type,
            props: element.props,
            parent: fiber,
            dom: null,
        }

        if (index === 0) {
            fiber.child = newFiber
        } else {
            prevSibling.sibling = newFiber
        }

        prevSibling = newFiber
        index++
    }

    // 次の作業単位を返す
    if (fiber.child) {
        return fiber.child
    }

    let nextFiber = fiber
    while (nextFiber) {
        if (nextFiber.sibling) {
            return nextFiber.sibling
        }
        nextFiber = nextFiber.parent
    }

}