export function h(tag, props, ...children) {
  const node = document.createElement(tag);
  let deferredValue;
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') {
      for (const [dataKey, dataValue] of Object.entries(value)) node.dataset[dataKey] = dataValue;
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'value') deferredValue = value;
    else if (key === 'checked' || key === 'selected') node[key] = true;
    else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat()) append(node, child);
  if (deferredValue != null && 'value' in node) node.value = deferredValue;
  return node;
}

export function append(node, child) {
  if (child == null || child === false) return;
  if (child instanceof Node) node.append(child);
  else node.append(document.createTextNode(String(child)));
}

export function clear(node) {
  node.replaceChildren();
}
