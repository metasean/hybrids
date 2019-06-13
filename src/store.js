import * as cache from './cache';

const adapters = new WeakMap();
const definitions = new WeakMap();
const pointers = new WeakMap();

const _ = (h, v) => v;
const hasOwnProperty = Object.prototype.hasOwnProperty;

function isPartialEqual(source, target) {
  if (source === target) return true;
  if (!source || !target) return false;

  const keys = Object.keys(source);

  for (let i = 0; i < keys.length; i += 1) {
    const property = keys[i];
    if (property !== 'id' && source[property] !== target[property]) {
      return false;
    }
  }

  return true;
}

function resolveNestedObject(Model, id, values, lastModel) {
  let nestedId;

  if (typeof values !== 'object' || values === null) {
    nestedId = values;
  } else {
    if (hasOwnProperty.call(values, 'id')) {
      nestedId = values.id;
    } else if (lastModel) {
      nestedId = pointers.get(lastModel).id;
    } else {
      nestedId = id;
    }

    // eslint-disable-next-line no-use-before-define
    sync(Model, nestedId, values, lastModel);
  }

  return nestedId;
}

function define(Model) {
  let definition = definitions.get(Model);

  if (!definition) {
    definition = Object.keys(Model).map((key) => {
      const property = Model[key];

      switch (typeof property) {
        case 'function': {
          switch (property) {
            case String:
            case Number:
            case Boolean: {
              return (model, id, values, lastModel) => {
                let value;
                if (hasOwnProperty.call(values, key)) {
                  value = values[key];
                } else {
                  value = lastModel ? lastModel[key] : undefined;
                }
                Object.defineProperty(model, key, {
                  value: value !== undefined ? property(value) : property(),
                  enumerable: true,
                });
              };
            }
            default: {
              return (model) => {
                Object.defineProperty(model, key, {
                  get() { return cache.get(this, key, property); },
                });
              };
            }
          }
        }
        case 'object': {
          if (property === null) {
            throw TypeError(`Unsupported property value for "${key}" key: null`);
          }

          if (Array.isArray(property)) {
            const itemModel = property[0];
            const itemType = typeof itemModel;
            let transform;

            switch (itemType) {
              case 'object':
                if (itemModel === null) {
                  throw TypeError(`Unsupported nested property value for "${key}" key: null`);
                }

                transform = (value, lastValue, id) => value.reduce((acc, item, index) => {
                  const nestedId = resolveNestedObject(
                    itemModel, `${id}.${index}`, item, null,
                  );
                  Object.defineProperty(acc, index, {
                    get: () => cache.get(itemModel, nestedId, _),
                    enumerable: true,
                  });
                  return acc;
                }, []);
                break;
              case 'function':
                transform = value => value.map(v => (v !== undefined ? itemModel(v) : itemModel()));
                break;
              case 'undefined':
                transform = v => v;
                break;
              default:
                throw TypeError(`Unsupported nested property value for "${key}" key: ${itemType}`);
            }

            return (target, id, values, lastModel) => {
              const lastValue = lastModel && lastModel[key];
              let value;
              if (hasOwnProperty.call(values, key) && !isPartialEqual(values[key], lastValue)) {
                if (!Array.isArray(values[key])) {
                  throw TypeError(`Property "${key}" value must be an array: ${typeof values[key]}`);
                }
                value = transform(values[key], lastValue, id);
              } else {
                value = lastValue || [];
              }

              Object.defineProperty(target, key, {
                value: Object.freeze(value),
                enumerable: true,
              });
            };
          }

          return (model, id, values, lastModel) => {
            let nestedId;
            if (isPartialEqual(values[key], lastModel && lastModel[key])) {
              nestedId = pointers.get(lastModel[key]).id;
            } else {
              nestedId = resolveNestedObject(
                property, id, values[key], lastModel && lastModel[key],
              );
            }

            Object.defineProperty(model, key, {
              get: () => cache.get(property, nestedId, _),
              enumerable: true,
            });
          };
        }
        default:
          throw TypeError(`Unsupported property value for "${key}" type: ${typeof Model[key]}`);
      }
    });

    definitions.set(Model, definition);
  }

  return definition;
}

function create(Model, id, values, lastModel) {
  const model = {};
  pointers.set(model, { Model, id });

  define(Model).forEach((fn) => {
    fn(model, id, values, lastModel);
  });

  return Object.freeze(model);
}

const listModels = new WeakMap();
function getListModel(Model) {
  let listModel = listModels.get(Model);
  if (!listModel) {
    listModel = {};
    listModels.set(Model, listModel);
  }
  return listModel;
}

function clearListModelAfterUpdate(Model, id, model) {
  const entries = cache.entries.get(Model);
  const entry = entries && entries.get(id);

  if (model === null || (entry && entry.value === undefined)) {
    cache.set(getListModel(Model), undefined, _, undefined);
  }
}

function sync(Model, id, values, lastModel) {
  if (values === lastModel) return lastModel;

  if (values === null) {
    clearListModelAfterUpdate(Model, id, values);
    cache.set(Model, id, _, values, true);
    return values;
  }

  if (typeof values === 'object') {
    if (values instanceof Promise) {
      values.then((resolvedValues) => {
        if (typeof resolvedValues !== 'object') {
          throw TypeError(`The value must be an object or null: ${typeof resolvedValues}`);
        }

        let model = resolvedValues;
        if (resolvedValues !== null) {
          model = create(Model, id, resolvedValues, lastModel);
        }

        clearListModelAfterUpdate(Model, id, model);
        cache.set(Model, id, _, model);
      });

      return lastModel;
    }

    const model = create(Model, id, values, lastModel);
    clearListModelAfterUpdate(Model, id, model);
    cache.set(Model, id, _, model, true);

    return model;
  }

  throw TypeError(`The value must be an object or null: ${typeof value}`);
}

export function get(Model, id) {
  if (typeof Model !== 'object' || Model === null) {
    throw TypeError(`The first argument must be an object: ${typeof Model}`);
  }

  const normalizedId = id !== undefined ? String(id) : undefined;
  const lastModel = cache.get(Model, normalizedId, _);
  const adapter = adapters.get(Model);
  const value = adapter && adapter.get ? adapter.get(id, lastModel) : undefined;

  if (value === undefined) {
    return lastModel;
  }

  return sync(Model, normalizedId, value, lastModel);
}

export function set(ModelOrInstance, values) {
  if (typeof ModelOrInstance !== 'object' || ModelOrInstance === null) {
    throw TypeError(`The first argument must be an object: ${typeof ModelOrInstance}`);
  }
  if (typeof values !== 'object') {
    throw TypeError(`The value must be an object or null: ${typeof value}`);
  }

  const pointer = pointers.get(ModelOrInstance);
  let Model = ModelOrInstance;
  let id;

  if (pointer) {
    ({ Model, id } = pointer);
  } else {
    id = values && (values.id !== undefined ? String(values.id) : undefined);
  }

  const lastModel = cache.get(Model, id, _);

  if (values === lastModel) return;
  if (lastModel && values) {
    const keys = Object.keys(values);
    let isEqual = true;

    for (let i = 0; i < keys.length; i += 1) {
      const property = keys[i];
      if (property !== 'id' && values[property] !== lastModel[property]) {
        isEqual = false;
        break;
      }
    }
    if (isEqual) return;
  }

  const adapter = adapters.get(Model);
  if (adapter && adapter.set) {
    const model = values && create(Model, id, values, lastModel);
    const result = adapter.set(id, model, lastModel);
    if (result === undefined) {
      clearListModelAfterUpdate(Model, id, model);
      cache.set(Model, id, _, model, true);
    } else {
      sync(Model, id, result, lastModel);
    }
  } else {
    sync(Model, id, values, lastModel);
  }
}

function normalizeId(id) {
  return JSON.stringify(
    Object.keys(id).sort().reduce((acc, key) => {
      if (typeof id[key] === 'object' && id[key] !== null) {
        throw TypeError(`Nested objects are not supported. You must use primitive value for '${key}' key: ${typeof id[key]}`);
      }
      acc[key] = id[key];
      return acc;
    }, {}),
  );
}

function processList(Model, models, lastModels, id) {
  if (!Array.isArray(models)) {
    throw TypeError(`The value must be an array: ${typeof models}`);
  }

  const ListModel = getListModel(Model);

  const processedModels = Object.freeze(
    Object.keys(models).reduce((acc, key, index) => {
      const item = models[key];
      let itemId;

      if (hasOwnProperty.call(item, 'id')) {
        itemId = item.id;
        set(Model, item);
      } else {
        itemId = key;
        set(Model, { ...item, id: key });
      }

      Object.defineProperty(acc, index, {
        get: () => cache.get(Model, itemId, _),
        enumerable: true,
      });

      return acc;
    }, []),
  );

  cache.set(ListModel, id, _, processedModels);
  return processedModels;
}

function syncList(Model, id, models, lastModels) {
  if (models === lastModels) return lastModels;

  if (typeof models === 'object' && models !== null) {
    if (models instanceof Promise) {
      models.then((resolvedModels) => {
        processList(Model, resolvedModels, lastModels, id);
      });

      return lastModels;
    }

    return processList(Model, models, lastModels, id);
  }

  throw TypeError(`The value must be an array or a promise: ${typeof value}`);
}

export function list(Model, parameters) {
  if (typeof Model !== 'object' || Model === null) {
    throw TypeError(`The first argument must be an object: ${typeof Model}`);
  }
  if ((parameters !== undefined && typeof parameters !== 'object') || parameters === null) {
    throw TypeError(`The second argument if defined must be an object: ${typeof parameters}`);
  }

  const adapter = adapters.get(Model);

  if (adapter && !adapter.list) {
    throw TypeError('Connected adapter does not support list method');
  }

  const id = parameters && normalizeId(parameters);
  const entries = cache.entries.get(Model);
  const ListModel = getListModel(Model);

  let globalModels = cache.get(ListModel, undefined, _);

  if (!globalModels) {
    globalModels = [];
    if (entries) {
      let index = 0;
      entries.forEach(({ value, key }) => {
        if (value) {
          Object.defineProperty(globalModels, index, {
            get: () => cache.get(Model, key, _),
            enumerable: true,
          });
          index += 1;
        }
      });
    }
    cache.set(ListModel, undefined, _, globalModels, true);
  }

  const lastModels = id ? cache.get(ListModel, id, _) || [] : globalModels;
  const models = adapter && adapter.list
    ? adapter.list(parameters, lastModels, globalModels)
    : undefined;

  if (models === undefined) {
    return lastModels;
  }

  return syncList(ListModel, id, models, lastModels);
}

const methods = ['get', 'set', 'list'];
export function connect(Model, adapterOrAdapterList) {
  if (typeof Model !== 'object' || Model === null) {
    throw TypeError(`The first argument must be an object: ${typeof Model}`);
  }
  if (adapters.has(Model)) {
    throw Error(`Model "${Model}" already connected to the adapter`);
  }

  adapters.set(
    [].concat(adapterOrAdapterList).reduce((acc, adapter) => {
      methods.forEach((method) => {
        if (adapter[method]) acc[method].push(adapter[method]);
      });

      return acc;
    }, { get: [], set: [], list: [] }),
  );

  return () => adapters.delete(Model);
}
