
const Reactoid = {
    createElement,
    render,
    useState
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
    
    updateDom(dom, {}, fiber.props)  
    
    return dom
}

const isEvent = key => key.startsWith("on")
const isProperty = key => key !== "children" && !isEvent(key)
const isNew = (prev, next) => key => prev[key] !== next[key]
const isGone = (prev, next) => key => !(key in next)
function updateDom(dom, prevProps, nextProps) {
    
    // old propertiesを消す
    Object.keys(prevProps)
        .filter(isProperty)
        .filter(isGone(prevProps, nextProps))
        .forEach(name => {
            dom[name] = ""
        })

    // new propertyを付け足す
    Object.keys(nextProps)
       .filter(isProperty)
       .filter(isNew(prevProps, nextProps))
       .forEach(name => {
        dom[name] = nextProps[name]
       })
    
    // old event listner を消す
    Object.keys(prevProps)
        .filter(isEvent)
        .filter(
            key => !(key in nextProps) || isNew(prevProps, nextProps)(key)
        )
        .forEach(name => {
            const eventType = name.toLowerCase().substring(2)
            dom.removeEventListener(eventType, prevProps[name])
        })

    // new event listner を足す
    Object.keys(nextProps)
        .filter(isEvent)
        .filter(isNew(prevProps, nextProps))
        .forEach(name => {
            const eventType = name.toLowerCase().substring(2)
            dom.addEventListener(eventType, nextProps[name])
        })
}

// commitフェーズを実行する関数
function commmitRoot() {
    deletions.forEach(commitWork)
    commitWork(wipRoot.child)
    currentRoot = wipRoot
    wipRoot = null
}

// 再帰的にDomについか
function commitWork(fiber) {
    if (!fiber) {
        return
    }

    let domParentFiber = fiber.parent
    while (!domParentFiber.dom) {
        domParentFiber = domParentFiber.parent
    }
    const domParent = domParentFiber.dom

    if (fiber.effectTag === "PLACEMENT" && fiber.dom != null) {
        domParent.appendChild(fiber.dom)
    } else if (fiber.effectTag === "UPDATE" && fiber.dom != null) {
        updateDom(fiber.dom, fiber.alternate.props, fiber.props)
    } else if (fiber.effectTag === "DELETION") {
        commitDeletion(fiber, domParent)
    }

    commitWork(fiber.child)
    commitWork(fiber.sibling)
}

function commitDeletion(fiber, domParent) {
    if (fiber.dom) {
        domParent.removeChild(fiber.dom)
    } else {
        commitDeletion(fiber.child, domParent)
    }
}

// element(Reactoid要素)をcontainerの要素の下にレンダリングする。
function render(element, container) {
    wipRoot = {
        dom: container,
        props: {
            children: [element],
        },
        alternate: currentRoot,
    }
    deletions = []
    nextUnitOfWork = wipRoot
}

// 今、表示されているDom
let currentRoot = null

// 今、作業中のroot
let wipRoot = null

// 次の作業単位
let nextUnitOfWork = null

// 削除するノードを保管する配列
let deletions = null

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
    // 関数requestIdelCallbackによって、ブラウザがアイドル状態になった時にworkLoopを実行する
    //　つまり、workLoopの最初のwhile文からわかるようにnextUnitOfWorkになにかを設定しておけばアイドル状態になったときに
    // nextUnitOfworkのworkをしてくれる。
}
requestIdleCallback(workLoop)

function performUnitOfWork(fiber) {
    const isFunctionComponent = fiber.type instanceof Function
    if (isFunctionComponent) {
        updateFunctionComponent(fiber)
    } else {
        updateHostComponent(fiber)
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

let wipFiber = null 
let hookIndex = null

function updateFunctionComponent(fiber) {
    wipFiber = fiber
    hookIndex = 0
    wipFiber.hooks = []
    // fiber.typeが関数コンポーネントになっているからそれにpropsを適用してReactoid要素を得る。
    // この関数コンポーネントの中にuseStateが入っているかもしれないから上でwipFiberとかhookIndexなどの初期化をしておく。
    const children = [fiber.type(fiber.props)]
    reconcileChildren(fiber, children)
}

function useState(initial) {
    const oldHook = wipFiber.alternate && wipFiber.alternate.hooks && wipFiber.alternate.hooks[hookIndex]
    const hook = {
        state: oldHook ? oldHook.state : initial,
        queue: [],
    }

    const actions = oldHook ? oldHook.queue : []
    actions.forEach(action => {
        hook.state = action(hook.state)
    })

    const setState = action => {
        hook.queue.push(action)
        wipRoot = {
            dom: currentRoot.dom,
            props: currentRoot.props,
            alternate: currentRoot,
        }
        nextUnitOfWork = wipRoot
        deletions = []
    }

    wipFiber.hooks.push(hook)
    hookIndex++
    return [hook.state, setState]
}


function updateHostComponent(fiber) {
    // DOMのノードを新しく作る
    if (!fiber.dom) {
        fiber.dom = createDom(fiber)
    }

    // 次のファイバーを作る
    const elements = fiber.props.children
    reconcileChildren(fiber, elements)
}

function reconcileChildren(wipFiber, elements) {
    let index = 0
    let oldFiber = wipFiber.alternate && wipFiber.alternate.child
    let prevSibling = null

    while (index < elements.length || oldFiber != null) {
        const element = elements[index]
        let newFiber = null

        const sameType = oldFiber && element && element.type == oldFiber.type

        if (sameType) {
            // 更新
            newFiber = {
                type: oldFiber.type,
                props: element.props,
                dom: oldFiber.dom,
                parent: wipFiber,
                alternate: oldFiber,
                effectTag: "UPDATE",
            }
        }
        if (element && !sameType) {
            // 追加
            newFiber = {
                type: element.type,
                props: element.props,
                dom: null,
                parent: wipFiber,
                alternate: null,
                effectTag: "PLACEMENT",
            }
        }
        if (oldFiber && !sameType) {
            // 削除
            oldFiber.effectTag = "DELETION"
            deletions.push(oldFiber)
        }

        if (oldFiber) {
            oldFiber = oldFiber.sibling
        }

        if (index === 0) {
            wipFiber.child = newFiber
        } else {
            prevSibling.sibling = newFiber
        }

        prevSibling = newFiber
        index++
    }
}
