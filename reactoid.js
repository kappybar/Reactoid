
const Reactoid = {
    createElement,
    render,
}

// typeとpropsとchildrenを受け取ってteact要素を作成する関数
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

// element(Reactoid要素)をcontainerの要素の下にレンダリングする。
function render(element, container) {
    const dom = 
      element.type === "TEXT_ELEMENT" 
        ? document.createTextNode("")
        : document.createElement(element.type)
    
    const isProperty = key => key !== "children"
    Object.keys(element.props)
      .filter(isProperty)
      .forEach(name => {
        dom[name] = element.props[name]
      })    

    element.props.children.forEach(child =>
        render(child, dom)    
    )

    container.appendChild(dom)
}

