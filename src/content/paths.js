// Small helpers for reading/writing nested content by a dotted path like
// "sections.3.items.0.title", plus applying the AI assistant's edit operations.

const toKey = (part) => (/^\d+$/.test(part) ? Number(part) : part);
export const splitPath = (path) => (path === '' ? [] : String(path).split('.').map(toKey));

export const getAt = (obj, path) =>
  splitPath(path).reduce((cur, k) => (cur == null ? undefined : cur[k]), obj);

// Immutable set: returns a new object with the value replaced.
export const setAt = (obj, path, value) => {
  const parts = splitPath(path);
  if (parts.length === 0) return value;
  const [head, ...rest] = parts;
  const base = Array.isArray(obj) ? [...obj] : { ...(obj || {}) };
  base[head] = rest.length ? setAt(obj?.[head], rest.join('.'), value) : value;
  return base;
};

const updateArrayAt = (obj, path, fn) => {
  const arr = getAt(obj, path);
  if (!Array.isArray(arr)) throw new Error(`"${path}" is not a list`);
  return setAt(obj, path, fn([...arr]));
};

export const insertAt = (obj, path, index, value) =>
  updateArrayAt(obj, path, (arr) => {
    const i = index < 0 || index > arr.length ? arr.length : index;
    arr.splice(i, 0, value);
    return arr;
  });

export const removeAt = (obj, path) => {
  const parts = splitPath(path);
  const last = parts.pop();
  const parentPath = parts.join('.');
  const parent = getAt(obj, parentPath);
  if (Array.isArray(parent)) {
    if (typeof last !== 'number' || last >= parent.length) throw new Error(`Nothing at "${path}"`);
    return updateArrayAt(obj, parentPath, (arr) => { arr.splice(last, 1); return arr; });
  }
  if (parent && typeof parent === 'object') {
    const copy = { ...parent };
    delete copy[last];
    return setAt(obj, parentPath, copy);
  }
  throw new Error(`Nothing at "${path}"`);
};

export const moveAt = (obj, path, toIndex) => {
  const parts = splitPath(path);
  const from = parts.pop();
  const parentPath = parts.join('.');
  return updateArrayAt(obj, parentPath, (arr) => {
    if (typeof from !== 'number' || from >= arr.length) throw new Error(`Nothing at "${path}"`);
    const [item] = arr.splice(from, 1);
    arr.splice(Math.max(0, Math.min(toIndex, arr.length)), 0, item);
    return arr;
  });
};

// Operations come from the AI assistant: { op, path, value_json, to_index }.
export const applyOperations = (content, operations) => {
  let next = content;
  for (const op of operations) {
    const value = op.value_json ? JSON.parse(op.value_json) : undefined;
    if (op.op === 'set') {
      const parent = splitPath(op.path).slice(0, -1).join('.');
      if (parent && getAt(next, parent) == null) throw new Error(`Can't find "${parent}"`);
      next = setAt(next, op.path, value);
    } else if (op.op === 'insert') next = insertAt(next, op.path, op.to_index ?? -1, value);
    else if (op.op === 'remove') next = removeAt(next, op.path);
    else if (op.op === 'move') next = moveAt(next, op.path, op.to_index);
    else throw new Error(`Unknown operation "${op.op}"`);
  }
  return next;
};

// Firestore rejects `undefined`; strip it (and anything non-JSON) before saving.
export const toPlain = (obj) => JSON.parse(JSON.stringify(obj));
